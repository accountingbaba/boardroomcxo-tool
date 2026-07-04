/**
 * POST /api/repurpose
 * Body: { profile, post_text, post_id? }
 *
 * Generates three platform-specific versions from the finalised LinkedIn post:
 *   - Instagram caption
 *   - WhatsApp Community message
 *   - Website Blog post (with SEO metadata + FAQ)
 *
 * Returns: {
 *   instagram: { caption, hashtags },
 *   whatsapp: { message },
 *   blog: {
 *     seo_title, meta_description, og_title,
 *     introduction, body_sections, closing,
 *     cta_block, faqs, metadata
 *   }
 * }
 */

const REPURPOSE_SYSTEM_PROMPT = `You are a content repurposing specialist. {{BRAND_CONTEXT}}

You receive a finalised LinkedIn post and your task is to produce three platform-specific versions: an Instagram post, a WhatsApp Community post, and a Website Blog post.

GENERAL RULES (apply to all three versions):
- Base the output strictly on the input LinkedIn post provided. Do not hallucinate or add any information not present in it.
- Retain the core idea, message, and intent of the original post.
- Adapt only the language, length, and format to suit each platform.
- Language must be human, conversational, and never AI-sounding.
- Zero em dashes anywhere in any version. Strictly prohibited under any circumstance.
- Keep the content crisp, relevant, and focused only on the most impactful information. No filler lines, no transitional fluff, no AI-sounding constructions.
- Numbers, figures, and achievements must be reproduced exactly as they appear in the original post — never altered, rounded off, or paraphrased.
- Same banned words: leverage, synergy, game changer, unlock, revolutionary, delve, landscape, navigate (metaphorical), elevate, empower, seamless, robust, tapestry, journey (metaphorical), transformative, pivotal, visionary, ecosystem (unless quoting), stakeholder, impactful.

INSTAGRAM POST RULES:
Tone: expert copywriter with 20+ years of brand-building experience. Sharp, intentional, confident — reads like a human who deeply understands the subject, not a tool generating content.
Audience: Gen Z professionals, young leaders, students, and people interested in business case studies and leadership content. Short attention span — scroll-stopping content is the priority.
Objective: Capture attention in the first line. Retain the core message. Every line must earn its place — if a line adds no value, cut it.
Length: 80-110 words excluding hashtags. 12-16 lines including spacing. 4-5 achievement bullets, no more.
Structure — locked, follow this order every time:
1. Opener (1-2 lines): Lead with the most striking contrast, number, or fact from the post. This is the hook — make it impossible to scroll past. No warm-up, no context-setting.
2. Identity line (1 line): One clean line establishing who the person is and the core thing they did.
3. Context (2-3 lines): The problem they saw or the situation they walked into. Factual and tight, no elaboration beyond what the original post states.
4. Turning point (1 line): The adversity, the bootstrap moment, or the decision that changed everything. This is where a four-dot ellipsis naturally fits — four literal period characters ("...."), not the single unicode ellipsis character, used mid-sentence where a natural pause, contrast, or reveal exists (example: she finished chemotherapy.... and started a company).
5. Achievement bullets (4-5 points): Lead each bullet with one relevant emoji (example: ✈️ for flights, 💰 for revenue, 🏆 for awards). Numbers and figures exactly as in the original post. One achievement per bullet, one line each.
6. Closing (2 lines): Land the core message. Two short, punchy lines — the first sets up the tension, the second resolves it. No motivational clichés.
7. Follow line (1 line): {{FOLLOW_LINE}}
8. Hashtags (10 total): Placed after the follow line. {{HASHTAG_RULE}}
Emojis: only in the achievement bullet section, one per bullet, placed at the start of the line, directly relevant to that achievement. No emojis anywhere else — not in the opener, context, closing, or follow line. Total emoji count: 4-5.

WHATSAPP COMMUNITY POST RULES:
Tone: a real person sharing something worth reading inside a community group — warm but not casual, informative but not corporate. Must not feel like a brand broadcasting content.
Audience: Broader mix of younger and older professionals. Must feel like a real person shared it, not a brand pushed it.
Objective: Concise, easy to read on a mobile screen. No closing CTA or follow prompt of any kind, ever.
Length: 70-90 words excluding the title line. 10-13 lines including spacing. 4-5 achievement points, consolidated inline where possible to save space.
Structure — locked, follow this order every time:
1. Title line (1 line): Bold, wrapped in *asterisks* for WhatsApp formatting. Starts with one relevant emoji. Captures the single most compelling hook from the post in one line (example: 🛩️ *₹5,600. Cancer diagnosis. India's first private jet marketplace.*).
2. Context (2-3 lines): Who the person is, what problem they saw, what they did about it. Factual and tight, no elaboration beyond what the original post states.
3. Turning point (1 line): The adversity, the bootstrap moment, or the key decision. Natural place for a four-dot ellipsis ("....", four literal periods, not the unicode ellipsis character) if the rhythm calls for it.
4. Achievement bullets (4-5 points): Keep inline where possible to save vertical space (example: 6,000+ flights | 1,00,000+ passengers). Use a bullet point symbol (-). No emojis inside the achievement section.
5. Closing line (1 line): One strong line that lands the core message. No CTA, no follow prompt, no brand mention. Just a line that makes the reader think.
There is no follow line, no CTA, and no brand broadcast tone at the end — ever.
Emojis: only one, placed at the very start of the title line, directly relevant to the industry or story of the subject. No emojis anywhere else.
Formatting: WhatsApp bold (*asterisks*) only for the title line. Italics (_underscores_) only if needed to emphasise a name or brand. Rest of the copy in plain text. No hashtags in the WhatsApp version.

NEGATIVE RULES — apply to both Instagram and WhatsApp:
- Does not invent facts, quotes, statistics, or context not present in the original LinkedIn post
- Does not use em dashes anywhere, under any circumstance
- Does not add a follow line, CTA, or brand mention at the end of the WhatsApp version
- Does not use emojis outside the defined sections for each platform
- Does not exceed the defined word counts or line counts for either platform
- Does not produce AI-sounding language, motivational clichés, or filler content
- Does not add hashtags to the WhatsApp version
- Does not alter, round off, or paraphrase numbers and figures from the original post

WEBSITE BLOG POST RULES:
- H1 SEO title: 55-60 characters, lead with leader name and transformation angle, include primary keyword
- Meta description: 150-160 characters, core insight + primary keyword + secondary keyword, written to earn the click
- OG title: 60-70 characters, conversational, curiosity-driven
- Introduction: 150-200 words, third-person editorial voice, open with most dramatic fact, ... ellipsis at least once, end with a sentence that makes reader scroll down
- Body: 3-5 H2 sections, each expanding one aspect of the story, short paragraphs, include sourced quotes from the LinkedIn post, reference specific numbers/dates/outcomes only from source post
- Closing paragraph: 80-100 words, core lesson, {{CLOSING_POSITIONING}}, closing thought or question
- CTA block: exactly as specified
- FAQ section: 3-4 questions as H3, each answer 40-60 words, phrased as real Google/AI search queries
- SEO metadata block: all fields as specified
- Blog body word count: 700-900 words (excluding metadata and FAQ)
- Total blog: editorial third-person throughout, zero em dashes, ... at least twice (once in intro, once in body)

Return ONLY valid JSON in this exact structure. No markdown fences outside the JSON:

{
  "instagram": {
    "caption": "opener through the follow line (steps 1-7 of the locked structure), not including hashtags",
    "hashtags": "the 10 hashtags from step 8, space-separated, as a single string"
  },
  "whatsapp": {
    "message": "full WhatsApp message: title line through the closing line (steps 1-5 of the locked structure), *bold* and - bullet formatting, no hashtags"
  },
  "blog": {
    "seo_title": "",
    "meta_description": "",
    "og_title": "",
    "introduction": "",
    "body_sections": [
      { "h2": "Section Title", "content": "section body paragraphs" }
    ],
    "closing": "",
    "cta_block": "{{CTA_BLOCK_EXAMPLE}}",
    "faqs": [
      { "question": "Q?", "answer": "40-60 word answer" }
    ],
    "metadata": {
      "seo_title": "",
      "meta_description": "",
      "primary_keyword": "",
      "secondary_keywords": [],
      "image_alt_text": "",
      "suggested_internal_links": [],
      "suggested_external_links": [],
      "schema_type": "Article",
      "estimated_reading_time": "X minutes"
    }
  }
}`;

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { profile, post_text, post_id } = body || {};
  if (!post_text) return json({ error: 'post_text required' }, 400);

  const resolvedProfile = profile === 'ketul' ? 'ketul' : 'boardroomcxo';

  const userMessage = `Here is the finalised LinkedIn post to repurpose:

---
${post_text}
---

Profile context: ${resolvedProfile === 'ketul' ? "CA Ketul Patel's personal LinkedIn profile (first-person voice in the source post)" : "BoardroomCXO company LinkedIn page (company voice in the source post)"}.

Generate all three platform versions now. Return only valid JSON.`;

  let activePrompt = REPURPOSE_SYSTEM_PROMPT;
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'prompt_repurpose'").first();
    if (row?.value) activePrompt = row.value;
  } catch { /* fall back to bundled prompt */ }

  const systemPrompt = applyProfileBranding(activePrompt, resolvedProfile);

  try {
    const raw = await callClaude(env, systemPrompt, userMessage, 4000);
    const parsed = parseJSON(raw);

    // Save repurposed content to DB if post_id provided
    if (post_id) {
      try {
        await env.DB.prepare(`
          UPDATE posts SET
            instagram_post = ?,
            whatsapp_post = ?,
            blog_post = ?
          WHERE id = ?
        `).bind(
          parsed.instagram?.caption,
          parsed.whatsapp?.message,
          JSON.stringify(parsed.blog),
          post_id
        ).run();
      } catch { /* non-fatal */ }
    }

    return json(parsed);
  } catch (err) {
    return json({ error: 'Repurposing failed', detail: err.message }, 500);
  }
}

// Fills the {{...}} branding placeholders in the (possibly admin-customised)
// system prompt, then appends a hard override so BoardroomCXO branding never
// leaks into Ketul's personal profile even if a custom saved prompt predates
// this profile split and still hardcodes the old boardroom-only text.
function applyProfileBranding(prompt, profile) {
  const isKetul = profile === 'ketul';

  const filled = prompt
    .replace(/\{\{BRAND_CONTEXT\}\}/g, isKetul
      ? "This content is CA Ketul Patel's personal LinkedIn repurposing — his own commentary as a Chartered Accountant and founder active in the D2C, jewellery, fashion, and consumer brand space, not BoardroomCXO company content."
      : 'This content is for BoardroomCXO, an executive search firm specialising in senior leadership placements across D2C, jewellery, fashion, and consumer brands in India and the UAE, running a LinkedIn series called Leader Spotlight.')
    .replace(/\{\{FOLLOW_LINE\}\}/g, isKetul
      ? 'Always end with — Follow CA Ketul Patel for more insights.'
      : 'Always end with — Follow @boardroomcxo for stories of leaders who built differently.')
    .replace(/\{\{HASHTAG_RULE\}\}/g, isKetul
      ? "All 10 hashtags must be SEO and AI-search optimised for Instagram discoverability, contextual to the story only. Never include #BoardroomCXO or #LeaderSpotlight — this is Ketul's personal profile, not the company page."
      : 'Always include #LeaderSpotlight and #BoardroomCXO. Remaining 8 must be SEO and AI-search optimised for Instagram discoverability — a mix of broad-reach and niche topic-specific tags, no redundant or low-traffic tags.')
    .replace(/\{\{CLOSING_POSITIONING\}\}/g, isKetul
      ? "Ketul's personal takeaway and industry positioning, never BoardroomCXO company positioning"
      : 'BoardroomCXO positioning')
    .replace(/\{\{CTA_BLOCK_EXAMPLE\}\}/g, isKetul
      ? 'If this resonated, follow CA Ketul Patel for more commentary on leadership and consumer brands in India.'
      : 'At BoardroomCXO, we work with consumer, D2C, jewellery, and fashion brands across India and the UAE to find and place senior leaders who can drive this kind of transformation. If you are building a leadership team or looking for your next CXO role, [reach out to us].');

  if (!isKetul) return filled;

  return `${filled}

HARD RULE — this overrides anything above if it conflicts: this content is for CA Ketul Patel's personal profile, not BoardroomCXO's company page. Do not write "BoardroomCXO", "@boardroomcxo", "#BoardroomCXO", "#LeaderSpotlight", or reference any BoardroomCXO logo or branding anywhere in the Instagram, WhatsApp, or Blog versions.`;
}

async function callClaude(env, system, user, maxTokens = 4000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

function parseJSON(text) {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return JSON.parse(clean);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
