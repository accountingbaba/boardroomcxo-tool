/**
 * POST /api/image
 * multipart/form-data fields:
 *   photo       — reference photo file (jpeg/png)
 *   post_text   — the finalised LinkedIn post text
 *   headline    — Line 1 headline text
 *   accent_word — word/phrase to accent in orange
 *   subject_line — Line 2 supporting line (name + title)
 *   post_id     — (optional) DB post ID to link image to
 *
 * Returns: {
 *   image_url,         — base64 data URL of best image
 *   attempt,           — 1 | 2 | 3
 *   quality_score,     — out of 100
 *   quality_report,    — object with each check result
 *   dalle_prompt,      — the prompt used for the final attempt
 *   limitations_notice — string
 * }
 */

const LIMITATIONS_NOTICE = `Note: DALL-E 3 generates images from text descriptions. The subject's face in this image is based on GPT-4o's analysis of your reference photo — it will be close but will not be pixel-perfect. Always compare the generated image against your reference photo before publishing. Both logo zones are reserved as clean placeholders and must be composited manually using Canva, Figma, or any design tool. This takes approximately 5 to 10 minutes.`;

const DEFAULT_IMAGE_INSTRUCTIONS = `Photorealistic editorial portrait photograph. 4:5 portrait format. LinkedIn social media post image.

MANDATORY SUBJECT RENDERING RULES:
- Natural imperfect skin — pores visible, subtle lines present, natural uneven light falloff across face and neck
- Real fabric texture on clothing — suit grain, shirt collar weight, button detail, fabric drape
- Natural facial asymmetry — human faces are not symmetrical, do not symmetrise
- No skin smoothing of any kind. No AI beautification. No idealisation of any feature.
- The face must look like a real photograph of this specific person — photorealistic, not rendered, not illustrated

COMPOSITION:
- Single subject, positioned centre-frame or slightly left of centre
- Three-quarter body visible, from mid-shin upward
- Clean negative space on the right mid-frame reserved for logo placement
- No decorative fills, background elements, or props

LIGHTING AND SHADOW:
- One dominant directional studio light, soft and natural, coming from slightly above and to one side
- Realistic shadow falling on one side of the face
- Shallow depth of field — subject in sharp focus, background softly blurred
- A subtle natural directional shadow behind the subject falling onto the background — soft-edged, photographic, not a digital drop shadow
- Shadow opacity: subtle — present and visible but never dramatic or heavy

BACKGROUND:
- Deep charcoal-to-warm-grey gradient background
- Darker at edges, slightly lighter directly behind the subject
- Soft natural bokeh blur throughout
- No textures, no patterns, no props, no environmental elements
- Clean professional studio backdrop

TEXT AREA — bottom 20-22% of image:
- Natural darkening of the background to near-black at the bottom — not a coloured panel placed on top
- No drop shadows on any text. No outlined fonts. No decorative elements. High contrast, restrained, editorial.
- The text area must feel like Fortune India, The Ken, or Bloomberg Businessweek — not a social media graphic.

LOGO PLACEHOLDER ZONES:
- Top-right corner: clean empty rectangle of dark charcoal — small, unobtrusive — reserved for logo compositing
- Right mid-frame: clean neutral card zone with slightly rounded corners — reserved for brand logo compositing — clear of subject's face within the negative space

OVERALL FEEL:
- Editorial photography aesthetic — The Ken meets Bloomberg Businessweek
- Real. Human. Credible. Authoritative.
- Must feel like it was shot by a professional editorial photographer and laid out by a senior art director at a premium business publication
- Premium and understated — earns attention because it looks important and credible, not because it is loud
- Photorealistic, not illustrated, not rendered, not AI-looking
- No flat lighting. No over-processed look. No glowing edges. No hyper-sharpened outlines. No plastic skin. No AI artifacts.`;

export async function onRequestPost(context) {
  const { request, env } = context;

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: 'Expected multipart/form-data' }, 400);
  }

  const photoFile = formData.get('photo');
  const postText = formData.get('post_text') || '';
  const headline = formData.get('headline') || '';
  const accentWord = formData.get('accent_word') || '';
  const subjectLine = formData.get('subject_line') || '';
  const postId = formData.get('post_id') || null;

  if (!photoFile) return json({ error: 'Reference photo required' }, 400);
  if (!headline) return json({ error: 'Headline text required' }, 400);

  // Convert uploaded file to base64 for GPT-4o Vision
  const photoBuffer = await photoFile.arrayBuffer();
  const photoBase64 = arrayBufferToBase64(photoBuffer);
  const photoMime = photoFile.type || 'image/jpeg';

  try {
    // Stage 1: Analyse reference photo with GPT-4o Vision
    const subjectDescription = await analysePhoto(env, photoBase64, photoMime);

    // Load the custom image prompt from DB settings, or use the bundled default
    const customInstructions = await loadSetting(env, 'prompt_image');

    // Up to 3 generation attempts
    let bestResult = null;
    let bestScore = 0;

    for (let attempt = 1; attempt <= 3; attempt++) {
      // Stage 2: Build DALL-E prompt and generate image
      const dallePrompt = buildDallePrompt(customInstructions, subjectDescription, headline, accentWord, subjectLine, attempt, bestResult?.qualityReport);
      const imageB64 = await generateImage(env, dallePrompt);

      // Stage 3: Quality check with GPT-4o Vision
      const { score, report } = await qualityCheck(env, imageB64, photoBase64, photoMime);

      if (!bestResult || score > bestScore) {
        bestScore = score;
        bestResult = { imageB64, score, report, dallePrompt, attempt };
      }

      // Deliver if above threshold
      if (score >= 85) break;
      // Continue to next attempt if not final
      if (attempt === 3) break;
    }

    // Save image reference to DB if post_id provided
    if (postId) {
      try {
        await env.DB.prepare(
          'UPDATE posts SET image_prompt = ?, status = ? WHERE id = ?'
        ).bind(bestResult.dallePrompt, 'draft', postId).run();
      } catch { /* non-fatal */ }
    }

    return json({
      image_url: `data:image/png;base64,${bestResult.imageB64}`,
      attempt: bestResult.attempt,
      quality_score: bestResult.score,
      quality_report: bestResult.report,
      dalle_prompt: bestResult.dallePrompt,
      limitations_notice: LIMITATIONS_NOTICE,
    });

  } catch (err) {
    return json({ error: 'Image pipeline failed', detail: err.message }, 500);
  }
}

/* ── STAGE 1: GPT-4o Vision — Analyse Reference Photo ───────── */

async function analysePhoto(env, photoBase64, mimeType) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1200,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are analysing a reference photograph to extract a precise visual description for use in generating an editorial image via DALL-E 3. Your output must be factual, specific, and detailed. Do not interpret, idealise, or editorially describe — describe exactly what you see.

Extract and document the following in a structured block labelled SUBJECT DESCRIPTION — GROUND TRUTH:

FACE:
- Overall face shape (oval, square, round, angular, etc.)
- Forehead width and height
- Eye shape, size, placement, colour, and distinguishing features (hooded lids, strong brow, etc.)
- Nose shape: bridge width, tip shape, nostrils
- Lip shape: upper lip definition, lower lip fullness, mouth width
- Chin shape and prominence
- Jawline: soft, defined, angular, rounded
- Cheekbone prominence
- Skin tone: warm/cool/neutral undertone, depth (light/medium/medium-deep/deep), surface quality
- Distinguishing marks: moles, scars, facial hair, stubble pattern

HAIR:
- Hairline shape
- Hair colour: base colour, highlights, grey distribution
- Hair texture: straight, wavy, curly, coily
- Hair style: length, volume, parting, cut

EXPRESSION:
- Exact expression in the reference photo
- Eye direction: camera-facing, slightly off-axis, etc.

CLOTHING:
- Type of garment(s) visible
- Colour and pattern
- Collar type and fit
- Visible accessories

GLASSES (if present):
- Frame shape, colour, material
- Lens tint

BUILD AND POSTURE:
- Build: slim, medium, broad
- Shoulder width
- Posture: upright, relaxed, commanding

Output only the SUBJECT DESCRIPTION block. No additional commentary.`
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${photoBase64}`, detail: 'high' }
            }
          ]
        }
      ]
    }),
  });

  if (!res.ok) throw new Error(`GPT-4o Vision error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/* ── STAGE 2: Build DALL-E Prompt ───────────────────────────── */

function buildDallePrompt(subjectDescription, headline, accentWord, subjectLine, attempt, prevReport) {
  // On retry attempts, add refinements based on what failed
  let refinements = '';
  if (attempt > 1 && prevReport) {
    const failed = Object.entries(prevReport)
      .filter(([, v]) => v?.status === 'Fail')
      .map(([k]) => k);
    if (failed.includes('face_match')) {
      refinements += ' CRITICAL: The face MUST match the described bone structure, skin tone, and hair exactly. Photorealistic — not illustrated.';
    }
    if (failed.includes('skin_realism')) {
      refinements += ' The skin MUST show natural pores, subtle lines, and uneven light falloff. No smoothing, no beautification, no AI skin processing.';
    }
    if (failed.includes('background_quality')) {
      refinements += ' Background must be a pure deep charcoal-to-warm-grey gradient. No props, no environment, no textures.';
    }
    if (failed.includes('text_area')) {
      refinements += ' The bottom 20% must darken naturally to near-black for text overlay. No coloured panel.';
    }
  }

  return `Photorealistic editorial portrait photograph. 4:5 portrait format. LinkedIn social media post image.

SUBJECT: ${subjectDescription}

MANDATORY SUBJECT RENDERING RULES:
- Natural imperfect skin — pores visible, subtle lines present, natural uneven light falloff across face and neck
- Real fabric texture on clothing — suit grain, shirt collar weight, button detail, fabric drape
- Natural facial asymmetry — human faces are not symmetrical, do not symmetrise
- No skin smoothing of any kind. No AI beautification. No idealisation of any feature.
- The face must look like a real photograph of this specific person — photorealistic, not rendered, not illustrated

COMPOSITION:
- Single subject, positioned centre-frame or slightly left of centre
- Three-quarter body visible, from mid-shin upward
- Clean negative space on the right mid-frame reserved for logo placement
- No decorative fills, background elements, or props

LIGHTING AND SHADOW:
- One dominant directional studio light, soft and natural, coming from slightly above and to one side
- Realistic shadow falling on one side of the face
- Shallow depth of field — subject in sharp focus, background softly blurred
- A subtle natural directional shadow behind the subject falling onto the background — soft-edged, photographic, not a digital drop shadow
- Shadow opacity: subtle — present and visible but never dramatic or heavy

BACKGROUND:
- Deep charcoal-to-warm-grey gradient background
- Darker at edges, slightly lighter directly behind the subject
- Soft natural bokeh blur throughout
- No textures, no patterns, no props, no environmental elements
- Clean professional studio backdrop

TEXT AREA — bottom 20-22% of image:
- Natural darkening of the background to near-black at the bottom — not a coloured panel placed on top
- Line 1 (large, dominant, Inter ExtraBold or Montserrat ExtraBold): "${headline}" — the word "${accentWord}" in bold orange (#FF6B00), all other text in white
- Line 2 (same font family, Regular weight, noticeably smaller, white): "${subjectLine}"
- Line 3 (same font family, Light weight, very small, white at 60-70% opacity): "Follow @boardroomcxo for more insights."
- No drop shadows on any text. No outlined fonts. No decorative elements. High contrast, restrained, editorial.
- The text area must feel like Fortune India, The Ken, or Bloomberg Businessweek — not a social media graphic.

LOGO PLACEHOLDER ZONES:
- Top-right corner: clean empty rectangle of dark charcoal — small, unobtrusive — reserved for logo compositing
- Right mid-frame: clean neutral card zone with slightly rounded corners — reserved for brand logo compositing — clear of subject's face within the negative space

OVERALL FEEL:
- Editorial photography aesthetic — The Ken meets Bloomberg Businessweek
- Real. Human. Credible. Authoritative.
- Must feel like it was shot by a professional editorial photographer and laid out by a senior art director at a premium business publication
- Premium and understated — earns attention because it looks important and credible, not because it is loud
- Photorealistic, not illustrated, not rendered, not AI-looking
- No flat lighting. No over-processed look. No glowing edges. No hyper-sharpened outlines. No plastic skin. No AI artifacts.${refinements}`;
}

/* ── STAGE 2: Generate Image with DALL-E 3 ───────────────────── */

async function generateImage(env, prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1536',  // portrait — 2:3 closest to 4:5 for gpt-image-1
      quality: 'high',
      output_format: 'png',
    }),
  });

  if (!res.ok) throw new Error(`Image generation error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  // gpt-image-1 returns b64_json directly
  const b64 = data.data?.[0]?.b64_json || '';
  if (!b64) throw new Error('No image data returned');
  return b64;
}

/* ── STAGE 3: GPT-4o Vision Quality Check ────────────────────── */

async function qualityCheck(env, generatedImageB64, referencePhotoB64, photoMime) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are reviewing a DALL-E 3 generated image (IMAGE 1) against a reference photograph (IMAGE 2) of the subject and against editorial brand standards. Score each criterion strictly. The standard is editorial photography for a premium business publication, not social media content.

Score each check. Return ONLY valid JSON — no markdown, no explanation outside the JSON.

{
  "score": 0,
  "checks": {
    "face_match": { "status": "Pass|Fail", "points": 0, "max": 25, "note": "one line" },
    "skin_realism": { "status": "Pass|Fail", "points": 0, "max": 15, "note": "one line" },
    "shadow_depth": { "status": "Pass|Fail", "points": 0, "max": 10, "note": "one line" },
    "clothing_accuracy": { "status": "Pass|Fail", "points": 0, "max": 10, "note": "one line" },
    "background_quality": { "status": "Pass|Fail", "points": 0, "max": 10, "note": "one line" },
    "lighting_quality": { "status": "Pass|Fail", "points": 0, "max": 10, "note": "one line" },
    "text_area": { "status": "Pass|Fail", "points": 0, "max": 10, "note": "one line" },
    "logo_placeholder_zones": { "status": "Pass|Fail", "points": 0, "max": 5, "note": "one line" },
    "overall_editorial_feel": { "status": "Pass|Fail", "points": 0, "max": 5, "note": "one line" }
  }
}

Scoring guide:
- face_match (25pts): Face resembles reference photo — similar bone structure, skin tone, hair, expression
- skin_realism (15pts): Natural pores, subtle lines, natural asymmetry — no smoothing, no AI beautification
- shadow_depth (10pts): Subtle natural directional shadow behind subject, soft-edged, photographic
- clothing_accuracy (10pts): Clothing colour, type, texture consistent with reference
- background_quality (10pts): Deep charcoal-to-warm-grey gradient, clean, no props
- lighting_quality (10pts): One dominant directional studio light, natural, realistic face shadow
- text_area (10pts): Bottom text fade present, editorial feel, no coloured banners
- logo_placeholder_zones (5pts): Both placeholder zones clean and clearly reserved
- overall_editorial_feel (5pts): Feels like editorial photography, not AI-generated content

Set "score" to the sum of all points earned.`
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${generatedImageB64}`, detail: 'high' }
            },
            {
              type: 'image_url',
              image_url: { url: `data:${photoMime};base64,${referencePhotoB64}`, detail: 'high' }
            }
          ]
        }
      ]
    }),
  });

  if (!res.ok) throw new Error(`GPT-4o QC error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '{}';

  try {
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const parsed = JSON.parse(clean);
    return { score: parsed.score || 0, report: parsed.checks || {} };
  } catch {
    return { score: 0, report: {} };
  }
}

/* ── HELPERS ─────────────────────────────────────────────────── */

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
