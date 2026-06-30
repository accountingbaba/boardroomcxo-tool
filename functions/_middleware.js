// Auth middleware — runs before every API function
// All requests to /api/* must include the correct passphrase in the header
// Set the passphrase with: wrangler secret put ACCESS_PASSPHRASE

export async function onRequest(context) {
  const { request, env, next } = context

  const url = new URL(request.url)

  // Only protect /api routes
  if (!url.pathname.startsWith('/api/')) {
    return next()
  }

  // Allow preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders(),
    })
  }

  const passphrase = request.headers.get('x-access-passphrase')

  if (!passphrase || passphrase !== env.ACCESS_PASSPHRASE) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    })
  }

  const response = await next()

  // Add CORS headers to all API responses
  const newHeaders = new Headers(response.headers)
  Object.entries(corsHeaders()).forEach(([k, v]) => newHeaders.set(k, v))

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-access-passphrase',
  }
}
