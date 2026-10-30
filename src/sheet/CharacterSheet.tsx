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
import { sheetLayout, useNarrow, useSheetMode, type SheetMode, type SheetSection } from './mode'
import { Notes } from './components/Story'
import { AbilitiesPanel, CharacterCard, CombatTabs, FeaturesTraits, Fight, HpChip, SkillsPanel } from './combat/CombatPage'
import { canPowerUp, PowerUpCard } from '../powerup'
import './sheet.css'

export function CharacterSheet({ characterId, onBack, onEdit, onLevelUp }: { characterId: string; onBack: () => void; onEdit?: () => void; onLevelUp?: () => void }) {
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

  return <Sheet character={character} apply={apply} undo={undo} undoTo={undoTo} redo={canRedo ? redo : undefined} log={log} onBack={onBack} onEdit={onEdit} onLevelUp={onLevelUp} />
}

/** Someone else's sheet (the DM looking at a player's): nothing can be changed, and a tap that would says so. */
export interface ViewOnly {
  /** The player whose sheet this is. */
  playerName: string
  /** Set after a tap that would have changed the sheet, to call out the notice. */
  noticed: boolean
}

export function Sheet({ character, apply, undo, undoTo, redo, log, onBack, onEdit, onLevelUp, viewOnly }: {
  character: Character
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
  const layout = sheetLayout(mode, { dying: character.state.currentHp === 0, powerUp: canPowerUp(character), narrow })
  const p = { character, apply }
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
      case 'tabs': return layout.tabs ? <CombatTabs key={s} tabs={layout.tabs} render={section} aside={narrow ? <HpChip character={character} /> : undefined} /> : null
      case 'fight': return <Fight key={s} {...p} />
      case 'features': return <FeaturesTraits key={s} character={character} />
      case 'powerUp': return <PowerUpCard key={s} {...p} />
    }
  }
  return (
    <div className={`ff-sheet mode-${mode}${viewOnly ? ' view-only' : ''}`}>
      <Header character={character} onBack={onBack} onEdit={onEdit} />
      {viewOnly && (
        <p className={`view-only-bar${viewOnly.noticed ? ' noticed' : ''}`} role="status">
          <span aria-hidden="true">👁</span> {t(viewOnly.noticed ? 'sheet.viewOnlyNotice' : 'sheet.viewOnly', { name: viewOnly.playerName })}
        </p>
      )}
      <ModeSwitch mode={mode} onChange={setMode} />
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
function Header({ character, onBack, onEdit }: { character: Character; onBack: () => void; onEdit?: () => void }) {
  const { t } = useI18n()
  return (
    <header className="sheet-header">
      <button type="button" className="btn ghost" onClick={onBack} aria-label={t('common.backToCharacters')}>{t('common.backArrow')}</button>
      <div className="who"><span className="sr-only">{character.name}</span></div>
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
