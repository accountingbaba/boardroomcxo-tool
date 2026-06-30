// Simple health check endpoint — confirms the Worker and DB are connected
export async function onRequestGet(context) {
  const { env } = context

  try {
    await env.DB.prepare('SELECT 1').run()
    return Response.json({ status: 'ok', db: 'connected' })
  } catch (err) {
    return Response.json({ status: 'error', message: err.message }, { status: 500 })
  }
}
