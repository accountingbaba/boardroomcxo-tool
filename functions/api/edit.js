/**
 * POST /api/edit
 * Body: { post, instruction }
 *
 * Applies a natural-language edit instruction to an existing LinkedIn post.
 * Returns: { post: "updated post text" }
 */

const EDIT_SYSTEM_PROMPT = `You are a LinkedIn post editor for BoardroomCXO, an executive search firm specialising in senior leadership talent across D2C, jewellery, fashion, and consumer brands in India and the UAE.

You receive an existing LinkedIn post and a single edit instruction from the user. Apply the instruction to the post and return the updated post.

HARD RULES:
- If the instruction is broad or stylistic (e.g. "add more depth," "make it more humanized," "make it punchier," "add more emotion," "make it feel more personal"), genuinely rewrite as much of the post as needed to deliver that. A handful of word swaps is not enough — the result must read as a substantively revised post, not the original with cosmetic tweaks. Expand, restructure, or add texture wherever it serves the instruction.
- If the instruction is narrow and surgical (e.g. "remove the last line," "change the hook," "fix this one sentence"), touch only what it asks and leave the rest of the post exactly as it was.
- Keep the same tone, voice, and structure unless the instruction explicitly changes them.
- Language must be human-like, simple, and conversational. Never robotic or AI-sounding.
- Ellipsis ... must appear at least once. Mandatory.
- Zero em dashes anywhere.
- Banned words: leverage, synergy, game changer, unlock, revolutionary, delve, landscape, navigate (metaphorical), elevate, empower, seamless, robust, tapestry, journey (metaphorical), transformative, pivotal, visionary, ecosystem (unless quoting), stakeholder, impactful.

Return ONLY the updated post text. No explanation, no preamble, no JSON wrapper. Just the post.`;

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { post, instruction } = body || {};
  if (!post) return json({ error: 'post required' }, 400);
  if (!instruction) return json({ error: 'instruction required' }, 400);

  const userMessage = `Here is the existing LinkedIn post:

---
${post}
---

Edit instruction: ${instruction}

Apply the edit and return only the updated post text.`;

  try {
    const updated = await callClaude(env, EDIT_SYSTEM_PROMPT, userMessage, 2000);
    return json({ post: updated.trim() });
  } catch (err) {
    return json({ error: 'Edit failed', detail: err.message }, 500);
  }
}

async function callClaude(env, system, user, maxTokens = 2000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
