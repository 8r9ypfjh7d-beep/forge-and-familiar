import { ShowMath } from '../explain/ShowMath'
import { StatsCard } from '../explain/StatsCard'
import { useI18n } from '../i18n'
import type { Character } from '../model/character'
import { QuickCastBar } from '../quickcast'
import { derive, formatMod } from '../rules'
import { ReactionReminders } from '../reactions'
import { Attacks } from './components/Attacks'
import { Attunement } from './components/Attunement'
import { DEFAULT_THEME_ID, ThemePicker, useCharacterTheme } from '../themes'
import { Clock } from './components/Clock'
import { DeathSaves } from './components/DeathSaves'
import { Exhaustion } from './components/Exhaustion'
import { HitPoints } from './components/HitPoints'
import { Resources } from './components/Resources'
import { Rests } from './components/Rests'
import { SpellSlots } from './components/SpellSlots'
import { Spellbook } from '../spellbook'
import { Supplies } from '../supplies/Supplies'
import { TurnChecklist } from '../turn'
import type { Apply } from './types'
import { useLiveCharacter, type LogEntry } from './useLiveCharacter'
import { sheetLayout, useSheetMode, type SheetMode, type SheetSection } from './mode'
import { Identity, Notes, SocialSkills } from './components/Story'
import './sheet.css'

export function CharacterSheet({ characterId, onBack }: { characterId: string; onBack: () => void }) {
  const { character, apply, undo, undoTo, redo, canRedo, log } = useLiveCharacter(characterId)
  useCharacterTheme(character?.theme)
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

  return <Sheet character={character} apply={apply} undo={undo} undoTo={undoTo} redo={canRedo ? redo : undefined} log={log} onBack={onBack} />
}

function Sheet({ character, apply, undo, undoTo, redo, log, onBack }: {
  character: Character
  apply: Apply
  undo: () => void
  undoTo: (id: number) => void
  redo?: () => void
  log: LogEntry[]
  onBack: () => void
}) {
  const [mode, setMode] = useSheetMode(character.id)
  const layout = sheetLayout(mode, { dying: character.state.currentHp === 0 })
  const p = { character, apply }
  const section = (s: SheetSection) => {
    switch (s) {
      case 'quickcast': return <QuickCastBar key={s} {...p} />
      case 'identity': return <Identity key={s} character={character} />
      case 'social': return <SocialSkills key={s} character={character} />
      case 'notes': return <Notes key={s} {...p} />
      case 'inspiration': return <Attunement key={s} {...p} />
      case 'hp': return <HitPoints key={s} {...p} />
      case 'death': return <DeathSaves key={s} {...p} />
      case 'rests': return <Rests key={s} {...p} />
      case 'clock': return <Clock key={s} {...p} />
      case 'exhaustion': return <Exhaustion key={s} {...p} />
      case 'stats': return <StatsCard key={s} character={character} />
      case 'attacks': return <Attacks key={s} character={character} />
      case 'turn': return <TurnChecklist key={s} character={character} />
      case 'reactions': return <ReactionReminders key={s} {...p} />
      case 'slots': return <SpellSlots key={s} {...p} />
      case 'spells': return <Spellbook key={s} {...p} />
      case 'resources': return <Resources key={s} {...p} />
      case 'supplies': return <Supplies key={s} {...p} />
      case 'history': return <History key={s} log={log} onUndo={undo} onUndoTo={undoTo} onRedo={redo} />
    }
  }
  return (
    <div className={`ff-sheet mode-${mode}`}>
      <Header character={character} apply={apply} onBack={onBack} />
      <ModeSwitch mode={mode} onChange={setMode} />
      {layout.top.map(section)}
      <div className="sheet-grid">
        <div className="col">{layout.columns[0].map(section)}</div>
        <div className="col">{layout.columns[1].map(section)}</div>
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

function Header({ character, apply, onBack }: { character: Character; apply: Apply; onBack: () => void }) {
  const stats = derive(character)
  const { t, classLine } = useI18n()
  const classes = classLine(character.classes)
  return (
    <header className="sheet-header">
      <button type="button" className="btn ghost" onClick={onBack} aria-label={t('common.backToCharacters')}>{t('common.backArrow')}</button>
      {character.portrait
        ? <img className="portrait" src={character.portrait} alt="" />
        : <div className="portrait placeholder" aria-hidden="true">{character.name.slice(0, 1)}</div>}
      <div className="who">
        <h1>{character.name}</h1>
        <p>{classes}</p>
      </div>
      <dl className="quick-stats">
        <div><dt>{t('stat.ac')}</dt><dd><ShowMath character={character} stat="ac">{stats.armorClass.value}</ShowMath></dd></div>
        <div><dt>{t('stat.init')}</dt><dd><ShowMath character={character} stat="initiative">{formatMod(stats.initiative)}</ShowMath></dd></div>
        <div><dt>{t('stat.speed')}</dt><dd><ShowMath character={character} stat="speed">{stats.speed}</ShowMath></dd></div>
        <div><dt>{t('stat.prof')}</dt><dd><ShowMath character={character} stat="proficiency">{formatMod(stats.proficiencyBonus)}</ShowMath></dd></div>
      </dl>
      <ThemePicker
        value={character.theme}
        classId={character.classes[0]?.classId}
        onChange={(id, name) => apply(`Theme: ${name}`, c => ({ ...c, theme: id === DEFAULT_THEME_ID ? undefined : id }))}
      />
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
