// Streak-free dice: each die size deals from a shuffled bag of its faces, refilled when empty.
// Every `sides` draws of one die show each face exactly once. Off by default; see README Fairness.
import { randomInt } from './rng'

/** Remaining faces per die size, next draw first. */
export type BagState = Record<number, number[]>

export interface BagStorage {
  load(): BagState | undefined
  save(state: BagState): void
}

/** Dice outside this range roll plain random: a bag of 1000 faces would never cycle in play. */
export const BAG_MIN_SIDES = 2
export const BAG_MAX_SIDES = 100

/** localStorage persistence, one key per signed-in user (`ff.dicebag.v1.<userId>`). */
export function localBagStorage(key: string): BagStorage {
  return {
    load() {
      try {
        const raw = globalThis.localStorage?.getItem(key)
        return raw ? (JSON.parse(raw) as BagState) : undefined
      } catch {
        return undefined
      }
    },
    save(state) {
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(state))
      } catch {
        // Storage full or blocked: the bag lives in memory only.
      }
    },
  }
}

/** A bag holding 1..sides in a uniformly random order (Fisher-Yates over crypto randomInt). */
export function shuffledBag(sides: number): number[] {
  const faces = Array.from({ length: sides }, (_, i) => i + 1)
  for (let i = faces.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[faces[i], faces[j]] = [faces[j], faces[i]]
  }
  return faces
}

const inBagRange = (sides: number) => Number.isInteger(sides) && sides >= BAG_MIN_SIDES && sides <= BAG_MAX_SIDES

/** Keeps only well-formed bags: distinct integer faces in 1..sides. Anything else is dropped. */
function clean(raw: unknown): BagState {
  const out: BagState = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, faces] of Object.entries(raw as Record<string, unknown>)) {
    const sides = Number(key)
    if (!inBagRange(sides) || !Array.isArray(faces) || faces.length > sides) continue
    const ok = faces.every(f => Number.isInteger(f) && f >= 1 && f <= sides) && new Set(faces).size === faces.length
    if (ok) out[sides] = faces as number[]
  }
  return out
}

export class DiceBag {
  private readonly storage?: BagStorage

  constructor(storage?: BagStorage) {
    this.storage = storage
  }

  private state: BagState = {}

  /** One die, 1..sides. Reloads and saves storage on every draw, so two tabs share one bag. */
  draw = (sides: number): number => {
    if (!inBagRange(sides)) return 1 + randomInt(sides)
    if (this.storage) this.state = clean(this.storage.load())
    let bag = this.state[sides]
    if (!bag?.length) bag = shuffledBag(sides)
    const [face, ...rest] = bag
    this.state[sides] = rest
    this.storage?.save(this.state)
    return face
  }
}
