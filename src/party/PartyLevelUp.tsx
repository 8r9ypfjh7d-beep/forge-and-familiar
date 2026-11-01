import { useCallback, useEffect, useState } from 'react'
import { ConfirmDialog } from '../builder/ConfirmDialog'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import type { Character } from '../model/character'
import { getCharacter } from '../storage'
import { fetchPartyCharacters, watchPartyCharacters } from './cloud'
import { updateStash } from './store'
import type { Party } from './types'
import { levelAfter, partyLevels, partyTop, type LevelUpStatus, type PartyLevelRow } from './xp'

const STATUS: Record<LevelUpStatus, MessageKey> = {
  sent: 'partyLevel.st.sent', choosing: 'partyLevel.st.choosing', done: 'partyLevel.st.done', idle: 'partyLevel.st.idle', unknown: 'partyLevel.st.unknown',
}

/** The campaign's characters, the server's copy first (it has the players' latest level-ups), kept live. */
function usePartyCharacters(party: Party) {
  const ids = party.members.filter(m => m.userId !== party.dmId).flatMap(m => (m.characterId ? [m.characterId] : []))
  const key = ids.join(',')
  const [chars, setChars] = useState<Record<string, Character | undefined> | null>(null)
  const load = useCallback(async () => {
    const list = key ? key.split(',') : []
    const remote = new Map((await fetchPartyCharacters(list).catch(() => [])).map(c => [c.id, c]))
    const local = await Promise.all(list.map(id => (remote.has(id) ? undefined : getCharacter(id))))
    setChars(Object.fromEntries(list.map((id, i) => [id, remote.get(id) ?? local[i] ?? undefined])))
  }, [key])
  useEffect(() => {
    load()
    const off = watchPartyCharacters(key ? key.split(',') : [], load)
    // Back on the tab after the table's phones moved on: read again.
    const seen = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', seen)
    return () => { off(); document.removeEventListener('visibilitychange', seen) }
  }, [key, load])
  return { chars, reload: load }
}

const OPEN_KEY = 'ff.dm.levelsOpen.v1'
const readOpen = () => { try { return localStorage.getItem(OPEN_KEY) } catch { return null } }
const writeOpen = (open: boolean) => { try { localStorage.setItem(OPEN_KEY, open ? '1' : '0') } catch { /* this visit only */ } }

/**
 * The DM screen's "Party level" card: one tap gives every ticked player a milestone level (or brings the ones
 * behind up to the party's top level), then shows who has their new level on the sheet and who is still choosing.
 * The level travels as a party award, as Give XP does; each player's device then asks them to Level Up.
 */
export function PartyLevelUp({ party, userId }: { party: Party; userId: string }) {
  const { t } = useI18n()
  const { chars, reload } = usePartyCharacters(party)
  const [off, setOff] = useState<Set<string>>(new Set())
  const [ask, setAsk] = useState<'level' | 'catchup' | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(() => readOpen() === '1')
  if (userId !== party.dmId || !chars) return null
  const rows = partyLevels(party, chars)
  if (!rows.length) return null

  const top = partyTop(rows)
  const picked = rows.filter(r => !off.has(r.userId))
  const behind = picked.filter(r => r.status !== 'unknown' && levelAfter(r) < top)
  const canLevel = picked.filter(r => r.status !== 'unknown' && levelAfter(r) < 20)
  const levelable = canLevel.length
  const busyRows = rows.filter(r => r.status === 'sent' || r.status === 'choosing')
  const levels = rows.filter(r => r.level > 0).map(r => r.level)
  const low = Math.min(...levels), high = Math.max(...levels)
  const nameOf = (r: PartyLevelRow) => r.name ?? t('party.unknownPlayer')
  const show = open || busyRows.length > 0
  const toggle = () => { writeOpen(!show); setOpen(!show) }
  const flip = (id: string) => setOff(s => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const give = async (kind: 'level' | 'catchup') => {
    const to = kind === 'level' ? canLevel : behind
    if (!to.length) return
    setBusy(true)
    const res = await updateStash(party.id, userId, {
      type: 'award', milestone: true, ...(kind === 'catchup' ? { level: top } : {}),
      to: to.map(r => ({ userId: r.userId, characterId: r.characterId })), names: to.map(nameOf),
    })
    setBusy(false)
    setNote(res.ok ? t(kind === 'level' ? 'partyLevel.doneLevel' : 'partyLevel.doneCatchup', { count: to.length, level: top }) : res.reason)
    if (res.ok) { setOpen(true); reload() }
  }
  const confirmText = ask === 'level'
    ? t('partyLevel.confirmLevel', { list: canLevel.map(r => `${nameOf(r)} ${levelAfter(r)} → ${levelAfter(r) + 1}`).join(', ') })
    : t('partyLevel.confirmCatchup', { level: top, list: behind.map(r => `${nameOf(r)} ${levelAfter(r)} → ${top}`).join(', ') })

  return (
    <section className="card dm-levels" aria-labelledby="dm-levels-title">
      <div className="dm-top-head">
        <h2 id="dm-levels-title" className="sub-title">{t('partyLevel.title')}</h2>
        <button type="button" className="btn small dm-top-toggle" aria-expanded={show} aria-controls="dm-levels-body" onClick={toggle}>
          {t(show ? 'partyLevel.hide' : 'partyLevel.show')}
        </button>
        <p className="dm-top-line">
          <span>{levels.length ? t(low === high ? 'partyLevel.at' : 'partyLevel.between', { low, high }) : t('partyLevel.st.unknown')}</span>
          {busyRows.length > 0
            ? <span className="dm-levels-wait">{t('partyLevel.waiting', { count: busyRows.length })}</span>
            : <span>{t('partyLevel.allSet')}</span>}
        </p>
      </div>
      {show && (
        <div id="dm-levels-body" className="dm-levels-body">
          <p className="hint">{t('partyLevel.hint')}</p>
          <ul className="plain dm-levels-list" aria-label={t('xp.give.who')}>
            {rows.map(r => (
              <li key={r.userId} className={`dm-level-row st-${r.status}`}>
                <button type="button" className={`chip ${off.has(r.userId) ? '' : 'on'}`} aria-pressed={!off.has(r.userId)} onClick={() => flip(r.userId)}>
                  {nameOf(r)}
                </button>
                <span className="dm-level-info">
                  <span className="dm-level-num">{r.level > 0 ? t('partyLevel.level', { level: r.level }) : '—'}</span>
                  {r.status !== 'idle' && <span className="dm-level-st">{t(STATUS[r.status], { level: levelAfter(r) })}</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="row dm-levels-actions">
            <button type="button" className="btn primary small" disabled={busy || !levelable} onClick={() => setAsk('level')}>
              <span aria-hidden="true">⬆ </span>{t('partyLevel.give', { count: levelable })}
            </button>
            {behind.length > 0 && (
              <button type="button" className="btn small" disabled={busy} onClick={() => setAsk('catchup')}>
                {t('partyLevel.catchup', { level: top, count: behind.length })}
              </button>
            )}
          </div>
          {note && <p className="hint" role="status">{note}</p>}
        </div>
      )}
      <ConfirmDialog open={!!ask} title={confirmText} yes={t(ask === 'catchup' ? 'partyLevel.yesCatchup' : 'partyLevel.yesLevel')}
        onYes={() => ask && give(ask)} onClose={() => setAsk(null)} />
    </section>
  )
}
