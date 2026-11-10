import { useEffect, useState } from 'react'
import { CloudLinkNotice } from '../accounts'
import { ConfirmDialog, TypedConfirmDialog } from '../builder/ConfirmDialog'
import { useI18n } from '../i18n'
import { InstallCard } from '../pwa'
import type { Character } from '../model/character'
import { campaignTarget, canEndParty, canRestoreParty, isPartyDm } from './active'
import { listProfiles } from '../storage'
import { fetchAccountNames } from './cloud'
import { canUndoEnd, deleteParty, endParty, leaveParty, listEndedParties, onPartiesChanged, restoreParty } from './store'
import type { Party } from './types'
import './party.css'

/** The first screen on opening the app: the player's characters first (tap one to open its sheet), then the
 *  campaigns they're in. Tapping a campaign plays it: the DM gets the DM screen, a player their sheet. With no
 *  character yet, building one is the one prominent action; joining or starting a campaign sits below. */
export function CampaignsHome({ userId, playerName, parties, current, characters, signedIn, onPlay, onOpenCharacter, onJoin, onStart, onBuild, dmTools, onDmScreen }: {
  userId: string
  playerName: string
  /** Null while loading. */
  parties: Party[] | null
  current?: Party
  /** This player's own characters on the device. */
  characters: Character[]
  /** The profile came from an activation code: only then may it ask to turn sync back on. */
  signedIn: boolean
  onPlay: (party: Party) => void
  onOpenCharacter: (id: string) => void
  onJoin: () => void
  onStart: () => void
  onBuild: () => void
  /** True when this profile keeps the DM pages without running a campaign: shows a DM screen button. */
  dmTools?: boolean
  /** Opens the DM screen. */
  onDmScreen?: () => void
}) {
  const { t, classLine, raceName } = useI18n()
  const names = useNames()
  if (parties === null) return null
  const ownIds = characters.map(c => c.id)

  return (
    <section className="ff-party campaigns-home" aria-labelledby="home-title">
      <div className="campaigns-head">
        <span className="glass-eyebrow">{t(parties.length || characters.length ? 'home.eyebrow' : 'home.eyebrowNew', { name: playerName })}</span>
        <h2 id="home-title" className="glass-title">{t('home.charactersTitle')}</h2>
      </div>
      {/* Campaigns live on the server: a device whose code was entered before but is no longer signed in can't see them. */}
      {signedIn && <CloudLinkNotice />}
      {characters.length === 0 ? (
        <div className="glass campaigns-empty">
          <div className="portrait-empty" aria-hidden="true">✦</div>
          <p className="campaigns-empty-title">{t('home.noCharacters')}</p>
          <div className="campaigns-actions">
            <button className="glass-btn prominent" onClick={onBuild}>{t('home.build')}</button>
          </div>
          <p className="small"><a className="home-ready-link" href="#/starters">{t('home.readyMade')}</a></p>
        </div>
      ) : (
        <ul className="home-heroes">
          {characters.map(c => (
            <li key={c.id}>
              <button className="glass home-hero" onClick={() => onOpenCharacter(c.id)}>
                {c.portrait ? <img src={c.portrait} alt="" /> : <span className="portrait-empty" aria-hidden="true">{c.name.slice(0, 1)}</span>}
                <span className="home-hero-text">
                  <strong>{c.name}</strong>
                  <span className="muted small">{raceName(c.raceId, c.subraceId, c.rulesEdition)} · {classLine(c.classes)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {characters.length > 0 && <InstallCard />}

      <h3 className="home-section">{t('home.campaignsTitle')}</h3>
      {parties.length === 0 ? (
        <div className="glass campaigns-none">
          <p className="campaigns-empty-title">{t('home.emptyTitle')}</p>
          <p className="muted small">{t('home.emptyBody')}</p>
          <div className="campaigns-actions">
            <button className="glass-btn" onClick={onJoin}>{t('home.join')}</button>
            <button className="glass-btn" onClick={onStart}>{t('home.start')}</button>
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
      <EndedCampaigns userId={userId} names={names} />
      {(parties.length > 0 || (dmTools && onDmScreen)) && (
        <div className="campaigns-foot">
          {parties.length > 0 && <button className="glass-btn" onClick={onJoin}>{t('home.joinAnother')}</button>}
          {dmTools && onDmScreen && <button className="glass-btn" onClick={onDmScreen}>{t('home.dmScreen')}</button>}
        </div>
      )}
    </section>
  )
}

/** End (DM or admin: closed for everyone) and Leave (anyone but the DM: gone from your list only). End moves the
 *  campaign to Ended campaigns with everything kept, so a yes/no is enough; only on a server that still deletes
 *  ended campaigns does it say what is lost and ask for the campaign's name. Characters are never touched. */
export function CampaignManage({ party, userId }: { party: Party; userId: string }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState<'end' | 'leave' | null>(null)
  const undoable = canUndoEnd(party.id)
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
      {undoable
        ? <ConfirmDialog open={asking === 'end'} title={t('party.confirmEnd', { name: party.name })} body={t('party.confirmEndUndoable')}
            yes={t('party.end')} onYes={() => void end()} onClose={close} />
        : <TypedConfirmDialog open={asking === 'end'} title={t('party.confirmEnd', { name: party.name })} body={t('party.confirmEndBody')}
            phrase={party.name} yes={t('party.end')} onYes={() => void end()} onClose={close} />}
      <ConfirmDialog open={asking === 'leave'} title={t('party.confirmLeave', { name: party.name })} yes={t('party.leave')}
        onYes={() => void leaveParty(party.id, userId)} onClose={close} />
    </div>
  )
}

/** Campaigns the DM ended, folded under the list. Its DM (or the admin) brings one back as it was, or deletes it
 *  for good; a player can take it off their list. Hidden when there are none. */
function EndedCampaigns({ userId, names }: { userId: string; names: Record<string, string> }) {
  const { t, locale } = useI18n()
  const [ended, setEnded] = useState<Party[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [asking, setAsking] = useState<{ kind: 'delete' | 'remove'; party: Party } | null>(null)
  useEffect(() => {
    let live = true
    const load = () => { listEndedParties(userId).then(list => { if (live) setEnded(list) }) }
    load()
    const off = onPartiesChanged(load)
    return () => { live = false; off() }
  }, [userId])
  if (!ended.length) return null
  const run = async (id: string, action: () => Promise<boolean | void>, failed: 'party.restoreFailed' | 'party.deleteFailed') => {
    setBusy(id)
    const ok = await action()
    setBusy(null)
    if (ok === false) alert(t(failed))
  }
  const when = (iso: string) => new Date(iso).toLocaleDateString(locale, { dateStyle: 'medium' })
  const close = () => setAsking(null)
  return (
    <details className="glass campaigns-ended">
      <summary>{t('party.endedTitle', { count: ended.length })}</summary>
      <p className="muted small">{t('party.endedHint')}</p>
      <ul className="campaigns-ended-list">
        {ended.map(p => {
          const dm = isPartyDm(p, userId)
          const owner = canRestoreParty(p, userId)
          return (
            <li key={p.id} className="campaign-ended">
              <span className="campaign-ended-name">
                <strong>{p.name}</strong>
                <span className="muted small">
                  {t('party.endedOn', { date: when(p.endedAt!) })} · {dm ? t('party.pick.youDm') : t('party.dm', { name: names[p.dmId] ?? t('party.unknownPlayer') })}
                </span>
              </span>
              <span className="campaign-ended-actions">
                {owner && <button className="glass-btn small prominent" disabled={busy === p.id}
                  onClick={() => void run(p.id, () => restoreParty(p.id, userId), 'party.restoreFailed')}>{t('party.restore')}</button>}
                {owner && <button className="glass-btn small ghost campaign-end" disabled={busy === p.id}
                  onClick={() => setAsking({ kind: 'delete', party: p })}>{t('party.deleteForever')}</button>}
                {!dm && <button className="glass-btn small ghost" disabled={busy === p.id}
                  onClick={() => setAsking({ kind: 'remove', party: p })}>{t('party.removeEnded')}</button>}
              </span>
            </li>
          )
        })}
      </ul>
      <TypedConfirmDialog open={asking?.kind === 'delete'} title={t('party.confirmDelete', { name: asking?.party.name ?? '' })}
        body={t('party.confirmEndBody')} phrase={asking?.party.name ?? ''} yes={t('party.deleteForever')}
        onYes={() => { const p = asking!.party; void run(p.id, () => deleteParty(p.id, userId), 'party.deleteFailed') }} onClose={close} />
      <ConfirmDialog open={asking?.kind === 'remove'} title={t('party.confirmRemoveEnded', { name: asking?.party.name ?? '' })}
        yes={t('party.removeEnded')} onYes={() => { const p = asking!.party; void leaveParty(p.id, userId) }} onClose={close} />
    </details>
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
