import { useCallback, useEffect, useRef, useState } from 'react'
import './a11y'
import { AccessibilityDialog, SkipLink, useFocusOnChange, useShortcuts } from './a11y/ui'
import { AccountBadge, ActivateScreen, activate, activateErrorKey, getSession, isAdmin, onSessionChanged, type Session } from './accounts'
import { AdminPage } from './admin'
import { Builder, EditCharacter } from './builder/Builder'
import { CombatTracker } from './combat/ui/CombatTracker'
import { DmScreen } from './dm'
import { DmRequestPopup, EditRequestDialog, editState, RequestsAgent, RequestsView, spendEditPass, updateRequests, useRequests, type EditState, type Shared } from './requests'
import { DiceFab, DiceProvider } from './dice/ui'
import type { Character, UserProfile } from './model/character'
import { deleteSnapshotsFor } from './portability'
import { ExportButton, ImportButton, LevelHistory } from './portability/ui'
import { PartyRollRelay, PartyView } from './party'
import { RulesQA } from './rulesqa'
import { PrintSheet } from './print'
import { Homebrew, loadHomebrew } from './homebrew'
import { useI18n } from './i18n'
import type { MessageKey } from './i18n/locales/en'
import { AppNav, canOpen } from './nav'
import { CharacterSheet } from './sheet/CharacterSheet'
import { StarterPicker } from './starters'
import { SyncBadge, useCloudSync } from './sync'
import {
  deleteCharacter, getActiveProfileId, listCharacters, listProfiles, onCharactersChanged, saveCharacter, saveProfile,
  setActiveProfileId,
} from './storage'

type View = { kind: 'list' } | { kind: 'build' } | { kind: 'edit'; id: string } | { kind: 'starters' } | { kind: 'combat'; encounterId?: string } | { kind: 'dm'; tab?: 'requests' } | { kind: 'requests' } | { kind: 'party' } | { kind: 'rules' } | { kind: 'sheet'; id: string } | { kind: 'levels'; id: string } | { kind: 'print'; id: string } | { kind: 'homebrew' } | { kind: 'admin' }

const newId = () => crypto.randomUUID()

// Register saved homebrew items with the rules engine before any sheet derives stats.
loadHomebrew()

export default function App() {
  const [profiles, setProfiles] = useState<UserProfile[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(getActiveProfileId())
  const [session, setSession] = useState<Session | null>(getSession)
  const [characters, setCharacters] = useState<Character[]>([])
  const [view, setView] = useState<View>(() => (getSession()?.role === 'dm' ? { kind: 'dm' } : { kind: 'list' }))
  const [diceOpen, setDiceOpen] = useState(false)
  const [askEdit, setAskEdit] = useState<Character | null>(null)
  const requests = useRequests()
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
      setView(s.role === 'dm' ? { kind: 'dm' } : { kind: 'list' })
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

  // The DM pages (DM screen, combat tracker) are for the DM account only, plus the admin account (Ziv).
  // Roles follow the open profile: the admin opened as a player sees exactly what that player sees.
  // Players never see the DM pages, even if they lead a party.
  const ownProfile = !!session && session.id === active?.id
  const admin = ownProfile && isAdmin(session.id)
  const dmAccount = ownProfile && session.role === 'dm'
  const isDm = dmAccount || admin
  const nav = { isDm, dmAccount, admin }
  // A screen this account may not open (a shortcut, a link, a switched profile) falls back to its home screen.
  const allowed = canOpen(view.kind, nav)
  useEffect(() => {
    if (!allowed) setView(isDm ? { kind: 'dm' } : { kind: 'list' })
  }, [allowed, isDm])

  // Players edit a character only with the DM's OK (one edit per approval). The DM and the admin edit freely.
  const editsFreely = isDm
  const editStateOf = (id: string): EditState => (editsFreely ? 'approved' : active ? editState(requests ?? [], active.id, id) : 'none')
  const startEdit = (id: string) => {
    if (editStateOf(id) === 'approved') setView({ kind: 'edit', id })
    else setAskEdit(characters.find(c => c.id === id) ?? null)
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
    setView({ kind: 'list' })
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
    <EditRequestDialog key={askEdit?.id} character={askEdit} userId={active.id} userName={active.displayName} onClose={() => setAskEdit(null)} />
    <div className="app">
      <SkipLink />
      <AppNav
        viewKind={view.kind}
        onGo={key => setView({ kind: key })}
        playerName={active.displayName}
        {...nav}
        dmBadge={<>{session?.id === active.id && <AccountBadge session={session} />}<SyncBadge compact /></>}
        onAccessibility={() => a11yDialog.current?.showModal()}
      >
        <SyncBadge />
        <ProfileSwitcher profiles={profiles} active={active} onSwitch={switchProfile} onAdd={addProfile} />
      </AppNav>
      <AccessibilityDialog ref={a11yDialog} />
      <main id="main" ref={mainRef} tabIndex={-1}>
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
            onCancel={() => setView({ kind: 'list' })}
            onSaved={id => {
              if (!editsFreely) updateRequests(l => spendEditPass(l, active.id, id))
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
        {view.kind === 'party' && <PartyView userId={active.id} onOpenCharacter={id => setView({ kind: 'sheet', id })} />}
      </main>
      <DiceFab open={diceOpen} onOpenChange={setDiceOpen} character={onScreen} />
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

function CharacterList({ owner, characters, onNew, onStarter, onOpen, editState, onEdit, onLevels, onPrint, onImported, onDelete }: {
  owner: UserProfile
  characters: Character[]
  onNew: () => void
  onStarter: () => void
  onOpen: (id: string) => void
  editState: (id: string) => EditState
  onEdit: (id: string) => void
  onLevels: (id: string) => void
  onPrint: (id: string) => void
  onImported: () => void
  onDelete: (id: string) => void
}) {
  const { t, classLine, raceName } = useI18n()
  return (
    <section>
      <div className="row spread">
        <h2>{t('list.title', { name: owner.displayName })}</h2>
        <div className="row">
          <ImportButton ownerId={owner.id} onImported={onImported} />
          <button className="btn" onClick={onStarter}>{t('list.starters')}</button>
          <button className="btn primary" onClick={onNew}>{t('list.new')}</button>
        </div>
      </div>
      {characters.length === 0 ? (
        <div className="panel empty">
          <p>{t('list.empty')}</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={onNew}>{t('list.buildFirst')}</button>
            <button className="btn" onClick={onStarter}>{t('list.newToDnd')}</button>
          </div>
        </div>
      ) : (
        <div className="card-grid">
          {characters.map(c => {
            return (
              <article key={c.id} className="panel char-card">
                {c.portrait ? <img src={c.portrait} alt="" /> : <div className="portrait-empty small">{c.name.slice(0, 1)}</div>}
                <div>
                  <h3>{c.name}</h3>
                  <p className="muted small">{raceName(c.raceId, c.subraceId, c.rulesEdition)} · {classLine(c.classes)}</p>
                  <div className="row">
                    <button className="btn primary small" onClick={() => onOpen(c.id)}>{t('common.openSheet')}</button>
                    <button className="btn small" onClick={() => onEdit(c.id)} aria-label={`${t(EDIT_LABEL[editState(c.id)])}: ${c.name}`}>{t(EDIT_LABEL[editState(c.id)])}</button>
                    <button className="btn small" onClick={() => onLevels(c.id)}>{t('list.levels')}</button>
                    <button className="btn small" onClick={() => onPrint(c.id)}>{t('list.print')}</button>
                    <ExportButton character={c} />
                    <button className="btn ghost small" onClick={() => confirm(t('list.confirmDelete', { name: c.name })) && onDelete(c.id)}>{t('common.delete')}</button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

const EDIT_LABEL: Record<EditState, MessageKey> = { approved: 'list.edit', pending: 'list.editRequested', none: 'list.askEdit' }
