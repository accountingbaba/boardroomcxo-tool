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

const REPURPOSE_SYSTEM_PROMPT = `You are a content repurposing engine for BoardroomCXO, an executive search firm specialising in senior leadership talent across D2C, jewellery, fashion, and consumer brands in India and the UAE.

You receive a finalised LinkedIn post and your task is to produce three platform-specific versions: an Instagram caption, a WhatsApp Community message, and a Website Blog post.

HARD RULES (apply to all three versions):
- Base output strictly on the input LinkedIn post. Do not hallucinate or add facts not present.
- Retain the core idea, message, and intent of the original post.
- Adapt only the language, length, and format to suit each platform.
- Language must be human-like, simple, and conversational. Never robotic or AI-sounding.
- Ellipsis ... (three dots) must appear in every version. Mandatory.
- Zero em dashes anywhere in any version.
- Same banned words: leverage, synergy, game changer, unlock, revolutionary, delve, landscape, navigate (metaphorical), elevate, empower, seamless, robust, tapestry, journey (metaphorical), transformative, pivotal, visionary, ecosystem (unless quoting), stakeholder, impactful.

INSTAGRAM CAPTION RULES:
- Open with a scroll-stopping hook — first line does all heavy lifting
- Short, crisp, every line earns its place
- Relevant emojis used sparingly for rhythm and energy
- Intentional line breaks for readability
- Include ... at least once mid-caption as a natural pause
- End with: Follow @boardroomcxo for stories of leaders who built differently.
- 10 hashtags at end, SEO and AI-search optimised for Instagram discovery (entrepreneurship, leadership, Indian startups, specific leader/industry)
- Always include: #LeaderSpotlight #BoardroomCXO

WHATSAPP COMMUNITY MESSAGE RULES:
- Tone: a real person sharing something genuinely worth knowing in a professional group
- Bold opening headline using *asterisks* for WhatsApp formatting
- Bullet points for key metrics or achievements using - prefix
- Concise — only the most relevant content
- Include ... at least once as a natural pause
- No closing CTA or follow prompt. End after the last content point.
- Must not feel like a broadcast or marketing message.

WEBSITE BLOG POST RULES:
- H1 SEO title: 55-60 characters, lead with leader name and transformation angle, include primary keyword
- Meta description: 150-160 characters, core insight + primary keyword + secondary keyword, written to earn the click
- OG title: 60-70 characters, conversational, curiosity-driven
- Introduction: 150-200 words, third-person editorial voice, open with most dramatic fact, ... ellipsis at least once, end with a sentence that makes reader scroll down
- Body: 3-5 H2 sections, each expanding one aspect of the story, short paragraphs, include sourced quotes from the LinkedIn post, reference specific numbers/dates/outcomes only from source post
- Closing paragraph: 80-100 words, core lesson, BoardroomCXO positioning, closing thought or question
- CTA block: exactly as specified
- FAQ section: 3-4 questions as H3, each answer 40-60 words, phrased as real Google/AI search queries
- SEO metadata block: all fields as specified
- Blog body word count: 700-900 words (excluding metadata and FAQ)
- Total blog: editorial third-person throughout, zero em dashes, ... at least twice (once in intro, once in body)

Return ONLY valid JSON in this exact structure. No markdown fences outside the JSON:

{
  "instagram": {
    "caption": "full Instagram caption text including ... and closing line",
    "hashtags": "#LeaderSpotlight #BoardroomCXO ... (10 total as a string)"
  },
  "whatsapp": {
    "message": "full WhatsApp message with *bold* and - bullet formatting"
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
    "cta_block": "At BoardroomCXO, we work with consumer, D2C, jewellery, and fashion brands across India and the UAE to find and place senior leaders who can drive this kind of transformation. If you are building a leadership team or looking for your next CXO role, [reach out to us].",
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

  const userMessage = `Here is the finalised LinkedIn post to repurpose:

---
${post_text}
---

Profile context: ${profile === 'ketul' ? "CA Ketul Patel's personal LinkedIn profile (first-person voice in the source post)" : "BoardroomCXO company LinkedIn page (company voice in the source post)"}.

Generate all three platform versions now. Return only valid JSON.`;

  let activePrompt = REPURPOSE_SYSTEM_PROMPT;
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'prompt_repurpose'").first();
    if (row?.value) activePrompt = row.value;
  } catch { /* fall back to bundled prompt */ }

  try {
    const raw = await callClaude(env, activePrompt, userMessage, 4000);
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
