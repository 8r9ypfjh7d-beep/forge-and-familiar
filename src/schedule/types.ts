// Saved scheduling shape. A poll belongs to one party and collects everyone's availability.
export type Availability = 'yes' | 'maybe' | 'no'

export interface SessionOption {
  id: string
  /** Start time as an ISO string (UTC). Shown in each viewer's local time. */
  startsAt: string
  /** UserProfile.id of whoever suggested it. */
  proposedBy: string
}

export interface SessionPoll {
  id: string
  partyId: string
  createdBy: string
  /** Planned length, used for the calendar file and to tell when a session is over. */
  durationMinutes: number
  options: SessionOption[]
  /** votes[userId][optionId]. A missing entry means the player hasn't answered. */
  votes: Record<string, Record<string, Availability>>
  /** Set when the DM locks in a date. */
  chosenOptionId?: string
  createdAt: string
  updatedAt: string
}
