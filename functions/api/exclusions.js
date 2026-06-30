// Exclusions API — manages published leaders and used source URLs
// GET  /api/exclusions        — returns all exclusions
// POST /api/exclusions        — adds a new exclusion
// DELETE /api/exclusions      — removes an exclusion by value

export async function onRequestGet(context) {
  const { env } = context

  try {
    const rows = await env.DB.prepare(
      'SELECT * FROM exclusions ORDER BY created_at DESC'
    ).all()

    return Response.json({ exclusions: rows.results })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const body = await request.json()
    const { type, value, profile, reason } = body

    if (!type || !value) {
      return Response.json({ error: 'type and value are required' }, { status: 400 })
    }

    const id = crypto.randomUUID()

    await env.DB.prepare(
      'INSERT OR IGNORE INTO exclusions (id, type, value, profile, reason) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, type, value, profile || null, reason || null).run()

    return Response.json({ success: true, id })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context

  try {
    const body = await request.json()
    const { value } = body

    if (!value) {
      return Response.json({ error: 'value is required' }, { status: 400 })
    }

    await env.DB.prepare(
      'DELETE FROM exclusions WHERE value = ?'
    ).bind(value).run()

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
