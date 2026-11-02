import { describe, expect, it } from 'vitest'
import { withTokenArt } from '../combat/map/tokens'
import type { Token } from '../combat/types'
import type { Character } from '../model/character'
import { forShare } from '../share/link'
import { takeSnapshot } from '../portability/snapshots'
import {
  addPieces, artPath, droppedArt, fitWithin, MAX_GALLERY, removePiece, setArt, setCaption, sharedTokenArt, squareCrop, stillUsed, tokenArt,
} from './logic'

const LINK = 'https://x.supabase.co/storage/v1/object/public/art/acct-ziv/c1/a.jpg'
const LINK2 = 'https://x.supabase.co/storage/v1/object/public/art/acct-ziv/c1/b.jpg'
const DATA = 'data:image/jpeg;base64,AAAA'
const base = { id: 'c1', name: 'Ada', ownerId: 'acct-ziv', notes: 'secret' } as unknown as Character

describe('character art', () => {
  it('token art falls back to the portrait; only links travel to other players', () => {
    expect(tokenArt({ portrait: LINK })).toBe(LINK)
    expect(tokenArt({ portrait: LINK, token: LINK2 })).toBe(LINK2)
    expect(tokenArt({})).toBeUndefined()
    expect(sharedTokenArt({ portrait: DATA })).toBeUndefined()
    expect(sharedTokenArt({ token: LINK2 })).toBe(LINK2)
  })

  it('crops tokens to the centred square and never upscales', () => {
    expect(squareCrop(400, 200)).toEqual({ sx: 100, sy: 0, side: 200 })
    expect(squareCrop(100, 300)).toEqual({ sx: 0, sy: 100, side: 100 })
    expect(fitWithin(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 })
    expect(fitWithin(200, 100, 1600)).toEqual({ width: 200, height: 100 })
  })

  it('adds newest first, caps the gallery, captions and removes', () => {
    let c = addPieces(base, [{ id: 'a', url: LINK }])
    c = addPieces(c, [{ id: 'b', url: LINK2 }])
    expect(c.gallery!.map(p => p.id)).toEqual(['b', 'a'])
    c = setCaption(c, 'a', '  At the inn ')
    expect(c.gallery![1].caption).toBe('At the inn')
    expect(setCaption(c, 'a', '').gallery![1]).not.toHaveProperty('caption')
    expect(removePiece(removePiece(c, 'a'), 'b')).not.toHaveProperty('gallery')
    const many = addPieces(base, Array.from({ length: MAX_GALLERY + 5 }, (_, i) => ({ id: `p${i}`, url: LINK })))
    expect(many.gallery).toHaveLength(MAX_GALLERY)
  })

  it('removes a file only once nothing shows it any more', () => {
    const c = setArt(addPieces(base, [{ id: 'a', url: LINK }]), 'portrait', LINK)
    expect(stillUsed(removePiece(c, 'a'), LINK)).toBe(true)
    expect(droppedArt(c, removePiece(c, 'a'))).toEqual([])
    expect(droppedArt(c, setArt(removePiece(c, 'a'), 'portrait', undefined))).toEqual([LINK])
    expect(droppedArt(setArt(base, 'portrait', DATA), base)).toEqual([])
    expect(artPath(LINK)).toBe('acct-ziv/c1/a.jpg')
    expect(artPath(DATA)).toBeNull()
    expect(setArt(c, 'token', undefined)).not.toHaveProperty('token')
  })

  it('map tokens pick up party art and report no change when it is the same', () => {
    const tokens = [{ id: 't1', combatantId: 'x', characterId: 'c1', kind: 'pc', label: 'A', x: 0, y: 0, size: 1 }] as Token[]
    const next = withTokenArt(tokens, () => LINK)!
    expect(next[0].art).toBe(LINK)
    expect(withTokenArt(next, () => LINK)).toBeNull()
    expect(withTokenArt(next, () => undefined)![0]).not.toHaveProperty('art')
  })

  it('share links keep linked pictures only; snapshots leave art out', () => {
    const c = { ...addPieces(base, [{ id: 'a', url: LINK }, { id: 'b', url: DATA }]), portrait: LINK, token: LINK2 } as Character
    const shared = forShare(c)
    expect(shared.gallery!.map(p => p.id)).toEqual(['a'])
    expect(shared.portrait).toBe(LINK)
    expect(shared.token).toBe(LINK2)
    const snap = takeSnapshot({ ...c, classes: [], state: {} } as unknown as Character)
    expect(snap.character).not.toHaveProperty('gallery')
    expect(snap.character).not.toHaveProperty('token')
  })
})
