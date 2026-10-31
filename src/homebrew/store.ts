// Homebrew pack library. Async like src/storage so a backend can replace localStorage later.
// Every pack on this device is active: its items are registered with the rules engine so
// characters holding them keep their attacks, AC and weight.
import {
  allTools, registerClassOptions, registerHomebrewBackgrounds, registerHomebrewClasses, registerHomebrewFeats, registerHomebrewItems, registerHomebrewProficiencies,
  registerHomebrewRaces, registerHomebrewSubclasses, type ClassDef, type HomebrewBackgroundDef, type Race, type Subrace, type TraitChoice,
} from '../rules'
import { CONTENT_FORMAT, CONTENT_VERSION, listSources, registerContentPack, unregisterContentPack, type Monster } from '../content'
import { toLibraryMonster } from '../monsters/model'
import { markPackDirty } from '../sync/outbox'
import { slug } from './pack'
import { sanitizePack } from './pack'
import type { HomebrewBackground, HomebrewClass, HomebrewMonster, HomebrewPack, HomebrewRace } from './types'

const KEY = 'ff.homebrew.v1'
/** Party members' packs from the cloud (src/sync), by `<ownerId>:<packId>`. Read-only, never edited here. */
const SHARED_KEY = 'ff.homebrew.shared.v1'
const CHANGED = 'ff:homebrew-changed'

function readPacks(): HomebrewPack[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.flatMap(p => {
      try {
        return [sanitizePack(p)]
      } catch {
        return []
      }
    })
  } catch {
    return []
  }
}

function readShared(): Record<string, HomebrewPack> {
  try {
    const raw = JSON.parse(localStorage.getItem(SHARED_KEY) ?? '{}')
    const out: Record<string, HomebrewPack> = {}
    for (const [k, p] of Object.entries(raw && typeof raw === 'object' ? raw : {})) {
      try { out[k] = sanitizePack(p) } catch { /* skip a broken copy */ }
    }
    return out
  } catch {
    return {}
  }
}

/** The packs the rules engine sees: this device's library, plus the newest party copy of each pack not in it. */
function activePacks(): HomebrewPack[] {
  const local = readPacks()
  const byId = new Map(local.map(p => [p.id, p]))
  const party = new Map<string, HomebrewPack>()
  for (const p of Object.values(readShared())) {
    if (byId.has(p.id)) continue
    const cur = party.get(p.id)
    if (!cur || p.updatedAt > cur.updatedAt) party.set(p.id, p)
  }
  return [...local, ...party.values()]
}

/** The race's named pick as a rules TraitChoice (saved in traitChoices[`<raceId>:choice`]); option ids come from their names. */
const toChoices = (r: HomebrewRace): TraitChoice[] | undefined =>
  r.choice && [{ id: `${r.id}:choice`, name: r.choice.name, options: r.choice.options.map(o => ({ id: slug(o.name), name: o.name, detail: o.detail, effects: o.effects })) }]

export const toRace = (r: HomebrewRace): Race => ({
  id: r.id, name: r.name, size: r.size, speed: r.speed, abilityBonuses: r.abilityBonuses,
  freeAbilityBonuses: r.freeAbilityBonuses ? { count: r.freeAbilityBonuses, exclude: [] } : undefined,
  skillProficiencies: r.skillProficiencies, freeSkillChoices: r.freeSkillChoices || undefined,
  languages: r.languages, languageChoices: r.languageChoices || undefined,
  // The pick shows as a trait so the sheet and builder explain it.
  traits: r.choice ? [...r.traits, r.choice.name] : r.traits,
  choices: toChoices(r),
  hpPerLevel: r.hpPerLevel || undefined,
  sizeOptions: r.sizeOptions?.length ? [...new Set([r.size, ...r.sizeOptions])] : undefined,
  effects: r.effects, tools: r.tools,
  toolChoices: r.toolChoices ? { count: r.toolChoices, from: allTools() } : undefined,
  armor: r.armor, weapons: r.weapons,
  naturalArmor: r.naturalArmor ? { base: r.naturalArmor, dex: true } : undefined,
  edition: r.edition,
})

export const toSubrace = (r: HomebrewRace): Subrace => ({
  id: r.id, name: r.name, abilityBonuses: r.abilityBonuses, traits: r.traits, parentRaceId: r.parentRaceId,
  hpPerLevel: r.hpPerLevel || undefined, languageChoices: r.languageChoices || undefined, effects: r.effects,
})

/** A pack background as the rules engine's background, in the editions its author picked. */
export const toBackground = (b: HomebrewBackground): HomebrewBackgroundDef => ({
  id: b.id, name: b.name, editions: b.editions === 'both' ? ['2014', '2024'] : [b.editions],
  skillProficiencies: b.skillProficiencies, toolProficiencies: b.tools,
  toolChoices: b.toolChoices ? { count: b.toolChoices, from: b.toolChoiceFrom.length ? b.toolChoiceFrom : allTools() } : undefined,
  languages: b.languages, languageChoices: b.languageChoices || undefined,
  feature: b.feature.trim() || b.name, equipment: b.equipment, gold: b.gold || undefined,
  abilityScores: b.abilityScores.length ? b.abilityScores : undefined,
  feat: b.originFeatId ? { id: b.originFeatId, note: b.originFeatNote } : undefined,
  effects: b.effects.length ? b.effects : undefined,
  description: [b.featureText && `${b.feature}: ${b.featureText}`, b.description].filter(Boolean).join('\n\n') || undefined,
})

/** A pack class as the engine's ClassDef. Its feature uses become resources; gear is left to the player. */
export const toClass = ({ tools, ...c }: HomebrewClass): ClassDef => ({
  ...c, resources: [], startingEquipment: [], subclassTitle: c.subclassTitle.trim() || 'Subclass',
  ...(tools.length ? { toolProficiencies: tools } : {}),
  // A blank spell list means the class's own: homebrew spells that name it.
  ...(c.spellcasting ? { spellcasting: { ...c.spellcasting, list: c.spellcasting.list || c.id } } : {}),
})

/** A pack monster as a library `Monster` with source `hb:<packId>`, so `{ source, id }` references find it. */
export const toMonster = (m: HomebrewMonster, packId: string): Monster => toLibraryMonster(m, `hb:${packId}`)

/**
 * Monsters go to the content library as one content pack per homebrew pack (source `hb:<packId>`), so
 * `loadKind('monsters')` lists them next to the SRD on the DM screen. Packs that lost their monsters, or
 * were deleted, are unregistered.
 */
function registerMonsters(packs: HomebrewPack[]) {
  const live = new Set<string>()
  for (const p of packs) {
    if (!p.monsters.length) continue
    const id = `hb:${p.id}`
    live.add(id)
    registerContentPack({
      format: CONTENT_FORMAT, version: CONTENT_VERSION,
      source: { id, title: p.name, edition: '2014', license: 'homebrew', attribution: `Homebrew by ${p.authorName || 'a player'}` },
      entries: { monsters: p.monsters.map(m => toMonster(m, p.id)) },
    })
  }
  for (const s of listSources()) if (s.id.startsWith('hb:') && !live.has(s.id)) unregisterContentPack(s.id)
}

/** Hands every pack's content to the rules engine. */
function register(packs: HomebrewPack[]) {
  // Languages and tools first: race tool picks list every tool, homebrew ones included.
  registerHomebrewProficiencies(packs.flatMap(p => p.languages), packs.flatMap(p => p.tools))
  registerHomebrewItems(packs.flatMap(p => p.items))
  registerHomebrewFeats(packs.flatMap(p => p.feats))
  const races = packs.flatMap(p => p.races)
  registerHomebrewRaces(races.filter(r => !r.parentRaceId).map(toRace), races.filter(r => r.parentRaceId).map(toSubrace))
  registerHomebrewSubclasses(packs.flatMap(p => p.subclasses))
  registerHomebrewBackgrounds(packs.flatMap(p => p.backgrounds).map(toBackground))
  registerClassOptions('homebrew', packs.flatMap(p => p.classOptions.map(o => ({ ...o, source: p.name }))))
  registerHomebrewClasses(packs.flatMap(p => p.classes).map(toClass))
  registerMonsters(packs)
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked; nothing else to do offline.
  }
  register(activePacks())
  globalThis.window?.dispatchEvent(new Event(CHANGED))
}

const writePacks = (packs: HomebrewPack[]) => write(KEY, packs)

export async function listPacks(): Promise<HomebrewPack[]> {
  return readPacks()
}

export async function savePack(pack: HomebrewPack): Promise<HomebrewPack> {
  const next = { ...pack, history: undefined, updatedAt: new Date().toISOString() }
  writePacks([...readPacks().filter(p => p.id !== pack.id), next])
  markPackDirty(next.id)
  return next
}

export async function deletePack(id: string): Promise<void> {
  writePacks(readPacks().filter(p => p.id !== id))
  markPackDirty(id, true)
}

export type ImportResult = 'added' | 'updated' | 'unchanged'

/** Adds a friend's pack, or replaces our copy when theirs is newer. */
export async function importPack(pack: HomebrewPack): Promise<ImportResult> {
  const packs = readPacks()
  const existing = packs.find(p => p.id === pack.id)
  if (existing && Date.parse(existing.updatedAt) >= Date.parse(pack.updatedAt)) return 'unchanged'
  writePacks([...packs.filter(p => p.id !== pack.id), { ...pack, history: undefined }])
  markPackDirty(pack.id)
  return existing ? 'updated' : 'added'
}

/** This device's library without marking anything for sync: for src/sync only. */
export const localPacks = (): HomebrewPack[] => readPacks()

/** Writes another device's copy into the library (or removes it), without marking it for sync. */
export function applyRemotePack(pack: HomebrewPack | null, id = pack?.id) {
  const rest = readPacks().filter(p => p.id !== id)
  writePacks(pack ? [...rest, { ...sanitizePack(pack), history: undefined }] : rest)
}

/** Party members' packs this device knows, keyed `<ownerId>:<packId>`. */
export async function listPartyPacks(): Promise<HomebrewPack[]> {
  return Object.values(readShared())
}

/** Applies party members' pack changes from the cloud: a pack to keep, or null when it was deleted. */
export function applyPartyPacks(changes: { ownerId: string; id: string; pack: HomebrewPack | null }[]) {
  if (!changes.length) return
  const shared = readShared()
  for (const c of changes) {
    const key = `${c.ownerId}:${c.id}`
    if (c.pack) shared[key] = { ...sanitizePack(c.pack), history: undefined }
    else delete shared[key]
  }
  write(SHARED_KEY, shared)
}

/** Calls fn when packs change in this tab or another one. Returns an unsubscribe function. */
export function onPacksChanged(fn: () => void): () => void {
  const other = (e: StorageEvent) => {
    if (e.key !== KEY && e.key !== SHARED_KEY) return
    register(activePacks())
    fn()
  }
  window.addEventListener(CHANGED, fn)
  window.addEventListener('storage', other)
  return () => {
    window.removeEventListener(CHANGED, fn)
    window.removeEventListener('storage', other)
  }
}

/** Registers stored homebrew items with the rules engine. Call once at startup. */
export function loadHomebrew() {
  register(activePacks())
}
