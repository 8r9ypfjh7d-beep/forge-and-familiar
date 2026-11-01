import { useCallback, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { ExportButton } from '../portability/ui'
import type { Character } from '../model/character'
import { EffectsCard } from './components/Effects'
import { Attacks } from './components/Attacks'
import { DeathSaves } from './components/DeathSaves'
import { HitPoints } from './components/HitPoints'
import { Metamagic } from './components/Metamagic'
import { Resources } from './components/Resources'
import { Rests } from './components/Rests'
import { Spellbook, SpellsCard } from '../spellbook'
import { Inventory } from '../inventory'
import { Supplies } from '../supplies/Supplies'
import type { Apply } from './types'
import { useLiveCharacter, type LogEntry } from './useLiveCharacter'
import { sheetLayout, useNarrow, useSheetMode, type CombatTab, type SheetMode, type SheetSection } from './mode'
import { CombatStartedNotice, LiveMapTab, useLiveCombat } from './combat/LiveMap'
import { bringsCharacter } from './combat/liveMap'
import { characterCard } from '../familiar/context'
import type { FamiliarScreen } from '../familiar/screen'
import { AskFamiliar } from '../familiar/ui/AskFamiliar'
import { useFamiliarScreen } from '../familiar/ui/screen'
import { applyOnSheet } from '../familiar/changes'
import { t as tr } from '../i18n'
import { getCharacter } from '../storage'
import { rulesEdition } from '../rules'
import type { Party } from '../party/types'
import { Notes } from './components/Story'
import { FirstTips } from './components/FirstTips'
import { AbilitiesPanel, CharacterCard, CombatTabs, FeaturesTraits, Fight, HpChip, SkillsPanel } from './combat/CombatPage'
import { canPowerUp, PowerUpCard } from '../powerup'
import './sheet.css'

export function CharacterSheet({ characterId, party, userId, onBack, onEdit, onLevelUp }: {
  characterId: string
  /** The campaign in play: its live combat (src/combat/live) puts a Map tab in combat mode. */
  party?: Party
  userId?: string
  onBack: () => void
  onEdit?: () => void
  onLevelUp?: () => void
}) {
  const { character, apply, undo, undoTo, redo, canRedo, log } = useLiveCharacter(characterId)
  const { t } = useI18n()

  if (character === undefined) return <div className="ff-sheet"><p className="hint">{t('common.loading')}</p></div>
  if (character === null) {
    return (
      <div className="ff-sheet">
        <p>{t('common.notFound')}</p>
        <button type="button" className="btn" onClick={onBack}>{t('common.back')}</button>
      </div>
    )
  }

  return <Sheet character={character} party={party} userId={userId} apply={apply} undo={undo} undoTo={undoTo} redo={canRedo ? redo : undefined} log={log} onBack={onBack} onEdit={onEdit} onLevelUp={onLevelUp} />
}

/** The open sheet for the Familiar: its card, the live character, and the player's other characters by id. */
function sheetScreen(character: Character, apply: Apply): FamiliarScreen {
  return {
    context: { kind: 'character', characterId: character.id },
    card: characterCard(character),
    edition: rulesEdition(character),
    role: 'player',
    data: {
      character: () => character,
      getCharacter: async (id: string) => {
        const c = id === character.id ? character : await getCharacter(id)
        return c && c.ownerId === character.ownerId ? c : undefined
      },
      // A tapped Apply card goes through the sheet's own apply(), so it saves, syncs and shows in the change log.
      applyChange: p => applyOnSheet(p, apply, { applied: tr('familiar.log.applied'), undone: tr('familiar.log.undone') }),
    },
    chips: ['familiar.chip.explainFeatures', 'familiar.chip.combat', ...(character.spells?.length ? ['familiar.chip.spells'] : []), 'familiar.chip.nextLevel'],
  }
}

/** Someone else's sheet (the DM looking at a player's): nothing can be changed, and a tap that would says so. */
export interface ViewOnly {
  /** The player whose sheet this is. */
  playerName: string
  /** Set after a tap that would have changed the sheet, to call out the notice. */
  noticed: boolean
}

export function Sheet({ character, party, userId, apply, undo, undoTo, redo, log, onBack, onEdit, onLevelUp, viewOnly }: {
  character: Character
  party?: Party
  userId?: string
  apply: Apply
  undo: () => void
  undoTo: (id: number) => void
  redo?: () => void
  log: LogEntry[]
  onBack: () => void
  onEdit?: () => void
  onLevelUp?: () => void
  viewOnly?: ViewOnly
}) {
  const [mode, setMode] = useSheetMode(character.id)
  const narrow = useNarrow()
  const { t } = useI18n()
  const live = useLiveCombat(party?.id)
  const brings = bringsCharacter(party, userId ?? '', character.id)
  // The Map tab is new until opened; a combat that starts while the player is elsewhere on the sheet shows a notice.
  const [mapSeen, setMapSeen] = useState(false)
  const [wantTab, setWantTab] = useState<CombatTab | null>(null)
  const [notice, setNotice] = useState(false)
  const [hadLive, setHadLive] = useState(false)
  if (!!live !== hadLive) {
    setHadLive(!!live)
    setMapSeen(false)
    setNotice(!!live)
    if (!live) setWantTab(null)
  }
  const onPick = useCallback((tab: CombatTab) => { if (tab === 'map') { setMapSeen(true); setNotice(false) } }, [])
  const closeNotice = useCallback(() => setNotice(false), [])
  const openMap = useCallback(() => { setMode('combat'); setWantTab('map'); setNotice(false) }, [setMode])
  const layout = sheetLayout(mode, { dying: character.state.currentHp === 0, powerUp: canPowerUp(character), narrow, liveMap: !!live })
  const p = { character, apply }
  useFamiliarScreen(useMemo(() => (viewOnly ? null : sheetScreen(character, apply)), [character, apply, viewOnly]))
  const section = (s: SheetSection) => {
    switch (s) {
      case 'abilities': return <AbilitiesPanel key={s} character={character} />
      case 'spellCard': return <SpellsCard key={s} {...p} />
      case 'notes': return <Notes key={s} {...p} />
      case 'hp': return <HitPoints key={s} {...p} />
      case 'death': return <DeathSaves key={s} {...p} />
      case 'rests': return <Rests key={s} {...p} />
      case 'effects': return <EffectsCard key={s} {...p} />
      case 'attacks': return <Attacks key={s} {...p} />
      case 'spells': return <Spellbook key={s} {...p} />
      case 'inventory': return <Inventory key={s} {...p} />
      case 'resources': return <Resources key={s} {...p} />
      case 'metamagic': return <Metamagic key={s} {...p} />
      case 'supplies': return <Supplies key={s} {...p} />
      case 'history': return viewOnly ? null : <History key={s} log={log} onUndo={undo} onUndoTo={undoTo} onRedo={redo} />
      case 'summary': return <CharacterCard key={s} character={character} apply={apply} onLevelUp={onLevelUp} vitals={(layout.vitals ?? []).map(section)} />
      case 'skills': return <SkillsPanel key={s} character={character} />
      case 'tabs': return layout.tabs ? <CombatTabs key={s} tabs={layout.tabs} render={section} aside={narrow ? <HpChip character={character} /> : undefined} want={wantTab} onPick={onPick} badges={{ map: !!live && !mapSeen }} /> : null
      case 'map': return live ? <LiveMapTab key={s} live={live} character={character} brings={brings} /> : null
      case 'fight': return <Fight key={s} {...p} />
      case 'features': return <FeaturesTraits key={s} character={character} />
      case 'powerUp': return <PowerUpCard key={s} {...p} />
    }
  }
  return (
    <div className={`ff-sheet mode-${mode}${viewOnly ? ' view-only' : ''}`}>
      <Header character={character} onBack={onBack} onEdit={onEdit} familiar={!viewOnly} />
      {viewOnly && (
        <p className={`view-only-bar${viewOnly.noticed ? ' noticed' : ''}`} role="status">
          <span aria-hidden="true">👁</span> {t(viewOnly.noticed ? 'sheet.viewOnlyNotice' : 'sheet.viewOnly', { name: viewOnly.playerName })}
        </p>
      )}
      <ModeSwitch mode={mode} onChange={setMode} />
      {!viewOnly && <FirstTips />}
      {notice && live && (mode !== 'combat' || !mapSeen) && <CombatStartedNotice onOpen={openMap} onClose={closeNotice} />}
      {layout.top.map(section)}
      <div className="sheet-grid">
        {layout.columns.map((col, i) => col.length > 0 && <div key={i} className="col">{col.map(section)}</div>)}
      </div>
    </div>
  )
}

function ModeSwitch({ mode, onChange }: { mode: SheetMode; onChange: (m: SheetMode) => void }) {
  const { t } = useI18n()
  return (
    <div className="mode-switch-row">
      <div className="mode-switch" role="group" aria-label={t('sheet.mode')}>
        {(['story', 'combat'] as const).map(m => (
          <button key={m} type="button" className={`mode-btn${mode === m ? ' on' : ''}`} aria-pressed={mode === m} onClick={() => onChange(m)}>
            <span aria-hidden="true">{m === 'story' ? '📜' : '⚔️'}</span> {t(`sheet.mode.${m}`)}
          </button>
        ))}
      </div>
      <span className="hint">{t(mode === 'story' ? 'sheet.mode.storyHint' : 'sheet.mode.combatHint')}</span>
    </div>
  )
}

/** The character card below shows who the character is, so the header keeps only navigation, edit and export. */
function Header({ character, onBack, onEdit, familiar }: { character: Character; onBack: () => void; onEdit?: () => void; familiar?: boolean }) {
  const { t } = useI18n()
  return (
    <header className="sheet-header">
      <button type="button" className="btn ghost" onClick={onBack} aria-label={t('common.backToCharacters')}>{t('common.backArrow')}</button>
      <div className="who"><span className="sr-only">{character.name}</span></div>
      {familiar && <AskFamiliar label={t('familiar.askAbout', { name: character.name })} />}
      {onEdit && <button type="button" className="btn small" onClick={onEdit}>✎ {t('sheet.edit')}</button>}
      <ExportButton character={character} />
    </header>
  )
}

const timeOf = (at?: number) => (at ? new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '')

function History({ log, onUndo, onUndoTo, onRedo }: {
  log: LogEntry[]
  onUndo: () => void
  onUndoTo: (id: number) => void
  onRedo?: () => void
}) {
  const { t } = useI18n()
  return (
    <section className="card" aria-labelledby="log-title">
      <div className="card-head">
        <h2 id="log-title">{t('sheet.session')}</h2>
        <div>
          <button type="button" className="btn ghost small" disabled={!onRedo} onClick={onRedo}>{t('sheet.redo')}</button>
          <button type="button" className="btn ghost small" disabled={!log.length} onClick={onUndo}>
            {log[0] ? t('sheet.undoWhat', { what: log[0].text }) : t('sheet.undo')}
          </button>
        </div>
      </div>
      {log.length === 0
        ? <p className="hint">{t('sheet.logEmpty')}</p>
        : (
          <ol className="log">
            {log.map((e, i) => (
              <li key={e.id} className="log-entry">
                <span className="what">
                  {e.text}<time>{timeOf(e.at)}</time>
                  {e.changes && e.changes.length > 0 && <span className="diff">{e.changes.join(' · ')}</span>}
                </span>
                {i > 0 && (
                  <button type="button" className="btn ghost small" onClick={() => onUndoTo(e.id)}
                    aria-label={t('sheet.undoToLabel', { what: e.text, n: i + 1 })}>
                    {t('sheet.undoTo')}
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
    </section>
  )
}
