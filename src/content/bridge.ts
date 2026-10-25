// Converts between the content library and the rest of the app: library equipment → rules engine items,
// homebrew packs → content packs so the compendium lists them next to the SRD.
import type { HomebrewItem, HomebrewPack } from '../homebrew/types'
import type { Item, WeaponProperty } from '../rules/types'
import { CONTENT_FORMAT, CONTENT_VERSION, type ContentPack, type Equipment, type Feat, type Spell, type SpellSchool } from './types.ts'

/** Rules-engine item ids that the SRD 5.1 library spells differently. Every other engine weapon and armor id matches. */
export const LIBRARY_ID_FOR_RULES_ITEM: Record<string, string> = {
  padded: 'padded-armor', leather: 'leather-armor', 'studded-leather': 'studded-leather-armor', hide: 'hide-armor',
  'half-plate': 'half-plate-armor', splint: 'splint-armor', plate: 'plate-armor',
  'light-crossbow': 'crossbow-light', 'heavy-crossbow': 'crossbow-heavy', 'hand-crossbow': 'crossbow-hand',
}

const RULES_PROPERTIES = new Set<string>(['finesse', 'light', 'heavy', 'reach', 'thrown', 'two-handed', 'versatile', 'ammunition', 'loading', 'ranged'])

/** A library weapon, armor or gear entry as a rules-engine Item, so derive() can use it. Mounts and vehicles give undefined. */
export function toRulesItem(e: Equipment): Item | undefined {
  const weight = e.weight ?? 0
  if (e.weapon) {
    const w = e.weapon
    // The engine marks launcher weapons 'ranged'; thrown ones (dart) stay melee-style there.
    const ranged = w.range === 'ranged' && !w.properties.includes('thrown')
    const properties = [...w.properties, ...(ranged ? ['ranged'] : [])].filter(p => RULES_PROPERTIES.has(p)) as WeaponProperty[]
    const item: Item = { kind: 'weapon', id: e.id, name: e.name, category: w.category, damage: w.damage?.dice ?? '0', damageType: w.damage?.type ?? '', properties, weight }
    if (w.versatileDamage) item.versatile = w.versatileDamage
    if (w.normalRange) item.range = w.longRange ? `${w.normalRange}/${w.longRange}` : String(w.normalRange)
    return item
  }
  if (e.armor) {
    const a = e.armor
    const item: Item = { kind: 'armor', id: e.id, name: e.name, category: a.category, baseAc: a.baseAc, weight }
    // The engine leaves dexCap off shields: they add to AC, DEX never applies.
    if (a.category !== 'shield') {
      if (!a.dexBonus) item.dexCap = 0
      else if (a.maxDexBonus != null) item.dexCap = a.maxDexBonus
    }
    if (a.stealthDisadvantage) item.stealthDisadvantage = true
    if (a.strMinimum) item.strengthReq = a.strMinimum
    return item
  }
  if (e.type === 'mount' || e.type === 'vehicle') return undefined
  return { kind: 'gear', id: e.id, name: e.name, weight, ...(e.description ? { description: e.description } : {}) }
}

function homebrewEquipment(i: HomebrewItem, base: Pick<Equipment, 'source' | 'edition'>): Equipment {
  const e: Equipment = { id: i.id, name: i.name, ...base, type: i.kind === 'armor' ? 'armor' : i.kind === 'weapon' ? 'weapon' : 'gear', categories: [], weight: i.weight }
  if (i.description) e.description = i.description
  if (i.kind === 'weapon') {
    const [normal, long] = (i.range ?? '').split('/').map(Number)
    e.categories = [`${i.category}-weapons`]
    e.weapon = {
      category: i.category,
      range: i.properties.includes('ranged') ? 'ranged' : 'melee',
      damage: { dice: i.damage, type: i.damageType },
      properties: i.properties.filter(p => p !== 'ranged'),
      ...(i.versatile ? { versatileDamage: i.versatile } : {}),
      ...(normal ? { normalRange: normal } : {}),
      ...(long ? { longRange: long } : {}),
    }
  } else if (i.kind === 'armor') {
    e.categories = [i.category === 'shield' ? 'shields' : `${i.category}-armor`]
    e.armor = {
      category: i.category,
      baseAc: i.baseAc,
      dexBonus: i.dexCap !== 0,
      ...(i.dexCap ? { maxDexBonus: i.dexCap } : {}),
      ...(i.strengthReq ? { strMinimum: i.strengthReq } : {}),
      stealthDisadvantage: !!i.stealthDisadvantage,
    }
  }
  return e
}

/** A homebrew pack's spells, items and feats as a content pack (source `hb:<packId>`). Ids stay `hb:<packId>:<slug>`. */
export function fromHomebrewPack(pack: HomebrewPack): ContentPack {
  const base = { source: `hb:${pack.id}`, edition: '2014' as const }
  const spells: Spell[] = pack.spells.map(s => ({
    id: s.id,
    name: s.name,
    ...base,
    level: s.level,
    school: s.school.toLowerCase() as SpellSchool,
    castingTime: s.castingTime,
    range: s.range,
    components: { ...s.components },
    duration: s.duration,
    concentration: s.concentration,
    ritual: s.ritual,
    classes: s.classes,
    subclasses: [],
    description: s.description,
    ...(s.higherLevels ? { higherLevels: s.higherLevels } : {}),
    ...(s.save ? { save: { ability: s.save, onSuccess: 'other' as const } } : {}),
    ...(s.damage ? { damage: { ...(s.damageType ? { type: s.damageType } : {}), [s.level === 0 ? 'byCharacterLevel' : 'bySlotLevel']: { [Math.max(1, s.level)]: s.damage } } } : {}),
  }))
  const feats: Feat[] = pack.feats.map(f => ({
    id: f.id,
    name: f.name,
    ...base,
    prerequisites: { abilities: [], anyAbility: false, ...(f.prerequisite ? { text: f.prerequisite } : {}) },
    repeatable: false,
    description: f.description,
  }))
  return {
    format: CONTENT_FORMAT,
    version: CONTENT_VERSION,
    source: { id: base.source, title: pack.name, edition: base.edition, license: 'homebrew', attribution: `Homebrew by ${pack.authorName || 'a player'}` },
    entries: { spells, equipment: pack.items.map(i => homebrewEquipment(i, base)), feats },
  }
}
