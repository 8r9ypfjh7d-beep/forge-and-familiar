import { useEffect, useState } from 'react'
import { getCharacter, onCharactersChanged } from '../storage'
import type { Party } from './types'
import { canViewCharacter } from './visibility'

/** Screens about one character, all guarded the same way. */
const CHARACTER_VIEWS: readonly string[] = ['sheet', 'edit', 'levelup', 'levels', 'plan', 'print']

/**
 * Whether the open profile may show the character a view is about. A link or a switched profile on a shared
 * device can point at another player's character: it opens only when `canViewCharacter` says so. Unknown
 * ids pass (the screen shows its own "not found"); the answer is true while loading, so nothing flickers.
 */
export function useCharacterAccess(view: { kind: string; id?: string }, userId: string | undefined, parties: readonly Party[] | undefined): boolean {
  const id = CHARACTER_VIEWS.includes(view.kind) && 'id' in view ? view.id : undefined
  // Blocked ids, keyed by viewer; the view is allowed unless its id is in there.
  const [blocked, setBlocked] = useState<{ userId: string; id: string } | null>(null)
  useEffect(() => {
    if (!id || !userId) return
    let live = true
    const check = () => getCharacter(id).then(c => {
      if (!live) return
      const ok = !c || canViewCharacter(c, { userId, parties: parties ?? [] })
      setBlocked(ok ? null : { userId, id })
    })
    check()
    const off = onCharactersChanged(check)
    return () => { live = false; off() }
  }, [id, userId, parties])
  return !(id && userId && blocked?.id === id && blocked.userId === userId)
}
