/**
 * POST /api/headline
 * Body: { post_text, subject }
 *   post_text — the finalised/approved LinkedIn post text
 *   subject   — optional leader/brand name and title, for context only
 *
 * Returns: {
 *   headlines: [
 *     { headline, accent_word, virality_score, virality_note },
 *     ... 5 options, sorted by virality_score descending
 *   ]
 * }
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const postText = (body?.post_text || '').trim();
  const subject = (body?.subject || '').trim();

  if (!postText) return json({ error: 'post_text is required' }, 400);

  const userMessage = `Read the LinkedIn post below and generate exactly 5 headline options for the image that will accompany it. These headlines are the large line-1 text overlaid on the post's editorial image — think magazine cover lines (Fortune India, The Ken, Bloomberg Businessweek), not social media captions.

${subject ? `SUBJECT: ${subject}\n\n` : ''}LINKEDIN POST:
"""
${postText}
"""

RULES for each headline:
- ONE line only. No sublines, no colons splitting two clauses, no line breaks.
- 4 to 8 words. Punchy, magazine-cover-line register.
- Must be derived directly from the strongest hook, angle, or reveal actually present in the post above — not a generic template.
- Each of the 5 options must take a genuinely different angle on the post (different hook, different phrasing), not minor rewordings of each other.
- accent_word must be a single word or short phrase that appears VERBATIM inside that headline, chosen as the one word/phrase worth highlighting in orange.
- virality_score is 0-100, scored on hook strength, scroll-stop power, and share potential for a LinkedIn feed image.
- virality_note is one short line explaining the strongest factor behind that score.

Return ONLY valid JSON, no markdown fences, no explanation outside the JSON, in this exact shape:

{
  "headlines": [
    { "headline": "", "accent_word": "", "virality_score": 0, "virality_note": "" }
  ]
}

The "headlines" array must contain exactly 5 items, sorted by virality_score descending.`;

  try {
    const raw = await callClaude(
      env,
      'You are a headline editor for a premium business publication, writing magazine-style cover lines for LinkedIn post images.',
      userMessage,
      1500
    );
    const parsed = parseJSON(raw);
    const headlines = Array.isArray(parsed.headlines) ? parsed.headlines : [];
    headlines.sort((a, b) => (b.virality_score || 0) - (a.virality_score || 0));
    return json({ headlines });
  } catch (err) {
    return json({ error: 'Headline generation failed', detail: err.message }, 500);
  }
}

/* ── HELPERS ─────────────────────────────────────────────────── */

async function callClaude(env, system, user, maxTokens = 1500) {
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

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
