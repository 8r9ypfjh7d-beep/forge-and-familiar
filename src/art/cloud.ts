// Character art in the Supabase `art` bucket (supabase/migrations/20261102110000_character_art.sql).
// Files live under `<account id>/<character id>/`; links are public but unguessable. Without the cloud,
// or when an upload fails, the picture stays a data URL inside the character.
import { getCloudAccountId } from '../cloud/auth'
import { getSupabase } from '../cloud/client'
import { artPath, LOCAL_SIZE, ART_SIZE, type ArtKind } from './logic'
import { shrinkArt } from './image'

const BUCKET = 'art'

/** Whether pictures can go to the cloud right now (signed in and online). */
export const canUpload = (): boolean => !!getCloudAccountId() && (typeof navigator === 'undefined' || navigator.onLine)

/** Shrinks the file and uploads it; answers the public link, or a smaller data URL when it can't be uploaded. */
export async function storeArt(file: File, kind: ArtKind, characterId: string): Promise<{ url: string; uploaded: boolean }> {
  const account = getCloudAccountId()
  if (account && canUpload()) {
    const dataUrl = await shrinkArt(file, kind, ART_SIZE[kind])
    const url = await upload(account, characterId, dataUrl).catch(() => null)
    if (url) return { url, uploaded: true }
  }
  return { url: await shrinkArt(file, kind, LOCAL_SIZE[kind]), uploaded: false }
}

async function upload(account: string, characterId: string, dataUrl: string): Promise<string | null> {
  const db = await getSupabase()
  if (!db) return null
  const blob = await (await fetch(dataUrl)).blob()
  const path = `${account}/${encodeURIComponent(characterId)}/${crypto.randomUUID()}.jpg`
  const { error } = await db.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' })
  if (error) return null
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Best effort: removes files the character no longer uses. */
export async function removeArt(urls: string[]): Promise<void> {
  const paths = urls.flatMap(u => artPath(u) ?? [])
  if (!paths.length) return
  try {
    const db = await getSupabase()
    if (db) await db.storage.from(BUCKET).remove(paths)
  } catch { /* offline: the file stays, which is harmless */ }
}
