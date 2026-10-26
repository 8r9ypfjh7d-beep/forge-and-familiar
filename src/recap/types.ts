// Saved session shape. Pure JSON, so a future sync layer can send it as is.
import type { RollResult } from '../dice/types'
import type { Character } from '../model/character'

/** The parts of a character the recorder watches. Leaves out the portrait and notes to keep sessions small. */
export type Tracked = Pick<Character, 'name' | 'xp' | 'classes' | 'inventory' | 'coins' | 'state'>

export type SessionEventBody =
  | { kind: 'damage'; amount: number; hpAfter: number; maxHp: number }
  | { kind: 'heal'; amount: number; hitDie?: string; toFull?: boolean }
  | { kind: 'tempHp'; amount: number }
  | { kind: 'down' }
  | { kind: 'stable' }
  | { kind: 'death' }
  | { kind: 'revived' }
  | { kind: 'slot'; level: number; delta: number; pact?: boolean }
  | { kind: 'resource'; label: string; delta: number }
  | { kind: 'rest'; rest: 'short' | 'long' }
  | { kind: 'condition'; condition: string; added: boolean }
  | { kind: 'item'; itemId: string; name: string; delta: number }
  | { kind: 'coins'; delta: { cp: number; sp: number; gp: number } }
  | { kind: 'xp'; amount: number }
  | { kind: 'levelUp'; from: number; to: number }
  | { kind: 'roll'; roll: RollResult }

export type SessionEvent = SessionEventBody & {
  id: string
  at: string
  /** Unset for table rolls that were not made for a character. */
  characterId?: string
  characterName: string
}

/** One undoable step per character, so undo on the sheet takes its events back out. */
export interface Step {
  snapshot: Tracked
  eventIds: string[]
  at: string
}

export interface Session {
  id: string
  /** UserProfile.id of whoever ran the session on this device. */
  ownerId: string
  title: string
  startedAt: string
  /** Unset while recording. */
  endedAt?: string
  characterIds: string[]
  events: SessionEvent[]
  /** Newest last. The first entry is the snapshot taken at the start. */
  steps: Record<string, Step[]>
}
