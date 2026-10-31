// The reveal moment: when the DM reveals an entry while a player is in the app, a full-screen card
// says what they discovered. Tap "Open" to read it, anywhere else to dismiss. Stays until tapped.
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import type { Party } from '../party/types'
import { requestOpenEntry } from './Codex'
import { typeKey } from './EntryView'
import { newArrivals } from './logic'
import { listHandouts, onHandoutsChanged, refreshHandouts } from './store'
import { watchHandouts } from './cloud'
import type { LoreEntry } from './types'
import './lore.css'

/** Mounted once in the app for the campaign in play. `onOpen` takes the player to the campaign page. */
export function RevealMoment({ party, userId, onOpen }: { party: Party; userId: string; onOpen: () => void }) {
  const { t } = useI18n()
  const [since] = useState(() => new Date(Date.now() - 2 * 60 * 1000).toISOString())
  const [shown, setShown] = useState<LoreEntry | null>(null)
  const [done, setDone] = useState<string[]>([])

  useEffect(() => {
    let live = true
    const load = () => listHandouts(party.id).then(list => {
      if (!live) return
      const next = newArrivals(list, party, userId, since).find(e => !done.includes(e.id))
      if (next && !shown) setShown(next)
    })
    load()
    const off = onHandoutsChanged(load)
    const refresh = () => { void refreshHandouts(party.id) }
    const offCloud = watchHandouts(party.id, refresh)
    return () => { live = false; off(); offCloud() }
  }, [party, userId, since, done, shown])

  if (!shown || party.dmId === userId) return null
  const close = () => { setDone(d => [...d, shown.id]); setShown(null) }
  const still = typeof document !== 'undefined' && document.documentElement.dataset.motion === 'reduce'

  return (
    <div className={`ff-lore-reveal ${still ? 'is-still' : ''}`} role="dialog" aria-modal="true" aria-label={t('lore.discovered')} onClick={close}>
      <div className="glass-sheet reveal-card" onClick={e => e.stopPropagation()}>
        <span className="glass-eyebrow">{t('lore.discovered')}</span>
        <span className="kind">{t(typeKey(shown.kind))}</span>
        <h2>{shown.title}</h2>
        <div className="row">
          <button className="glass-btn prominent" onClick={() => { close(); onOpen(); requestOpenEntry(shown.id) }}>{t('lore.openIt')}</button>
          <button className="glass-btn ghost" onClick={close}>{t('lore.later')}</button>
        </div>
      </div>
    </div>
  )
}
