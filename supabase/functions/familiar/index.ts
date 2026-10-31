// The Familiar: Gemini proxy for the in-app assistant. The browser never sees the Gemini key.
// Auth: the Supabase JWT of the device (gateway-verified) must map to a linked account.
// Limits: per account per UTC day, counted in assistant_usage; allowances in assistant_limits or the defaults below.
// Stateless: the client sends the whole conversation (Gemini `contents`), tools run in the browser.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ORIGINS = (Deno.env.get('FAMILIAR_ORIGINS') ?? 'https://forge-and-familiar.onrender.com,http://localhost:5173,http://localhost:4173').split(',')

const DEFAULT_LIMITS = { requests_per_day: 80, tokens_per_day: 400_000 }
const ADMIN_FACTOR = 5
const MAX_BODY = 200_000
const MAX_CONTENTS = 80

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && (ORIGINS.includes(origin) || origin.endsWith('.onrender.com')) ? origin : ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
})

const json = (status: number, body: unknown, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })

/** The `sub` of a JWT the gateway already verified. */
function userIdFrom(auth: string | null): string | null {
  const token = auth?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

const nextUtcMidnight = () => {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString()
}

Deno.serve(async (req: Request) => {
  const headers = cors(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json(405, { error: 'method' }, headers)
  if (!GEMINI_KEY) return json(503, { error: 'server', message: 'GEMINI_API_KEY is not set' }, headers)

  const userId = userIdFrom(req.headers.get('authorization'))
  if (!userId) return json(401, { error: 'signIn' }, headers)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const { data: device } = await admin.from('account_devices').select('account_id, accounts(is_admin)').eq('user_id', userId).maybeSingle()
  const accountId = device?.account_id as string | undefined
  if (!accountId) return json(401, { error: 'signIn' }, headers)
  const isAdmin = !!(device as { accounts?: { is_admin?: boolean } | null })?.accounts?.is_admin

  const [{ data: limitRow }, { data: usage }] = await Promise.all([
    admin.from('assistant_limits').select('requests_per_day, tokens_per_day').eq('account_id', accountId).maybeSingle(),
    admin.from('assistant_usage').select('requests, tokens_in, tokens_out').eq('account_id', accountId).eq('day', new Date().toISOString().slice(0, 10)).maybeSingle(),
  ])
  const factor = limitRow ? 1 : isAdmin ? ADMIN_FACTOR : 1
  const limits = {
    requests: (limitRow?.requests_per_day ?? DEFAULT_LIMITS.requests_per_day) * factor,
    tokens: (limitRow?.tokens_per_day ?? DEFAULT_LIMITS.tokens_per_day) * factor,
  }
  const used = { requests: usage?.requests ?? 0, tokens: (usage?.tokens_in ?? 0) + (usage?.tokens_out ?? 0) }
  if (used.requests >= limits.requests || used.tokens >= limits.tokens) {
    return json(429, { error: 'limit', resetAt: nextUtcMidnight(), used, limits }, headers)
  }

  const raw = await req.text()
  if (raw.length > MAX_BODY) return json(413, { error: 'tooLarge' }, headers)
  let body: { contents?: unknown[]; tools?: unknown; systemInstruction?: unknown; stream?: boolean; generationConfig?: unknown }
  try {
    body = JSON.parse(raw)
  } catch {
    return json(400, { error: 'badRequest' }, headers)
  }
  if (!Array.isArray(body.contents) || body.contents.length === 0 || body.contents.length > MAX_CONTENTS) return json(400, { error: 'badRequest' }, headers)

  const consume = (requests: number, tokensIn: number, tokensOut: number) =>
    admin.rpc('assistant_consume', { p_account: accountId, p_requests: requests, p_tokens_in: tokensIn, p_tokens_out: tokensOut }).then(() => {}, () => {})
  await consume(1, 0, 0)

  const method = body.stream ? 'streamGenerateContent?alt=sse' : 'generateContent'
  const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      contents: body.contents,
      tools: body.tools,
      systemInstruction: body.systemInstruction,
      generationConfig: body.generationConfig ?? { temperature: 0.4 },
    }),
  })
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '')
    console.error('gemini', upstream.status, text.slice(0, 500))
    return json(502, { error: 'server', status: upstream.status, message: text.slice(0, 300) }, headers)
  }

  const usageOf = (chunk: { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }) =>
    chunk.usageMetadata ? { tokensIn: chunk.usageMetadata.promptTokenCount ?? 0, tokensOut: chunk.usageMetadata.candidatesTokenCount ?? 0 } : null

  if (!body.stream) {
    const data = await upstream.json()
    const u = usageOf(data)
    if (u) await consume(0, u.tokensIn, u.tokensOut)
    return json(200, { ...data, model: MODEL }, headers)
  }

  // Stream: pass the SSE bytes through; the last chunk carries the usage, counted after the stream ends.
  let last: { tokensIn: number; tokensOut: number } | null = null
  let tail = ''
  const decoder = new TextDecoder()
  const pass = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk)
      tail = (tail + decoder.decode(chunk, { stream: true })).slice(-20_000)
      for (const m of tail.matchAll(/^data: (.+)$/gm)) {
        try {
          const u = usageOf(JSON.parse(m[1]))
          if (u) last = u
        } catch { /* partial line */ }
      }
    },
    flush() {
      if (last) consume(0, last.tokensIn, last.tokensOut)
    },
  })
  return new Response(upstream.body!.pipeThrough(pass), {
    headers: { ...headers, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Familiar-Model': MODEL },
  })
})
