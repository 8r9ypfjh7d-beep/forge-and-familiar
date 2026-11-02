// Character art (portrait, token art, gallery): pure helpers. Uploading lives in cloud.ts, resizing in image.ts.
import type { ArtPiece, Character } from '../model/character'

/** Most pictures a gallery keeps. */
export const MAX_GALLERY = 24
/** Longest side in pixels per kind of picture. Tokens are cut to a square. */
export const ART_SIZE = { portrait: 640, token: 256, gallery: 1600 } as const
export type ArtKind = keyof typeof ART_SIZE
/** Without the cloud pictures are kept as data URLs inside the character, so they stay smaller. */
export const LOCAL_SIZE: Record<ArtKind, number> = { portrait: 400, token: 160, gallery: 800 }

/** A link anyone at the table can load (not a data URL living on one device). */
export const isRemote = (url: string | undefined): url is string => !!url && /^https:\/\//.test(url)

/** The picture a battle map token shows: the token art, else the portrait. */
export const tokenArt = (c: Pick<Character, 'token' | 'portrait'>): string | undefined => c.token || c.portrait || undefined

/** Token art that may travel on the live combat row to every player: only links, never a data URL. */
export const sharedTokenArt = (c: Pick<Character, 'token' | 'portrait'>): string | undefined => {
  const url = tokenArt(c)
  return isRemote(url) ? url : undefined
}

/** The centred square of a picture, for token art. */
export function squareCrop(width: number, height: number): { sx: number; sy: number; side: number } {
  const side = Math.min(width, height)
  return { sx: Math.round((width - side) / 2), sy: Math.round((height - side) / 2), side }
}

/** Width and height inside max on the longer side, never upscaled. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export const galleryOf = (c: Character): ArtPiece[] => c.gallery ?? []

/** New pictures go first; the oldest drop off past MAX_GALLERY. */
export function addPieces(c: Character, pieces: ArtPiece[]): Character {
  return { ...c, gallery: [...pieces, ...galleryOf(c)].slice(0, MAX_GALLERY) }
}

export function removePiece(c: Character, id: string): Character {
  const gallery = galleryOf(c).filter(p => p.id !== id)
  const { gallery: _g, ...rest } = c
  return gallery.length ? { ...rest, gallery } : rest
}

export function setCaption(c: Character, id: string, caption: string): Character {
  const text = caption.trim()
  return {
    ...c,
    gallery: galleryOf(c).map(p => {
      if (p.id !== id) return p
      const { caption: _c, ...rest } = p
      return text ? { ...rest, caption: text } : rest
    }),
  }
}

/** Sets or clears the portrait or the token art. */
export function setArt(c: Character, kind: 'portrait' | 'token', url: string | undefined): Character {
  const { [kind]: _old, ...rest } = c
  return url ? { ...rest, [kind]: url } : rest
}

/** Whether the character still shows this picture anywhere, so its file must stay. */
export const stillUsed = (c: Character, url: string): boolean =>
  c.portrait === url || c.token === url || galleryOf(c).some(p => p.url === url)

/** Links the character used before and no longer does: their files can be removed. */
export function droppedArt(before: Character, after: Character): string[] {
  const urls = [before.portrait, before.token, ...galleryOf(before).map(p => p.url)].filter(isRemote)
  return [...new Set(urls)].filter(u => !stillUsed(after, u))
}

/** The file path inside the `art` bucket for a public link, or null for anything else. */
export function artPath(url: string): string | null {
  const m = /\/storage\/v1\/object\/public\/art\/([^?#]+)/.exec(url)
  return m ? decodeURIComponent(m[1]) : null
}

/** Without the pictures: for undo logs and snapshots, which never restore art. */
export function withoutArt<T extends Partial<Pick<Character, 'portrait' | 'token' | 'gallery'>>>(c: T): Omit<T, 'portrait' | 'token' | 'gallery'> {
  const { portrait: _p, token: _t, gallery: _g, ...rest } = c
  return rest
}
