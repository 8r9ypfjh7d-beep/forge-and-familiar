import { describe, expect, it } from 'vitest'
import { makeCharacter } from '../sheet/fixtures'
import { decodeCharacter, encodeCharacter, forShare, MAX_PORTRAIT, shareCodeFrom, shareLink } from './link'

describe('share links', () => {
  const c = makeCharacter({ ownerId: 'acct-roy', notes: 'Secretly the lost heir' })

  it('round-trips a character through a compressed code', async () => {
    const code = await encodeCharacter(c)
    expect(code[0]).toBe('z')
    const r = await decodeCharacter(code)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.character.name).toBe(c.name)
      expect(r.character.classes).toEqual(c.classes)
      expect(r.character.state.currentHp).toBe(c.state.currentHp)
    }
  })

  it('leaves out the owner and private notes', () => {
    const s = forShare(c)
    expect(s.ownerId).toBe('')
    expect(s.notes).toBe('')
    expect(c.notes).toBe('Secretly the lost heir')
  })

  it('drops a portrait too big for a link', () => {
    expect(forShare({ ...c, portrait: 'data:image/png;base64,' + 'A'.repeat(MAX_PORTRAIT) }).portrait).toBeUndefined()
    expect(forShare({ ...c, portrait: 'https://example.com/me.png' }).portrait).toBe('https://example.com/me.png')
  })

  it('rejects broken and cut-off codes', async () => {
    const code = await encodeCharacter(c)
    expect(await decodeCharacter(code.slice(0, code.length / 2))).toEqual({ ok: false, error: 'broken' })
    expect(await decodeCharacter('x123')).toEqual({ ok: false, error: 'broken' })
  })

  it('reports characters this device cannot read', async () => {
    const r = await decodeCharacter(await encodeCharacter({ ...c, raceId: 'homebrew-moon-elf' }))
    expect(r).toEqual({ ok: false, error: 'unknown' })
  })

  it('finds the code in the hash', async () => {
    const link = await shareLink(c, 'https://forge.example/')
    expect(link.startsWith('https://forge.example/#ff-character=z')).toBe(true)
    expect(shareCodeFrom(new URL(link).hash)).toBe(link.split('=')[1])
    expect(shareCodeFrom('#ff-request=abc')).toBeNull()
  })
})
