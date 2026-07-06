/**
 * POST /api/research
 * Body: { profile: 'boardroomcxo' | 'ketul' }
 *
 * BoardroomCXO profile  -> Claude generates a shortlist of 5 Indian leaders
 * Ketul profile         -> Tavily searches recent news, Claude filters + scores
 *
 * Streams NDJSON progress events (searching/generating stages) followed by a
 * terminal { stage: 'complete', result: { options } } event — same pattern
 * as /api/generate, so the frontend progress bar tracks real work instead of
 * a fixed-duration timer.
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { profile, already_shown, max_age_days } = body || {};
  if (!profile) return json({ error: 'profile required' }, 400);
  if (profile !== 'boardroomcxo' && profile !== 'ketul') return json({ error: 'Unknown profile' }, 400);
  const alreadyShown = Array.isArray(already_shown) ? already_shown : [];
  const maxAgeDays = Number.isFinite(max_age_days) && max_age_days > 0 ? Math.min(max_age_days, 25) : 25;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const emit = (event) => writer.write(encoder.encode(JSON.stringify(event) + '\n'));

  const pipeline = (async () => {
    try {
      const result = profile === 'boardroomcxo'
        ? await runLeaderResearch(env, emit, alreadyShown)
        : await runIndustryResearch(env, emit, alreadyShown, maxAgeDays);
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

/* ── LEADER SPOTLIGHT RESEARCH ───────────────────────────────── */

async function runLeaderResearch(env, emit, alreadyShown = []) {
  // Load exclusion list from DB
  let excluded = [];
  try {
    const rows = await env.DB.prepare(
      "SELECT value FROM exclusions WHERE type = 'leader' ORDER BY created_at DESC"
    ).all();
    excluded = rows.results.map(r => r.value);
  } catch {
    // DB not wired yet in dev — continue with empty list
  }

  // Merge in names already shown to the user earlier in this session (e.g. from
  // a previous "show more" batch) so a fresh search doesn't repeat them.
  excluded = Array.from(new Set([...excluded, ...alreadyShown]));

  // Load blacklist terms (people/topics manually banned in Settings) — these
  // are permanent regardless of publish status, unlike the exclusions above.
  let blacklist = [];
  try {
    const rows = await env.DB.prepare(
      "SELECT term FROM blacklist WHERE profile IS NULL OR profile = 'boardroomcxo'"
    ).all();
    blacklist = rows.results.map(r => r.term);
  } catch {
    // ignore if DB unavailable
  }

  // Load last 20 preferences for self-learning context
  let pastContext = '';
  try {
    const prefs = await env.DB.prepare(
      "SELECT selected_subject, selected_score FROM preferences WHERE profile = 'boardroomcxo' ORDER BY created_at DESC LIMIT 20"
    ).all();
    if (prefs.results.length > 0) {
      pastContext = `\n\nPast user selections (most recent first, for self-learning context):\n` +
        prefs.results.map(p => `- ${p.selected_subject} (score: ${p.selected_score})`).join('\n');
    }
  } catch {
    // ignore if DB unavailable
  }

  const excludeBlock = excluded.length > 0
    ? `\n\nEXCLUSION LIST — never suggest these leaders:\n${excluded.map(e => `- ${e}`).join('\n')}`
    : '\n\nNo leaders have been published yet. All are eligible.';

  const blacklistBlock = blacklist.length > 0
    ? `\n\nBANNED — the user has explicitly said never to suggest these people, under any name variant, regardless of how strong their story is:\n${blacklist.map(b => `- ${b}`).join('\n')}`
    : '';

  const systemPrompt = `You are a research engine for the BoardroomCXO LinkedIn content tool.

BoardroomCXO is an executive search firm founded by CA Ketul Patel, specialising in placing senior leadership talent across D2C, jewellery, fashion, and consumer brands in India and the UAE.

Your task: Generate a shortlist of 5 Indian business leaders suitable for Leader Spotlight posts on the BoardroomCXO LinkedIn company page.

Each leader must:
- Be based in India or have led Indian businesses or global MNCs operating in India
- Have done something verifiable: transformed a company, turned around a business in crisis, created or redefined an entire category in India, or led industry-first change
- Have a story with a specific, dramatic, human moment at its centre
- Be senior enough that a LinkedIn feature would prompt them or their network to engage
- NOT be on the exclusion list

Priority sectors: FMCG, D2C, jewellery, fashion, consumer retail, beauty, food and beverage, technology-led consumer businesses

Priority story types:
- Crisis and recovery
- Homegrown leader rising to the top
- Industry-first transformation
- Counterintuitive strategic decision that paid off
- Leader who built something nobody believed in
- Leader who created or redefined an entire category in India

Score each leader out of 100 for virality potential (five factors: hook strength, emotional resonance, shareability, engagement trigger, narrative arc — 20 points each).${excludeBlock}${blacklistBlock}${pastContext}

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no explanation:
{
  "options": [
    {
      "label": "Full Name — Company, one-line story angle",
      "score": 88,
      "name": "Full Name",
      "company": "Company Name",
      "angle": "One sentence on the specific transformation or category moment",
      "hook": "The single most dramatic fact or moment in their story"
    }
  ]
}

Return exactly 5 options, ranked by score descending.`;

  const maxTokens = 2000;
  const response = await callClaude(env, systemPrompt, 'Generate the 5-leader shortlist now.', maxTokens, (chars) => emit({ stage: 'generating', chars, max_tokens: maxTokens }));
  const parsed = parseJSON(response);
  if (!parsed?.options) throw new Error('No options in response');

  // Safety net: the model can still slip a banned/excluded name past prompt
  // instructions, so hard-filter the result before it ever reaches the user.
  const banned = [...excluded, ...blacklist].map(n => n.toLowerCase());
  const options = parsed.options.filter(o => {
    const name = (o.name || o.label || '').toLowerCase();
    return !banned.some(b => name.includes(b));
  });

  if (options.length === 0) throw new Error('No leaders passed the criteria. Please try again.');
  return { options };
}

/* ── INDUSTRY NEWS RESEARCH ──────────────────────────────────── */

async function runIndustryResearch(env, emit, alreadyShown = [], maxAgeDays = 25) {
  // Load previously used source URLs for deduplication
  let usedUrls = [];
  try {
    const rows = await env.DB.prepare(
      "SELECT value FROM exclusions WHERE type = 'source_url' ORDER BY created_at DESC"
    ).all();
    usedUrls = rows.results.map(r => r.value);
  } catch {
    // DB not available in dev
  }

  // Merge in URLs already shown to the user earlier in this session (e.g. from
  // a previous "show more" batch) so a fresh search doesn't repeat them.
  usedUrls = Array.from(new Set([...usedUrls, ...alreadyShown]));

  // Step 1: Tavily search across accepted source tiers
  const searchQueries = [
    'Indian D2C brand funding jewellery fashion 2025',
    'celebrity brand India jewellery fashion launch 2025',
    'brand collaboration India fashion jewellery 2025',
    'global luxury brand India entry 2025',
    'Indian brand international fashion week 2025',
    'D2C brand IPO funding India consumer 2025',
    'OTT platform brand India fashion jewellery 2025',
  ];

  let articles = [];

  for (let i = 0; i < searchQueries.length; i++) {
    try {
      const results = await tavilySearch(env, searchQueries[i], maxAgeDays);
      articles.push(...results);
    } catch {
      // skip failed queries
    }
    await emit({ stage: 'searching', completed: i + 1, total: searchQueries.length });
  }

  // Deduplicate by URL
  const seen = new Set(usedUrls);
  articles = articles.filter(a => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  if (articles.length === 0) {
    throw new Error('No recent articles found. Try again in a few minutes or check your Tavily API key.');
  }

  // Step 2: Claude filters and scores — strict pass first, then a relaxed
  // retry over the same articles if nothing survives. Trade press headlines
  // often omit a named decision-maker even when the brand/action/India-nexus
  // signals are solid, so a single strict pass regularly returns zero on
  // ordinary news days.
  const articlesBlock = articles.slice(0, 30).map((a, i) =>
    `[${i + 1}] Title: ${a.title}\nURL: ${a.url}\nSource: ${a.url ? new URL(a.url).hostname : 'unknown'}\nPublished: ${a.published_date || 'unknown'}\nSnippet: ${a.content || a.snippet || ''}`
  ).join('\n\n---\n\n');

  const maxTokens = 2000;

  let options = await scoreArticles(env, articlesBlock, maxAgeDays, maxTokens, false, emit);
  if (options.length === 0) {
    options = await scoreArticles(env, articlesBlock, maxAgeDays, maxTokens, true, emit);
  }

  if (options.length === 0) {
    throw new Error(
      `Found ${articles.length} article(s) from the last ${maxAgeDays} days, but none passed the quality filters ` +
      `(named brand + concrete action + India nexus, matching one of the 7 story types) even on a relaxed pass. ` +
      `Try widening the freshness window in Settings, or check back later for fresh coverage.`
    );
  }
  return { options };
}

async function scoreArticles(env, articlesBlock, maxAgeDays, maxTokens, relaxed, emit) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const signalsBlock = relaxed
    ? `MANDATORY SIGNALS — at least 3 of these 4 must be present (a named decision-maker is a bonus, not required):
1. Named brand (specific, not generic)
2. Named person in a decision role (founder, CEO, CMO, investor, creative director) — nice to have
3. Concrete action (something that has happened or been officially announced — not a prediction or rumour)
4. India nexus (happens in India, involves an Indian brand, or involves an Indian brand going international)`
    : `MANDATORY SIGNALS — all 4 must be present in every accepted article:
1. Named brand (specific, not generic)
2. Named person in a decision role (founder, CEO, CMO, investor, creative director)
3. Concrete action (something that has happened or been officially announced — not a prediction or rumour)
4. India nexus (happens in India, involves an Indian brand, or involves an Indian brand going international)`;

  const storyTypesBlock = relaxed
    ? `THE 7 STORY TYPES — article should reasonably relate to at least one (a loose match is fine on this pass):`
    : `THE 7 STORY TYPES — article must match at least one:`;

  const systemPrompt = `You are a content intelligence researcher for CA Ketul Patel's personal LinkedIn profile.

Today's date is ${todayStr}.

Your task: From the articles below, select the best 5 for LinkedIn post source material.${relaxed ? ' This is a second, relaxed pass — the strict pass returned nothing, so favor including a reasonable story over rejecting everything, while still respecting the hard exclusions below.' : ' Apply all filters strictly.'}

RECENCY — NON-NEGOTIABLE: Only select articles published within the last ${maxAgeDays} days of today's date. If an article's published date cannot be confirmed, or falls outside this window, reject it — do not guess a date.

${signalsBlock}

${storyTypesBlock}
1. Celebrity or creator turning brand owner (with equity/creative stake — not just an ambassador)
2. Brand x brand or brand x IP collaboration with a real product output in India
3. Global luxury or premium brand entering or expanding significantly in India
4. D2C or new-age brand funding, IPO, or major milestone (Series A or above)
5. OTT or entertainment platform driving brand visibility with commercial outcome
6. Indian brand going global (international fashion week, global celebrity, foreign market entry)
7. Unconventional community or cultural marketing (not a standard ad campaign)

HARD EXCLUSION — reject if any apply:
- Pure ambassador deal with no equity or creative stake
- Routine store opening by a mass-market chain with no strategic pivot
- Trade, B2B, manufacturing, gem mining, export policy, supply chain
- Macro trend report or ranking listicle with no specific named brand event
- Funding in food, supplements, pure tech, fintech — non-lifestyle category
- Source is SEO blog, forum, Reddit, Quora, unverifiable aggregator, brand microsite
- Story is vague trend commentary with no named brand event

Score each accepted article out of 100 for virality (5 factors x 20 pts: hook strength, emotional resonance, shareability, engagement trigger, narrative arc).

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no explanation:
{
  "options": [
    {
      "label": "Brand/story — one-line angle for LinkedIn",
      "score": 86,
      "story_type": 1,
      "brand": "Brand Name",
      "person": "Person Name, Role",
      "url": "https://...",
      "source": "publication name",
      "date_published": "YYYY-MM-DD",
      "summary": "One sentence: what happened",
      "angle": "Two sentences: what a D2C/jewellery founder could discuss"
    }
  ]
}

Return up to 5 options, ranked by score descending. If fewer than 5 pass all checks, return however many did. Every option must include a confirmed "date_published" within the last ${maxAgeDays} days.`;

  const response = await callClaude(env, systemPrompt, `Here are the articles to evaluate:\n\n${articlesBlock}`, maxTokens, (chars) => emit({ stage: 'generating', chars, max_tokens: maxTokens }));
  const parsed = parseJSON(response);
  if (!parsed?.options) throw new Error('No options in response');
  return parsed.options;
}

/* ── HELPERS ─────────────────────────────────────────────────── */

async function callClaude(env, system, user, maxTokens = 2000, onProgress) {
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

async function tavilySearch(env, query, maxAgeDays = 25) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: env.TAVILY_API_KEY,
      query,
      topic: 'news',
      days: maxAgeDays,
      search_depth: 'basic',
      max_results: 5,
      include_domains: [
        'retailjewellerindia.com', 'inc42.com', 'afaqs.com', 'indianretailer.com',
        'impactonnet.com', 'fashionunited.in', 'retail.economictimes.indiatimes.com',
        'exchange4media.com', 'indianjeweller.in', 'storyboard18.com', 'harpersbazaar.in',
        'cosmopolitan.in', 'luxebook.in', 'business-standard.com', 'infashionbusiness.com',
        'medianews4u.com', 'prnewswire.com', 'jewelbuzz.in',
      ],
    }),
  });

  if (!res.ok) throw new Error(`Tavily error ${res.status}`);
  const data = await res.json();
  return data.results || [];
}

function parseJSON(text) {
  // Strip markdown code fences if Claude wrapped the JSON
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return JSON.parse(clean);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
