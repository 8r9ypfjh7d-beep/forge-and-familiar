import { describe, expect, it } from 'vitest'
import { emptyDmState } from '../dm/types'
import type { DmState } from '../dm/types'
import { freshState, type NpcSheet } from '../npc/types'
import { makeBlock } from '../npc/fixtures'
import type { Party } from '../party/types'
import { makeCharacter } from '../sheet/fixtures'
import { DM_CHIPS, checkEncounter, declarations, dmAllowed, dmCard, runTool, systemInstruction, type DmToolData, type ToolEnv } from './index'
import { en } from '../i18n/locales/en'
import { he } from '../i18n/locales/he'

const now = '2026-10-31T10:00:00Z'
const campaign: Party = {
  id: 'p1', name: 'Garden Gang', code: 'ABCDEF', dmId: 'acct-noa', createdAt: now, updatedAt: now,
  members: [
    { userId: 'acct-noa', joinedAt: now },
    { userId: 'acct-roy', characterId: 'c-roy', joinedAt: now },
    { userId: 'acct-tamir', characterId: 'c-tamir', joinedAt: now },
  ],
}
const roy = makeCharacter({ id: 'c-roy', ownerId: 'acct-roy', name: 'Vex', classes: [{ classId: 'rogue', level: 3 }] })
const tamir = makeCharacter({ id: 'c-tamir', ownerId: 'acct-tamir', name: 'Goku', classes: [{ classId: 'fighter', level: 3 }] })
tamir.state = { ...tamir.state, conditions: ['poisoned'] }

const dmState: DmState = {
  ...emptyDmState(),
  party: [{ count: 2, level: 3 }],
  plans: [{ id: 'e1', name: 'Goblin ambush', notes: 'They hide in the ferns.', monsters: [{ monsterId: 'goblin', source: 'srd-5.1', name: 'Goblin', xp: 50, cr: 0.25, count: 4 }] }],
  activePlanId: 'e1',
  npcs: [{ id: 'n1', name: 'Old Mags', role: 'innkeeper', notes: '' }],
}
const npc: NpcSheet = {
  id: 'vexa', ownerId: 'acct-noa', schemaVersion: 1, partyId: 'p1', name: 'Captain Vexa', role: 'Red Hand leader', notes: 'Secretly the mayor\'s sister.',
  block: makeBlock({ name: 'Bandit Captain', challengeRating: 2, xp: 450, hitPoints: 65 }), state: freshState(65), createdAt: now, updatedAt: now,
}
const asked: string[][] = []
const data: DmToolData = {
  campaign, dmState, npcSheets: [npc],
  getCharacters: async ids => { asked.push(ids); return [roy, tamir].filter(c => ids.includes(c.id)) },
  playerName: id => ({ 'acct-roy': 'Roy', 'acct-tamir': 'Tamir' })[id],
}
const dmEnv: ToolEnv = { userId: 'acct-noa', context: { kind: 'dm', partyId: 'p1' }, locale: 'en', edition: '2014', data: { dm: data } }
const DM_TOOLS = ['get_party', 'encounter_check', 'find_monsters', 'get_monster']

describe('DM tool access', () => {
  it('offers the DM tools only to the campaign\'s DM on the DM screen', () => {
    expect(declarations(dmEnv).map(d => d.name)).toEqual(expect.arrayContaining(DM_TOOLS))
    const player = { ...dmEnv, userId: 'acct-roy' }
    const sheet = { ...dmEnv, context: { kind: 'character' as const, characterId: 'c-roy' } }
    const noData = { ...dmEnv, data: {} }
    const otherCampaign = { ...dmEnv, context: { kind: 'dm' as const, partyId: 'p2' } }
    for (const env of [player, sheet, noData, otherCampaign]) {
      expect(dmAllowed(env)).toBe(false)
      expect(declarations(env).map(d => d.name)).not.toEqual(expect.arrayContaining(['get_party']))
    }
    expect(declarations(player).some(d => DM_TOOLS.includes(d.name))).toBe(false)
  })

  it('refuses a forced call from a player, and lets the admin in without a campaign', async () => {
    const { ok, result } = await runTool('get_party', {}, { ...dmEnv, userId: 'acct-roy' })
    expect(ok).toBe(false)
    expect(JSON.stringify(result)).not.toMatch(/Vex/)
    expect(dmAllowed({ ...dmEnv, userId: 'acct-ziv' })).toBe(true)
    const admin = { ...dmEnv, userId: 'acct-ziv', context: { kind: 'dm' as const }, data: { dm: { ...data, campaign: undefined } } }
    expect(dmAllowed(admin)).toBe(true)
    expect(dmAllowed({ ...admin, userId: 'acct-noa' })).toBe(false)
  })
})

describe('get_party', () => {
  it('lists the players\' characters with table stats, leaving the DM\'s seat out', async () => {
    asked.length = 0
    const { ok, result } = await runTool('get_party', {}, dmEnv)
    expect(ok).toBe(true)
    expect(asked[0]).toEqual(['c-roy', 'c-tamir'])
    const members = result.members as Record<string, unknown>[]
    expect(members.map(m => m.name)).toEqual(['Vex', 'Goku'])
    expect(members[0]).toMatchObject({ player: 'Roy', ac: expect.any(Number), hp: { max: expect.any(Number) } })
    expect((members[0].passive as { perception: number }).perception).toBeGreaterThan(5)
    expect(members[1].conditions).toEqual(['poisoned'])
    expect(JSON.stringify(result)).not.toMatch(/notes|rolls/i)
  })
})

describe('encounter_check', () => {
  it('rates the open plan against the DM screen\'s party', async () => {
    const { result } = await runTool('encounter_check', { plan: 'active' }, dmEnv)
    // 4 goblins = 200 XP; 2 level-3 characters: Low 300, Moderate 450, High 800.
    expect(result).toMatchObject({ plan: 'Goblin ambush', xp: 200, difficulty: 'trivial', budget: { low: 300, moderate: 450, high: 800 } })
  })

  it('reads "count x monster" lists from the library and takes other levels', async () => {
    const { result } = await runTool('encounter_check', { monsters: ['2 x ogre', 'goblin', 'nothing-like-this'], partyLevels: [3, 3, 3, 3] }, dmEnv)
    expect(result.xp).toBe(2 * 450 + 50)
    expect(result.difficulty).toBe('moderate')
    expect(result.notFound).toEqual(['nothing-like-this'])
  })

  it('warns about monsters above the party\'s level and swarms', () => {
    const solo = checkEncounter([{ name: 'Young Red Dragon', count: 1, cr: 10, xp: 5900 }], [{ count: 4, level: 5 }])
    expect(solo.difficulty).toBe('beyond')
    expect(solo.notes.join(' ')).toMatch(/CR above/)
    const swarm = checkEncounter([{ name: 'Goblin', count: 8, cr: 0.25, xp: 50 }], [{ count: 4, level: 1 }])
    expect(swarm.notes.join(' ')).toMatch(/8 monsters against 4/)
  })
})

describe('monster tools', () => {
  it('finds monsters by CR and type, with the DM\'s NPC sheets', async () => {
    const { result } = await runTool('find_monsters', { type: 'undead', maxCr: 1, limit: 25 }, dmEnv)
    const hits = result.hits as { id: string; cr: string; type: string }[]
    expect(hits.map(h => h.id)).toEqual(expect.arrayContaining(['skeleton', 'zombie']))
    expect(hits.every(h => h.type === 'undead')).toBe(true)
    const vexa = await runTool('find_monsters', { query: 'vexa' }, dmEnv)
    expect(vexa.result.npcSheets).toEqual([expect.objectContaining({ id: 'npc:vexa', name: 'Captain Vexa' })])
  })

  it('gives a compact stat block with attacks and saves', async () => {
    const { result } = await runTool('get_monster', { id: 'owlbear' }, dmEnv)
    const m = result.monster as { name: string; ac: string; actions: string[]; usage: string }
    expect(m.name).toBe('Owlbear')
    expect(m.actions.join(' ')).toMatch(/to hit/)
    expect(m.usage).toMatch(/CC-BY/)
    const byName = await runTool('get_monster', { id: 'Adult Red Dragon' }, dmEnv)
    expect((byName.result.monster as { legendaryActions: string[] }).legendaryActions.length).toBeGreaterThan(0)
  })

  it('opens an NPC sheet with its live HP and private notes marked', async () => {
    const { result } = await runTool('get_monster', { id: 'npc:vexa' }, dmEnv)
    expect(result.monster).toMatchObject({ name: 'Captain Vexa', creature: 'Bandit Captain', now: { hp: '65/65' } })
    expect((result.monster as { usage: string }).usage).toMatch(/private/)
  })
})

describe('DM card and prompt', () => {
  it('summarizes the DM screen without player secrets', () => {
    const card = dmCard({ campaign, dmState, npcSheets: [npc], characters: [roy, tamir] })
    expect(card).toMatch(/Campaign: Garden Gang\. 2 player/)
    expect(card).toMatch(/Open encounter "Goblin ambush": 4 x Goblin \(CR 1\/4, id goblin\)\. 200 XP, trivial/)
    expect(card).toMatch(/They hide in the ferns/)
    expect(card).toMatch(/Captain Vexa \(Bandit Captain, CR 2, id npc:vexa\)/)
    expect(card).toMatch(/Old Mags \(innkeeper\)/)
    expect(card).toMatch(/Vex \(level 3\)/)
    expect(card).not.toMatch(/mayor/)
  })

  it('tells the model how to help a DM and to keep secrets', () => {
    const s = systemInstruction({ context: { kind: 'dm' }, locale: 'he', role: 'dm', card: 'Campaign: X' })
    expect(s).toMatch(/encounter_check/)
    expect(s).toMatch(/secret rolls/)
    expect(s).toMatch(/Answer in Hebrew/)
  })

  it('has DM chips in both languages', () => {
    for (const key of DM_CHIPS) {
      expect(en[key]).toBeTruthy()
      expect((he.messages as Record<string, string>)[key]).toMatch(/[֐-׿]/)
    }
  })
})
