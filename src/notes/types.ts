// Saved journal shape, one per character. Pure JSON, so a future sync layer can send it as is.

/** Calendar day of a play session, YYYY-MM-DD in the player's local time. */
export type SessionDate = string

export interface SessionNote {
  id: string
  date: SessionDate
  title: string
  body: string
  /** Recap session (src/recap) this note belongs to, when one was recorded. */
  recapSessionId?: string
  createdAt: string
  updatedAt: string
}

export type Attitude = 'friendly' | 'neutral' | 'hostile' | 'unknown'

export interface Npc {
  id: string
  name: string
  /** Who they are: "innkeeper", "Zhentarim agent". */
  role: string
  place: string
  attitude: Attitude
  alive: boolean
  notes: string
  /** Session the party first met them. */
  metOn: SessionDate
}

export type QuestStatus = 'active' | 'done' | 'failed'

export interface Objective {
  id: string
  text: string
  done: boolean
}

export interface Quest {
  id: string
  title: string
  giver: string
  reward: string
  status: QuestStatus
  objectives: Objective[]
  notes: string
  startedOn: SessionDate
  /** Set when the quest is done or failed. */
  closedOn?: SessionDate
}

export interface Loot {
  id: string
  name: string
  qty: number
  /** Total value in gold pieces, if known. */
  valueGp?: number
  /** Where it came from: "goblin chief", "chest in the crypt". */
  source: string
  notes: string
  foundOn: SessionDate
}

export interface Journal {
  characterId: string
  notes: SessionNote[]
  npcs: Npc[]
  quests: Quest[]
  loot: Loot[]
  updatedAt: string
}
