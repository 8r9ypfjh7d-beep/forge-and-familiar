import { describe, expect, it } from 'vitest'
import { makeCharacter } from '../sheet/fixtures'
import { getMaxHp } from '../rules'
import { asImported, exportCharacter, fileName, parseCharacterFile } from './file'
import { restoreSnapshot, takeSnapshot, totalLevel } from './snapshots'

const parse = (x: unknown) => parseCharacterFile(JSON.stringify(x))
const fileFor = (character: unknown, extra: object = {}) =>
  ({ format: 'forge-and-familiar/character', version: 1, exportedAt: '', character, snapshots: [], ...extra })

describe('character files', () => {
  it('round-trips a character and its snapshots', () => {
    const c = makeCharacter({ notes: 'Owes the guild 40 gp' })
    const snap = takeSnapshot(c)
    const result = parseCharacterFile(exportCharacter(c, [snap]))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.file.character).toEqual(c)
    expect(result.file.snapshots).toHaveLength(1)
    expect(result.file.snapshots[0].label).toBe('Level 7')
  })

  it('rejects files that are not character files', () => {
    expect(parseCharacterFile('not json').ok).toBe(false)
    expect(parse({ hello: 'world' }).ok).toBe(false)
    expect(parse(fileFor(makeCharacter(), { version: 99 }))).toMatchObject({ ok: false, error: expect.stringMatching(/newer/) })
  })

  it('rejects characters the engine cannot read', () => {
    expect(parse(fileFor({ ...makeCharacter(), classes: [{ classId: 'gunslinger', level: 3 }] })))
      .toMatchObject({ ok: false, error: 'Unknown class "gunslinger".' })
    expect(parse(fileFor({ ...makeCharacter(), raceId: 'xyz' })).ok).toBe(false)
    expect(parse(fileFor({ ...makeCharacter(), classes: [{ classId: 'fighter', level: 21 }] })).ok).toBe(false)
    expect(parse(fileFor({ ...makeCharacter(), baseAbilities: { str: 10 } })).ok).toBe(false)
    expect(parse(fileFor({ ...makeCharacter(), schemaVersion: 2 })).ok).toBe(false)
  })

  it('fills fields an older file lacks, including a fresh play state', () => {
    const { state: _, notes: __, coins: ___, ...bare } = makeCharacter()
    const result = parse(fileFor(bare))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.file.character.notes).toBe('')
    expect(result.file.character.state.currentHp).toBe(getMaxHp(result.file.character))
  })

  it('drops broken snapshots but keeps the character', () => {
    const c = makeCharacter()
    const result = parse(fileFor(c, { snapshots: [takeSnapshot(c), { label: 'x' }] }))
    expect(result.ok && result.file.snapshots.length).toBe(1)
  })

  it('imports as a new character for the importing player', () => {
    const c = makeCharacter({ id: 'old', ownerId: 'friend' })
    const parsed = parseCharacterFile(exportCharacter(c, [takeSnapshot(c)]))
    if (!parsed.ok) throw new Error(parsed.error)
    let n = 0
    const { character, snapshots } = asImported(parsed.file, 'me', () => `id${++n}`)
    expect(character.id).toBe('id1')
    expect(character.ownerId).toBe('me')
    expect(snapshots[0]).toMatchObject({ id: 'id2', characterId: 'id1', character: { id: 'id1', ownerId: 'me' } })
  })

  it('names files after the character', () => {
    expect(fileName({ name: 'Brannoc Ashvale' })).toBe('brannoc-ashvale.character.json')
    expect(fileName({ name: '???' })).toBe('character.character.json')
  })
})

describe('level snapshots', () => {
  it('labels by total level and leaves out the portrait', () => {
    const snap = takeSnapshot(makeCharacter({ portrait: 'data:image/jpeg;base64,AAAA' }))
    expect(snap.level).toBe(7)
    expect(snap.label).toBe('Level 7')
    expect(snap.character.portrait).toBeUndefined()
    expect(takeSnapshot(makeCharacter(), '  Before multiclass ').label).toBe('Before multiclass')
  })

  it('rolls back the build and keeps notes, gear and portrait', () => {
    const before = makeCharacter({ classes: [{ classId: 'fighter', level: 4 }], xp: 2700 })
    const snap = takeSnapshot(before)
    const after = makeCharacter({
      classes: [{ classId: 'fighter', level: 5 }],
      xp: 6500,
      notes: 'Found a map',
      portrait: 'data:x',
      coins: { cp: 0, sp: 0, gp: 120 },
    })
    const restored = restoreSnapshot(after, snap)
    expect(totalLevel(restored)).toBe(4)
    expect(restored.xp).toBe(2700)
    expect(restored.notes).toBe('Found a map')
    expect(restored.portrait).toBe('data:x')
    expect(restored.coins.gp).toBe(120)
  })

  it('clamps HP to the lower max after a rollback', () => {
    const snap = takeSnapshot(makeCharacter({ classes: [{ classId: 'fighter', level: 1 }] }))
    const restored = restoreSnapshot(makeCharacter({ classes: [{ classId: 'fighter', level: 10 }] }), snap)
    expect(restored.state.currentHp).toBe(getMaxHp(restored))
  })

  it('does not change the snapshot when the restored character is edited', () => {
    const snap = takeSnapshot(makeCharacter())
    const restored = restoreSnapshot(makeCharacter(), snap)
    restored.classes[0].level = 20
    expect(snap.character.classes[0].level).toBe(5)
  })
})
