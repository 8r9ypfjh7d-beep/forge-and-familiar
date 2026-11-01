// Saved DM screen shape: one per profile. Nothing derived (budgets, difficulty) is stored.

export const DM_SCHEMA_VERSION = 1

/** "4 players at level 3". The DM types the party in; players' sheets stay private. */
export interface PartyGroup {
  count: number
  level: number
}

/** A monster in a planned encounter, by library id and source. Name and XP are kept so the plan reads without the library. */
export interface PlanMonster {
  monsterId: string
  source: string
  name: string
  xp: number
  cr: number
  count: number
  /** A DM-private NPC sheet (src/npc) standing in for a library monster; count is 1. */
  npcId?: string
}

/** A combat scenario: the monsters, the DM's notes and how it starts. */
export interface EncounterPlan {
  id: string
  name: string
  monsters: PlanMonster[]
  /** Read-aloud text, tactics, loot, terrain. Only the DM sees it. */
  notes?: string
  /** Roll each monster's hit points when the fight starts, instead of the average. */
  rollHp?: boolean
  /** Battle map (src/maps) pushed to the players when the fight starts. */
  mapId?: string
  /** The fight last started from this plan (src/combat), so Start fight can reopen it instead of copying it. */
  encounterId?: string
}

export interface Npc {
  id: string
  name: string
  /** Who they are: "innkeeper", "cult leader". */
  role: string
  /** Free text: where they are, what they want, how they talk. */
  notes: string
}

export interface DmState {
  schemaVersion: number
  party: PartyGroup[]
  plans: EncounterPlan[]
  /** The plan the Encounters tab shows. */
  activePlanId: string | null
  npcs: Npc[]
}

export const emptyDmState = (): DmState => ({
  schemaVersion: DM_SCHEMA_VERSION,
  party: [{ count: 4, level: 1 }],
  plans: [],
  activePlanId: null,
  npcs: [],
})
