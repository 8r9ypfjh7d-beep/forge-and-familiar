import type { Character } from '../model/character'

/** Records a change in the history (for undo) and saves it. */
export type Apply = (text: string, change: (c: Character) => Character) => void
