import { describe, expect, it } from 'vitest'
import { createCharacter, derive, type CharacterDraft } from '../rules'
import {
  answered, codeFrom, decide, decodeShared, encodeShared, grantToCharacter, inbox, linkFor, markApplied, mergeShared, mine,
  editState, newEditRequest, newRequest, openEditRequest, pendingGrants, problems, reminders, setStoryNote, spendEditPass, type RequestInput,
} from './logic'

const fighter = () => {
  const c = createCharacter({
    name: 'Thorin', ownerId: 'acct-roy', playerName: '', alignment: 'True Neutral', raceId: 'human', backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3 }], abilityMethod: 'standard',
    baseAbilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 }, freeAbilityBonuses: [], chosenSkills: [],
  } satisfies CharacterDraft)
  return { ...c, id: 'c1', inventory: [], notes: '' }
}

const input = (over: Partial<RequestInput> = {}): RequestInput => ({
  fromId: 'acct-roy', fromName: 'Roy', characterId: 'c1', characterName: 'Thorin',
  kind: 'item', title: '  Ember  ', details: 'A warm sword.', ...over,
})
const req = (id: string, over: Partial<RequestInput> = {}, at = '2026-10-26T10:00:00Z') => newRequest(input(over), id, at)

describe('requests', () => {
  it('validates and trims a new request', () => {
    expect(problems({ characterId: '', title: ' ' })).toEqual(['noCharacter', 'noTitle'])
    const r = req('r1')
    expect(r).toMatchObject({ title: 'Ember', status: 'pending' })
    expect(r.roll).toBeUndefined()
  })

  it('keeps only meaningful rolls, extra damage and stat changes', () => {
    const r = req('r1', {
      roll: { check: 'attack', ability: 'str', dice: ' 2d6+STR ', type: 'fire' },
      extraDamage: { damage: '', type: 'cold' },
      stats: [{ kind: 'ac', value: 1 }],
    })
    expect(r.roll).toEqual({ check: 'attack', ability: 'str', dice: '2d6+STR', type: 'fire' })
    expect(r.extraDamage).toBeUndefined()
    expect(r.stats).toEqual([{ kind: 'ac', value: 1 }])
    expect(req('r2', { roll: { type: 'fire' } }).roll).toBeUndefined()
  })

  it('sorts the DM inbox, reminders and history', () => {
    let list = [req('a', {}, '2026-10-26T12:00:00Z'), req('b', {}, '2026-10-26T11:00:00Z'), req('c')]
    list = decide(list, 'c', 'later', '2026-10-26T13:00:00Z', 'Soon')
    expect(inbox(list).map(r => r.id)).toEqual(['b', 'a'])
    expect(reminders(list).map(r => r.id)).toEqual(['c'])
    expect(list.find(r => r.id === 'c')?.reply).toBe('Soon')
    list = decide(list, 'c', 'granted', '2026-10-26T14:00:00Z')
    expect(reminders(list)).toHaveLength(0)
    expect(answered(list).map(r => r.id)).toEqual(['c'])
    expect(list.find(r => r.id === 'c')?.reply).toBe('Soon')
    list = decide(list, 'c', 'pending', '2026-10-26T15:00:00Z')
    expect(list.find(r => r.id === 'c')).not.toHaveProperty('decidedAt')
    expect(mine(list, 'acct-roy')).toHaveLength(3)
    expect(mine(list, 'acct-tamir')).toHaveLength(0)
  })

  it('grants an item into the inventory with its effects, and its roll as an action', () => {
    const r = req('r1', { roll: { dice: '1d4' }, extraDamage: { damage: '1d6', type: 'fire' }, stats: [{ kind: 'ac', value: 1 }] })
    const c = grantToCharacter(fighter(), r, 'u1')
    expect(c.inventory).toHaveLength(1)
    expect(c.inventory[0]).toMatchObject({ item: { name: 'Ember' }, notes: 'A warm sword.', extraDamage: '1d6 fire', effects: [{ kind: 'ac', value: 1 }] })
    expect(c.customActions).toEqual([{ id: 'u1', kind: 'action', name: 'Ember', description: 'A warm sword.', roll: { dice: '1d4' } }])
    const before = derive(c).armorClass.value
    c.inventory[0].equipped = true
    expect(derive(c).armorClass.value).toBe(before + 1)
  })

  it('grants effects and abilities as combat-page actions, and plain ideas as notes', () => {
    const fx = grantToCharacter(fighter(), req('r1', { kind: 'effect', title: 'Blessed', details: '', stats: [{ kind: 'saves', value: 1 }] }), 'u2')
    expect(fx.customActions).toEqual([{ id: 'u2', kind: 'other', name: 'Blessed', stats: [{ kind: 'saves', value: 1 }] }])
    const note = grantToCharacter({ ...fighter(), notes: 'Old notes' }, req('r2', { kind: 'other', title: 'A pet crow', details: 'Named Pip' }), 'u3')
    expect(note.notes).toBe('Old notes\n\nA pet crow: Named Pip')
    expect(note.customActions ?? []).toHaveLength(0)
  })

  it('applies a grant once', () => {
    let list = decide([req('r1')], 'r1', 'granted', '2026-10-26T12:00:00Z')
    expect(pendingGrants(list, 'acct-roy')).toHaveLength(1)
    list = markApplied(list, ['r1'])
    expect(pendingGrants(list, 'acct-roy')).toHaveLength(0)
  })
})

describe('request links', () => {
  it('round-trips a request with Hebrew text and mechanics', () => {
    const r = { ...req('r1', { title: 'חרב הגחלת', roll: { check: 'save', ability: 'cha', save: 'dex', dice: '3d6' } }), storyNote: 'secret' }
    const link = linkFor('https://example.com/', 'request', r)
    const s = decodeShared(codeFrom(link)!)
    expect(s?.type).toBe('request')
    expect(s?.request.title).toBe('חרב הגחלת')
    expect(s?.request.roll).toEqual({ check: 'save', ability: 'cha', save: 'dex', dice: '3d6' })
    expect(s?.request).not.toHaveProperty('storyNote')
  })

  it('never leaks the DM story note in an answer, and keeps the reply', () => {
    const r = { ...decide([req('r1')], 'r1', 'later', '2026-10-26T12:00:00Z', 'Maybe in the forest')[0], storyNote: 'The dryad gives it' }
    const s = decodeShared(encodeShared('answer', r))!
    expect(s.request).toMatchObject({ status: 'later', reply: 'Maybe in the forest' })
    expect(s.request).not.toHaveProperty('storyNote')
  })

  it('rejects junk and cleans bad fields', () => {
    expect(decodeShared('not-a-code')).toBeNull()
    expect(codeFrom('hello')).toBeNull()
    const bad = btoa(JSON.stringify({ v: 1, t: 'q', r: { id: 'x', fromId: 'y', title: 'T', kind: 'nuke', status: 'granted', stats: [{ kind: 'hp', value: 5 }, { kind: 'ac', value: 1e9 }] } }))
    const s = decodeShared(bad)!
    expect(s.request.kind).toBe('other')
    expect(s.request.status).toBe('pending')
    expect(s.request.stats).toEqual([{ kind: 'ac', value: 99 }])
  })

  it('merges requests and answers without losing newer decisions', () => {
    const r = req('r1')
    let list = mergeShared([], { type: 'request', request: r }).list
    expect(list).toHaveLength(1)
    list = decide(list, 'r1', 'later', '2026-10-26T12:00:00Z')
    expect(mergeShared(list, { type: 'request', request: r }).outcome).toBe('same')
    const answer = { ...r, status: 'granted' as const, decidedAt: '2026-10-26T13:00:00Z' }
    const merged = mergeShared(markApplied([r], []), { type: 'answer', request: answer })
    expect(merged.outcome).toBe('updated')
    expect(merged.list[0].status).toBe('granted')
    const older = { ...r, status: 'denied' as const, decidedAt: '2026-10-26T11:00:00Z' }
    expect(mergeShared(merged.list, { type: 'answer', request: older }).outcome).toBe('older')
  })

  it('story notes stay on the DM side', () => {
    const list = setStoryNote([req('r1')], 'r1', 'At the inn')
    expect(list[0].storyNote).toBe('At the inn')
  })

  it('lets a player edit once after the DM approves', () => {
    const ask = newEditRequest({ fromId: 'acct-roy', fromName: 'Roy', characterId: 'c1', characterName: 'Thorin', details: ' Swap a skill ' }, 'e1', 'now')
    expect(ask).toMatchObject({ kind: 'edit', title: 'Thorin', details: 'Swap a skill', status: 'pending' })
    let list = [ask]
    expect(editState(list, 'acct-roy', 'c1')).toBe('pending')
    expect(openEditRequest(list, 'acct-roy', 'c1')?.id).toBe('e1')
    expect(editState(list, 'acct-roy', 'c2')).toBe('none')
    expect(editState(list, 'acct-tamir', 'c1')).toBe('none')

    // The approval travels as an answer link, like any request.
    const answer = decodeShared(encodeShared('answer', decide(list, 'e1', 'granted', 'later')[0]))!
    list = mergeShared(list, answer).list
    expect(editState(list, 'acct-roy', 'c1')).toBe('approved')
    // An approved edit is never "granted" onto the sheet.
    expect(pendingGrants(list, 'acct-roy')).toEqual([])
    const f = fighter()
    expect(grantToCharacter(f, list[0], 'x')).toEqual(f)

    list = spendEditPass(list, 'acct-roy', 'c1')
    expect(editState(list, 'acct-roy', 'c1')).toBe('none')
    expect(editState(decide([ask], 'e1', 'denied', 'later'), 'acct-roy', 'c1')).toBe('none')
  })
})
