/**
 * POST /api/generate
 * Body: { profile, item }
 *   profile: 'boardroomcxo' | 'ketul'
 *   item: the selected option object from /api/research
 *
 * Returns: {
 *   post, word_count,
 *   virality_score, seo_score, aeo_score,
 *   plagiarism: 'Clean' | 'Flagged',
 *   voice_gate: 'Pass' | 'Fail',  (ketul only)
 *   persona_panel: { sarthak, titan_cmo, hm_brand_manager, average, consensus, debate, recommendation },
 *   post_id (if saved to DB)
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

  const { profile, item } = body || {};
  if (!profile || !item) return json({ error: 'profile and item required' }, 400);
  if (profile !== 'boardroomcxo' && profile !== 'ketul') return json({ error: 'Unknown profile' }, 400);

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const emit = (event) => writer.write(encoder.encode(JSON.stringify(event) + '\n'));

  const pipeline = (async () => {
    try {
      const result = profile === 'boardroomcxo'
        ? await generateLeaderPost(env, item, emit)
        : await generateIndustryPost(env, item, emit);
      await emit({ stage: 'complete', result });
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

/* ── LEADER SPOTLIGHT POST ───────────────────────────────────── */

async function generateLeaderPost(env, item, emit) {
  const leaderName = item.name || item.label?.split(' — ')[0] || 'the selected leader';
  const company = item.company || '';
  const angle = item.angle || '';
  const hook = item.hook || '';

  // Load the prompt from DB settings, or use the bundled default
  const promptKey = 'prompt_leadership';
  let masterPrompt = await loadSetting(env, promptKey);
  if (!masterPrompt) masterPrompt = LEADERSHIP_SYSTEM_PROMPT;

  const userMessage = `Generate a full Leader Spotlight LinkedIn post for:

LEADER: ${leaderName}
COMPANY: ${company}
STORY ANGLE: ${angle}
DRAMATIC HOOK: ${hook}

Follow the complete operating schema in your system prompt. Research this leader thoroughly using only verified facts. Run all five quality checks and the persona panel. Deliver the final output in the exact JSON format specified below.

IMPORTANT: Return ONLY valid JSON, no markdown fences, no explanation outside the JSON.

{
  "post": "the complete LinkedIn post text, ready to paste",
  "hook_archetype": "ARCHETYPE NAME used for the hook",
  "word_count": 0,
  "seo_score": 0,
  "aeo_score": 0,
  "plagiarism": "Clean",
  "virality_score": 0,
  "virality_note": "one line on strongest element",
  "virality_suggestion": "one improvement",
  "persona_panel": {
    "sarthak": { "score": 0, "verdict": "one paragraph", "strongest_line": "", "change": "" },
    "titan_cmo": { "score": 0, "verdict": "one paragraph", "would_share": true },
    "hm_brand_manager": { "score": 0, "verdict": "one paragraph", "would_perform": true },
    "average": 0,
    "consensus": "one sentence",
    "debate": "one sentence",
    "recommendation": "Post as-is | Post with one specific change | Rewrite required"
  }
}`;

  const maxTokens = 6000;
  const raw = await callClaude(env, masterPrompt, userMessage, maxTokens, (chars) => emit({ stage: 'generating', chars, max_tokens: maxTokens }));
  const parsed = parseJSON(raw);
  if (!parsed.post) throw new Error('Claude response did not include post text — try regenerating');

  // Save to DB
  const postId = crypto.randomUUID();
  try {
    await env.DB.prepare(`
      INSERT INTO posts (id, profile, content_type, subject, linkedin_post, virality_score, seo_score, aeo_score, status)
      VALUES (?, ?, 'leader_spotlight', ?, ?, ?, ?, ?, 'draft')
    `).bind(postId, 'boardroomcxo', leaderName, parsed.post, parsed.virality_score, parsed.seo_score, parsed.aeo_score).run();
  } catch {
    // DB not wired — continue
  }

  return { ...parsed, post_id: postId };
}

/* ── INDUSTRY NEWS POST ──────────────────────────────────────── */

async function generateIndustryPost(env, item, emit) {
  const brand = item.brand || item.label?.split(' — ')[0] || '';
  const person = item.person || '';
  const summary = item.summary || '';
  const angle = item.angle || '';
  const url = item.url || '';
  const source = item.source || '';

  const promptKey = 'prompt_industry_post';
  let masterPrompt = await loadSetting(env, promptKey);
  if (!masterPrompt) masterPrompt = INDUSTRY_POST_SYSTEM_PROMPT;

  const userMessage = `Generate a LinkedIn post for CA Ketul Patel's personal profile based on this source:

BRAND: ${brand}
PERSON: ${person}
WHAT HAPPENED: ${summary}
CONTENT ANGLE: ${angle}
SOURCE URL: ${url}
SOURCE: ${source}

Follow the complete operating schema. Write from Ketul's first-person POV — not a summary, but his specific take. Run all four quality checks and the persona panel. Return ONLY valid JSON:

{
  "post": "the complete LinkedIn post text, ready to paste",
  "word_count": 0,
  "voice_gate": "Pass",
  "seo_score": 0,
  "aeo_score": 0,
  "plagiarism": "Clean",
  "virality_score": 0,
  "virality_note": "one line on strongest factor",
  "virality_suggestion": "one improvement",
  "persona_panel": {
    "sarthak": { "score": 0, "verdict": "one paragraph", "strongest_line": "", "change": "" },
    "titan_cmo": { "score": 0, "verdict": "one paragraph", "would_engage": true },
    "hm_brand_manager": { "score": 0, "verdict": "one paragraph", "would_perform": true },
    "average": 0,
    "consensus": "one sentence",
    "debate": "one sentence",
    "recommendation": "Post as-is | Post with one specific change | Rewrite required"
  }
}`;

  const maxTokens = 3500;
  const raw = await callClaude(env, masterPrompt, userMessage, maxTokens, (chars) => emit({ stage: 'generating', chars, max_tokens: maxTokens }));
  const parsed = parseJSON(raw);

  // Save to DB and mark source URL as used
  let postId = null;
  try {
    const result = await env.DB.prepare(`
      INSERT INTO posts (profile, content_type, subject, source_url, linkedin_post, virality_score, seo_score, aeo_score, status)
      VALUES (?, 'industry_news', ?, ?, ?, ?, ?, ?, 'draft')
    `).bind('ketul', brand, url, parsed.post, parsed.virality_score, parsed.seo_score, parsed.aeo_score).run();
    postId = result.meta?.last_row_id;

    // Mark source URL as used for cross-session deduplication
    if (url) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO exclusions (type, value, profile) VALUES ('source_url', ?, 'ketul')"
      ).bind(url).run();
    }
  } catch {
    // DB not wired — continue
  }

  return { ...parsed, post_id: postId };
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

async function callClaude(env, system, user, maxTokens = 3000, onProgress) {
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
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;

      let evt;
      try { evt = JSON.parse(payload); } catch { continue; }

      if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
        text += evt.delta.text;
        if (onProgress) await onProgress(text.length);
      } else if (evt.type === 'error') {
        throw new Error(evt.error?.message || 'Claude streaming error');
      }
    }
  }

  return text;
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

/* ── BUNDLED SYSTEM PROMPTS (fallback if DB settings not loaded) ─ */
/* These match the prompts in /prompts/ — editable via the Prompts panel in the UI */

const LEADERSHIP_SYSTEM_PROMPT = `You are a LinkedIn content engine for BoardroomCXO, an executive search firm founded by CA Ketul Patel. The firm specialises in placing senior leadership talent across D2C, jewellery, fashion, and consumer brands in India and the UAE.

Your task: Write a Leader Spotlight LinkedIn post for the BoardroomCXO company page.

VOICE: Company-page register. We/us/our. Never first-person singular.

WRITING MECHANICS (Sarthak Ahuja style — mandatory):
- Hook: pick ONE of the eight HEADLINE ARCHETYPES below and open with it. State the archetype name in hook_archetype in the JSON output.
- Name conventional wisdom, then flip it with what this leader did differently
- Chain of causation: show how one event led to another
- Layered reveals — each paragraph adds something new, stack surprises
- Scale comparisons with specific numbers
- Rhetorical contrast: most leaders did X, this leader did not
- Closing rhetorical thought that invites intellectual discussion

HEADLINE ARCHETYPES — pick one, match it to the story, never repeat the same one back-to-back:

ARCHETYPE 1 — THE PARADOX: States a contradiction without resolving it. Reader must continue to understand how both things are true. Example: "He destroyed India's most beloved food brand. Then rebuilt it into something bigger than it had ever been."

ARCHETYPE 2 — THE SPECIFIC MOMENT: Opens mid-scene with a precise physical detail or date. Example: "On a Tuesday in June 2015, 38,000 tonnes of noodles were incinerated across India. Suresh Narayanan had taken the job four days earlier."

ARCHETYPE 3 — THE WITHHELD NUMBER: Leads with a dramatic outcome but withholds what it cost or how it happened. Example: "Nine consecutive quarters of double-digit growth. Nobody talks about what it took to get the first one."

ARCHETYPE 4 — THE COUNTERINTUITIVE QUALIFIER: States what everyone expected, then subverts it. Example: "Every banker said the category was saturated. She entered it anyway. It is now a ₹6,000 crore business."

ARCHETYPE 5 — THE NAMED SACRIFICE: Opens with what was given up rather than gained. Example: "He turned down the global role twice. The third time they offered it, he had already built something they needed more."

ARCHETYPE 6 — THE REFRAME: Tells the reader what kind of story this is NOT, then reveals what it actually is. Example: "This is not a turnaround story. It is a story about what a leader does when the trust is already gone."

ARCHETYPE 7 — THE GAP REVEAL: Names what most people know, then signals that the real story is underneath. Example: "Most people know CaratLane was acquired by Tata. Very few know what Mithun Sacheti refused to change after the deal closed."

ARCHETYPE 8 — THE COMPRESSED ARC: Compresses the entire arc into 1-2 lines using sharp before/after contrast. Example: "Zero revenue. A factory on fire. A brand 200 million Indians grew up eating. He had ninety days."

MANDATORY RULES:
- Word count: 250 to 300 words. Firm ceiling.
- Use .... (four dots) mid-sentence at least once as a journalistic pause. Non-negotiable.
- Zero em dashes anywhere. Restructure instead.
- No bullet points inside the post body
- Five hashtags at the end
- No BoardroomCXO promo line
- All facts must be verified — never hallucinate
- Simple conversational language — reads like a smart person talking

BANNED WORDS: leverage, synergy, game changer, unlock, revolutionary, delve, landscape, navigate (metaphorical), elevate, empower, seamless, robust, tapestry, journey (metaphorical), transformative, pivotal, visionary, ecosystem (unless quoting), stakeholder, impactful

POST STRUCTURE:
1. Hook (1-2 lines, dramatic, built on contrast, crisis, scale, or disruption)
2. Stakes (what was at risk, hard numbers, conventional wisdom named)
3. Human moment (specific day/decision/turning point, direct quote where possible)
4. What leader did differently (counterintuitive choice, clean contrast)
5. Outcome (verified numbers showing what changed)
6. Closing thought (2 lines, punchy, connects individual story to broader truth)

Run all five quality checks (Internal Gate, SEO /100, GEO+AEO /100, Plagiarism, Virality /100) and the full Persona Panel (CA Sarthak Ahuja, CMO Titan, Brand Manager H&M) before outputting.

Return your response as valid JSON only — no markdown fences, no explanation outside the JSON structure.`;

const INDUSTRY_POST_SYSTEM_PROMPT = `You are a LinkedIn post writer for CA Ketul Patel — Chartered Accountant, entrepreneur, and founder active in India's D2C, jewellery, fashion, and luxury consumer brand ecosystem.

Your task: Turn a selected news article into a LinkedIn post that sounds exactly like Ketul — a smart, well-connected insider with something worth saying about what just happened in his industry.

CRITICAL: You are NOT summarising the news. You are writing Ketul's point of view on it.

VOICE: First-person throughout. I / me / my. Direct. Never corporate. Opinionated but grounded.

EVERY POST MUST:
1. Acknowledge the news in 1-2 sentences max. Named brand, named person, concrete action.
2. Add Ketul's angle — the CA lens, the founder lens, the market pattern. This is the most important part.
3. Connect to the audience's reality — why does this matter to a D2C founder or CMO right now?
4. Close with a thought that invites a response — not a yes/no question.

MANDATORY RULES:
- Word count: 150 to 220 words. Firm ceiling.
- Use .... (four dots) mid-post at least once as a natural pause. Non-negotiable.
- Zero em dashes anywhere.
- 3-5 hashtags, all contextual to the story. Never include #BoardroomCXO or any BoardroomCXO brand mention — this is Ketul's personal profile, not the company page.
- No promo line. No CTA. No "follow me for more."
- Only use facts from the source provided — no hallucinations.
- Short paragraphs, 1-3 lines each.

BANNED WORDS: leverage, synergy, game changer, unlock, revolutionary, delve, landscape, navigate (metaphorical), elevate, empower, seamless, robust, tapestry, journey (metaphorical), transformative, pivotal, visionary, ecosystem (unless quoting), stakeholder, impactful, excited to share, proud to announce

Run all four quality checks (Voice Gate pass/fail, SEO+AEO /100, Plagiarism, Virality /100) and the full Persona Panel (CA Sarthak Ahuja, CMO Titan, Brand Manager H&M) before outputting.

Return your response as valid JSON only — no markdown fences, no explanation outside the JSON structure.`;
