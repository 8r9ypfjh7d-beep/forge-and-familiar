// Character files: write a character (and its level snapshots) to JSON and read one back.
// Pure TypeScript; browser download and upload glue is in download.ts.
import { CHARACTER_SCHEMA_VERSION, type Character } from '../model/character'
import { ABILITIES, classById, freshState, getMaxHp, raceById } from '../rules'
import type { Snapshot } from './snapshots'

export const FILE_FORMAT = 'forge-and-familiar/character'
export const FILE_VERSION = 1
/** Portraits are data URLs, so allow a few MB. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024

export interface CharacterFile {
  format: typeof FILE_FORMAT
  version: number
  exportedAt: string
  character: Character
  snapshots: Snapshot[]
}

export type ParseResult = { ok: true; file: CharacterFile } | { ok: false; error: string }

export function exportCharacter(c: Character, snapshots: Snapshot[] = [], now = new Date()): string {
  const file: CharacterFile = { format: FILE_FORMAT, version: FILE_VERSION, exportedAt: now.toISOString(), character: c, snapshots }
  return JSON.stringify(file, null, 2)
}

export function fileName(c: Pick<Character, 'name'>): string {
  const slug = c.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug || 'character'}.character.json`
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const isStr = (x: unknown): x is string => typeof x === 'string'

/** Checks a character from a file and fills fields an older export may lack. Returns an error message or the character. */
export function checkCharacter(x: unknown): string | Character {
  if (!isObj(x)) return 'The file has no character in it.'
  if (!isStr(x.name) || !x.name.trim()) return 'The character has no name.'
  if (typeof x.schemaVersion === 'number' && x.schemaVersion > CHARACTER_SCHEMA_VERSION)
    return 'This character was saved by a newer version of Forge & Familiar.'
  if (!isStr(x.raceId) || !raceById(x.raceId)) return `Unknown race "${String(x.raceId)}".`
  if (!isStr(x.backgroundId)) return 'The character has no background.'
  if (!Array.isArray(x.classes) || x.classes.length === 0) return 'The character has no class.'
  for (const cl of x.classes) {
    if (!isObj(cl) || !isStr(cl.classId) || !classById(cl.classId)) return `Unknown class "${String(isObj(cl) ? cl.classId : cl)}".`
    if (!Number.isInteger(cl.level) || (cl.level as number) < 1 || (cl.level as number) > 20) return `Class level must be 1 to 20.`
  }
  if (!isObj(x.baseAbilities) || ABILITIES.some(a => typeof (x.baseAbilities as Record<string, unknown>)[a] !== 'number'))
    return 'The ability scores are missing or broken.'

  const c = {
    playerName: '', alignment: '', xp: 0, abilityMethod: 'manual', freeAbilityBonuses: [], chosenSkills: [],
    inventory: [], coins: { cp: 0, sp: 0, gp: 0 }, notes: '',
    ...x,
    schemaVersion: CHARACTER_SCHEMA_VERSION,
  } as unknown as Character
  if (!isObj(c.state)) c.state = freshState(getMaxHp(c))
  return c
}

export function parseCharacterFile(text: string): ParseResult {
  if (text.length > MAX_FILE_BYTES) return { ok: false, error: 'The file is too large.' }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This is not a character file (it is not valid JSON).' }
  }
  if (!isObj(raw) || raw.format !== FILE_FORMAT) return { ok: false, error: 'This is not a Forge & Familiar character file.' }
  if (typeof raw.version !== 'number' || raw.version > FILE_VERSION)
    return { ok: false, error: 'This file was made by a newer version of Forge & Familiar.' }

  const character = checkCharacter(raw.character)
  if (isStr(character)) return { ok: false, error: character }

  // A broken snapshot is dropped rather than failing the whole import.
  const snapshots: Snapshot[] = []
  for (const s of Array.isArray(raw.snapshots) ? raw.snapshots : []) {
    if (!isObj(s) || !isStr(s.label) || !isStr(s.takenAt)) continue
    const sc = checkCharacter(s.character)
    if (isStr(sc)) continue
    snapshots.push({ ...(s as unknown as Snapshot), character: sc })
  }

  return { ok: true, file: { format: FILE_FORMAT, version: FILE_VERSION, exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : '', character, snapshots } }
}

/**
 * Makes an imported file into a new character for this player. Imports never overwrite:
 * the character and its snapshots get fresh ids, so importing twice gives two copies.
 */
export function asImported(file: CharacterFile, ownerId: string, newId: () => string = () => crypto.randomUUID(), now = new Date()) {
  const id = newId()
  const stamp = now.toISOString()
  const character: Character = { ...file.character, id, ownerId, createdAt: stamp, updatedAt: stamp }
  const snapshots: Snapshot[] = file.snapshots.map(s => ({
    ...s,
    id: newId(),
    characterId: id,
    character: { ...s.character, id, ownerId },
  }))
  return { character, snapshots }
}
