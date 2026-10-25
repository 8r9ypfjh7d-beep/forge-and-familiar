// Export, import and rollback as single steps over both stores.
import type { Character } from '../model/character'
import { getCharacter, saveCharacter } from '../storage'
import { downloadText } from './download'
import { asImported, exportCharacter, fileName, parseCharacterFile } from './file'
import { restoreSnapshot, takeSnapshot, type Snapshot } from './snapshots'
import { addSnapshots, listSnapshots } from './store'

export async function exportToFile(c: Character): Promise<void> {
  downloadText(fileName(c), exportCharacter(c, await listSnapshots(c.id)))
}

/** Reads a chosen file and saves it as a new character for ownerId. Throws with a player-facing message. */
export async function importFromFile(file: File, ownerId: string): Promise<Character> {
  const parsed = parseCharacterFile(await file.text())
  if (!parsed.ok) throw new Error(parsed.error)
  const { character, snapshots } = asImported(parsed.file, ownerId)
  const saved = await saveCharacter(character)
  if (snapshots.length) await addSnapshots(snapshots)
  return saved
}

/** Rolls the character back to a snapshot, first saving the current build so the rollback can be undone. */
export async function rollBack(snap: Snapshot): Promise<Character> {
  const current = await getCharacter(snap.characterId)
  if (!current) throw new Error('This character no longer exists.')
  await addSnapshots([takeSnapshot(current, `Before rollback to ${snap.label}`)])
  return saveCharacter(restoreSnapshot(current, snap))
}
