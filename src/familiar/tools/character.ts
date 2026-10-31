// Player tools: the open character (or the builder draft), how a number is built, and what the builder still needs.
// They read only what the app hands over in ToolEnv.data, so the model sees the asker's own characters and nothing else.
import type { Character } from '../../model/character'
import { loadKind, type Spell } from '../../content'
import { STEP_IDS, skillPicks, stepIssues, stepWarnings, subclassSlots, grantedSkills, type StepId } from '../../builder/validate'
import { explain, type StatKey } from '../../explain/math'
import { planSteps } from '../../planner/plan'
import { spellAccess } from '../../spellbook/access'
import { extraSources } from '../../spellbook/extra'
import { isPrepared } from '../../spellbook/spellbook'
import {
  ABILITIES, ALL_SKILLS, allFeats, allRaces, backgroundsFor, classById, classChoices, classesFor, createCharacter, derive, featById, getAbilityScores,
  improvementSlots, itemById, languagePickCount, rulesEdition, subclassById, subclassesFor, toolPickGroups, unmetFeatPrereqs,
  type CharacterDraft,
} from '../../rules'
import { characterCard, draftCard } from '../context'
import { registerTool, str, type ToolEnv } from './registry'

export const CHARACTER_SECTIONS = ['summary', 'abilities', 'features', 'spells', 'inventory', 'state', 'plan'] as const
type Section = (typeof CHARACTER_SECTIONS)[number]

const cut = (s: string | undefined, max = 300) => (s && s.length > max ? `${s.slice(0, max)}…` : s)

/** A draft as a character, so derive() and explain() can read it. Missing picks just count as nothing. */
export function draftCharacter(d: CharacterDraft): Character {
  return { ...createCharacter(d), id: 'draft' }
}

const ownDraft = (env: ToolEnv) => (env.context.kind === 'builder' ? (env.data?.draft?.() as CharacterDraft | undefined) : undefined)

/** The character a call is about: an id the app may open for this user, else what is on screen. */
export async function resolveCharacter(args: Record<string, unknown>, env: ToolEnv): Promise<{ character: Character; draft?: CharacterDraft }> {
  const id = str(args.id, 80)
  if (id) {
    const c = (await env.data?.getCharacter?.(id)) as Character | undefined
    if (!c) throw new Error(`No character "${id}" that this user can open.`)
    return { character: c }
  }
  if (env.context.kind === 'character') {
    const c = (env.data?.character?.() ?? (await env.data?.getCharacter?.(env.context.characterId))) as Character | undefined
    if (c) return { character: c }
  }
  const draft = ownDraft(env)
  if (draft) return { character: draftCharacter(draft), draft }
  throw new Error('No character is open. Ask the user to open their sheet or the builder, then ask again.')
}

async function spellIndex(edition: '2014' | '2024'): Promise<Map<string, Spell>> {
  const all = await loadKind('spells', { edition }).catch(() => [] as Spell[])
  const map = new Map<string, Spell>()
  for (const s of all) if (!map.has(s.id)) map.set(s.id, s)
  return map
}

async function section(c: Character, which: Section): Promise<Record<string, unknown>> {
  const d = derive(c)
  const edition = rulesEdition(c)
  switch (which) {
    case 'summary':
      return { card: characterCard(c) }
    case 'abilities':
      return {
        level: d.level, proficiencyBonus: d.proficiencyBonus,
        abilities: Object.fromEntries(ABILITIES.map(a => [a, { score: d.abilities[a], mod: d.mods[a], save: d.saves[a].bonus, saveProficient: d.saves[a].proficient }])),
        skills: Object.fromEntries(Object.entries(d.skills).map(([k, s]) => [k, { bonus: s.bonus, ability: s.ability, proficient: s.proficient, ...(s.expertise ? { expertise: true } : {}), ...(s.advantage ? { advantage: true } : {}) }])),
        initiative: d.initiative, passivePerception: d.passivePerception,
        hint: 'Call explain_stat for how any of these is built.',
      }
    case 'features':
      return {
        features: d.features.map(f => ({ level: f.level, name: f.name, class: f.className, ...(f.detail ? { detail: f.detail } : {}), ...(f.text ? { text: cut(f.text) } : {}) })),
        feats: d.feats, traits: d.traits, languages: d.languages, tools: d.tools,
        resources: d.resources.map(r => ({ name: r.label, max: r.max, used: c.state.resources[r.id]?.used ?? 0, recharge: r.recharge })),
        defenses: d.defenses, senses: d.senses, speed: d.speed, speeds: d.speeds, size: d.size,
        hint: 'Rules text for a feature: search_content kind "features" (SRD) or the class or subclass entry.',
      }
    case 'spells': {
      const byId = await spellIndex(edition)
      const known = (c.spells ?? []).map(k => {
        const s = byId.get(k.id)
        return { id: k.id, name: s?.name ?? k.id, level: s?.level, list: k.classId, prepared: isPrepared(k), ...(s?.concentration ? { concentration: true } : {}), ...(s?.ritual ? { ritual: true } : {}), ...(s && !s.source.startsWith('srd-') ? { source: s.source } : {}) }
      })
      const lib = { spells: [...byId.values()], classes: await loadKind('classes', { edition }).catch(() => []), subclasses: await loadKind('subclasses', { edition }).catch(() => []) }
      const access = spellAccess(c, lib.classes, lib.subclasses, d.abilities, undefined, lib.spells).map(a => ({
        class: a.className, ability: a.ability, kind: a.kind, cantrips: a.cantrips, spellsKnownOrPrepared: a.limit, highestSpellLevel: a.maxLevel,
        ...(a.spellbook != null ? { spellbookSize: a.spellbook } : {}),
        alwaysPrepared: a.alwaysPrepared.map(id => byId.get(id)?.name ?? id),
      }))
      return {
        spellcasting: d.spellcasting ?? null,
        slots: d.spellSlots.slots.map((n, i) => ({ level: i + 1, max: n, used: c.state.spellSlotsUsed[i] ?? 0 })).filter(s => s.max > 0),
        ...(d.spellSlots.pact ? { pactSlots: { ...d.spellSlots.pact, used: c.state.pactSlotsUsed } } : {}),
        perClass: access, known,
        fromItemsAndFeats: d.itemSpells.map(s => ({ spell: s.spell, from: s.source, ...(s.note ? { note: s.note } : {}) })),
      }
    }
    case 'inventory':
      return {
        items: c.inventory.map(i => ({ name: i.name ?? i.item?.name ?? itemById(i.itemId)?.name ?? i.itemId, qty: i.qty, equipped: i.equipped, ...(i.magicBonus ? { magicBonus: i.magicBonus } : {}), ...(i.pact ? { pactWeapon: true } : {}), ...(i.notes ? { notes: cut(i.notes, 120) } : {}) })),
        coins: c.coins,
        attacks: d.attacks.map(a => ({ name: a.name, bonus: a.bonus, damage: a.damage, type: a.damageType, ...(a.versatile ? { versatile: a.versatile } : {}), ...(a.notes.length ? { notes: a.notes } : {}) })),
        armorClass: d.armorClass, carried: d.carriedWeight, carryingCapacity: d.carryingCapacity,
      }
    case 'state':
      return {
        hp: { current: Math.min(c.state.currentHp, d.maxHp), max: d.maxHp, temp: c.state.tempHp },
        deathSaves: c.state.deathSaves, conditions: c.state.conditions,
        effects: (c.state.effects ?? []).map(e => ({ name: e.name, from: e.from, ...(e.level ? { level: e.level } : {}), ...(e.concentration ? { concentration: true } : {}) })),
        hitDice: d.hitDice.map(h => ({ die: h.die, total: h.total, spent: c.state.hitDiceSpent[h.die] ?? 0 })),
        resources: d.resources.map(r => ({ name: r.label, left: r.max - (c.state.resources[r.id]?.used ?? 0), max: r.max, recharge: r.recharge })),
        slotsLeft: d.spellSlots.slots.map((n, i) => ({ level: i + 1, left: n - (c.state.spellSlotsUsed[i] ?? 0) })).filter((_, i) => d.spellSlots.slots[i] > 0),
        ...(d.spellSlots.pact ? { pactSlotsLeft: d.spellSlots.pact.count - c.state.pactSlotsUsed } : {}),
      }
    case 'plan': {
      if (!c.levelPlan?.length) return { plan: [], note: 'No build plan yet. The sheet\'s build planner (Plan to 20) lets the player plan every level; you can suggest one in words.' }
      return {
        plan: planSteps(c).map(s => ({
          level: s.level, class: classById(s.entry.classId, edition)?.name ?? s.entry.classId, classLevel: s.classLevel,
          ...(s.subclassId ? { subclass: subclassById(s.subclassId, edition)?.name ?? s.subclassId } : {}),
          features: s.features.map(f => f.name), hpGain: s.hpGain,
          ...(s.asiDue ? { asiOrFeat: true } : {}), ...(s.needs.length ? { stillNeeds: s.needs } : {}), ...(s.issues.length ? { issues: s.issues } : {}),
        })),
      }
    }
  }
}

registerTool({
  declaration: {
    name: 'get_character',
    description:
      'Read the character on screen (or, with `id`, another character of this user). Sections: summary (the card), abilities (scores, saves, skills), ' +
      'features (class and race features, feats, resources, defenses), spells (known/prepared, slots, per-class limits), inventory (gear, attacks, coins), ' +
      'state (HP, conditions, what is used up), plan (the build planner route). In the builder it reads the draft so far.',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string', enum: [...CHARACTER_SECTIONS], description: 'Default summary.' },
        id: { type: 'string', description: 'Another own character by id; omit for the one on screen.' },
      },
    },
  },
  available: env => env.context.kind === 'character' || env.context.kind === 'builder' || !!env.data?.getCharacter,
  label: a => str(a.section) || 'summary',
  async run(args, env) {
    const which = (CHARACTER_SECTIONS as readonly string[]).includes(str(args.section)) ? (str(args.section) as Section) : 'summary'
    const { character, draft } = await resolveCharacter(args, env)
    return { name: character.name || '(unnamed)', section: which, ...(draft ? { draft: true } : {}), ...(await section(character, which)) }
  },
})

/** Every key explain_stat takes, for the error message. */
export function statKeys(c: Character): string[] {
  return [
    'ac', 'initiative', 'speed', 'proficiency', 'maxHp', 'passivePerception', 'spellDc', 'spellAttack', 'carryingCapacity',
    ...ABILITIES.flatMap(a => [`ability:${a}`, `mod:${a}`, `save:${a}`]),
    ...ALL_SKILLS.map(s => `skill:${s}`),
    ...derive(c).attacks.map((_, i) => `attack:${i}`),
  ]
}

registerTool({
  declaration: {
    name: 'explain_stat',
    description:
      'How one number on the character is built, line by line (the lines add up to the total), as the sheet\'s "show the math" does. ' +
      'Keys: ac, initiative, speed, proficiency, maxHp, passivePerception, spellDc, spellAttack, carryingCapacity, ability:<str..cha>, mod:<ability>, save:<ability>, ' +
      'skill:<skill id, e.g. stealth, sleight-of-hand>, attack:<index in the inventory section\'s attacks>.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'e.g. "ac", "save:wis", "skill:stealth", "attack:0".' },
        id: { type: 'string', description: 'Another own character by id; omit for the one on screen.' },
      },
      required: ['key'],
    },
  },
  available: env => env.context.kind === 'character' || env.context.kind === 'builder',
  label: a => str(a.key),
  async run(args, env) {
    const { character } = await resolveCharacter(args, env)
    const key = str(args.key, 40).trim()
    const valid = statKeys(character)
    if (!valid.includes(key)) throw new Error(`Unknown key "${key}". Use one of: ${valid.join(', ')}.`)
    const m = explain(character, key as StatKey)
    if (!m) return { key, note: 'This character has no such number (no spellcasting, or no such attack).' }
    return { key, title: m.title, total: m.total, signed: m.signed, lines: m.lines, notes: m.notes }
  },
})

const nameOf = <T extends { id: string; name: string }>(x: T) => ({ id: x.id, name: x.name, ...('source' in x && x.source ? { source: x.source as string } : {}) })

/** What the builder offers on a step and what is still open. Pure over the draft. */
export async function builderOptions(d: CharacterDraft, step: StepId): Promise<Record<string, unknown>> {
  const ed = rulesEdition(d)
  const level = d.classes.reduce((n, cl) => n + cl.level, 0)
  const base = { step, edition: ed, missing: stepIssues(step, d), warnings: stepWarnings(step, d) }
  switch (step) {
    case 'race': {
      const races = allRaces(ed)
      return {
        ...base, picked: d.raceId ? { race: d.raceId, subrace: d.subraceId ?? null } : null, total: races.length,
        options: races.slice(0, 80).map(nameOf),
        hint: 'Use search_content kind "races" and get_entry for traits.',
      }
    }
    case 'class': {
      const classes = classesFor(ed)
      return {
        ...base,
        picked: d.classes.map(cl => ({ class: cl.classId, level: cl.level, subclass: cl.subclassId ?? null })),
        classOptions: classes.slice(0, 40).map(nameOf),
        subclassesDue: subclassSlots(d).map(cl => ({
          class: cl.classId, picked: cl.subclassId ?? null,
          options: subclassesFor(cl.classId, ed).map(s => ({ id: s.id, name: s.name, ...(s.source ? { book: s.source } : {}) })),
        })),
        classChoices: classChoices(d).map(x => ({ class: x.classId, level: x.level, choice: x.choice.name, picked: x.picked?.name ?? null, options: x.choice.options.map(o => o.name) })),
      }
    }
    case 'abilities': {
      const slots = improvementSlots(d).map(s => {
        const got = d.improvements?.find(i => i.classId === s.classId && i.level === s.level)
        return { class: s.classId, classLevel: s.level, picked: got ? (got.featId ? { feat: featById(got.featId, ed)?.name ?? got.featId } : { abilities: got.abilities }) : null }
      })
      const feats = allFeats(ed)
      const eligible = feats.filter(f => !unmetFeatPrereqs(d, f, Math.max(level, 1)).length)
      return {
        ...base, method: d.abilityMethod, base: d.baseAbilities, final: getAbilityScores(d), backgroundOrRaceBonuses: d.freeAbilityBonuses,
        ...(ed === '2024' ? { background: d.backgroundId || null } : {}),
        improvementSlots: slots,
        featsMeetingPrerequisites: eligible.slice(0, 80).map(f => ({ id: f.id, name: f.name, ...(f.category ? { category: f.category } : {}) })),
        featsTotal: feats.length,
        note: 'Feats with unmet prerequisites are still pickable; the builder only warns.',
      }
    }
    case 'skills': {
      const p = skillPicks(d)
      return {
        ...base, background: d.backgroundId || null,
        backgroundOptions: ed === '2014' ? backgroundsFor(ed).slice(0, 60).map(nameOf) : undefined,
        granted: [...grantedSkills(d)], chosen: d.chosenSkills,
        classSkillPicks: { count: p.classCount, from: p.classFrom }, anySkillPicks: p.raceCount,
        ...(p.bgCount ? { backgroundSkillPicks: { count: p.bgCount, from: p.bgFrom } } : {}),
        ...(p.raceListCount ? { raceSkillPicks: { count: p.raceListCount, from: p.raceFrom } } : {}),
        languagePicks: languagePickCount(d), chosenLanguages: d.chosenLanguages ?? [],
        toolPicks: toolPickGroups(d).map(g => ({ from: g.source, count: g.count, options: g.from.slice(0, 20) })), chosenTools: d.chosenTools ?? [],
      }
    }
    case 'spells': {
      const byId = await spellIndex(ed)
      const [classes, subclasses] = await Promise.all([loadKind('classes', { edition: ed }).catch(() => []), loadKind('subclasses', { edition: ed }).catch(() => [])])
      const picked = d.spells ?? []
      const access = spellAccess(d, classes, subclasses, getAbilityScores(d), undefined, [...byId.values()])
      return {
        ...base,
        perClass: access.map(a => {
          const mine = picked.filter(k => k.classId === a.classId)
          const lvl = (id: string) => byId.get(id)?.level ?? 0
          return {
            class: a.className, kind: a.kind, highestSpellLevel: a.maxLevel,
            cantrips: { target: a.cantrips, picked: mine.filter(k => lvl(k.id) === 0).length },
            spells: { target: a.spellbook ?? a.limit, picked: mine.filter(k => lvl(k.id) > 0 && !a.alwaysPrepared.includes(k.id)).length },
            ...(a.spellbook != null ? { prepareEachDay: a.limit } : {}),
            alwaysPrepared: a.alwaysPrepared.map(id => byId.get(id)?.name ?? id),
            pickedNames: mine.map(k => byId.get(k.id)?.name ?? k.id),
          }
        }),
        extraPicks: extraSources(d).map(s => ({ from: s.grantId, kind: s.kind, cantrips: s.cantrips, spells: s.spells, lists: s.lists })),
        hint: 'Find spells with search_content kind "spells" and spellClass / spellLevel filters. Counts are guidance; the builder only notes under or over.',
      }
    }
    case 'equipment': {
      const cls = classById(d.classes[0]?.classId ?? '', ed)
      return {
        ...base, class: cls?.name ?? null,
        kitChoices: (cls?.equipmentChoices ?? []).map((ch, i) => ({ choice: i + 1, picked: d.equipmentPicks?.[i]?.option ?? null, options: ch.options.map(o => ({ items: o.items.map(id => itemById(id)?.name ?? id), ...(o.gold ? { gold: o.gold } : {}) })) })),
        startingGold: d.startingWealth ?? null, bought: (d.purchases ?? []).map(p => ({ name: p.item?.name ?? itemById(p.itemId)?.name ?? p.itemId, qty: p.qty })),
      }
    }
    case 'details':
      return { ...base, name: d.name || null, alignment: d.alignment, playerName: d.playerName || null }
  }
}

registerTool({
  declaration: {
    name: 'builder_options',
    description:
      'In the character builder: what a step offers right now and what is still missing (race, class with subclasses and class choices, abilities with ASI slots ' +
      'and feats that meet prerequisites, skills/languages/tools picks, spells per class with targets, equipment kit choices, details). Default: the step on screen.',
    parameters: {
      type: 'object',
      properties: { step: { type: 'string', enum: [...STEP_IDS], description: 'Builder step; default the current one.' } },
    },
  },
  available: env => env.context.kind === 'builder',
  label: a => str(a.step) || 'builder',
  async run(args, env) {
    const draft = ownDraft(env)
    if (!draft) throw new Error('The builder is not open.')
    const asked = str(args.step)
    const step = (STEP_IDS as string[]).includes(asked) ? (asked as StepId) : ((env.data?.step?.() as StepId | undefined) ?? 'race')
    const all = Object.fromEntries(STEP_IDS.map(s => [s, stepIssues(s, draft).length]))
    return { ...(await builderOptions(draft, step)), missingPerStep: all, summary: draftCard(draft) }
  },
})

