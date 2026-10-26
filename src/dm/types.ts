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
}

export interface EncounterPlan {
  id: string
  name: string
  monsters: PlanMonster[]
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
