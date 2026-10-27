import { useCallback, useEffect, useRef, useState } from 'react'
import './a11y'
import { AccessibilityButton, SkipLink, useFocusOnChange, useShortcuts } from './a11y/ui'
import { AccountBadge, ActivateScreen, activate, getSession, onSessionChanged, type Session } from './accounts'
import { Builder, EditCharacter } from './builder/Builder'
import { CombatTracker } from './combat/ui/CombatTracker'
import { DmScreen } from './dm'
import { RequestsAgent, RequestsView } from './requests'
import { DiceFab, DiceProvider } from './dice/ui'
import type { Character, UserProfile } from './model/character'
import { deleteSnapshotsFor } from './portability'
import { ExportButton, ImportButton, LevelHistory } from './portability/ui'
import { listParties, onPartiesChanged, PartyView } from './party'
import { RulesQA } from './rulesqa'
import { PrintSheet } from './print'
import { Homebrew, loadHomebrew } from './homebrew'
import { LanguagePicker, useI18n } from './i18n'
import { CharacterSheet } from './sheet/CharacterSheet'
import { StarterPicker } from './starters'
import {
  deleteCharacter, getActiveProfileId, listCharacters, listProfiles, saveCharacter, saveProfile, setActiveProfileId,
} from './storage'

type View = { kind: 'list' } | { kind: 'build' } | { kind: 'edit'; id: string } | { kind: 'starters' } | { kind: 'combat'; encounterId?: string } | { kind: 'dm'; tab?: 'requests' } | { kind: 'requests' } | { kind: 'party' } | { kind: 'rules' } | { kind: 'sheet'; id: string } | { kind: 'levels'; id: string } | { kind: 'print'; id: string } | { kind: 'homebrew' }

const newId = () => crypto.randomUUID()

// Register saved homebrew items with the rules engine before any sheet derives stats.
loadHomebrew()

export default function App() {
  const [profiles, setProfiles] = useState<UserProfile[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(getActiveProfileId())
  const [session, setSession] = useState<Session | null>(getSession)
  const [characters, setCharacters] = useState<Character[]>([])
  const [view, setView] = useState<View>(() => (getSession()?.role === 'dm' ? { kind: 'dm' } : { kind: 'list' }))
  const [leadsParty, setLeadsParty] = useState(false)
  const [diceOpen, setDiceOpen] = useState(false)
  const mainRef = useFocusOnChange<HTMLElement>(JSON.stringify(view))
  const a11yDialog = useRef<HTMLDialogElement>(null)
  useShortcuts({
    c: () => setView({ kind: 'list' }),
    b: () => setView({ kind: 'build' }),
    d: () => setDiceOpen(o => !o),
    p: () => setView({ kind: 'party' }),
    a: () => a11yDialog.current?.showModal(),
  })
  const { t } = useI18n()

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

  // The DM screen is for the DM account, and for anyone who runs a party on this device.
  useEffect(() => {
    if (!active) return
    const check = () => listParties(active.id).then(ps => setLeadsParty(ps.some(p => p.dmId === active.id)))
    check()
    return onPartiesChanged(check)
  }, [active])
  const isDm = (session?.id === active?.id && session?.role === 'dm') || leadsParty

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
  const openRequestLink = useCallback((type: 'request' | 'answer') => {
    setView(type === 'request' ? { kind: 'dm', tab: 'requests' } : { kind: 'requests' })
  }, [])

  const onScreenId = 'id' in view ? view.id : undefined
  const onScreen = characters.find(c => c.id === onScreenId)

  if (profiles === null) return null
  if (!active) return <ActivateScreen onLocal={addProfile} />

  return (
    <DiceProvider key={active.id} userId={active.id}>
    <RequestsAgent userId={active.id} onOpen={openRequestLink} />
    <div className="app">
      <SkipLink />
      <header className="topbar">
        <button className="brand" onClick={() => setView({ kind: 'list' })}>Forge &amp; Familiar</button>
        <div className="row">
          <button className={`chip ${view.kind === 'party' ? 'on' : ''}`} aria-current={view.kind === 'party' ? 'page' : undefined} onClick={() => setView({ kind: 'party' })}>{t('app.party')}</button>
          {session?.role !== 'dm' && <button className={`chip ${view.kind === 'requests' ? 'on' : ''}`} aria-current={view.kind === 'requests' ? 'page' : undefined} onClick={() => setView({ kind: 'requests' })}>{t('app.requests')}</button>}
          {isDm && <button className={`chip ${view.kind === 'dm' ? 'on' : ''}`} aria-current={view.kind === 'dm' ? 'page' : undefined} onClick={() => setView({ kind: 'dm' })}>{t('app.dm')}</button>}
          <button className={`chip ${view.kind === 'homebrew' ? 'on' : ''}`} aria-current={view.kind === 'homebrew' ? 'page' : undefined} onClick={() => setView({ kind: 'homebrew' })}>{t('app.homebrew')}</button>
          <button className={`chip ${view.kind === 'combat' ? 'on' : ''}`} aria-current={view.kind === 'combat' ? 'page' : undefined} onClick={() => setView({ kind: 'combat' })}>{t('app.combat')}</button>
          <button className={`chip ${view.kind === 'rules' ? 'on' : ''}`} aria-current={view.kind === 'rules' ? 'page' : undefined} onClick={() => setView({ kind: 'rules' })}>{t('app.rules')}</button>
          <LanguagePicker />
          <AccessibilityButton dialogRef={a11yDialog} />
          <ProfileSwitcher profiles={profiles} active={active} onSwitch={switchProfile} onAdd={addProfile} />
          {session?.id === active.id && <AccountBadge session={session} />}
        </div>
      </header>
      <main id="main" ref={mainRef} tabIndex={-1}>
        {view.kind === 'list' && (
          <CharacterList
            owner={active}
            characters={characters}
            onNew={() => setView({ kind: 'build' })}
            onStarter={() => setView({ kind: 'starters' })}
            onOpen={id => setView({ kind: 'sheet', id })}
            onEdit={id => setView({ kind: 'edit', id })}
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
            onEdit={() => setView({ kind: 'edit', id: view.id })}
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
        {view.kind === 'combat' && <CombatTracker key={`${active.id}:${view.encounterId ?? ''}`} ownerId={active.id} initialOpenId={view.encounterId} />}
        {view.kind === 'dm' && <DmScreen key={`${active.id}:${view.tab ?? ''}`} userId={active.id} initialTab={view.tab} onRunEncounter={id => setView({ kind: 'combat', encounterId: id })} />}
        {view.kind === 'requests' && <RequestsView key={active.id} userId={active.id} userName={active.displayName} />}
        {view.kind === 'homebrew' && <Homebrew profile={active} />}
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
            if (code) activate(code).then(s => { if (!s) alert(t('account.badCode')) })
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

function CharacterList({ owner, characters, onNew, onStarter, onOpen, onEdit, onLevels, onPrint, onImported, onDelete }: {
  owner: UserProfile
  characters: Character[]
  onNew: () => void
  onStarter: () => void
  onOpen: (id: string) => void
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
                    <button className="btn small" onClick={() => onEdit(c.id)} aria-label={`${t('list.edit')}: ${c.name}`}>{t('list.edit')}</button>
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
