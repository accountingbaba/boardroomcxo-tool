// Settings API — read and update prompts, keywords, and preferences
// GET  /api/settings         — returns all settings
// POST /api/settings         — updates one setting by key

export async function onRequestGet(context) {
  const { env } = context

  try {
    const rows = await env.DB.prepare(
      'SELECT key, value, label, category, updated_at FROM settings ORDER BY category, key'
    ).all()

    return Response.json({ settings: rows.results })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const body = await request.json()
    const { key, value } = body

    if (!key || value === undefined) {
      return Response.json({ error: 'key and value are required' }, { status: 400 })
    }

    await env.DB.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).bind(key, value).run()

    return Response.json({ success: true, key })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
