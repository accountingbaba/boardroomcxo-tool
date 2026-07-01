// Posts API — manages all content drafts and published posts
// GET  /api/posts             — returns all posts (with optional status filter)
// POST /api/posts             — creates a new post record
// PATCH /api/posts            — updates a post (status change, add content, log publish)

export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const profile = url.searchParams.get('profile')

  try {
    let query = 'SELECT * FROM posts'
    const conditions = []
    const bindings = []

    if (status) {
      conditions.push('status = ?')
      bindings.push(status)
    }
    if (profile) {
      conditions.push('profile = ?')
      bindings.push(profile)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY created_at DESC'

    const rows = await env.DB.prepare(query).bind(...bindings).all()
    return Response.json({ posts: rows.results })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const body = await request.json()
    const { profile, content_type, subject, source_url } = body

    if (!profile || !content_type) {
      return Response.json({ error: 'profile and content_type are required' }, { status: 400 })
    }

    const id = crypto.randomUUID()

    await env.DB.prepare(
      `INSERT INTO posts (id, profile, content_type, subject, source_url)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, profile, content_type, subject || null, source_url || null).run()

    return Response.json({ success: true, id })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function onRequestPatch(context) {
  const { request, env } = context

  try {
    const body = await request.json()
    const { id, ...fields } = body

    if (!id) {
      return Response.json({ error: 'id is required' }, { status: 400 })
    }

    const allowed = [
      'linkedin_post', 'instagram_post', 'whatsapp_post', 'blog_post',
      'image_prompt', 'image_url', 'scheduled_date', 'status',
      'virality_score', 'seo_score', 'aeo_score', 'persona_panel_score', 'published_at'
    ]

    const updates = []
    const bindings = []

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`)
        bindings.push(fields[key])
      }
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    bindings.push(id)

    await env.DB.prepare(
      `UPDATE posts SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...bindings).run()

    // Add the leader/URL to exclusions as soon as a post is approved (not just
    // published) — otherwise a leader the user already approved but hasn't
    // published yet keeps reappearing in later shortlist searches.
    if (fields.status === 'approved' || fields.status === 'published') {
      const post = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first()
      if (post) {
        const exclusionId = crypto.randomUUID()
        const reason = fields.status === 'published' ? 'Published' : 'Approved'
        if (post.content_type === 'leadership' && post.subject) {
          await env.DB.prepare(
            'INSERT OR IGNORE INTO exclusions (id, type, value, profile, reason) VALUES (?, ?, ?, ?, ?)'
          ).bind(exclusionId, 'leader', post.subject, post.profile, reason).run()
        }
        if (post.content_type === 'industry' && post.source_url) {
          await env.DB.prepare(
            'INSERT OR IGNORE INTO exclusions (id, type, value, profile, reason) VALUES (?, ?, ?, ?, ?)'
          ).bind(exclusionId, 'source_url', post.source_url, post.profile, reason).run()
        }
      }
    }

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
