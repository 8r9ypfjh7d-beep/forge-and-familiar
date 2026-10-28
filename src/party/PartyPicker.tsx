import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { listProfiles } from '../storage'
import { isPartyDm } from './active'
import { fetchAccountNames } from './cloud'
import type { Party } from './types'
import './party.css'

/** Display names for party members: profiles on this device, then the server's account list. */
function useNames() {
  const [names, setNames] = useState<Record<string, string>>({})
  useEffect(() => {
    let live = true
    Promise.all([listProfiles(), fetchAccountNames()]).then(([profiles, accounts]) => {
      if (live) setNames({ ...accounts, ...Object.fromEntries(profiles.map(p => [p.id, p.displayName])) })
    })
    return () => { live = false }
  }, [])
  return names
}

/** "Which campaign are you playing?" Shown on entering the app; the pick decides DM or player pages. */
export function PartyPicker({ parties, userId, onPick }: { parties: Party[]; userId: string; onPick: (partyId: string | null) => void }) {
  const { t } = useI18n()
  const names = useNames()
  return (
    <section className="ff-party party-picker" aria-labelledby="party-picker-title">
      <div className="party-picker-head">
        <span className="glass-eyebrow">{t('party.pick.eyebrow')}</span>
        <h2 id="party-picker-title" className="glass-title">{t('party.pick.title')}</h2>
        <p className="muted">{t('party.pick.help')}</p>
      </div>
      <div className="party-picker-list">
        {parties.map(p => {
          const dm = isPartyDm(p, userId)
          return (
            <button key={p.id} className={`glass party-card party-pick${dm ? ' is-dm' : ''}`} onClick={() => onPick(p.id)}>
              <h3>{p.name}</h3>
              <span className="muted small">
                {dm ? t('party.pick.youDm') : t('party.dm', { name: names[p.dmId] ?? t('party.unknownPlayer') })} · {t('party.members', { count: p.members.length })}
              </span>
              <span className={`glass-chip party-pick-role${dm ? ' on' : ''}`}>{t(dm ? 'party.pick.asDm' : 'party.pick.asPlayer')}</span>
            </button>
          )
        })}
      </div>
      <button className="glass-btn party-picker-skip" onClick={() => onPick(null)}>{t('party.pick.none')}</button>
    </section>
  )
}

/** The campaign switch in the player menu. */
export function PartySwitcher({ parties, party, onPick }: { parties: Party[]; party?: Party; onPick: (partyId: string | null) => void }) {
  const { t } = useI18n()
  if (parties.length === 0) return null
  return (
    <div className="row profile">
      <label className="muted small" htmlFor="campaign">{t('party.pick.campaign')}</label>
      <select id="campaign" value={party?.id ?? ''} onChange={e => onPick(e.target.value || null)}>
        {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        <option value="">{t('party.pick.none')}</option>
      </select>
    </div>
  )
}
