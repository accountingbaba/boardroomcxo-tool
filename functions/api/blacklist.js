// Blacklist API — topics the tool must never suggest
// GET  /api/blacklist — returns all terms
// POST /api/blacklist — adds a new term
// DELETE /api/blacklist — removes a term by value

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const rows = await env.DB.prepare(
      'SELECT * FROM blacklist ORDER BY created_at DESC'
    ).all();
    return Response.json({ terms: rows.results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { term, profile } = body;
    if (!term) return Response.json({ error: 'term required' }, { status: 400 });
    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT OR IGNORE INTO blacklist (id, term, profile) VALUES (?, ?, ?)'
    ).bind(id, term.trim(), profile || null).run();
    return Response.json({ success: true, id });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { term } = body;
    if (!term) return Response.json({ error: 'term required' }, { status: 400 });
    await env.DB.prepare('DELETE FROM blacklist WHERE term = ?').bind(term).run();
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
