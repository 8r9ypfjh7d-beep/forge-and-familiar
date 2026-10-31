// Changes the Familiar may propose, and how a tapped Apply card makes them through the app's own edit functions.
// Pure: the tool (tools/changes.ts) resolves names and checks fit; the sheet and builder call these when the user taps Apply.
import { addSpell, hasSpell, isPrepared, removeSpell, setPrepared, spellsOf } from '../spellbook/spellbook'
import { addItem, removeEntry, setQty } from '../inventory/inventory'
import { setEntry } from '../planner/plan'
import { backgroundPatch, classPatch, improvementPatch, racePatch, subracePatch } from '../builder/picks'
import type { Character, KnownSpell, PlannedLevel } from '../model/character'
import { setSubclass, type CharacterDraft, type InventoryEntry, type SkillId } from '../rules'

/** Where a change goes: the open sheet or the builder draft. */
export type ChangeTarget = 'character' | 'builder'

export type Change =
  | { kind: 'learn_spell'; spellId: string; classId: string }
  | { kind: 'forget_spell'; spellId: string; classId: string }
  | { kind: 'prepare_spell'; spellId: string; classId: string; prepared: boolean }
  | { kind: 'add_item'; entry: Omit<InventoryEntry, 'uid' | 'qty' | 'equipped'>; qty: number }
  | { kind: 'add_note'; text: string }
  | { kind: 'plan_level'; entry: PlannedLevel }
  | { kind: 'set_race'; raceId: string; subraceId?: string }
  | { kind: 'set_class'; classId: string }
  | { kind: 'set_subclass'; classId: string; subclassId: string }
  | { kind: 'set_background'; backgroundId: string }
  | { kind: 'set_feat'; featId: string; slot: 'origin' | { classId: string; level: number } }
  | { kind: 'set_skills'; skills: SkillId[] }

export type ChangeKind = Change['kind']

export const CHARACTER_KINDS: ChangeKind[] = ['learn_spell', 'forget_spell', 'prepare_spell', 'add_item', 'add_note', 'plan_level']
export const BUILDER_KINDS: ChangeKind[] = ['set_race', 'set_class', 'set_subclass', 'set_background', 'set_feat', 'set_skills', 'learn_spell', 'forget_spell']

/** Why a card warns before the tap (warn, don't block): `i18n familiar.change.warn.*`. */
export type ChangeWarning = 'offList' | 'tooHigh' | 'prereq' | 'resets' | 'replaces' | 'skillCount' | 'noBase'

/** One suggestion card: what to change, on which character, with names for the card text. */
export interface Proposal {
  id: string
  target: ChangeTarget
  /** The sheet's character, so the card applies only there. */
  characterId?: string
  /** Who it is for, for "Open David's sheet to apply". */
  characterName?: string
  change: Change
  /** English names of what the card names (spell, item, class...), keyed by role; the card translates them through i18n terms. */
  names: Record<string, string>
  warnings: ChangeWarning[]
  /** The model's one-line reason, in the user's language. */
  reason?: string
}

/** How a card's tap went. */
export type ApplyOutcome = { ok: true; undo: () => void } | { ok: false; why: 'already' | 'elsewhere' | 'failed' }

/** A change applied to a character, and how to take exactly that change back later (other edits since stay). */
export interface CharacterResult {
  next: Character
  undo: (c: Character) => Character
}

/** Applies a sheet change; null when there is nothing to do (already the case, or no longer fits). */
export function applyCharacterChange(c: Character, change: Change): CharacterResult | null {
  switch (change.kind) {
    case 'learn_spell': {
      if (hasSpell(c, change.classId, change.spellId)) return null
      return { next: addSpell(c, change.classId, change.spellId), undo: x => removeSpell(x, change.classId, change.spellId) }
    }
    case 'forget_spell': {
      const had = spellsOf(c).find(s => s.classId === change.classId && s.id === change.spellId)
      if (!had) return null
      return { next: removeSpell(c, change.classId, change.spellId), undo: x => restoreSpell(x, had) }
    }
    case 'prepare_spell': {
      const had = spellsOf(c).find(s => s.classId === change.classId && s.id === change.spellId)
      if (!had || isPrepared(had) === change.prepared) return null
      return { next: setPrepared(c, change.classId, change.spellId, change.prepared), undo: x => setPrepared(x, change.classId, change.spellId, !change.prepared) }
    }
    case 'add_item': {
      const qty = Math.max(1, Math.min(99, Math.round(change.qty)))
      const before = new Map(c.inventory.map(e => [e.uid, e.qty]))
      const { character, uid } = addItem(c, change.entry, qty)
      const stacked = before.get(uid)
      return {
        next: character,
        undo: x => {
          const e = x.inventory.find(i => i.uid === uid)
          if (!e) return x
          if (stacked == null) return e.qty > qty ? setQty(x, uid, e.qty - qty) : removeEntry(x, uid)
          return setQty(x, uid, Math.max(1, e.qty - qty))
        },
      }
    }
    case 'add_note': {
      const text = change.text.trim()
      if (!text || (c.notes ?? '').includes(text)) return null
      const added = c.notes?.trim() ? `\n\n${text}` : text
      return {
        next: { ...c, notes: `${c.notes?.trim() ? c.notes.replace(/\s+$/, '') : ''}${added}` },
        undo: x => (x.notes.endsWith(added) ? { ...x, notes: x.notes.slice(0, -added.length) } : x),
      }
    }
    case 'plan_level': {
      const old = (c.levelPlan ?? []).find(p => p.level === change.entry.level)
      if (old && JSON.stringify(old) === JSON.stringify(change.entry)) return null
      return {
        next: { ...c, levelPlan: setEntry(c, change.entry) },
        undo: x => {
          const now = (x.levelPlan ?? []).find(p => p.level === change.entry.level)
          if (JSON.stringify(now) !== JSON.stringify(change.entry)) return x
          const rest = (x.levelPlan ?? []).filter(p => p.level !== change.entry.level)
          return { ...x, levelPlan: old ? [...rest, old].sort((a, b) => a.level - b.level) : rest }
        },
      }
    }
    default:
      return null
  }
}

function restoreSpell(c: Character, k: KnownSpell): Character {
  if (hasSpell(c, k.classId, k.id)) return c
  return { ...c, spells: [...spellsOf(c), k] }
}

/** A builder change as a patch for `update()`, and the patch that puts the touched fields back. */
export interface DraftResult {
  patch: Partial<CharacterDraft>
  undo: Partial<CharacterDraft>
}

/** The builder's own pick functions, so a card changes the draft as tapping the option would; null when already so. */
export function applyDraftChange(d: CharacterDraft, change: Change): DraftResult | null {
  const patch = draftPatch(d, change)
  if (!patch) return null
  const keys = Object.keys(patch) as (keyof CharacterDraft)[]
  if (keys.every(k => JSON.stringify(patch[k]) === JSON.stringify(d[k]))) return null
  const undo = Object.fromEntries(keys.map(k => [k, d[k]])) as Partial<CharacterDraft>
  return { patch, undo }
}

function draftPatch(d: CharacterDraft, change: Change): Partial<CharacterDraft> | null {
  switch (change.kind) {
    case 'set_race': {
      if (d.raceId === change.raceId && d.subraceId === change.subraceId) return null
      if (d.raceId === change.raceId) return subracePatch(change.subraceId)
      return { ...racePatch(d, change.raceId), ...(change.subraceId ? subracePatch(change.subraceId) : {}) }
    }
    case 'set_class':
      return d.classes[0]?.classId === change.classId ? null : classPatch(d, change.classId)
    case 'set_subclass': {
      if (!d.classes.some(cl => cl.classId === change.classId)) return null
      return setSubclass(d, change.classId, change.subclassId) as Partial<CharacterDraft>
    }
    case 'set_background':
      return d.backgroundId === change.backgroundId ? null : backgroundPatch(d, change.backgroundId)
    case 'set_feat': {
      if (change.slot === 'origin') return { originFeatId: change.featId, chosenSkills: [] }
      const { classId, level } = change.slot
      const old = d.improvements?.find(i => i.classId === classId && i.level === level)
      if (old?.featId === change.featId) return null
      return improvementPatch(d, { classId, level, featId: change.featId })
    }
    case 'set_skills':
      return { chosenSkills: [...new Set(change.skills)] }
    case 'learn_spell': {
      const spells = d.spells ?? []
      if (spells.some(s => s.id === change.spellId && s.classId === change.classId)) return null
      return { spells: [...spells, { id: change.spellId, classId: change.classId }] }
    }
    case 'forget_spell': {
      const spells = d.spells ?? []
      if (!spells.some(s => s.id === change.spellId && s.classId === change.classId)) return null
      return { spells: spells.filter(s => !(s.id === change.spellId && s.classId === change.classId)) }
    }
    default:
      return null
  }
}

/** A sheet's tap: the change through the sheet's apply() (history, save, sync), and an undo that takes back only it. */
export function applyOnSheet(p: Proposal, apply: (text: string, change: (c: Character) => Character) => void, text: { applied: string; undone: string }): ApplyOutcome {
  const got: { undo?: (c: Character) => Character } = {}
  apply(text.applied, c => {
    const r = applyCharacterChange(c, p.change)
    if (!r) return c
    got.undo = r.undo
    return r.next
  })
  const undo = got.undo
  if (!undo) return { ok: false, why: 'already' }
  return { ok: true, undo: () => apply(text.undone, undo) }
}

/** A builder tap: the change through the builder's update(), and an undo that puts the touched picks back. */
export function applyInBuilder(p: Proposal, draft: CharacterDraft, update: (patch: Partial<CharacterDraft>) => void): ApplyOutcome {
  const r = applyDraftChange(draft, p.change)
  if (!r) return { ok: false, why: 'already' }
  update(r.patch)
  return { ok: true, undo: () => update(r.undo) }
}

/** Whether a card can apply where the user is now: the same sheet, or the builder. */
export function proposalFits(p: Proposal, context: { kind: string; characterId?: string }): boolean {
  if (p.target === 'builder') return context.kind === 'builder'
  return context.kind === 'character' && context.characterId === p.characterId
}
