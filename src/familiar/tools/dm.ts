// DM tools: the campaign's party, encounter balance, and monster stat blocks. Offered only on the DM screen, and
// every executor checks again that the asker runs this campaign (or is the admin): the model cannot widen access.
import { isAdmin } from '../../accounts'
import { filterMonsters, loadMonsters, monsterKey, searchEntries, sourceById, type Edition, type LoadedMonster, type Monster, type MonsterAction } from '../../content'
import { difficulty, groupsFromLevels, partyBudget, partySize, planXp, type Difficulty } from '../../dm/logic'
import type { DmState, EncounterPlan, PartyGroup } from '../../dm/types'
import type { Character } from '../../model/character'
import { crLabel, sensesText, speedText, typeLine, usageText } from '../../monsters/format'
import type { NpcSheet } from '../../npc/types'
import { canWatchSheets } from '../../party/active'
import type { Party } from '../../party/types'
import { classById, derive, raceById, rulesEdition, subclassById } from '../../rules'
import { num, registerTool, str, type ToolEnv } from './registry'

/** What the DM screen hands the DM tools. Filled by `dmToolData` in ../dm.ts; tests pass fakes. */
export interface DmToolData {
  /** The campaign being run. Missing: the admin's DM screen with no campaign picked. */
  campaign?: Party
  /** The DM screen's saved state: typed-in party levels, encounter plans, quick NPCs. */
  dmState?: DmState
  /** The DM's NPC sheets for this campaign (DM-private). */
  npcSheets?: NpcSheet[]
  /** The campaign's characters by id, from this device or the cloud. */
  getCharacters: (ids: string[]) => Promise<Character[]>
  /** Display name of a member account. */
  playerName?: (userId: string) => string | undefined
  /** Monster list for an edition; defaults to `loadMonsters` (SRD + books + packs). */
  monsters?: (edition: Edition) => Promise<LoadedMonster[]>
}

const dmData = (env: ToolEnv) => env.data?.dm as DmToolData | undefined

/** Whether this asker may use the DM tools here: on the DM screen, as the campaign's DM or the admin (as App.tsx does). */
export function dmAllowed(env: ToolEnv): boolean {
  if (env.context.kind !== 'dm') return false
  const dm = dmData(env)
  if (!dm) return false
  if (dm.campaign && env.context.partyId && dm.campaign.id !== env.context.partyId) return false
  return dm.campaign ? canWatchSheets(dm.campaign, env.userId) : isAdmin(env.userId)
}

const requireDm = (env: ToolEnv): DmToolData => {
  if (!dmAllowed(env)) throw new Error('Only the campaign\'s DM can use this, from the DM screen.')
  return dmData(env)!
}

const editionOf = (args: Record<string, unknown>, env: ToolEnv): Edition => {
  const e = str(args.edition)
  return e === '2014' || e === '2024' ? e : env.edition ?? '2024'
}

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

/** Player character ids brought to the campaign, the DM's own seat left out. */
const heroIds = (campaign: Party) =>
  campaign.members.filter(m => m.userId !== campaign.dmId).flatMap(m => (m.characterId ? [{ userId: m.userId, characterId: m.characterId }] : []))

/** One character as the DM needs it at the table: no private notes, no rolls. */
export function partyMember(c: Character, player?: string): Record<string, unknown> {
  const edition = rulesEdition(c)
  const d = derive(c)
  const classes = c.classes.map(cl => {
    const sub = cl.subclassId ? subclassById(cl.subclassId, edition)?.name ?? cl.subclassId : ''
    return `${classById(cl.classId, edition)?.name ?? cl.classId} ${cl.level}${sub ? ` (${sub})` : ''}`
  }).join(' / ')
  const passive = (skill: string) => 10 + (d.skills[skill as keyof typeof d.skills]?.bonus ?? 0)
  const concentrating = c.state.effects?.filter(e => e.on !== false && e.concentration).map(e => e.name) ?? []
  return {
    id: c.id,
    name: c.name,
    ...(player ? { player } : {}),
    summary: `${raceById(c.raceId)?.name ?? c.raceId}, ${classes}, level ${d.level}, ${edition} rules`,
    ac: d.armorClass.value,
    hp: { current: Math.min(c.state.currentHp, d.maxHp), max: d.maxHp, temp: c.state.tempHp },
    ...(c.state.currentHp <= 0 ? { deathSaves: c.state.deathSaves } : {}),
    conditions: c.state.conditions,
    ...(concentrating.length ? { concentrating } : {}),
    speed: d.speed,
    initiative: sign(d.initiative),
    passive: { perception: d.passivePerception, investigation: passive('investigation'), insight: passive('insight') },
    saves: Object.fromEntries(ABILITIES.map(a => [a, sign(d.saves[a].bonus) + (d.saves[a].proficient ? '*' : '')])),
    ...(d.spellcasting ? { spellSaveDc: d.spellcasting.saveDc, spellAttack: sign(d.spellcasting.attackBonus) } : {}),
    languages: d.languages,
  }
}

registerTool({
  declaration: {
    name: 'get_party',
    description:
      'DM only. The campaign\'s player characters right now: class and level, AC, HP, conditions, concentration, passive Perception/Investigation/Insight, saves (* proficient), spell save DC. ' +
      'Use it for encounter balance, who notices what, and who is in danger. Never share one player\'s details with another.',
    parameters: { type: 'object', properties: {} },
  },
  available: dmAllowed,
  label: () => 'Party',
  async run(_args, env) {
    const dm = requireDm(env)
    if (!dm.campaign) return { error: 'No campaign is being run on this DM screen. Ask the DM to pick one.', partyLevels: dm.dmState?.party }
    const seats = heroIds(dm.campaign)
    const found = new Map((await dm.getCharacters(seats.map(s => s.characterId))).map(c => [c.id, c]))
    const members = seats.flatMap(s => {
      const c = found.get(s.characterId)
      return c ? [partyMember(c, dm.playerName?.(s.userId))] : []
    })
    const missing = seats.length - members.length
    return {
      campaign: dm.campaign.name,
      members,
      ...(missing ? { note: `${missing} character(s) could not be loaded (offline or not synced).` } : {}),
      ...(seats.length < dm.campaign.members.length - 1 ? { watching: dm.campaign.members.length - 1 - seats.length } : {}),
    }
  },
})

// ---------- Encounter check ----------

const HINTS: Record<Difficulty, string> = {
  none: 'No monsters.',
  trivial: 'Below the Low budget: a speed bump.',
  low: 'Low: a few resources spent, little real danger.',
  moderate: 'Moderate: real danger; someone may drop without good tactics.',
  high: 'High: could kill a character; the party should be rested.',
  beyond: 'Above the High budget: deadly; consider fewer monsters, a way out, or allies.',
}

/** Finds a library monster by id or name (case-insensitive), the given source first. */
export function findMonster(list: readonly Monster[], idOrName: string, source?: string): Monster | undefined {
  const q = idOrName.trim().toLowerCase()
  const pool = source ? [...list.filter(m => m.source === source), ...list] : list
  return pool.find(m => m.id === q) ?? pool.find(m => m.name.toLowerCase() === q) ?? pool.find(m => monsterKey(m) === q)
}

export interface EncounterCheck {
  xp: number
  budget: { low: number; moderate: number; high: number }
  difficulty: Difficulty
  party: PartyGroup[]
  monsters: { name: string; count: number; cr: string; xp: number }[]
  notes: string[]
}

/** SRD 5.2 encounter math: monster XP added up (no multiplier) against the party's per-character budget, plus table sense. */
export function checkEncounter(monsters: { name: string; count: number; cr: number; xp: number }[], party: PartyGroup[]): EncounterCheck {
  const plan: EncounterPlan = { id: '', name: '', monsters: monsters.map(m => ({ monsterId: '', source: '', ...m })) }
  const xp = planXp(plan)
  const budget = partyBudget(party)
  const diff = difficulty(xp, budget)
  const players = partySize(party)
  const top = Math.max(1, ...party.map(g => g.level))
  const count = monsters.reduce((n, m) => n + m.count, 0)
  const notes = [HINTS[diff]]
  const big = monsters.filter(m => m.cr > top)
  if (big.length) notes.push(`CR above the highest character level (${top}): ${big.map(m => m.name).join(', ')}. One hit can drop a character.`)
  if (players && count >= players * 2) notes.push(`${count} monsters against ${players} characters: many attacks per round; area spells shine, the front line gets swarmed.`)
  if (players && count === 1 && players >= 3 && diff !== 'trivial') notes.push('A lone monster loses the action economy; legendary actions or minions help it.')
  return { xp, budget, difficulty: diff, party, monsters: monsters.map(m => ({ name: m.name, count: m.count, cr: crLabel(m.cr), xp: m.xp })), notes }
}

registerTool({
  declaration: {
    name: 'encounter_check',
    description:
      'DM only. How hard a fight is: adds the monsters\' XP (SRD 5.2, no multiplier) and compares it with the party\'s Low/Moderate/High budget. ' +
      'Give monsters by library id or name with a count, or plan="active" for the encounter open on the DM screen. The party defaults to the campaign\'s levels.',
    parameters: {
      type: 'object',
      properties: {
        monsters: { type: 'array', items: { type: 'string' }, description: 'Each "count x id-or-name", e.g. "3 x goblin", "owlbear".' },
        plan: { type: 'string', description: '"active" or a plan name from the DM screen.' },
        partyLevels: { type: 'array', items: { type: 'number' }, description: 'Character levels to check against instead of the campaign\'s, e.g. [5,5,4,4].' },
        edition: { type: 'string', enum: ['2014', '2024'] },
      },
    },
  },
  available: dmAllowed,
  label: a => str(a.plan) || (Array.isArray(a.monsters) ? a.monsters.slice(0, 3).map(m => str(m, 40)).join(', ') : 'Encounter'),
  async run(args, env) {
    const dm = requireDm(env)
    const levels = Array.isArray(args.partyLevels) ? args.partyLevels.map(num).filter((n): n is number => n != null).slice(0, 12) : []
    let party = levels.length ? groupsFromLevels(levels) : dm.dmState?.party ?? []
    if (!levels.length && dm.campaign && !partySize(party)) {
      const chars = await dm.getCharacters(heroIds(dm.campaign).map(s => s.characterId))
      party = groupsFromLevels(chars.map(c => derive(c).level))
    }
    if (!partySize(party)) return { error: 'No party levels known. Pass partyLevels.' }

    const planArg = str(args.plan)
    if (planArg) {
      const plans = dm.dmState?.plans ?? []
      const p = planArg === 'active' ? plans.find(x => x.id === dm.dmState?.activePlanId) ?? plans[0] : plans.find(x => x.name.toLowerCase() === planArg.toLowerCase())
      if (!p) return { error: `No plan "${planArg}". Plans: ${plans.map(x => x.name).join(', ') || 'none'}.` }
      return { plan: p.name, ...checkEncounter(p.monsters, party) }
    }

    const wanted = (Array.isArray(args.monsters) ? args.monsters : []).slice(0, 20).map(x => {
      const m = /^\s*(\d+)\s*[x×*]?\s*(.+)$/i.exec(str(x, 80))
      return m ? { count: Math.min(99, Number(m[1])), what: m[2].trim() } : { count: 1, what: str(x, 80).trim() }
    }).filter(w => w.what)
    if (!wanted.length) return { error: 'Give monsters or a plan.' }
    const list = await (dm.monsters ?? loadMonsters)(editionOf(args, env))
    const rows: { name: string; count: number; cr: number; xp: number }[] = []
    const unknown: string[] = []
    for (const w of wanted) {
      const m = findMonster(list, w.what) ?? searchEntries(list, w.what)[0]
      if (m) rows.push({ name: m.name, count: w.count, cr: m.challengeRating, xp: m.xp })
      else unknown.push(w.what)
    }
    return { ...checkEncounter(rows, party), ...(unknown.length ? { notFound: unknown } : {}) }
  },
})

// ---------- Monsters ----------

const MAX_ACTION = 400
const cutText = (s: string, max = MAX_ACTION) => (s.length > max ? `${s.slice(0, max)}…` : s)

const actionLine = (a: MonsterAction, locale: string) => {
  const bits = [
    a.attackBonus != null ? `${sign(a.attackBonus)} to hit` : '',
    a.reach ? `reach ${a.reach} ft` : '',
    a.range ? `range ${a.range.normal}${a.range.long ? `/${a.range.long}` : ''} ft` : '',
    a.damage.length ? a.damage.map(d => `${d.dice} ${d.type}`).join(' + ') : '',
    a.save ? `DC ${a.save.dc} ${a.save.ability.toUpperCase()} save (${a.save.onSuccess} on success)` : '',
  ].filter(Boolean).join(', ')
  const text = locale === 'he' && a.descriptionHe ? a.descriptionHe : a.description
  return `${a.name}${usageText(a)}${bits ? ` [${bits}]` : ''}: ${cutText(text)}`
}

/** A compact stat block the model can reason over: numbers plus each action's text, cut short. */
export function monsterBlock(m: Monster, locale = 'en'): Record<string, unknown> {
  const section = (list: MonsterAction[] | undefined) => (list?.length ? list.map(a => actionLine(a, locale)) : undefined)
  const src = sourceById(m.source)
  return {
    id: m.id,
    source: m.source,
    name: m.name,
    type: typeLine(m),
    cr: crLabel(m.challengeRating),
    xp: m.xp,
    ac: m.armorClass.map(a => `${a.value}${a.type ? ` (${a.type})` : ''}`).join(', '),
    hp: `${m.hitPoints} (${m.hitPointsRoll || m.hitDice})`,
    speed: speedText(m.speed),
    abilities: ABILITIES.map(a => `${a.toUpperCase()} ${m.abilities[a]}`).join(', '),
    ...(Object.keys(m.savingThrows).length ? { saves: Object.entries(m.savingThrows).map(([k, v]) => `${k.toUpperCase()} ${sign(v!)}`).join(', ') } : {}),
    ...(Object.keys(m.skills).length ? { skills: Object.entries(m.skills).map(([k, v]) => `${k} ${sign(v)}`).join(', ') } : {}),
    ...(m.damageVulnerabilities.length ? { vulnerable: m.damageVulnerabilities } : {}),
    ...(m.damageResistances.length ? { resist: m.damageResistances } : {}),
    ...(m.damageImmunities.length ? { immune: m.damageImmunities } : {}),
    ...(m.conditionImmunities.length ? { conditionImmune: m.conditionImmunities } : {}),
    senses: sensesText(m),
    languages: m.languages,
    traits: section(m.traits),
    actions: section(m.actions),
    bonusActions: section(m.bonusActions),
    reactions: section(m.reactions),
    ...(m.legendary ? { legendary: `${m.legendary.actions} per round${m.legendary.resistance ? `, Legendary Resistance ${m.legendary.resistance}/day` : ''}` } : {}),
    legendaryActions: section(m.legendaryActions),
    lairActions: section(m.lairActions),
    ...(m.spellcasting ? {
      spellcasting: `${m.spellcasting.ability.toUpperCase()}${m.spellcasting.saveDc ? `, save DC ${m.spellcasting.saveDc}` : ''}${m.spellcasting.attackBonus != null ? `, ${sign(m.spellcasting.attackBonus)} to hit` : ''}; ` +
        m.spellcasting.groups.map(g => `${g.label}: ${g.spells.join(', ')}`).join('; '),
    } : {}),
    sourceTitle: src?.title ?? m.source,
    usage: m.source.startsWith('srd-') ? 'SRD text, CC-BY-4.0. Quote at most two sentences.'
      : m.source.startsWith('books-') ? 'Numbers plus our own short summaries; not the book text. Explain in your own words and name the book.'
        : 'Homebrew or an NPC sheet written by the group.',
  }
}

const npcBlock = (n: NpcSheet, locale: string) => ({
  ...monsterBlock({ ...n.block, id: `npc:${n.id}` } as Monster, locale),
  name: n.name,
  creature: n.block.name,
  ...(n.role ? { role: n.role } : {}),
  ...(n.notes ? { dmNotes: cutText(n.notes, 1200) } : {}),
  now: { hp: `${n.state.currentHp}/${n.block.hitPoints}${n.state.tempHp ? ` +${n.state.tempHp} temp` : ''}`, conditions: n.state.conditions },
  usage: 'The DM\'s private NPC sheet. Never read dmNotes aloud to players unless the DM asks.',
})

registerTool({
  declaration: {
    name: 'find_monsters',
    description:
      'DM only. Monsters for an encounter from every source the campaign uses (SRD, our book summaries, homebrew packs): filter by CR range, creature type, habitat/environment and words. ' +
      'Returns short rows; call get_monster for the stat block.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words in the name or text, e.g. "undead", "swamp", "spellcaster". English.' },
        minCr: { type: 'number' },
        maxCr: { type: 'number' },
        type: { type: 'string', description: 'Creature type: aberration, beast, celestial, construct, dragon, elemental, fey, fiend, giant, humanoid, monstrosity, ooze, plant, undead.' },
        habitat: { type: 'string', description: 'Where it lives: forest, underdark, swamp, urban, mountain, coastal...' },
        edition: { type: 'string', enum: ['2014', '2024'] },
        limit: { type: 'number', description: 'Default 12, at most 25.' },
      },
    },
  },
  available: dmAllowed,
  label: a => str(a.query) || str(a.type) || str(a.habitat) || 'Monsters',
  async run(args, env) {
    const dm = requireDm(env)
    const edition = editionOf(args, env)
    const type = str(args.type).toLowerCase()
    const habitat = str(args.habitat).toLowerCase()
    let list: Monster[] = filterMonsters(await (dm.monsters ?? loadMonsters)(edition), { minCr: num(args.minCr), maxCr: num(args.maxCr), types: type ? [type] : undefined })
    if (habitat) list = list.filter(m => [...(m.habitat ?? []), ...(m.environments ?? [])].some(h => h.toLowerCase().includes(habitat)))
    const hits = searchEntries(list, str(args.query))
    const limit = Math.min(25, Math.max(1, num(args.limit) ?? 12))
    const npcs = (dm.npcSheets ?? []).filter(n => !str(args.query) || `${n.name} ${n.role ?? ''} ${n.block.name}`.toLowerCase().includes(str(args.query).toLowerCase()))
    return {
      edition,
      total: hits.length,
      hits: hits.slice(0, limit).map(m => ({
        id: m.id, source: m.source, name: m.name, cr: crLabel(m.challengeRating), xp: m.xp, type: m.type,
        ...(m.book ? { book: m.book } : {}), ...((m as LoadedMonster).legacy ? { legacy: true } : {}),
      })),
      ...(npcs.length ? { npcSheets: npcs.slice(0, 10).map(n => ({ id: `npc:${n.id}`, name: n.name, creature: n.block.name, cr: crLabel(n.block.challengeRating) })) } : {}),
    }
  },
})

registerTool({
  declaration: {
    name: 'get_monster',
    description:
      'DM only. One stat block: AC, HP, speed, abilities, defenses, and every trait and action with to-hit, damage, saves and recharge. ' +
      'Use it for "what does it do on its turn" and tactics. Ids from find_monsters; "npc:<id>" opens one of the DM\'s NPC sheets.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Monster id (e.g. owlbear), its name, or npc:<id>.' },
        source: { type: 'string', description: 'Source id from find_monsters, when the same monster is in several.' },
        edition: { type: 'string', enum: ['2014', '2024'] },
      },
      required: ['id'],
    },
  },
  available: dmAllowed,
  label: a => str(a.id),
  async run(args, env) {
    const dm = requireDm(env)
    const id = str(args.id)
    if (id.startsWith('npc:')) {
      const n = dm.npcSheets?.find(x => x.id === id.slice(4))
      return n ? { monster: npcBlock(n, env.locale) } : { error: `No NPC sheet ${id}.` }
    }
    const list = await (dm.monsters ?? loadMonsters)(editionOf(args, env))
    const m = findMonster(list, id, str(args.source) || undefined) ?? searchEntries(list, id)[0]
    return m ? { monster: monsterBlock(m, env.locale) } : { error: `No monster "${id}". Try find_monsters.` }
  },
})
