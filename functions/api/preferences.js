// Preferences API — logs every user selection and returns preference history
// POST /api/preferences       — saves a selection (called every time user picks from a shortlist)
// GET  /api/preferences       — returns recent selections for the learning context

export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const body = await request.json()
    const { profile, content_type, options_json, selected_index, selected_subject, selected_score } = body

    if (!profile || !content_type || !options_json || selected_index === undefined || !selected_subject) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const id = crypto.randomUUID()

    await env.DB.prepare(
      `INSERT INTO preferences (id, profile, content_type, options_json, selected_index, selected_subject, selected_score)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, profile, content_type, JSON.stringify(options_json), selected_index, selected_subject, selected_score || null).run()

    return Response.json({ success: true, id })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const profile = url.searchParams.get('profile')
  const content_type = url.searchParams.get('content_type')
  const limit = parseInt(url.searchParams.get('limit') || '20')

  try {
    let query = 'SELECT selected_subject, selected_score, content_type, created_at FROM preferences'
    const conditions = []
    const bindings = []

    if (profile) { conditions.push('profile = ?'); bindings.push(profile) }
    if (content_type) { conditions.push('content_type = ?'); bindings.push(content_type) }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ')
    query += ' ORDER BY created_at DESC LIMIT ?'
    bindings.push(limit)

    const rows = await env.DB.prepare(query).bind(...bindings).all()
    return Response.json({ preferences: rows.results })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
