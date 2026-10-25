// Records the active session while the app is open. Renders nothing; mount it once inside
// <DiceProvider> so it sees the roll history.
import { useEffect, useRef, useState } from 'react'
import { useDice } from '../dice/ui'
import { getCharacter, onCharactersChanged } from '../storage'
import { recordCharacter, recordRolls } from './journal'
import { getActiveSession, onSessionsChanged, updateSession } from './store'

export function SessionRecorder({ userId }: { userId: string }) {
  const { history } = useDice()
  const [active, setActive] = useState<{ id: string; characterIds: string[] } | null>(null)
  const queue = useRef(Promise.resolve())

  useEffect(() => {
    const load = () => getActiveSession(userId).then(s => {
      setActive(prev => {
        const next = s ? { id: s.id, characterIds: s.characterIds } : null
        return prev?.id === next?.id && prev?.characterIds.join() === next?.characterIds.join() ? prev : next
      })
    })
    load()
    return onSessionsChanged(load)
  }, [userId])

  useEffect(() => {
    if (!active) return
    // Saves run one at a time so each diff starts from the previous one's snapshot.
    const run = (task: () => Promise<unknown>) => {
      queue.current = queue.current.then(task).then(() => undefined, err => console.error('Session recap', err))
    }
    const syncCharacter = (id: string) => run(async () => {
      const c = await getCharacter(id)
      if (c) await updateSession(userId, active.id, s => recordCharacter(s, c))
    })
    const syncRolls = () => run(() => updateSession(userId, active.id, s => recordRolls(s, history.all())))

    // Catch up on anything that changed while the app was closed.
    active.characterIds.forEach(syncCharacter)
    syncRolls()
    const offChars = onCharactersChanged(id => {
      if (!id) active.characterIds.forEach(syncCharacter)
      else if (active.characterIds.includes(id)) syncCharacter(id)
    })
    const offRolls = history.subscribe(syncRolls)
    return () => { offChars(); offRolls() }
  }, [active, history, userId])

  return null
}
