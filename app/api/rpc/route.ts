const UPSTREAM = 'https://studio.genlayer.com/api'

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32000, message: error instanceof Error ? error.message : 'RPC proxy failed' } },
      { status: 502 },
    )
  }
}

