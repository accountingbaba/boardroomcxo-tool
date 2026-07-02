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

const DEFAULT_IMAGE_INSTRUCTIONS = `This image must be built using the attached files only. Every person's photo is the absolute ground truth — their face, skin, expression, and clothing must be reproduced with complete photographic accuracy, without distorting or altering any facial features. Each person should look natural and humanised. Any brand logo file(s) provided are to be used exactly as attached. Under no circumstance should any face, logo, or text element be distorted, redrawn, reinterpreted, or generated from memory. If you cannot reproduce every face or logo with complete accuracy, do not generate the image.

Photorealistic editorial portrait photograph. 4:5 portrait format. LinkedIn social media post image. Aesthetic target: The Ken meets Fortune India meets Bloomberg Businessweek — premium, understated, authoritative. Never a recruitment-post or corporate-graphic look. No decorative fills, no background elements, no creative liberties — everything in frame must have a reason.

COMPOSITION — single subject:
- Centred or slightly left of centre
- Reproduce the subject exactly as framed in the reference photo — same pose, same stance, same head angle, same crop/zoom level, same amount of body visible. If the reference is a headshot, deliver a headshot; if it is three-quarter body, keep it three-quarter body. Never restage the person into a different pose, never invent unseen body parts, never zoom in or out relative to the reference photo
- Extend only the background and setting around the subject as needed — never the subject's own body or pose
- Clean negative space on the right mid-frame reserved for logo placement

COMPOSITION — multiple subjects (when more than one reference photo is provided):
- Compose for exactly the number of people provided — never invent or merge subjects
- Each person keeps their own pose, stance, head angle, and crop/zoom level exactly as captured in their own reference photo — do not restage anyone into a shared standing pose or force them to face camera
- Two people: place at a natural conversational distance, roughly symmetrical or slightly left-weighted, each preserving their own photographed angle
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
- Reproduce the exact pose, posture, body angle, and framing scale from the reference photo — do not repose the subject, do not change their stance, do not make a headshot into a standing full-body shot or vice versa, do not zoom in or out relative to how they appear in the reference photo

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

SELF-CHECK BEFORE DELIVERING — apply silently, then regenerate internally if any fail. Never show this checklist, a list of numbered issues, or any text-only explanation to the user in place of the image — always deliver the best-effort image itself:
- Every face matches its reference photo exactly, with no distorted or altered features
- No face looks AI-generated, over-smoothed, over-symmetrical, or "too perfect"
- Every subject, if more than one, is reproduced with full individual accuracy — none simplified or generalised because others are present
- Every subject's pose, posture, and framing scale matches their reference photo exactly — nobody has been repositioned, restaged, re-cropped, or resized relative to their reference photo
- The exact headline and footer text specified below has been rendered directly onto the image, as a single line, with no text omitted or replaced with a placeholder
- A subtle natural shadow is visible behind the subject(s), adding depth
- Every logo used is pixel-accurate to the file provided, correctly aligned, evenly sized or intentionally hierarchised for a clear story reason, and never appears as a hard-edged rectangular block against the background
- Any transparent-background logo sits directly on the existing dark background with no extra panel or card added
- Nothing has been added to the frame that was not specified`;

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

  return `${instructions}

TEXT OVERLAY CONTENT — bottom 20-22% of image:
- Line 1 (large, dominant, Inter ExtraBold or Montserrat ExtraBold): "${headline}" — the word "${accentWord}" in bold orange (#FF6B00), all other text in white. This must render as ONE single line — no wrapping, no second line, no subline of any kind.
- Line 2 (same font family, Light weight, very small, white at 60-70% opacity): "${footerTag}"

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
