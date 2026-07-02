/**
 * POST /api/image
 * Body (JSON):
 *   headline    — single-line headline text
 *   accent_word — word/phrase to accent in orange
 *   profile     — 'boardroomcxo' | 'ketul' — selects the footer tag line
 *   post_text   — (optional) the finalised LinkedIn post text, for context only
 *   post_id     — (optional) DB post ID to link the prompt to
 *
 * This endpoint does not generate an image, does not call any LLM, and does
 * not require a photo upload. It assembles a ChatGPT-ready image prompt from
 * the saved image-prompt instructions (Prompts settings panel) plus the
 * headline. The user copies the prompt and pastes it into ChatGPT themselves,
 * attaching their own reference photo(s) and any brand logo file(s) there,
 * and generates the image in ChatGPT directly.
 *
 * Returns: { image_prompt, limitations_notice }
 */

const LIMITATIONS_NOTICE = `This tool builds the image prompt only — it does not generate the image. Copy the prompt below and paste it into ChatGPT along with your reference photo(s) and any brand logo file(s), then let ChatGPT generate the image directly.`;

const DEFAULT_IMAGE_INSTRUCTIONS = `Build this image using only the attached reference photo(s) and logo file(s). Faces are ground truth — reproduce them faithfully (skin tone, features, expression, clothing) without inventing or beautifying anything. Preserve each subject's exact pose, stance, head angle, and crop/zoom level exactly as shown in their own reference photo — extend only the background around them, never restage or resize the person.

Format: 4:5 portrait, LinkedIn-optimised. Photorealistic editorial photograph — Bloomberg Businessweek / The Ken / Fortune India aesthetic, premium and understated. No props, no invented background elements.

COMPOSITION: Subject(s) centred or slightly left, with clean negative space on the right mid-frame for logo placement. For more than one subject, compose for exactly the number of people provided and keep each person's own pose and scale from their reference photo — a natural single-row editorial group, comparable scale, no one restaged to face camera or match another's pose.

SUBJECT RENDERING: Natural imperfect skin (visible pores, subtle asymmetry, no smoothing or idealising). Real fabric texture on clothing. One soft directional studio light with a realistic shadow on the face, and a subtle soft-edged photographic shadow behind the subject(s) onto the background — not a flat digital drop shadow.

BACKGROUND: Deep charcoal-to-warm-grey gradient, darker at the edges, soft natural bokeh, no textures, patterns, or props.

LOGOS: Use only the attached logo file(s), pixel-accurate, never redrawn or recoloured. Strip away any background panel/box from the logo file itself and place the mark directly on the image's own dark background, blended cleanly with no visible rectangle or colour card. The featured brand's logo(s) sit in the right mid-frame as the dominant mark; the BoardroomCXO watermark stays small and subtle in a corner. If a logo can't be extracted cleanly, leave an empty placeholder zone rather than forcing a hard edge. If no logo applies, leave the zone empty.

OVERALL FEEL: Real, human, credible, authoritative — shot by a professional editorial photographer, not AI-generated, not a corporate or recruitment graphic.`;

const FOOTER_TAG_BY_PROFILE = {
  boardroomcxo: 'Follow @boardroomcxo for more insights.',
  ketul: 'Follow CA Ketul Patel for more insights.',
};

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Expected JSON body' }, 400);
  }

  const headline = (body.headline || '').trim();
  const accentWord = (body.accent_word || '').trim();
  const profile = body.profile || 'boardroomcxo';
  const postId = body.post_id || null;

  if (!headline) return json({ error: 'Headline text required' }, 400);

  const customInstructions = await loadSetting(env, 'prompt_image');
  const imagePrompt = buildImagePrompt(customInstructions, headline, accentWord, profile);

  if (postId) {
    try {
      await env.DB.prepare(
        'UPDATE posts SET image_prompt = ?, status = ? WHERE id = ?'
      ).bind(imagePrompt, 'draft', postId).run();
    } catch { /* non-fatal */ }
  }

  return json({ image_prompt: imagePrompt, limitations_notice: LIMITATIONS_NOTICE });
}

function buildImagePrompt(customInstructions, headline, accentWord, profile) {
  const instructions = (customInstructions && customInstructions.trim()) || DEFAULT_IMAGE_INSTRUCTIONS;
  const footerTag = FOOTER_TAG_BY_PROFILE[profile] || FOOTER_TAG_BY_PROFILE.boardroomcxo;

  const textOverlaySpec = `- Line 1 (large, dominant, Inter ExtraBold or Montserrat ExtraBold): "${headline}" — the word "${accentWord}" in bold orange (#FF6B00), all other text in white. This must render as ONE single line — no wrapping, no second line, no subline of any kind.
- Line 2 (same font family, Light weight, very small, white at 60-70% opacity): "${footerTag}"`;

  return `MANDATORY TEXT TO RENDER ONTO THE IMAGE — read this before anything else below, it is the single most important requirement in this prompt:
This image is incomplete and must not be delivered without this exact text physically rendered as real typography in the bottom 20-22% of the frame, baked directly into the picture (not described in words, not left blank, not replaced with a placeholder):
${textOverlaySpec}
If the headline text is long, shrink the font size to fit it on one line rather than wrapping it, dropping it, or omitting it.

${instructions}

TEXT OVERLAY CONTENT — bottom 20-22% of image (repeated here for emphasis — same requirement as above):
${textOverlaySpec}

GENERATION DIRECTIVE — read this before generating, it overrides anything ambiguous above:
- Render the exact Line 1 and Line 2 text above directly onto the image now, as real rendered typography baked into the picture. Do not omit the text, do not describe it in words instead of drawing it, and do not stop to ask a clarifying question — generate the image.
- Reproduce the subject's pose, posture, body angle, and framing/zoom level exactly as they appear in their attached reference photo. Do not restage them into a different stance, do not turn a close-crop photo into a standing full-body shot, do not resize or re-scale the person relative to the reference photo. Only the background, lighting, and logo zones are yours to compose — the person themselves must stay as photographed.
- Generate and deliver the image itself. Do not reply with a checklist, a numbered list of issues, or a text-only explanation in place of the image. If any element genuinely cannot be reproduced perfectly, still generate the closest possible image and mention the limitation briefly after the image — never before it and never instead of it.`;
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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
