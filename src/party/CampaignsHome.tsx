import { useEffect, useState } from 'react'
import { CloudLinkNotice } from '../accounts'
import { ConfirmDialog, TypedConfirmDialog } from '../builder/ConfirmDialog'
import { useI18n } from '../i18n'
import type { Character } from '../model/character'
import { campaignTarget, canEndParty, isPartyDm } from './active'
import { listProfiles } from '../storage'
import { fetchAccountNames } from './cloud'
import { endParty, leaveParty } from './store'
import type { Party } from './types'
import './party.css'

/** The first screen on opening the app: the campaigns this player is in. Tapping one plays it: the DM gets
 *  the DM screen, a player their sheet. With no campaign yet: sign in, join with a code, start one, or build. */
export function CampaignsHome({ userId, playerName, parties, current, characters, onPlay, onJoin, onStart, onBuild, onCharacters, dmTools, onDmScreen }: {
  userId: string
  playerName: string
  /** Null while loading. */
  parties: Party[] | null
  current?: Party
  /** This player's own characters on the device. */
  characters: Character[]
  onPlay: (party: Party) => void
  onJoin: () => void
  onStart: () => void
  onBuild: () => void
  onCharacters: () => void
  /** Whether this profile keeps the DM pages without running a campaign; undefined hides the button (already the DM). */
  dmTools?: boolean
  /** Opens the DM screen, turning DM tools on first. */
  onDmScreen?: () => void
}) {
  const { t, classLine } = useI18n()
  const names = useNames()
  if (parties === null) return null
  const ownIds = characters.map(c => c.id)

  return (
    <section className="ff-party campaigns-home" aria-labelledby="campaigns-title">
      <div className="campaigns-head">
        <span className="glass-eyebrow">{t(parties.length || characters.length ? 'home.eyebrow' : 'home.eyebrowNew', { name: playerName })}</span>
        <h2 id="campaigns-title" className="glass-title">{t('home.title')}</h2>
      </div>
      {/* Campaigns live on the server: a device not signed in to its account can't see them. */}
      {parties.length === 0 && <CloudLinkNotice />}
      {parties.length === 0 ? (
        <div className="glass campaigns-empty">
          <div className="portrait-empty" aria-hidden="true">⚔</div>
          <p className="campaigns-empty-title">{t('home.emptyTitle')}</p>
          <p className="muted">{t('home.emptyBody')}</p>
          <div className="campaigns-actions">
            <button className="glass-btn prominent" onClick={onJoin}>{t('home.join')}</button>
            <button className="glass-btn" onClick={onStart}>{t('home.start')}</button>
            <button className="glass-btn" onClick={onBuild}>{t('home.build')}</button>
          </div>
        </div>
      ) : (
        <div className="campaigns-list">
          {parties.map(p => {
            const dm = isPartyDm(p, userId)
            const target = campaignTarget(p, userId, ownIds)
            const hero = target.kind === 'sheet' ? characters.find(c => c.id === target.id) : undefined
            return (
              <div key={p.id} className={`glass campaign-card${dm ? ' is-dm' : ''}`}>
              <button className="campaign-open" onClick={() => onPlay(p)}>
                <span className="campaign-top">
                  <h3>{p.name}</h3>
                  {current?.id === p.id && <span className="glass-chip">{t('home.playingNow')}</span>}
                  <span className={`glass-chip campaign-role${dm ? ' on' : ''}`}>{t(dm ? 'party.pick.asDm' : 'party.pick.asPlayer')}</span>
                </span>
                <span className="muted small">
                  {dm ? t('party.pick.youDm') : t('party.dm', { name: names[p.dmId] ?? t('party.unknownPlayer') })} · {t('party.members', { count: p.members.length })}
                </span>
                <span className="campaign-you">
                  {hero ? <>
                    {hero.portrait ? <img src={hero.portrait} alt="" /> : <span className="portrait-empty" aria-hidden="true">{hero.name.slice(0, 1)}</span>}
                    <span><strong>{hero.name}</strong><span className="muted small"> · {classLine(hero.classes)}</span></span>
                  </> : <span className="campaign-next">{t(dm ? 'home.runGame' : 'home.pickCharacter')}</span>}
                </span>
              </button>
              <CampaignManage party={p} userId={userId} />
              </div>
            )
          })}
        </div>
      )}
      {parties.length > 0 && <CloudLinkNotice />}
      <div className="campaigns-foot">
        {parties.length > 0 && <button className="glass-btn" onClick={onJoin}>{t('home.joinAnother')}</button>}
        <button className="glass-btn" onClick={onCharacters}>{t('home.myCharacters')}</button>
        {dmTools !== undefined && onDmScreen && <button className="glass-btn" onClick={onDmScreen}>{t(dmTools ? 'home.dmScreen' : 'home.iAmDm')}</button>}
      </div>
    </section>
  )
}

/** End (DM or admin: gone for everyone) and Leave (anyone but the DM: gone from your list only). End can't be
 *  undone, so it says what is lost and asks for the campaign's name; Leave asks yes/no. Characters are never
 *  touched, so they stay in My characters. */
export function CampaignManage({ party, userId }: { party: Party; userId: string }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState<'end' | 'leave' | null>(null)
  const end = async () => {
    setBusy(true)
    const ok = await endParty(party.id, userId)
    setBusy(false)
    if (!ok) alert(t('party.endFailed'))
  }
  const close = () => setAsking(null)
  return (
    <div className="campaign-manage">
      {canEndParty(party, userId) && <button className="glass-btn small ghost campaign-end" disabled={busy} onClick={() => setAsking('end')}>{t('party.end')}</button>}
      {!isPartyDm(party, userId) && <button className="glass-btn small ghost" disabled={busy} onClick={() => setAsking('leave')}>{t('party.leave')}</button>}
      <TypedConfirmDialog open={asking === 'end'} title={t('party.confirmEnd', { name: party.name })} body={t('party.confirmEndBody')}
        phrase={party.name} yes={t('party.end')} onYes={() => void end()} onClose={close} />
      <ConfirmDialog open={asking === 'leave'} title={t('party.confirmLeave', { name: party.name })} yes={t('party.leave')}
        onYes={() => void leaveParty(party.id, userId)} onClose={close} />
    </div>
  )
}

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
