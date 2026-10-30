// The unfinished new character, kept in localStorage per player so a reload or a phone
// closing the app mid-builder doesn't lose it. Edits of saved characters aren't kept.
import type { CharacterDraft } from '../rules'

export interface SavedDraft {
  draft: CharacterDraft
  step: number
  hookKey?: string
  savedAt: string
}

const key = (ownerId: string) => `ff.builderDraft.v1.${ownerId}`

export function loadDraft(ownerId: string): SavedDraft | undefined {
  try {
    const raw = localStorage.getItem(key(ownerId))
    const saved = raw ? (JSON.parse(raw) as SavedDraft) : undefined
    return saved?.draft?.ownerId === ownerId ? saved : undefined
  } catch {
    return undefined
  }
}

export function saveDraft(saved: SavedDraft) {
  try {
    localStorage.setItem(key(saved.draft.ownerId), JSON.stringify(saved))
  } catch {
    // Storage full or blocked: the draft just isn't kept.
  }
}

export function clearDraft(ownerId: string) {
  try {
    localStorage.removeItem(key(ownerId))
  } catch {
    // Nothing to clear.
  }
}
