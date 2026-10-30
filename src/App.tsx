import { useCallback, useEffect, useRef, useState } from 'react'
import './a11y'
import { AccessibilityDialog, SkipLink, useFocusOnChange, useShortcuts } from './a11y/ui'
import { AccountBadge, ActivateScreen, CloudLinkNotice, activate, activateErrorKey, getSession, isAdmin, onSessionChanged, type Session } from './accounts'
import { AdminPage } from './admin'
import { Builder, EditCharacter, UnfinishedDraft } from './builder/Builder'
import { LevelUp } from './builder/LevelUp'
import { CombatTracker } from './combat/ui/CombatTracker'
import { DmScreen } from './dm'
import { DmRequestPopup, EditRequestDialog, editState, RequestsAgent, RequestsView, spendEditPass, updateRequests, useRequests, type EditState, type Shared } from './requests'
import { DiceFab, DiceProvider } from './dice/ui'
import type { Character, UserProfile } from './model/character'
import { deleteSnapshotsFor } from './portability'
import { ExportButton, ImportButton, LevelHistory } from './portability/ui'
import { campaignTarget, CampaignsHome, PartyRollRelay, PartySwitcher, PartyView, useActiveParty, useXpAwards, type Party } from './party'
import { xpForNextLevel, xpReady } from './rules'
import { RulesQA } from './rulesqa'
import { ShareButton } from './share'
import { PlanView } from './planner'
import { PrintSheet } from './print'
import { Homebrew, loadHomebrew } from './homebrew'
import { useI18n } from './i18n'
import type { MessageKey } from './i18n/locales/en'
import { AppNav, canOpen } from './nav'
import { CharacterSheet } from './sheet/CharacterSheet'
import { StarterPicker } from './starters'
import './list/list.css'
import { DuplicatePrompt, SyncBadge, useCloudSync } from './sync'
import {
  deleteCharacter, getActiveProfileId, listCharacters, listProfiles, onCharactersChanged, saveCharacter, saveProfile,
  setActiveProfileId,
} from './storage'

type View = { kind: 'campaigns' } | { kind: 'list' } | { kind: 'build' } | { kind: 'edit'; id: string } | { kind: 'levelup'; id: string } | { kind: 'starters' } | { kind: 'combat'; encounterId?: string } | { kind: 'dm'; tab?: 'requests' } | { kind: 'requests' } | { kind: 'party'; partyId?: string; startWith?: 'start' | 'join' } | { kind: 'rules' } | { kind: 'sheet'; id: string } | { kind: 'levels'; id: string } | { kind: 'plan'; id: string } | { kind: 'print'; id: string } | { kind: 'homebrew' } | { kind: 'admin' }

const newId = () => crypto.randomUUID()

// Register saved homebrew items with the rules engine before any sheet derives stats.
loadHomebrew()

export default function App() {
  const [profiles, setProfiles] = useState<UserProfile[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(getActiveProfileId())
  const [session, setSession] = useState<Session | null>(getSession)
  const [characters, setCharacters] = useState<Character[]>([])
  // Every visit opens on the campaigns home: pick a campaign, then play it.
  const [view, setView] = useState<View>({ kind: 'campaigns' })
  const [diceOpen, setDiceOpen] = useState(false)
  const [askEdit, setAskEdit] = useState<{ character: Character; note?: string } | null>(null)
  const requests = useRequests()
  const { t } = useI18n()
  const mainRef = useFocusOnChange<HTMLElement>(JSON.stringify(view))
  const a11yDialog = useRef<HTMLDialogElement>(null)
  useShortcuts({
    c: () => setView({ kind: 'list' }),
    b: () => setView({ kind: 'build' }),
    d: () => setDiceOpen(o => !o),
    p: () => setView({ kind: 'party' }),
    a: () => a11yDialog.current?.showModal(),
  })
  useEffect(() => {
    listProfiles().then(setProfiles)
  }, [])

  // Activating a code adds that friend's profile and makes it active.
  useEffect(() => onSessionChanged(async () => {
    const s = getSession()
    setSession(s)
    setProfiles(await listProfiles())
    if (s) {
      setActiveId(s.id)
      setView({ kind: 'campaigns' })
    }
  }), [])

  const active = profiles?.find(p => p.id === activeId) ?? profiles?.[0]

  const refresh = useCallback(() => {
    if (active) listCharacters(active.id).then(setCharacters)
  }, [active])
  useEffect(refresh, [refresh])
  // Characters pulled from the cloud show up without a reload.
  useEffect(() => onCharactersChanged(refresh), [refresh])
  useCloudSync(active?.id)

  // On entering the app the player picks the party (campaign) they play now. That party's DM gets the
  // DM pages (DM screen, combat tracker); everyone else gets the player pages. The admin (Ziv) also
  // opens the DM pages from the admin page. Roles follow the open profile, as for any player.
  const playing = useActiveParty(active?.id ?? '')
  const ownProfile = !!session && session.id === active?.id
  const admin = ownProfile && isAdmin(session.id)
  const partyDm = playing.isDm
  const isDm = partyDm || admin
  useXpAwards(active?.id, playing.parties)
  const nav = { isDm, partyDm, admin }
  // Tapping a campaign on the home screen plays it: the DM screen for its DM, else the sheet the player brings.
  const playCampaign = (p: Party) => {
    playing.choose(p.id)
    const to = campaignTarget(p, active?.id ?? '', characters.map(c => c.id))
    setView(to.kind === 'party' ? { kind: 'party', partyId: to.partyId } : to)
  }
  // The Campaign switch in the player menu plays the picked one, or the character list without a party.
  const switchCampaign = (id: string | null) => {
    const p = playing.parties?.find(x => x.id === id)
    if (p) playCampaign(p)
    else { playing.choose(null); setView({ kind: 'list' }) }
  }
  // A screen this account may not open (a shortcut, a link, a switched profile) falls back to its home screen.
  const allowed = canOpen(view.kind, nav)
  useEffect(() => {
    if (!allowed) setView({ kind: 'campaigns' })
  }, [allowed])

  // Players edit a character only with the DM's OK (one edit per approval). The DM and the admin edit freely,
  // and so does a player whose character has no DM (in no party run by someone else).
  const editsFreely = isDm
  const hasDm = (id: string) => !playing.parties || playing.parties.some(p => p.dmId !== active?.id && p.members.some(m => m.characterId === id))
  const editStateOf = (id: string): EditState => (editsFreely || !hasDm(id) ? 'approved' : active ? editState(requests ?? [], active.id, id) : 'none')
  const startEdit = (id: string) => {
    const character = characters.find(c => c.id === id)
    if (editStateOf(id) === 'approved') setView({ kind: 'edit', id })
    else if (character) setAskEdit({ character })
  }
  // Levelling up needs no OK once XP reaches the next level (the DM gives XP or a milestone on the party page).
  const levelUpPass = (id: string) => editStateOf(id) === 'approved' && !editsFreely && hasDm(id)
  const startLevelUp = (id: string) => {
    const character = characters.find(c => c.id === id)
    if (!character || xpReady(character) || editStateOf(id) === 'approved') setView({ kind: 'levelup', id })
    else setAskEdit({ character, note: t('levelup.needXp', { name: character.name, xp: character.xp, next: xpForNextLevel(character.classes.reduce((n, cl) => n + cl.level, 0)) ?? 0 }) })
  }

  const addProfile = async (displayName: string) => {
    const p = { id: newId(), displayName }
    await saveProfile(p)
    setProfiles(await listProfiles())
    switchProfile(p.id)
  }
  const switchProfile = (id: string) => {
    setActiveProfileId(id)
    setActiveId(id)
    setView({ kind: 'campaigns' })
  }

  // A request link opens the DM's Requests tab; an answer link opens the player's requests.
  // An answer to an edit request opens the character list, where Edit is now unlocked.
  const openRequestLink = useCallback((s: Shared) => {
    if (s.type === 'request') setView({ kind: 'dm', tab: 'requests' })
    else setView(s.request.kind === 'edit' ? { kind: 'list' } : { kind: 'requests' })
  }, [])

  const onScreenId = 'id' in view ? view.id : undefined
  const onScreen = characters.find(c => c.id === onScreenId)

  if (profiles === null) return null
  if (!active) return <ActivateScreen onLocal={addProfile} />

  return (
    <DiceProvider key={active.id} userId={active.id}>
    <RequestsAgent userId={active.id} onOpen={openRequestLink} />
    <PartyRollRelay userId={active.id} />
    {isDm && <DmRequestPopup onOpenAll={() => setView({ kind: 'dm', tab: 'requests' })} />}
    <EditRequestDialog key={askEdit?.character.id} character={askEdit?.character ?? null} note={askEdit?.note} userId={active.id} userName={active.displayName} onClose={() => setAskEdit(null)} />
    <div className="app">
      <SkipLink />
      <AppNav
        viewKind={view.kind}
        onGo={key => setView({ kind: key })}
        playerName={active.displayName}
        {...nav}
        dmBadge={<><AccountBadge dm={partyDm} /><SyncBadge compact /></>}
        onAccessibility={() => a11yDialog.current?.showModal()}
      >
        <SyncBadge />
        <ProfileSwitcher profiles={profiles} active={active} onSwitch={switchProfile} onAdd={addProfile} />
        {playing.parties && <PartySwitcher parties={playing.parties} party={playing.party} onPick={switchCampaign} />}
      </AppNav>
      <AccessibilityDialog ref={a11yDialog} />
      <main id="main" ref={mainRef} tabIndex={-1}>
        {ownProfile && view.kind !== 'campaigns' && <CloudLinkNotice />}
        {ownProfile && <DuplicatePrompt characters={characters} />}
        {(view.kind === 'campaigns' || view.kind === 'list') && <UnfinishedDraft key={active.id} ownerId={active.id} onContinue={() => setView({ kind: 'build' })} />}
        {view.kind === 'campaigns' && (
          <CampaignsHome
            userId={active.id}
            playerName={active.displayName}
            parties={playing.parties}
            current={playing.party}
            characters={characters}
            onPlay={playCampaign}
            onJoin={() => setView({ kind: 'party', startWith: 'join' })}
            onStart={() => setView({ kind: 'party', startWith: 'start' })}
            onBuild={() => setView({ kind: 'build' })}
            onCharacters={() => setView({ kind: 'list' })}
          />
        )}
        {view.kind === 'list' && (
          <CharacterList
            owner={active}
            characters={characters}
            onNew={() => setView({ kind: 'build' })}
            onStarter={() => setView({ kind: 'starters' })}
            onOpen={id => setView({ kind: 'sheet', id })}
            editState={editStateOf}
            onEdit={startEdit}
            onLevels={id => setView({ kind: 'levels', id })}
            onPlan={id => setView({ kind: 'plan', id })}
            onPrint={id => setView({ kind: 'print', id })}
            onImported={refresh}
            onDelete={async id => {
              await deleteCharacter(id)
              await deleteSnapshotsFor(id)
              refresh()
            }}
          />
        )}
        {view.kind === 'build' && (
          <Builder
            ownerId={active.id}
            playerName={active.displayName}
            onCancel={() => setView({ kind: 'list' })}
            onCreate={async c => {
              const saved = await saveCharacter(c)
              refresh()
              setView({ kind: 'sheet', id: saved.id })
            }}
          />
        )}
        {view.kind === 'edit' && (
          <EditCharacter
            key={view.id}
            characterId={view.id}
            onCancel={() => setView({ kind: 'sheet', id: view.id })}
            onSaved={id => {
              if (!editsFreely) updateRequests(l => spendEditPass(l, active.id, id))
              refresh()
              setView({ kind: 'sheet', id })
            }}
          />
        )}
        {view.kind === 'levelup' && (
          <LevelUp
            key={view.id}
            characterId={view.id}
            onDone={(id, saved) => {
              // A level-up that only an approval allowed (XP short of the next level) uses that approval.
              if (saved && levelUpPass(id) && !xpReady(characters.find(c => c.id === id) ?? { classes: [], xp: 0 })) updateRequests(l => spendEditPass(l, active.id, id))
              refresh()
              setView({ kind: 'sheet', id })
            }}
          />
        )}
        {view.kind === 'starters' && (
          <StarterPicker
            ownerId={active.id}
            playerName={active.displayName}
            onCancel={() => setView({ kind: 'list' })}
            onCustom={() => setView({ kind: 'build' })}
            onCreate={async c => {
              const saved = await saveCharacter(c)
              refresh()
              setView({ kind: 'sheet', id: saved.id })
            }}
          />
        )}
        {view.kind === 'sheet' && (
          <CharacterSheet
            characterId={view.id}
            onEdit={() => startEdit(view.id)}
            onLevelUp={() => startLevelUp(view.id)}
            onBack={() => {
              refresh()
              setView({ kind: 'list' })
            }}
          />
        )}
        {view.kind === 'levels' && (
          <LevelHistory
            characterId={view.id}
            onOpenSheet={id => setView({ kind: 'sheet', id })}
            onBack={() => {
              refresh()
              setView({ kind: 'list' })
            }}
          />
        )}
        {view.kind === 'plan' && <PlanView characterId={view.id} onBack={() => { refresh(); setView({ kind: 'list' }) }} />}
        {view.kind === 'print' && <PrintSheet characterId={view.id} onBack={() => setView({ kind: 'list' })} />}
        {view.kind === 'rules' && <RulesQA />}
        {view.kind === 'combat' && isDm && <CombatTracker key={`${active.id}:${view.encounterId ?? ''}`} ownerId={active.id} initialOpenId={view.encounterId} />}
        {view.kind === 'dm' && isDm && <DmScreen key={`${active.id}:${view.tab ?? ''}`} userId={active.id} initialTab={view.tab} onRunEncounter={id => setView({ kind: 'combat', encounterId: id })} />}
        {view.kind === 'requests' && <RequestsView key={active.id} userId={active.id} userName={active.displayName} />}
        {view.kind === 'homebrew' && <Homebrew profile={active} />}
        {view.kind === 'admin' && admin && (
          <AdminPage
            onOpenAs={async id => { setProfiles(await listProfiles()); switchProfile(id) }}
            onOpenSheet={id => setView({ kind: 'sheet', id })}
            onEdit={id => setView({ kind: 'edit', id })}
            onOpenDm={() => setView({ kind: 'dm' })}
            onOpenCombat={() => setView({ kind: 'combat' })}
          />
        )}
        {view.kind === 'party' && (
          <PartyView key={`${active.id}:${view.partyId ?? ''}:${view.startWith ?? ''}`} userId={active.id} openId={view.partyId} startWith={view.startWith}
            onOpenCharacter={id => setView({ kind: 'sheet', id })} />
        )}
      </main>
      <DiceFab open={diceOpen} onOpenChange={setDiceOpen} character={onScreen}
        secretTo={playing.party && !playing.isDm ? { partyId: playing.party.id, userId: active.id } : undefined} />
    </div>
    </DiceProvider>
  )
}

function ProfileSwitcher({ profiles, active, onSwitch, onAdd }: {
  profiles: UserProfile[]
  active: UserProfile
  onSwitch: (id: string) => void
  onAdd: (name: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="row profile">
      <label className="muted small" htmlFor="profile">{t('app.player')}</label>
      <select
        id="profile"
        value={active.id}
        onChange={e => {
          if (e.target.value === '__new') {
            const name = prompt(t('app.newPlayerPrompt'))?.trim()
            if (name) onAdd(name)
          } else if (e.target.value === '__code') {
            const code = prompt(t('account.codePrompt'))?.trim()
            if (code) activate(code).then(s => { if (typeof s === 'string') alert(t(activateErrorKey(s))) })
          } else onSwitch(e.target.value)
        }}
      >
        {profiles.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
        <option value="__new">{t('app.addPlayer')}</option>
        <option value="__code">{t('account.enterCode')}</option>
      </select>
    </div>
  )
}

function CharacterList({ owner, characters, onNew, onStarter, onOpen, editState, onEdit, onLevels, onPlan, onPrint, onImported, onDelete }: {
  owner: UserProfile
  characters: Character[]
  onNew: () => void
  onStarter: () => void
  onOpen: (id: string) => void
  editState: (id: string) => EditState
  onEdit: (id: string) => void
  onLevels: (id: string) => void
  onPlan: (id: string) => void
  onPrint: (id: string) => void
  onImported: () => void
  onDelete: (id: string) => void
}) {
  const { t, classLine, raceName } = useI18n()
  const actions = (
    <>
      <ImportButton ownerId={owner.id} onImported={onImported} className="glass-btn" />
      <button className="glass-btn" onClick={onStarter}>{t('list.starters')}</button>
      <button className="glass-btn prominent" onClick={onNew}>{t('list.new')}</button>
    </>
  )
  return (
    <section className="heroes">
      <header className="heroes-head">
        <h2 className="glass-title">{t('list.title', { name: owner.displayName })}</h2>
        {characters.length > 0 && <div className="heroes-actions">{actions}</div>}
      </header>
      {characters.length === 0 ? (
        <div className="glass heroes-empty">
          <div className="portrait-empty" aria-hidden="true">✦</div>
          <p>{t('list.empty')}</p>
          <div className="heroes-actions">
            <button className="glass-btn prominent" onClick={onNew}>{t('list.buildFirst')}</button>
            <button className="glass-btn" onClick={onStarter}>{t('list.newToDnd')}</button>
            <ImportButton ownerId={owner.id} onImported={onImported} className="glass-btn" />
          </div>
        </div>
      ) : (
        <div className="heroes-grid">
          {characters.map(c => (
            <article key={c.id} className="glass heroes-card">
              <div className="heroes-id">
                {c.portrait ? <img src={c.portrait} alt="" /> : <div className="portrait-empty" aria-hidden="true">{c.name.slice(0, 1)}</div>}
                <div>
                  <h3>{c.name}</h3>
                  <p className="muted small">{raceName(c.raceId, c.subraceId, c.rulesEdition)} · {classLine(c.classes)}</p>
                </div>
              </div>
              <div className="heroes-main">
                <button className="glass-btn prominent" onClick={() => onOpen(c.id)}>{t('common.openSheet')}</button>
                <button className="glass-btn" onClick={() => onEdit(c.id)} aria-label={`${t(EDIT_LABEL[editState(c.id)])}: ${c.name}`}>{t(EDIT_LABEL[editState(c.id)])}</button>
              </div>
              <div className="heroes-tools">
                <button className="heroes-tool" onClick={() => onLevels(c.id)}>{t('list.levels')}</button>
                <button className="heroes-tool" onClick={() => onPlan(c.id)}>{t('list.plan')}</button>
                <button className="heroes-tool" onClick={() => onPrint(c.id)}>{t('list.print')}</button>
                <ExportButton character={c} className="heroes-tool" />
                <ShareButton character={c} className="heroes-tool" />
                <button className="heroes-tool danger" onClick={() => confirm(t('list.confirmDelete', { name: c.name })) && onDelete(c.id)}>{t('common.delete')}</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

const EDIT_LABEL: Record<EditState, MessageKey> = { approved: 'list.edit', pending: 'list.editRequested', none: 'list.askEdit' }
