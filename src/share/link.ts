import type { Character } from '../model/character'
import { checkCharacter } from '../portability/file'

/** The hash parameter of a read-only share link: `#ff-character=<code>`. The hash never reaches the server. */
export const SHARE_PARAM = 'ff-character'

/** Portraits above this size (characters of a data URL) are left out so the link stays short enough to paste. */
export const MAX_PORTRAIT = 40_000

/** What a share link carries: the character without its owner id and private notes. */
export function forShare(c: Character): Character {
  const { ownerId: _o, notes: _n, portrait, ...rest } = structuredClone(c)
  const keep = portrait && portrait.length <= MAX_PORTRAIT ? { portrait } : {}
  return { ...rest, ...keep, ownerId: '', notes: '' }
}

const toBase64Url = (bytes: Uint8Array) => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (code: string) => Uint8Array.from(atob(code.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0))

const pipe = async (bytes: Uint8Array, stream: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer())

// Codes start with a version letter: "z" is deflated JSON, "j" plain JSON (browsers without CompressionStream).
export async function encodeCharacter(c: Character): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify({ v: 1, c: forShare(c) }))
  if (typeof CompressionStream === 'undefined') return 'j' + toBase64Url(json)
  return 'z' + toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))
}

export type Decoded = { ok: true; character: Character } | { ok: false; error: 'broken' | 'unknown' }

/** Reads a share code. "unknown" means it parsed but names content this device lacks (homebrew) or is from a newer app. */
export async function decodeCharacter(code: string): Promise<Decoded> {
  let raw: unknown
  try {
    const bytes = fromBase64Url(code.slice(1))
    const json = code[0] === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : code[0] === 'j' ? bytes : null
    if (!json) return { ok: false, error: 'broken' }
    raw = JSON.parse(new TextDecoder().decode(json))
  } catch {
    return { ok: false, error: 'broken' }
  }
  if (typeof raw !== 'object' || raw === null || (raw as { v?: unknown }).v !== 1) return { ok: false, error: 'broken' }
  const c = checkCharacter((raw as { c?: unknown }).c)
  return typeof c === 'string' ? { ok: false, error: 'unknown' } : { ok: true, character: c }
}

export function shareCodeFrom(hash: string): string | null {
  const m = new RegExp(`[#&]${SHARE_PARAM}=([A-Za-z0-9_-]+)`).exec(hash)
  return m ? m[1] : null
}

export async function shareLink(c: Character, base = `${location.origin}${location.pathname}`): Promise<string> {
  return `${base}#${SHARE_PARAM}=${await encodeCharacter(c)}`
}
