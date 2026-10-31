// propose_change: the model suggests one change; the panel shows an Apply card and only the user's tap makes it (changes.ts).
// This tool resolves names to ids and checks the fit (warn, don't block). It never changes anything itself.
import { loadKind, type Spell } from '../../content'
import { fromLibrary, fromMagicItem, withBase } from '../../inventory/inventory'
import { canTake, spellAccess, spellSourcesFor, sourceFor, type SpellAccess } from '../../spellbook/access'
import { skillPicks, subclassSlots } from '../../builder/validate'
import type { Character, PlannedLevel } from '../../model/character'
import { routeFor } from '../../planner/plan'
import {
  ABILITIES, SKILLS, allFeats, allRaces, backgroundsFor, classById, classesFor, derive, getAbilityScores, improvementSlots, itemById, rulesEdition,
  subclassesFor, totalLevel, unmetFeatPrereqs, type Ability, type CharacterDraft, type SkillId,
} from '../../rules'
import { BUILDER_KINDS, CHARACTER_KINDS, type Change, type ChangeKind, type ChangeWarning, type Proposal } from '../changes'
import { resolveCharacter } from './character'
import { num, registerTool, str, type ToolEnv } from './registry'

const KINDS = [...new Set([...CHARACTER_KINDS, ...BUILDER_KINDS])]

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()

/** By id first, then by name (case and spacing ignored). */
function find<T extends { id: string; name: string }>(list: T[], wanted: string): T | undefined {
  const w = wanted.trim()
  if (!w) return undefined
  return list.find(x => x.id === w) ?? list.find(x => norm(x.name) === norm(w))
}

/** Whether the screen can take a tap: the sheet or builder hands over `applyChange`. */
export const canPropose = (env: ToolEnv) =>
  (env.context.kind === 'character' || env.context.kind === 'builder') && typeof env.data?.applyChange === 'function'

const newId = () => `pc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

interface Built {
  change: Change
  names: Record<string, string>
  warnings: ChangeWarning[]
  /** English, for the model: what the card says. */
  summary: string
}

async function spellLibrary(edition: '2014' | '2024') {
  const sources = spellSourcesFor(edition)
  const [spells, classes, subclasses] = await Promise.all([
    loadKind('spells', { sources }).catch(() => [] as Spell[]),
    loadKind('classes', { sources }).catch(() => []),
    loadKind('subclasses', { sources }).catch(() => []),
  ])
  return { spells, classes, subclasses }
}

/** The spell and the class list it goes on: the asked class, else the first that can take it, else the first caster. */
async function spellFor(c: Character | CharacterDraft, args: Record<string, unknown>, scores: ReturnType<typeof getAbilityScores>) {
  const lib = await spellLibrary(rulesEdition(c))
  const spell = find(lib.spells, str(args.spell))
  if (!spell) throw new Error(`No spell "${str(args.spell)}" in this edition's library. Use search_content kind "spells" and pass its id.`)
  const access = spellAccess(c, lib.classes, lib.subclasses, scores, undefined, lib.spells)
  if (!access.length) throw new Error('This character has no spellcasting class that picks spells.')
  const asked = str(args.class)
  const a: SpellAccess = (asked && access.find(x => x.classId === asked || norm(x.className) === norm(asked))) || access.find(x => canTake(spell, x)) || access[0]
  const warnings: ChangeWarning[] = []
  if (!canTake(spell, a)) warnings.push(spell.level > a.maxLevel ? 'tooHigh' : 'offList')
  return { spell, access: a, warnings }
}

/** "str+2" or "dex+1, con+1" → { str: 2 } / { dex: 1, con: 1 }. */
export function parseAbilities(text: string): Partial<Record<Ability, number>> | undefined {
  const out: Partial<Record<Ability, number>> = {}
  for (const m of text.toLowerCase().matchAll(/(str|dex|con|int|wis|cha)\w*\s*\+?\s*(\d)/g)) out[m[1] as Ability] = (out[m[1] as Ability] ?? 0) + Number(m[2])
  const total = Object.values(out).reduce((n, v) => n + (v ?? 0), 0)
  return total > 0 && total <= 2 ? out : undefined
}

async function buildCharacterChange(kind: ChangeKind, args: Record<string, unknown>, c: Character): Promise<Built> {
  const edition = rulesEdition(c)
  switch (kind) {
    case 'learn_spell': {
      const { spell, access, warnings } = await spellFor(c, args, derive(c).abilities)
      if ((c.spells ?? []).some(k => k.id === spell.id && k.classId === access.classId)) throw new Error(`${c.name} already has ${spell.name} on the ${access.className} list.`)
      return { change: { kind, spellId: spell.id, classId: access.classId }, names: { spell: spell.name, class: access.className }, warnings, summary: `Add ${spell.name} to ${c.name}'s ${access.className} spells.` }
    }
    case 'forget_spell':
    case 'prepare_spell': {
      const lib = await spellLibrary(edition)
      const spell = find(lib.spells, str(args.spell))
      const known = (c.spells ?? []).filter(k => k.id === (spell?.id ?? str(args.spell)))
      if (!known.length) throw new Error(`${c.name} does not have "${str(args.spell)}". Read get_character section spells for what they have.`)
      const k = known.find(x => x.classId === str(args.class)) ?? known[0]
      const name = spell?.name ?? k.id
      if (kind === 'forget_spell') return { change: { kind, spellId: k.id, classId: k.classId }, names: { spell: name }, warnings: [], summary: `Remove ${name} from ${c.name}'s spells.` }
      const prepared = args.prepared !== false
      if (!c.classes.some(cl => cl.classId === 'wizard') || k.classId !== 'wizard') throw new Error('Only a wizard prepares from a spellbook on this sheet; other known spells count as prepared already. To swap, propose forget_spell and learn_spell.')
      return { change: { kind, spellId: k.id, classId: k.classId, prepared }, names: { spell: name }, warnings: [], summary: `${prepared ? 'Prepare' : 'Unprepare'} ${name}.` }
    }
    case 'add_item': {
      const sources = [sourceFor(edition)]
      const [equipment, magic] = await Promise.all([loadKind('equipment', { sources }).catch(() => []), loadKind('magic-items', { sources }).catch(() => [])])
      const wanted = str(args.item)
      const qty = Math.max(1, Math.min(99, Math.round(num(args.qty) ?? 1)))
      const gear = find(equipment, wanted)
      if (gear) return { change: { kind, entry: fromLibrary(gear), qty }, names: { item: gear.name }, warnings: [], summary: `Add ${qty} × ${gear.name} to ${c.name}'s inventory.` }
      const m = find(magic, wanted)
      if (!m) throw new Error(`No item "${wanted}" in the library. Use search_content kind "equipment" or "magic-items" and pass its id.`)
      const warnings: ChangeWarning[] = []
      let entry = fromMagicItem(m)
      if (m.category === 'weapon' || m.category === 'armor') {
        const base = itemById(str(args.base))
        const fits = base && (m.category === 'weapon' ? base.kind === 'weapon' : base.kind === 'armor')
        const fallback = itemById(m.category === 'armor' ? (/shield/i.test(m.name) ? 'shield' : 'chain-shirt') : 'longsword')
        if (!fits) warnings.push('noBase')
        const use = fits ? base : fallback
        if (use) entry = { ...entry, item: withBase(use, m.name, m.id) }
      }
      return { change: { kind, entry, qty }, names: { item: m.name }, warnings, summary: `Add ${qty} × ${m.name} to ${c.name}'s inventory.` }
    }
    case 'add_note': {
      const text = str(args.text, 600).trim()
      if (!text) throw new Error('add_note needs `text`: the note to add, in the user\'s language.')
      return { change: { kind, text }, names: {}, warnings: [], summary: `Add a note to ${c.name}'s sheet: "${text}"` }
    }
    case 'plan_level': {
      const now = totalLevel(c)
      const level = Math.round(num(args.level) ?? now + 1)
      if (level <= now || level > 20) throw new Error(`Plan a level from ${now + 1} to 20; ${c.name} is level ${now}.`)
      const routed = routeFor(c).find(e => e.level === level)
      const cls = str(args.class) ? find(classesFor(edition), str(args.class)) : classById(routed?.classId ?? c.classes[0]?.classId ?? '', edition)
      if (!cls) throw new Error(`No class "${str(args.class)}".`)
      const entry: PlannedLevel = { level, classId: cls.id }
      const names: Record<string, string> = { class: cls.name }
      const warnings: ChangeWarning[] = []
      if (str(args.subclass)) {
        const sub = find(subclassesFor(cls.id, edition), str(args.subclass))
        if (!sub) throw new Error(`No ${cls.name} subclass "${str(args.subclass)}". Use builder-style ids from search_content kind "subclasses".`)
        entry.subclassId = sub.id
        names.subclass = sub.name
      }
      if (str(args.feat)) {
        const feat = find(allFeats(edition), str(args.feat))
        if (!feat) throw new Error(`No feat "${str(args.feat)}" in this edition.`)
        entry.featId = feat.id
        names.feat = feat.name
        if (unmetFeatPrereqs(c, feat, level).length) warnings.push('prereq')
      } else if (str(args.abilities)) {
        const abilities = parseAbilities(str(args.abilities))
        if (!abilities) throw new Error('abilities must add up to 2, e.g. "cha+2" or "dex+1, con+1".')
        entry.abilities = abilities
      }
      const old = (c.levelPlan ?? []).find(p => p.level === level)
      if (old && (old.featId || old.abilities || old.subclassId)) warnings.push('replaces')
      const what = [names.class, names.subclass, names.feat, entry.abilities && ABILITIES.filter(a => entry.abilities?.[a]).map(a => `${a.toUpperCase()} +${entry.abilities![a]}`).join(', ')].filter(Boolean).join(', ')
      return { change: { kind, entry }, names, warnings, summary: `Plan level ${level}: ${what}.` }
    }
    default:
      throw new Error(`On a sheet the kinds are: ${CHARACTER_KINDS.join(', ')}.`)
  }
}

async function buildDraftChange(kind: ChangeKind, args: Record<string, unknown>, d: CharacterDraft): Promise<Built> {
  const ed = rulesEdition(d)
  switch (kind) {
    case 'set_race': {
      const race = find(allRaces(ed), str(args.race))
      if (!race) throw new Error(`No race "${str(args.race)}" in ${ed}. builder_options step race lists them.`)
      const sub = str(args.subrace) ? find(race.subraces ?? [], str(args.subrace)) : undefined
      if (str(args.subrace) && !sub) throw new Error(`${race.name} has no subrace "${str(args.subrace)}". Options: ${(race.subraces ?? []).map(s => s.name).join(', ') || 'none'}.`)
      const warnings: ChangeWarning[] = d.raceId && d.raceId !== race.id ? ['resets'] : []
      return { change: { kind, raceId: race.id, ...(sub ? { subraceId: sub.id } : {}) }, names: { race: race.name, ...(sub ? { subrace: sub.name } : {}) }, warnings, summary: `Pick ${sub?.name ?? race.name}.` }
    }
    case 'set_class': {
      const cls = find(classesFor(ed), str(args.class))
      if (!cls) throw new Error(`No class "${str(args.class)}" in ${ed}.`)
      const warnings: ChangeWarning[] = d.classes[0] && d.classes[0].classId !== cls.id ? ['resets'] : []
      return { change: { kind, classId: cls.id }, names: { class: cls.name }, warnings, summary: `Pick ${cls.name} as the class.` }
    }
    case 'set_subclass': {
      const cl = (str(args.class) && d.classes.find(x => x.classId === str(args.class) || norm(classById(x.classId, ed)?.name ?? '') === norm(str(args.class)))) || d.classes[0]
      if (!cl) throw new Error('Pick a class first.')
      const def = classById(cl.classId, ed)
      if (!subclassSlots(d).includes(cl)) throw new Error(`${def?.name ?? cl.classId} picks its subclass at level ${def?.subclassLevel ?? '?'}; the draft is level ${cl.level}. Suggest it for later with words instead.`)
      const sub = find(subclassesFor(cl.classId, ed), str(args.subclass))
      if (!sub) throw new Error(`No ${def?.name ?? cl.classId} subclass "${str(args.subclass)}". builder_options step class lists them.`)
      return { change: { kind, classId: cl.classId, subclassId: sub.id }, names: { subclass: sub.name, class: def?.name ?? cl.classId }, warnings: [], summary: `Pick ${sub.name}.` }
    }
    case 'set_background': {
      const bg = find(backgroundsFor(ed), str(args.background))
      if (!bg) throw new Error(`No background "${str(args.background)}" in ${ed}.`)
      const warnings: ChangeWarning[] = d.backgroundId && d.backgroundId !== bg.id ? ['resets'] : []
      return { change: { kind, backgroundId: bg.id }, names: { background: bg.name }, warnings, summary: `Pick the ${bg.name} background.` }
    }
    case 'set_feat': {
      const feat = find(allFeats(ed), str(args.feat))
      if (!feat) throw new Error(`No feat "${str(args.feat)}" in ${ed}.`)
      const level = Math.max(1, d.classes.reduce((n, cl) => n + cl.level, 0))
      const warnings: ChangeWarning[] = unmetFeatPrereqs(d, feat, level).length ? ['prereq'] : []
      const slotArg = str(args.slot)
      if (slotArg === 'origin') {
        if (d.originFeatId && d.originFeatId !== feat.id) warnings.push('replaces')
        return { change: { kind, featId: feat.id, slot: 'origin' }, names: { feat: feat.name }, warnings, summary: `Take ${feat.name} as the origin feat.` }
      }
      const slots = improvementSlots(d)
      const [cid, lvl] = slotArg.split(':')
      const empty = (s: { classId: string; level: number }) => !d.improvements?.some(i => i.classId === s.classId && i.level === s.level && (i.featId || Object.keys(i.abilities ?? {}).length))
      const slot = slots.find(s => s.classId === cid && s.level === Number(lvl)) ?? slots.find(empty) ?? slots[0]
      if (!slot) throw new Error('The draft has no Ability Score Improvement yet. For a 2024 Human\'s or Variant Human\'s feat pass slot "origin".')
      if (!empty(slot)) warnings.push('replaces')
      const cname = classById(slot.classId, ed)?.name ?? slot.classId
      return { change: { kind, featId: feat.id, slot }, names: { feat: feat.name, class: cname }, warnings, summary: `Take ${feat.name} at ${cname} level ${slot.level}.` }
    }
    case 'set_skills': {
      const raw = Array.isArray(args.skills) ? args.skills.map(x => str(x, 40)) : str(args.skills, 300).split(/,\s*/)
      const ids = raw.map(s => (s in SKILLS ? s : Object.entries(SKILLS).find(([, v]) => norm(v.name) === norm(s))?.[0])).filter((s): s is SkillId => !!s)
      if (!ids.length) throw new Error('set_skills needs `skills`: skill ids such as "stealth", "sleight-of-hand".')
      const p = skillPicks(d)
      const total = p.classCount + p.raceCount + p.bgCount + p.raceListCount
      const warnings: ChangeWarning[] = ids.length !== total ? ['skillCount'] : []
      return { change: { kind, skills: ids }, names: {}, warnings, summary: `Choose skills: ${ids.map(s => SKILLS[s].name).join(', ')} (the builder asks for ${total}).` }
    }
    case 'learn_spell': {
      const { spell, access, warnings } = await spellFor(d, args, getAbilityScores(d))
      return { change: { kind, spellId: spell.id, classId: access.classId }, names: { spell: spell.name, class: access.className }, warnings, summary: `Pick ${spell.name} for ${access.className}.` }
    }
    case 'forget_spell': {
      const lib = await spellLibrary(ed)
      const spell = find(lib.spells, str(args.spell))
      const k = (d.spells ?? []).find(x => x.id === (spell?.id ?? str(args.spell)))
      if (!k) throw new Error(`The draft has no spell "${str(args.spell)}".`)
      return { change: { kind, spellId: k.id, classId: k.classId }, names: { spell: spell?.name ?? k.id }, warnings: [], summary: `Drop ${spell?.name ?? k.id}.` }
    }
    default:
      throw new Error(`In the builder the kinds are: ${BUILDER_KINDS.join(', ')}.`)
  }
}

const WARNING_TEXT: Record<ChangeWarning, string> = {
  offList: 'not on this class\'s spell list (the card warns; the DM decides)',
  tooHigh: 'higher than the spell level this class can cast now',
  prereq: 'the feat\'s prerequisites are not met (the card warns; the DM decides)',
  resets: 'changing this clears picks that depend on it (skills, languages, and so on); the player picks those again',
  replaces: 'replaces what was picked there',
  skillCount: 'a different number of skills than the builder asks for',
  noBase: 'no base weapon or armor given; it starts on a stand-in the player can change in the inventory',
}

/** Builds the card; the tool and tests share it. */
export async function proposeChange(args: Record<string, unknown>, env: ToolEnv): Promise<{ proposal: Proposal; summary: string }> {
  const kind = str(args.kind) as ChangeKind
  if (!KINDS.includes(kind)) throw new Error(`Unknown kind "${kind}". Use one of: ${KINDS.join(', ')}.`)
  const { character, draft } = await resolveCharacter({}, env)
  const built = draft ? await buildDraftChange(kind, args, draft) : await buildCharacterChange(kind, args, character)
  const reason = str(args.reason, 240).trim()
  const proposal: Proposal = {
    id: newId(),
    target: draft ? 'builder' : 'character',
    ...(draft ? {} : { characterId: character.id, characterName: character.name }),
    change: built.change,
    names: built.names,
    warnings: built.warnings,
    ...(reason ? { reason } : {}),
  }
  return { proposal, summary: built.summary }
}

registerTool({
  declaration: {
    name: 'propose_change',
    description:
      'Suggest ONE change to the character on screen. It does not change anything: the user sees an Apply card under your answer and decides. ' +
      'Call it once per change (at most 4 per answer), after reading the character, only when the user wants help choosing. ' +
      `On a sheet: ${CHARACTER_KINDS.join(', ')}. In the builder: ${BUILDER_KINDS.join(', ')}. ` +
      'Pass ids from search_content / builder_options when you have them (names work too). Never say the change is made; say they can tap Apply.',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: KINDS },
        spell: { type: 'string', description: 'learn_spell, forget_spell, prepare_spell: spell id or name.' },
        class: { type: 'string', description: 'Spell list class (default: one that can take it); plan_level: the class for that level; set_class; set_subclass: whose subclass.' },
        prepared: { type: 'boolean', description: 'prepare_spell: true to prepare (default), false to unprepare. Wizard spellbook only.' },
        item: { type: 'string', description: 'add_item: equipment or magic item id or name.' },
        qty: { type: 'number', description: 'add_item: how many (default 1).' },
        base: { type: 'string', description: 'add_item for a magic weapon or armor: the base item id, e.g. longsword, chain-mail.' },
        text: { type: 'string', description: 'add_note: the note, short, in the user\'s language.' },
        level: { type: 'number', description: 'plan_level: the future character level (current + 1 to 20).' },
        subclass: { type: 'string', description: 'set_subclass or plan_level: subclass id or name.' },
        feat: { type: 'string', description: 'set_feat or plan_level: feat id or name.' },
        abilities: { type: 'string', description: 'plan_level instead of a feat: "cha+2" or "dex+1, con+1".' },
        slot: { type: 'string', description: 'set_feat: "origin" (2024 Human, Variant Human) or "<classId>:<class level>" of an ASI; default the first open one.' },
        race: { type: 'string', description: 'set_race: race or species id or name.' },
        subrace: { type: 'string', description: 'set_race: subrace or lineage id or name.' },
        background: { type: 'string', description: 'set_background: id or name.' },
        skills: { type: 'array', items: { type: 'string' }, description: 'set_skills: the full list of chosen skills (ids like "stealth").' },
        reason: { type: 'string', description: 'One short line on why, in the user\'s language; shown on the card.' },
      },
      required: ['kind'],
    },
  },
  available: canPropose,
  label: a => str(a.kind),
  async run(args, env) {
    const { proposal, summary } = await proposeChange(args, env)
    return {
      proposed: true,
      card: summary,
      ...(proposal.warnings.length ? { warnings: proposal.warnings.map(w => WARNING_TEXT[w]) } : {}),
      note: 'An Apply card now shows under your answer. Nothing has changed yet: tell the user they can tap Apply (and Undo after). Do not say it is done.',
      proposal,
    }
  },
})
