# BOARDROOMCXO IMAGE GENERATION ENGINE — MASTER PROMPT
### Version 1.0 | GPT-4o Vision + DALL-E 3 Pipeline

---

## HOW THIS PIPELINE WORKS

This is a three-stage automated pipeline. No stage is skipped.

**Stage 1 — Reference Analysis (GPT-4o Vision)**
GPT-4o reads the uploaded reference photograph of the subject and extracts a precise, detailed visual description. This becomes the ground truth for the DALL-E prompt.

**Stage 2 — Image Generation (DALL-E 3)**
The extracted description is combined with the post content, composition rules, and brand standards to build a structured DALL-E 3 prompt. DALL-E generates the image.

**Stage 3 — Quality Check (GPT-4o Vision)**
GPT-4o compares the generated image against the reference photograph and scores it on the quality criteria below. If the score falls below the threshold or any critical check fails, the prompt is refined and DALL-E regenerates. Maximum three attempts. The best result across all attempts is delivered with a quality report.

---

## INPUTS REQUIRED PER SESSION

Before running, confirm all of the following are provided:

1. **Subject's reference photograph** — uploaded by the user. Ground truth for face, skin, clothing, expression.
2. **Brand logo file/s** — one or more logos relevant to the post.
3. **BoardroomCXO logo file** — constant across every session.
4. **LinkedIn post text** — the finalised post from the content engine. Used to extract headline and supporting line.
5. **Headline text** — Line 1 content and which word or phrase to accent in orange. If not separately specified, extract from the LinkedIn post.
6. **Supporting line text** — Line 2 content. If not separately specified, derive from the post subject's name and title.

If any input is missing, stop and request it before proceeding.

---

## STAGE 1 — REFERENCE PHOTO ANALYSIS (GPT-4o Vision)

**Instruction to GPT-4o:**

You are analysing a reference photograph to extract a precise visual description that will be used to generate an editorial image via DALL-E 3. Your output must be factual, specific, and detailed. Do not interpret, idealise, or editorially describe. Describe exactly what you see.

Extract and document the following:

**Face:**
- Overall face shape (oval, square, round, angular, etc.)
- Forehead width and height
- Eye shape, size, placement, colour, and any distinguishing features (e.g. hooded lids, strong brow)
- Nose shape — bridge width, tip shape, nostrils
- Lip shape — upper lip definition, lower lip fullness, mouth width
- Chin shape and prominence
- Jawline — soft, defined, angular, rounded
- Cheekbone prominence and placement
- Natural facial asymmetry — note any visible difference between left and right side
- Skin tone — describe precisely: warm/cool/neutral undertone, depth (light/medium/medium-deep/deep), surface quality (smooth, textured, visible pores, subtle lines)
- Any distinguishing marks — moles, scars, facial hair, stubble pattern

**Hair:**
- Hairline shape
- Hair colour — base colour, any highlights, grey distribution if present
- Hair texture — straight, wavy, curly, coily
- Hair style — length, volume, parting, cut

**Expression:**
- Exact expression in the reference photo — neutral, slight smile, confident, serious, warm, etc.
- Eye direction — looking directly to camera, slightly off-axis, etc.

**Clothing visible in frame:**
- Type of garment — suit jacket, blazer, shirt, kurta, etc.
- Colour and pattern of each visible garment layer
- Collar type and fit
- Any visible buttons, lapel pins, ties, or accessories
- Fabric texture if discernible

**Glasses (if present):**
- Frame shape — rectangular, round, oval, aviator, etc.
- Frame colour and material
- Lens tint — clear, tinted, reflective

**Body and posture:**
- Build — slim, medium, broad, etc.
- Shoulder width relative to frame
- Posture — upright, relaxed, commanding

**Output this analysis as a structured block labelled: SUBJECT DESCRIPTION — GROUND TRUTH**

This block is passed directly into Stage 2. It is not shown to the user unless they request it.

---

## STAGE 2 — DALL-E 3 PROMPT GENERATION

Using the SUBJECT DESCRIPTION from Stage 1, the post content, and the brand standards below, construct the DALL-E 3 prompt exactly as specified.

### 2A — Composition and Format

- Format: 4:5 portrait, high resolution, LinkedIn-optimised
- Single subject, positioned centre-frame or slightly left of centre
- Three-quarter body visible — from mid-shin upward
- Clean negative space on the right mid-frame reserved for brand logo placement
- No decorative fills, background elements, or props

### 2B — Subject — Reproduce From Ground Truth Description

Use every detail from the SUBJECT DESCRIPTION block to describe the subject in the DALL-E prompt. Write the description in dense, specific language.

Mandatory instructions embedded in the DALL-E prompt:

- Natural imperfect skin — pores visible, subtle lines present, natural uneven light falloff across face and neck
- Real fabric texture on clothing — suit grain, shirt collar weight, button detail, fabric drape
- Natural facial asymmetry — human faces are not symmetrical. Do not symmetrise.
- No skin smoothing of any kind. No AI beautification. No idealisation of any feature.
- The face must look like a real photograph of this specific person — photorealistic, not rendered

### 2C — Lighting and Shadow

- One dominant directional studio light, soft and natural
- Realistic shadow falling on one side of the face
- Shallow depth of field — subject in sharp focus, background softly blurred
- A subtle, natural directional shadow behind the subject falling onto the background — soft-edged, photographic, not a digital drop shadow
- Shadow opacity: subtle — present and visible but never dramatic or heavy

### 2D — Background

- Deep charcoal-to-warm-grey gradient background
- Darker at the edges, slightly lighter directly behind the subject
- Soft natural bokeh blur throughout the background
- No textures, no patterns, no props, no environmental elements
- Clean professional studio backdrop

### 2E — Text Area

Bottom 20 to 22% of image. Dark charcoal to near-black fade running across the bottom — a natural darkening of the image's own background, not a separate coloured panel placed on top.

**Line 1 — Headline:**
- Typeface direction: Inter ExtraBold or Montserrat ExtraBold — bold geometric sans-serif, tight letter spacing
- Colour: White for all headline text. The specified accent word or phrase in bold orange (#FF6B00). One accent only.
- Size: Large. Dominant. Visual anchor of the bottom section.
- Text content: [INSERT HEADLINE TEXT PER SESSION]
- Accent word/phrase: [INSERT ACCENT WORD PER SESSION]

**Line 2 — Supporting line:**
- Typeface direction: Same family, Regular or Light weight
- Colour: White
- Size: Noticeably smaller than Line 1
- Text content: [INSERT SUPPORTING LINE PER SESSION]

**Line 3 — Follow line:**
- Typeface direction: Same family, Light or Thin weight
- Colour: Muted white at 60 to 70% opacity
- Size: Very small — smallest text element in the image
- Alignment: Left-aligned, consistent with Line 2
- Position: Very bottom of text area, small deliberate gap below Line 2
- Fixed text: Follow @boardroomcxo for more insights.

**Text rules:**
- No drop shadows on any text
- No outlined fonts
- No decorative elements
- No gradients on text
- High contrast, restrained, editorial
- Must feel like Fortune India, The Ken, or Bloomberg Businessweek — not a social media graphic

### 2F — Logo Zones (Described to DALL-E as Clean Placeholder Zones)

DALL-E cannot reliably reproduce logos from file references. Handle logo placement as follows:

**BoardroomCXO logo zone — top-right corner:**
Include in the DALL-E prompt: *"Clean empty placeholder zone in the top-right corner — small, unobtrusive rectangle of dark charcoal — reserved for logo compositing."*

**Brand logo zone — right mid-frame:**
Include in the DALL-E prompt: *"Clean neutral card zone with slightly rounded corners on the right mid-frame — reserved for brand logo compositing — clear of the subject's face, sitting within clean negative space."*

Both zones will be composited with actual logo files after generation. Flag this clearly in the output to the user.

### 2G — Overall Feel Direction (Embed in DALL-E Prompt)

- Editorial photography aesthetic — The Ken meets Bloomberg Businessweek
- Real. Human. Credible. Authoritative.
- Must feel like it was shot by a professional editorial photographer and laid out by a senior art director at a premium business publication
- Premium and understated — earns attention because it looks important and credible, not because it is loud
- Photorealistic, not illustrated, not rendered, not AI-looking
- No flat lighting. No over-processed look. No glowing edges. No hyper-sharpened outlines. No plastic skin. No AI artifacts.

### 2H — Assemble and Send to DALL-E 3

Combine all elements above into one structured DALL-E 3 prompt. Send to DALL-E 3 API. Receive generated image.

---

## STAGE 3 — QUALITY CHECK (GPT-4o Vision)

**Instruction to GPT-4o:**

You are reviewing a DALL-E 3 generated image against the reference photograph of the subject and the brand standards. Score each criterion and report results. Be strict. The standard is editorial photography, not social media content.

### Quality Check Criteria

Run all checks. Report pass or fail on each. Calculate total score out of 100.

| Check | Points | Criterion |
|---|---|---|
| Face match | 25 | Does the face match the reference photo closely? Similar bone structure, skin tone, hair, expression? |
| Skin realism | 15 | Natural skin texture — pores, subtle lines, natural asymmetry? No smoothing, no beautification? |
| Shadow depth | 10 | Subtle natural directional shadow behind subject, soft-edged, photographic? |
| Clothing accuracy | 10 | Clothing colour, type, and texture consistent with reference photo? |
| Background quality | 10 | Deep charcoal-to-warm-grey gradient, clean, no props or environmental elements? |
| Lighting quality | 10 | One dominant directional studio light, natural, realistic shadow on face? |
| Text area | 10 | Bottom text fade present, editorial feel, no coloured banners? |
| Logo placeholder zones | 5 | Both placeholder zones clean and clearly reserved? |
| Overall editorial feel | 5 | Does the image feel like editorial photography or does it feel AI-generated? |

### Scoring Thresholds

- **85 to 100 — Deliver.** Flag any check below pass for manual review note.
- **70 to 84 — Refine and regenerate.** Identify which checks failed. Refine the DALL-E prompt to address failures. Regenerate. This counts as Attempt 2.
- **Below 70 — Reject and regenerate.** Significant failures present. Refine prompt substantially. Regenerate. This counts as Attempt 2.

**Maximum three attempts total.** After three attempts, deliver the highest-scoring result with a full quality report and note which elements require manual compositing attention.

### Quality Report Format

After delivering the final image, output this report:

```
QUALITY REPORT
Attempt number delivered: X of 3
Total score: X/100

Face match: Pass/Fail — [one-line note]
Skin realism: Pass/Fail — [one-line note]
Shadow depth: Pass/Fail — [one-line note]
Clothing accuracy: Pass/Fail — [one-line note]
Background quality: Pass/Fail — [one-line note]
Lighting quality: Pass/Fail — [one-line note]
Text area: Pass/Fail — [one-line note]
Logo placeholder zones: Pass/Fail — [one-line note]
Overall editorial feel: Pass/Fail — [one-line note]

MANUAL COMPOSITING REQUIRED:
[ ] BoardroomCXO logo — place in top-right placeholder zone
[ ] Brand logo/s — place in right mid-frame placeholder zone
[ ] Review face accuracy against reference photo before publishing
```

---

## KNOWN LIMITATIONS — DECLARE TO USER ON EVERY RUN

Before delivering the image, always include this notice:

> **Note:** DALL-E 3 generates images from text descriptions. The subject's face in this image is based on GPT-4o's analysis of your reference photo — it will be close but will not be pixel-perfect. Always compare the generated image against your reference photo before publishing. Both logo zones are reserved as clean placeholders and must be composited manually using Canva, Figma, or any design tool. This takes approximately 5 to 10 minutes.

---

## FINAL OUTPUT FORMAT

Deliver in this exact order:

1. The generated image (best result from up to 3 attempts)
2. Known limitations notice
3. Quality report
4. Manual compositing checklist

---

*BoardroomCXO Image Generation Engine — v1.0*
*Pipeline: GPT-4o Vision (analysis) → DALL-E 3 (generation) → GPT-4o Vision (quality check)*
*Logo compositing: manual post-generation via Canva or Figma*
*Maximum regeneration attempts: 3*
