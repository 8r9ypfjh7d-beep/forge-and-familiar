import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { emptyDraft } from '../builder/Builder'
import { setLocale } from '../i18n'
import type { Character } from '../model/character'
import type { CharacterDraft } from '../rules'
import { makeCharacter } from '../sheet/fixtures'
import {
  applyCharacterChange, applyDraftChange, applyInBuilder, applyOnSheet, declarations, parseAbilities, proposeChange, runTool, runTurn, setFamiliarScreen,
  type FamiliarTransport, type Proposal, type ToolEnv,
} from './index'
import { ChangeCards } from './ui/ChangeCard'
import { proposalsOf } from './ui/view'

const david: Character = makeCharacter({
  id: 'david', ownerId: 'ziv', name: 'David Jones', raceId: 'human', backgroundId: 'soldier', rulesEdition: '2024', spellEdition: '2024',
  classes: [{ classId: 'warlock', level: 7, subclassId: 'great-old-one-patron' }],
  baseAbilities: { str: 10, dex: 14, con: 14, int: 10, wis: 12, cha: 16 },
  spells: [{ id: 'eldritch-blast', classId: 'warlock' }, { id: 'hex', classId: 'warlock' }],
  inventory: [{ uid: 'gs', itemId: 'greatsword', qty: 1, equipped: true, pact: true }],
  notes: 'Owes the guild 10 gp.',
})

/** A sheet whose apply() works like useLiveCharacter's: runs the change now, keeps the result. */
function liveSheet(start: Character) {
  let c = start
  const log: string[] = []
  const apply = (text: string, change: (x: Character) => Character) => { const next = change(c); if (next !== c) { c = next; log.push(text) } }
  const env = (): ToolEnv => ({
    userId: 'ziv', locale: 'en', edition: '2024', context: { kind: 'character', characterId: start.id },
    data: { character: () => c, getCharacter: async id => (id === c.id ? c : undefined), applyChange: p => applyOnSheet(p, apply, { applied: 'applied', undone: 'undone' }) },
  })
  return { get: () => c, log, env }
}

const fighterDraft = (): CharacterDraft => ({
  ...emptyDraft('roy', 'Roy'), raceId: 'human', backgroundId: 'acolyte', classes: [{ classId: 'fighter', level: 4 }],
  baseAbilities: { str: 15, dex: 14, con: 13, int: 8, wis: 12, cha: 10 }, chosenSkills: ['athletics', 'perception'],
})
function liveBuilder(start: CharacterDraft) {
  let d = start
  const update = (patch: Partial<CharacterDraft>) => { d = { ...d, ...patch } }
  const env = (): ToolEnv => ({ userId: 'roy', locale: 'en', context: { kind: 'builder' }, data: { draft: () => d, step: () => 'class', applyChange: p => applyInBuilder(p, d, update) } })
  return { get: () => d, env }
}

afterEach(() => setLocale('en'))

describe('propose_change tool', () => {
  it('is offered only where a tap can apply it', () => {
    expect(declarations(liveSheet(david).env()).map(d => d.name)).toContain('propose_change')
    expect(declarations(liveBuilder(fighterDraft()).env()).map(d => d.name)).toContain('propose_change')
    const noApply: ToolEnv = { userId: 'ziv', locale: 'en', context: { kind: 'character', characterId: 'david' }, data: { character: () => david } }
    expect(declarations(noApply).map(d => d.name)).not.toContain('propose_change')
    expect(declarations({ userId: 'ziv', locale: 'en', context: { kind: 'dm' } }).map(d => d.name)).not.toContain('propose_change')
  })

  it('resolves names to ids and warns about off-list picks without blocking', async () => {
    const env = liveSheet(david).env()
    const ok = await proposeChange({ kind: 'learn_spell', spell: 'Counterspell' }, env)
    expect(ok.proposal).toMatchObject({ target: 'character', characterId: 'david', characterName: 'David Jones', change: { kind: 'learn_spell', spellId: 'counterspell', classId: 'warlock' }, warnings: [] })
    const off = await proposeChange({ kind: 'learn_spell', spell: 'cure-wounds', reason: 'Some healing' }, env)
    expect(off.proposal.warnings).toEqual(['offList'])
    expect(off.proposal.reason).toBe('Some healing')
    await expect(proposeChange({ kind: 'learn_spell', spell: 'Not A Spell' }, env)).rejects.toThrow(/search_content/)
    await expect(proposeChange({ kind: 'set_class', class: 'wizard' }, env)).rejects.toThrow(/On a sheet/)
  })

  it('keeps the card out of what goes back to the model', async () => {
    const env = liveSheet(david).env()
    const sent: unknown[] = []
    let round = 0
    const transport: FamiliarTransport = async body => {
      sent.push(body.contents.at(-1))
      return round++ === 0
        ? { parts: [{ functionCall: { name: 'propose_change', args: { kind: 'add_item', item: 'Torch', qty: 2 } } }] }
        : { parts: [{ text: 'Tap Apply to add two torches.' }] }
    }
    const r = await runTurn([], 'Should I carry torches?', { context: env.context, locale: 'en', role: 'player' }, env, transport)
    const [card] = proposalsOf(r.tools)
    expect(card.change).toMatchObject({ kind: 'add_item', qty: 2, entry: { itemId: 'torch' } })
    const response = (sent[1] as { parts: { functionResponse: { response: Record<string, unknown> } }[] }).parts[0].functionResponse.response
    expect(response.proposed).toBe(true)
    expect(response.proposal).toBeUndefined()
    expect(response.note).toMatch(/Nothing has changed/)
  })

  it('checks builder picks: subclass level, feat slots, skill count', async () => {
    const env = liveBuilder({ ...fighterDraft(), classes: [{ classId: 'fighter', level: 2 }] }).env()
    await expect(proposeChange({ kind: 'set_subclass', subclass: 'champion' }, env)).rejects.toThrow(/level 3/)
    const at4 = liveBuilder(fighterDraft()).env()
    const feat = await proposeChange({ kind: 'set_feat', feat: 'Grappler' }, at4)
    expect(feat.proposal.change).toMatchObject({ kind: 'set_feat', slot: { classId: 'fighter', level: 4 } })
    const skills = await proposeChange({ kind: 'set_skills', skills: ['Athletics'] }, at4)
    expect(skills.proposal.change).toEqual({ kind: 'set_skills', skills: ['athletics'] })
    expect(skills.proposal.warnings).toEqual(['skillCount'])
    const race = await proposeChange({ kind: 'set_race', race: 'Dwarf' }, at4)
    expect(race.proposal.warnings).toEqual(['resets'])
  })

  it('reads ability bonuses for planned levels', () => {
    expect(parseAbilities('cha+2')).toEqual({ cha: 2 })
    expect(parseAbilities('Dex +1, Con +1')).toEqual({ dex: 1, con: 1 })
    expect(parseAbilities('str+3')).toBeUndefined()
  })
})

describe('applying on the sheet', () => {
  it('applies a tapped card through apply() and undoes only that change', async () => {
    const sheet = liveSheet(david)
    const { proposal } = await proposeChange({ kind: 'learn_spell', spell: 'counterspell' }, sheet.env())
    const out = sheet.env().data!.applyChange!(proposal)
    expect(out.ok).toBe(true)
    expect(sheet.get().spells!.map(s => s.id)).toContain('counterspell')
    expect(sheet.log).toEqual(['applied'])
    // A second tap has nothing to do.
    expect(sheet.env().data!.applyChange!(proposal)).toEqual({ ok: false, why: 'already' })
    // Something else changes meanwhile; Undo keeps it.
    sheet.env().data!.applyChange!((await proposeChange({ kind: 'add_note', text: 'Ask about the tower.' }, sheet.env())).proposal)
    if (out.ok) out.undo()
    expect(sheet.get().spells!.map(s => s.id)).toEqual(['eldritch-blast', 'hex'])
    expect(sheet.get().notes).toBe('Owes the guild 10 gp.\n\nAsk about the tower.')
    expect(sheet.log.at(-1)).toBe('undone')
  })

  it('stacks items and takes back only the added ones', () => {
    const c = { ...david, inventory: [...david.inventory, { uid: 't', itemId: 'torch', qty: 3, equipped: false }] }
    const r = applyCharacterChange(c, { kind: 'add_item', entry: { itemId: 'torch' }, qty: 2 })!
    expect(r.next.inventory.find(e => e.itemId === 'torch')!.qty).toBe(5)
    expect(r.undo(r.next).inventory.find(e => e.itemId === 'torch')!.qty).toBe(3)
    const fresh = applyCharacterChange(david, { kind: 'add_item', entry: { itemId: 'torch' }, qty: 1 })!
    expect(fresh.undo(fresh.next).inventory).toEqual(david.inventory)
  })

  it('plans a level and puts the old plan entry back on undo', async () => {
    const planned = { ...david, levelPlan: [{ level: 8, classId: 'warlock', abilities: { cha: 2 } }] }
    const sheet = liveSheet(planned)
    const { proposal } = await proposeChange({ kind: 'plan_level', level: 8, feat: 'Alert' }, sheet.env())
    expect(proposal.warnings).toContain('replaces')
    const out = sheet.env().data!.applyChange!(proposal)
    expect(sheet.get().levelPlan).toEqual([{ level: 8, classId: 'warlock', featId: 'alert' }])
    if (out.ok) out.undo()
    expect(sheet.get().levelPlan).toEqual(planned.levelPlan)
    await expect(proposeChange({ kind: 'plan_level', level: 5 }, sheet.env())).rejects.toThrow(/from 8 to 20/)
  })

  it('prepares wizard spellbook spells only', async () => {
    const wiz = makeCharacter({ id: 'w', name: 'Vex', classes: [{ classId: 'wizard', level: 3 }], spells: [{ id: 'sleep', classId: 'wizard', prepared: false }] })
    const r = applyCharacterChange(wiz, { kind: 'prepare_spell', spellId: 'sleep', classId: 'wizard', prepared: true })!
    expect(r.next.spells![0].prepared).toBeUndefined()
    expect(r.undo(r.next).spells![0].prepared).toBe(false)
    await expect(proposeChange({ kind: 'prepare_spell', spell: 'hex' }, liveSheet(david).env())).rejects.toThrow(/wizard/)
  })
})

describe('applying in the builder', () => {
  it('uses the builder pick functions and undo restores what they cleared', async () => {
    const b = liveBuilder(fighterDraft())
    const { proposal } = await proposeChange({ kind: 'set_race', race: 'dwarf', subrace: 'hill-dwarf' }, b.env())
    const out = b.env().data!.applyChange!(proposal)
    expect(b.get()).toMatchObject({ raceId: 'dwarf', subraceId: 'hill-dwarf', chosenSkills: [] })
    if (out.ok) out.undo()
    expect(b.get()).toMatchObject({ raceId: 'human', subraceId: undefined, chosenSkills: ['athletics', 'perception'] })
  })

  it('sets a class, a feat slot and nothing when already so', () => {
    const d = fighterDraft()
    const cls = applyDraftChange(d, { kind: 'set_class', classId: 'rogue' })!
    expect(cls.patch.classes).toEqual([{ classId: 'rogue', level: 4 }])
    expect(cls.patch.chosenSkills).toEqual([])
    expect(cls.undo.classes).toEqual(d.classes)
    expect(applyDraftChange(d, { kind: 'set_class', classId: 'fighter' })).toBeNull()
    const feat = applyDraftChange(d, { kind: 'set_feat', featId: 'grappler', slot: { classId: 'fighter', level: 4 } })!
    expect(feat.patch.improvements).toEqual([{ classId: 'fighter', level: 4, featId: 'grappler' }])
  })
})

describe('Apply cards', () => {
  const card = (over: Partial<Proposal> = {}): Proposal => ({
    id: 'pc-1', target: 'character', characterId: 'david', characterName: 'David Jones',
    change: { kind: 'learn_spell', spellId: 'counterspell', classId: 'warlock' }, names: { spell: 'Counterspell', class: 'Warlock' }, warnings: ['offList'], reason: 'Shuts down enemy casters.', ...over,
  })
  const html = (p: Proposal, applied?: Record<string, 'applied' | 'undone'>) => renderToStaticMarkup(createElement(ChangeCards, { proposals: [p], applied }))

  it('shows Apply only on the matching sheet, in English and Hebrew', () => {
    const off = setFamiliarScreen({ context: { kind: 'character', characterId: 'david' }, data: { applyChange: () => ({ ok: true, undo: () => {} }) } })
    const en = html(card())
    expect(en).toContain('Add Counterspell to your Warlock spells')
    expect(en).toContain('Shuts down enemy casters.')
    expect(en).toContain('Ask your DM')
    expect(en).toContain('>Apply<')
    setLocale('he')
    const he = html(card())
    expect(he).toContain('להוסיף את')
    expect(he).toContain('להחיל')
    setLocale('en')
    off()
    const elsewhere = html(card())
    expect(elsewhere).not.toContain('>Apply<')
    expect(elsewhere).toContain('Open David Jones&#x27;s sheet to apply this.')
    expect(html(card({ target: 'builder', characterId: undefined }))).toContain('Open the builder to apply this.')
  })

  it('reads Applied after the tap, with the undo hint after a reload', () => {
    const out = html(card(), { 'pc-1': 'applied' })
    expect(out).toContain('Applied')
    expect(out).not.toContain('Ask your DM')
    expect(out).toContain('change it on the sheet')
  })

  it('names builder picks through the app translations', () => {
    const off = setFamiliarScreen({ context: { kind: 'builder' }, edition: '2014', data: { applyChange: () => ({ ok: true, undo: () => {} }) } })
    expect(html(card({ target: 'builder', change: { kind: 'set_feat', featId: 'grappler', slot: { classId: 'fighter', level: 4 } }, names: { feat: 'Grappler' }, warnings: [] })))
      .toContain('Take Grappler at Fighter level 4')
    expect(html(card({ target: 'builder', change: { kind: 'set_skills', skills: ['stealth', 'acrobatics'] }, names: {}, warnings: [] }))).toContain('Choose skills: Stealth, Acrobatics')
    off()
  })

  it('lists only successful proposals', async () => {
    const r = await runTool('propose_change', { kind: 'learn_spell', spell: 'nope' }, liveSheet(david).env())
    expect(r.ok).toBe(false)
    expect(proposalsOf([{ name: 'propose_change', args: {}, label: 'x', ok: false }])).toEqual([])
  })
})
