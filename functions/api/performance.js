// Performance log API — manual entry of post metrics after publishing
// POST /api/performance       — log metrics for a post
// GET  /api/performance       — get all performance entries

export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const body = await request.json()
    const { post_id, platform, likes, comments, reposts, impressions, notes } = body

    if (!post_id) {
      return Response.json({ error: 'post_id is required' }, { status: 400 })
    }

    const id = crypto.randomUUID()

    await env.DB.prepare(
      `INSERT INTO performance_log (id, post_id, platform, likes, comments, reposts, impressions, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, post_id,
      platform || 'linkedin',
      likes || 0, comments || 0, reposts || 0, impressions || 0,
      notes || null
    ).run()

    return Response.json({ success: true, id })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function onRequestGet(context) {
  const { env } = context

  try {
    const rows = await env.DB.prepare(
      `SELECT pl.*, p.subject, p.profile, p.content_type, p.linkedin_post
       FROM performance_log pl
       LEFT JOIN posts p ON pl.post_id = p.id
       ORDER BY pl.logged_at DESC
       LIMIT 50`
    ).all()

    return Response.json({ logs: rows.results })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
