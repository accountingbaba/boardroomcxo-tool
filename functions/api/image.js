/**
 * POST /api/image
 * multipart/form-data fields:
 *   photo       — reference photo file (jpeg/png)
 *   post_text   — the finalised LinkedIn post text
 *   headline    — single-line headline text
 *   accent_word — word/phrase to accent in orange
 *   profile     — 'boardroomcxo' | 'ketul' — selects the footer tag line
 *   post_id     — (optional) DB post ID to link the prompt to
 *
 * This endpoint does not generate an image and does not call OpenAI. It runs
 * a single Claude Vision pass over the reference photo to extract a precise
 * ground-truth description, then assembles that into a ChatGPT-ready image
 * prompt. The user copies the prompt and pastes it into ChatGPT themselves,
 * alongside the same reference photo(s) and any brand logo file(s), and
 * generates the image there.
 *
 * Returns: {
 *   image_prompt,        — the ChatGPT-ready prompt text
 *   subject_description, — Claude Vision extracted ground-truth description
 *   limitations_notice   — string
 * }
 */

const LIMITATIONS_NOTICE = `This tool builds the image prompt only — it does not generate the image. Copy the prompt below and paste it into ChatGPT along with the same reference photo(s) and any brand logo file(s), then let ChatGPT generate the image directly.`;

const DEFAULT_IMAGE_INSTRUCTIONS = `This image must be built using the attached files only. Every person's photo is the absolute ground truth — their face, skin, expression, and clothing must be reproduced with complete photographic accuracy, without distorting or altering any facial features. Each person should look natural and humanised. Any brand logo file(s) provided are to be used exactly as attached. Under no circumstance should any face, logo, or text element be distorted, redrawn, reinterpreted, or generated from memory. If you cannot reproduce every face or logo with complete accuracy, do not generate the image.

Photorealistic editorial portrait photograph. 4:5 portrait format. LinkedIn social media post image. Aesthetic target: The Ken meets Fortune India meets Bloomberg Businessweek — premium, understated, authoritative. Never a recruitment-post or corporate-graphic look. No decorative fills, no background elements, no creative liberties — everything in frame must have a reason.

COMPOSITION — single subject:
- Centred or slightly left of centre, three-quarter body visible, from mid-shin upward
- Clean negative space on the right mid-frame reserved for logo placement

COMPOSITION — multiple subjects (when more than one reference photo is provided):
- Compose for exactly the number of people provided — never invent or merge subjects
- Two people: three-quarter body visible, standing at a natural conversational distance, roughly symmetrical or slightly left-weighted, each preserving their own photographed angle rather than forced to face camera
- Three or more: natural single-row editorial group (slight depth stagger reads as authentic), all faces at comparable scale, none cropped or crowded
- If one person is clearly the primary subject of the story, they may sit marginally larger, more central, or sharper, without reducing the accuracy of the others
- Lighting and shadow treatment must be even and consistent across every subject — no one person more "studio-lit" than another
- Preserve clean negative space for logo placement without subjects crowding it

MANDATORY SUBJECT RENDERING RULES — applies independently to every subject in frame:
- Natural imperfect skin — pores visible, subtle lines present, natural uneven light falloff across face and neck
- Real fabric texture on clothing — suit grain, shirt collar weight, button detail, fabric drape
- Natural facial asymmetry — human faces are not symmetrical, do not symmetrise
- No skin smoothing of any kind. No AI beautification. No idealisation of any feature. Applies to every subject, no averaging or leniency because more than one is in frame.
- The face must look like a real photograph of this specific person — photorealistic, not rendered, not illustrated
- Professional standing pose, face(s) toward camera unless the reference photo shows otherwise

LIGHTING AND SHADOW:
- One dominant directional studio light, soft and natural, coming from slightly above and to one side
- Realistic shadow falling on one side of each face
- Shallow depth of field — subject(s) in sharp focus, background softly blurred
- A subtle natural directional shadow behind the subject(s) falling onto the background — soft-edged, photographic, matching the dominant light source and consistent across all subjects, not a digital drop shadow
- Shadow opacity: subtle — present and visible but never dramatic or heavy

BACKGROUND:
- Deep charcoal-to-warm-grey gradient background
- Darker at edges, slightly lighter directly behind the subject(s)
- Soft natural bokeh blur throughout
- No textures, no patterns, no props, no environmental elements
- Clean professional studio backdrop

TEXT AREA — bottom 20-22% of image:
- Natural darkening of the background to near-black at the bottom — not a coloured panel placed on top
- Clear size hierarchy across text lines — headline dominant, supporting line secondary, footer line smallest and quietest
- No drop shadows on any text. No outlined fonts. No decorative elements. No gradients on text. High contrast, restrained, editorial.
- The text area must feel like Fortune India, The Ken, or Bloomberg Businessweek — not a social media graphic.

LOGO HANDLING — strict, pixel-accurate reproduction only:
- Use only the logo file(s) provided, exactly as given — never redrawn, recoloured, or reinterpreted from memory
- Single logo: place in the right mid-frame, clear of every subject's face and clear of the bottom text zone
- Multiple logos: choose the grouping the story actually justifies — equal-weight side by side or stacked for sibling/co-founded brands, a subtle "×" or thin divider for an acquirer/acquired pairing, a marginally larger parent mark for a parent/sub-brand pairing. Whatever is chosen, keep consistent sizing logic, consistent padding, and clean alignment
- Never paste a logo as a hard rectangular block or flat solid-colour card against the gradient background — no visible seams or mismatched colour boxes. Extract the mark or wordmark itself and blend its edges into the charcoal-to-warm-grey backdrop as though embossed or printed directly onto it
- If a logo's native background is white or black and essential to its identity, feather only the immediate edge into the surrounding tone — never alter the logo's own letterforms, icon shapes, or colours
- If a logo file has a transparent background, place it directly on the existing dark background with no additional panel, card, or shade added behind it
- If a logo cannot be blended cleanly without distorting its content, leave a clean labelled placeholder zone for that logo instead of forcing a hard-edged box — this must not block correct placement of any other logos
- If no brand logo applies to this post, leave the zone empty — never invent or substitute anything

LOGO PLACEHOLDER ZONES:
- Bottom corner watermark zone: very small, subtle, low-contrast — reserved for the BoardroomCXO watermark only. Must read as a discreet credit mark, never competing with the subject(s) or the featured brand.
- Right mid-frame or top-right (prominent): reserved for the featured brand's own logo(s), following the multi-logo grouping rules above. This is the dominant logo zone and must clearly outweigh the BoardroomCXO watermark in size and visual prominence.

OVERALL FEEL:
- Editorial photography aesthetic — The Ken meets Bloomberg Businessweek
- Real. Human. Credible. Authoritative.
- Must feel like it was shot by a professional editorial photographer and laid out by a senior art director at a premium business publication
- Premium and understated — earns attention because it looks important and credible, not because it is loud
- Photorealistic, not illustrated, not rendered, not AI-looking
- No flat lighting. No over-processed look. No glowing edges. No hyper-sharpened outlines. No plastic skin. No AI artifacts.

SELF-CHECK BEFORE DELIVERING — regenerate if any fail:
- Every face matches its reference photo exactly, with no distorted or altered features
- No face looks AI-generated, over-smoothed, over-symmetrical, or "too perfect"
- Every subject, if more than one, is reproduced with full individual accuracy — none simplified or generalised because others are present
- A subtle natural shadow is visible behind the subject(s), adding depth
- Every logo used is pixel-accurate to the file provided, correctly aligned, evenly sized or intentionally hierarchised for a clear story reason, and never appears as a hard-edged rectangular block against the background
- Any transparent-background logo sits directly on the existing dark background with no extra panel or card added
- Nothing has been added to the frame that was not specified`;

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
  const postId = formData.get('post_id') || null;
  const profile = formData.get('profile') || 'boardroomcxo';

  if (!photoFile) return json({ error: 'Reference photo required' }, 400);
  if (!headline) return json({ error: 'Headline text required' }, 400);

  // Convert uploaded file to base64 for Claude Vision
  const photoBuffer = await photoFile.arrayBuffer();
  const photoBase64 = arrayBufferToBase64(photoBuffer);
  const photoMime = photoFile.type || 'image/jpeg';

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const emit = (event) => writer.write(encoder.encode(JSON.stringify(event) + '\n'));

  const pipeline = (async () => {
    try {
      // Stage 1: Analyse reference photo with Claude Vision
      await emit({ stage: 'analyse_photo', status: 'start' });
      const subjectDescription = await analysePhoto(env, photoBase64, photoMime);
      await emit({ stage: 'analyse_photo', status: 'done' });

      // Load the custom image prompt from DB settings, or use the bundled default
      const customInstructions = await loadSetting(env, 'prompt_image');

      // Stage 2: Assemble the ChatGPT-ready image prompt — no image API call
      await emit({ stage: 'build_prompt', status: 'start' });
      const imagePrompt = buildImagePrompt(customInstructions, subjectDescription, headline, accentWord, profile);
      await emit({ stage: 'build_prompt', status: 'done' });

      // Save prompt to DB if post_id provided
      if (postId) {
        try {
          await env.DB.prepare(
            'UPDATE posts SET image_prompt = ?, status = ? WHERE id = ?'
          ).bind(imagePrompt, 'draft', postId).run();
        } catch { /* non-fatal */ }
      }

      await emit({
        stage: 'complete',
        result: {
          image_prompt: imagePrompt,
          subject_description: subjectDescription,
          limitations_notice: LIMITATIONS_NOTICE,
        },
      });
    } catch (err) {
      await emit({ stage: 'error', message: err.message });
    } finally {
      await writer.close();
    }
  })();

  context.waitUntil(pipeline);

  return new Response(readable, {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

/* ── STAGE 1: Claude Vision — Analyse Reference Photo ────────── */

async function analysePhoto(env, photoBase64, mimeType) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: photoBase64 }
            },
            {
              type: 'text',
              text: `You are analysing a reference photograph to extract a precise visual description for use in an editorial image prompt that will be handed to a human, who will paste it into ChatGPT along with this same photo. Your output must be factual, specific, and detailed. Do not interpret, idealise, or editorially describe — describe exactly what you see.

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
            }
          ]
        }
      ]
    }),
  });

  if (!res.ok) throw new Error(`Claude Vision error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

/* ── STAGE 2: Build ChatGPT-ready Image Prompt ───────────────── */

const FOOTER_TAG_BY_PROFILE = {
  boardroomcxo: 'Follow @boardroomcxo for more insights.',
  ketul: 'Follow CA Ketul Patel for more insights.',
};

function buildImagePrompt(customInstructions, subjectDescription, headline, accentWord, profile) {
  const instructions = (customInstructions && customInstructions.trim()) || DEFAULT_IMAGE_INSTRUCTIONS;
  const footerTag = FOOTER_TAG_BY_PROFILE[profile] || FOOTER_TAG_BY_PROFILE.boardroomcxo;

  return `${instructions}

SUBJECT: ${subjectDescription}

TEXT OVERLAY CONTENT — bottom 20-22% of image:
- Line 1 (large, dominant, Inter ExtraBold or Montserrat ExtraBold): "${headline}" — the word "${accentWord}" in bold orange (#FF6B00), all other text in white. This must render as ONE single line — no wrapping, no second line, no subline of any kind.
- Line 2 (same font family, Light weight, very small, white at 60-70% opacity): "${footerTag}"`;
}

/* ── HELPERS ─────────────────────────────────────────────────── */

async function loadSetting(env, key) {
  try {
    const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
    return row?.value || null;
  } catch {
    return null;
  }
}

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
