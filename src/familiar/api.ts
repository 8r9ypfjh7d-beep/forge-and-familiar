// Talks to the `familiar` Supabase Edge Function, which holds the Gemini key and the per-account limits.
import { cloudConfig } from '../cloud/config'
import { getSupabase } from '../cloud/client'
import { FamiliarError, type FamiliarRequest, type FamiliarResponse, type Part } from './types'

export type FamiliarTransport = (body: FamiliarRequest, opts: { signal?: AbortSignal; onText?: (delta: string) => void }) => Promise<FamiliarResponse>

interface GeminiChunk {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[]
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
}

/** Merges streamed chunks into one answer: text parts are joined, other parts kept in order. */
export function mergeChunks(chunks: GeminiChunk[]): FamiliarResponse {
  const parts: Part[] = []
  let finishReason: string | undefined
  let usage: FamiliarResponse['usage']
  for (const c of chunks) {
    const cand = c.candidates?.[0]
    for (const p of cand?.content?.parts ?? []) {
      const prev = parts[parts.length - 1]
      if (p.text != null && !p.functionCall && prev && prev.text != null && !prev.functionCall && !!prev.thought === !!p.thought && !p.thoughtSignature) prev.text += p.text
      else parts.push({ ...p })
    }
    if (cand?.finishReason) finishReason = cand.finishReason
    if (c.usageMetadata) usage = { tokensIn: c.usageMetadata.promptTokenCount ?? 0, tokensOut: c.usageMetadata.candidatesTokenCount ?? 0 }
  }
  return { parts, finishReason, usage }
}

/** Splits a server-sent-events buffer into complete `data:` payloads and the unfinished rest. */
export function parseSse(buffer: string): { events: string[]; rest: string } {
  const blocks = buffer.split(/\r?\n\r?\n/)
  const rest = blocks.pop() ?? ''
  const events = blocks.flatMap(b => b.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim())).filter(Boolean)
  return { events, rest }
}

export const functionUrl = () => (cloudConfig ? `${cloudConfig.url.replace(/\/$/, '')}/functions/v1/familiar` : null)

async function errorFor(res: Response): Promise<FamiliarError> {
  const body = await res.json().catch(() => ({} as Record<string, unknown>))
  if (res.status === 401) return new FamiliarError('signIn')
  if (res.status === 429) return new FamiliarError('limit', 'limit', typeof body.resetAt === 'string' ? body.resetAt : undefined)
  if (res.status === 413) return new FamiliarError('tooLarge')
  if (res.status === 503) return new FamiliarError('notConfigured', String(body.message ?? 'not configured'))
  return new FamiliarError('server', String(body.message ?? `HTTP ${res.status}`))
}

/** The real transport: POST to the Edge Function with this device's session. Streams when `onText` is given. */
export const edgeTransport: FamiliarTransport = async (body, { signal, onText }) => {
  const url = functionUrl()
  if (!url || !cloudConfig) throw new FamiliarError('notConfigured')
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new FamiliarError('offline')
  const supabase = await getSupabase()
  const token = (await supabase?.auth.getSession())?.data.session?.access_token
  if (!token) throw new FamiliarError('signIn')
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: cloudConfig.anonKey },
      body: JSON.stringify({ ...body, stream: !!onText }),
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new FamiliarError('offline')
  }
  if (!res.ok) throw await errorFor(res)
  if (!onText || !res.body) return mergeChunks([await res.json() as GeminiChunk])

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const chunks: GeminiChunk[] = []
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const { events, rest } = parseSse(done ? buffer + '\n\n' : buffer)
    buffer = rest
    for (const e of events) {
      try {
        const chunk = JSON.parse(e) as GeminiChunk
        chunks.push(chunk)
        for (const p of chunk.candidates?.[0]?.content?.parts ?? []) if (p.text && !p.thought) onText(p.text)
      } catch { /* ignore a broken event */ }
    }
    if (done) break
  }
  return mergeChunks(chunks)
}
