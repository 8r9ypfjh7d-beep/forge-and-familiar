import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import './a11y'
import { AccessibilityButton, SkipLink, useFocusOnChange, useShortcuts } from './a11y/ui'
import { AccountBadge, ActivateScreen, activate, getSession, onSessionChanged, type Session } from './accounts'
import { Builder, EditCharacter } from './builder/Builder'
import { CoinsView } from './coins'
import { CombatTracker } from './combat/ui/CombatTracker'
import { CompareView } from './compare'
import { DiceFab, DiceProvider } from './dice/ui'
import type { Character, UserProfile } from './model/character'
import { deleteSnapshotsFor } from './portability'
import { ImportButton, LevelHistory } from './portability/ui'
import { PartyView } from './party'
import { CompanionsView, deleteCompanionsFor } from './companions'
import { RecapView, SessionRecorder } from './recap'
import { deleteJournalFor, JournalView } from './notes'
import { RulesQA } from './rulesqa'
import { PrintSheet } from './print'
import { Homebrew, loadHomebrew } from './homebrew'
import { themeById } from './themes'
import { LanguagePicker, useI18n } from './i18n'
import { CharacterSheet } from './sheet/CharacterSheet'
import { TableMode } from './table'
import { StarterPicker } from './starters'
import {
  deleteCharacter, getActiveProfileId, listCharacters, listProfiles, saveCharacter, saveProfile, setActiveProfileId,
} from './storage'

type View = { kind: 'list' } | { kind: 'build' } | { kind: 'edit'; id: string } | { kind: 'starters' } | { kind: 'combat' } | { kind: 'party' } | { kind: 'recap' } | { kind: 'rules' } | { kind: 'coins' } | { kind: 'sheet'; id: string } | { kind: 'levels'; id: string } | { kind: 'companions'; id: string } | { kind: 'journal'; id: string } | { kind: 'print'; id: string } | { kind: 'homebrew' } | { kind: 'compare'; id?: string } | { kind: 'table'; id: string }

const newId = () => crypto.randomUUID()

// Register saved homebrew items with the rules engine before any sheet derives stats.
loadHomebrew()

export default function App() {
  const [profiles, setProfiles] = useState<UserProfile[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(getActiveProfileId())
  const [session, setSession] = useState<Session | null>(getSession)
  const [characters, setCharacters] = useState<Character[]>([])
  const [view, setView] = useState<View>({ kind: 'list' })
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
      setView({ kind: 'list' })
    }
  }), [])

  const active = profiles?.find(p => p.id === activeId) ?? profiles?.[0]

  const refresh = useCallback(() => {
    if (active) listCharacters(active.id).then(setCharacters)
  }, [active])
  useEffect(refresh, [refresh])

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

  const onScreenId = 'id' in view ? view.id : undefined
  const onScreen = characters.find(c => c.id === onScreenId)

  if (profiles === null) return null
  if (!active) return <ActivateScreen onLocal={addProfile} />

  return (
    <DiceProvider key={active.id} userId={active.id}>
    <SessionRecorder userId={active.id} />
    <div className="app">
      <SkipLink />
      <header className="topbar">
        <button className="brand" onClick={() => setView({ kind: 'list' })}>Forge &amp; Familiar</button>
        <div className="row">
          <button className={`chip ${view.kind === 'party' ? 'on' : ''}`} aria-current={view.kind === 'party' ? 'page' : undefined} onClick={() => setView({ kind: 'party' })}>{t('app.party')}</button>
          <button className={`chip ${view.kind === 'homebrew' ? 'on' : ''}`} aria-current={view.kind === 'homebrew' ? 'page' : undefined} onClick={() => setView({ kind: 'homebrew' })}>{t('app.homebrew')}</button>
          <button className={`chip ${view.kind === 'combat' ? 'on' : ''}`} aria-current={view.kind === 'combat' ? 'page' : undefined} onClick={() => setView({ kind: 'combat' })}>{t('app.combat')}</button>
          <button className={`chip ${view.kind === 'coins' ? 'on' : ''}`} aria-current={view.kind === 'coins' ? 'page' : undefined} onClick={() => setView({ kind: 'coins' })}>{t('app.coins')}</button>
          <button className={`chip ${view.kind === 'recap' ? 'on' : ''}`} aria-current={view.kind === 'recap' ? 'page' : undefined} onClick={() => setView({ kind: 'recap' })}>{t('app.recap')}</button>
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
            onTable={id => setView({ kind: 'table', id })}
            onLevels={id => setView({ kind: 'levels', id })}
            onCompanions={id => setView({ kind: 'companions', id })}
            onJournal={id => setView({ kind: 'journal', id })}
            onPrint={id => setView({ kind: 'print', id })}
            onCompare={id => setView({ kind: 'compare', id })}
            onImported={refresh}
            onDelete={async id => {
              await deleteCharacter(id)
              await deleteSnapshotsFor(id)
              await deleteCompanionsFor(id)
              await deleteJournalFor(id)
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
        {view.kind === 'compare' && (
          <CompareView key={view.id} ownerId={active.id} characterId={view.id} onBack={() => setView({ kind: 'list' })} />
        )}
        {view.kind === 'table' && <TableMode characterId={view.id} onExit={() => { refresh(); setView({ kind: 'list' }) }} />}
        {view.kind === 'companions' && (
          <CompanionsView
            characterId={view.id}
            onOpenSheet={id => setView({ kind: 'sheet', id })}
            onBack={() => setView({ kind: 'list' })}
          />
        )}
        {view.kind === 'journal' && (
          <JournalView
            characterId={view.id}
            userId={active.id}
            onOpenSheet={id => setView({ kind: 'sheet', id })}
            onBack={() => setView({ kind: 'list' })}
          />
        )}
        {view.kind === 'rules' && <RulesQA />}
        {view.kind === 'combat' && <CombatTracker key={active.id} ownerId={active.id} />}
        {view.kind === 'homebrew' && <Homebrew profile={active} />}
        {view.kind === 'coins' && <CoinsView userId={active.id} />}
        {view.kind === 'recap' && <RecapView userId={active.id} />}
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

function CharacterList({ owner, characters, onNew, onStarter, onOpen, onEdit, onTable, onLevels, onCompanions, onJournal, onPrint, onCompare, onImported, onDelete }: {
  owner: UserProfile
  characters: Character[]
  onNew: () => void
  onStarter: () => void
  onOpen: (id: string) => void
  onEdit: (id: string) => void
  onTable: (id: string) => void
  onLevels: (id: string) => void
  onCompanions: (id: string) => void
  onJournal: (id: string) => void
  onPrint: (id: string) => void
  onCompare: (id: string) => void
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
              <article key={c.id} className="panel char-card" style={themeStripe(c.theme)}>
                {c.portrait ? <img src={c.portrait} alt="" /> : <div className="portrait-empty small">{c.name.slice(0, 1)}</div>}
                <div>
                  <h3>{c.name}</h3>
                  <p className="muted small">{raceName(c.raceId, c.subraceId)} · {classLine(c.classes)}</p>
                  <div className="row">
                    <button className="btn primary small" onClick={() => onOpen(c.id)}>{t('common.openSheet')}</button>
                    <button className="btn small" onClick={() => onEdit(c.id)} aria-label={`${t('list.edit')}: ${c.name}`}>{t('list.edit')}</button>
                    <button className="btn small" onClick={() => onTable(c.id)}>{t('list.table')}</button>
                    <button className="btn small" onClick={() => onLevels(c.id)}>{t('list.levels')}</button>
                    <button className="btn small" onClick={() => onCompanions(c.id)}>{t('list.companions')}</button>
                    <button className="btn small" onClick={() => onJournal(c.id)}>{t('list.journal')}</button>
                    <button className="btn small" onClick={() => onPrint(c.id)}>{t('list.print')}</button>
                    <button className="btn small" onClick={() => onCompare(c.id)}>{t('list.compare')}</button>
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

/** The character's theme accent as a stripe on the card's leading edge. */
function themeStripe(id: string | undefined): CSSProperties | undefined {
  const theme = themeById(id)
  return theme ? { borderInlineStart: `4px solid ${theme.tokens.accent}` } : undefined
}
