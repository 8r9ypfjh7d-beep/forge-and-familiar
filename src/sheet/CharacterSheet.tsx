import { ShowMath } from '../explain/ShowMath'
import { StatsCard } from '../explain/StatsCard'
import { useI18n } from '../i18n'
import type { Character } from '../model/character'
import { QuickCastBar } from '../quickcast'
import { derive, formatMod } from '../rules'
import { ReactionReminders } from '../reactions'
import { Attunement } from './components/Attunement'
import { DEFAULT_THEME_ID, ThemePicker, useCharacterTheme } from '../themes'
import { Clock } from './components/Clock'
import { DeathSaves } from './components/DeathSaves'
import { Exhaustion } from './components/Exhaustion'
import { HitPoints } from './components/HitPoints'
import { Resources } from './components/Resources'
import { Rests } from './components/Rests'
import { SpellSlots } from './components/SpellSlots'
import { Supplies } from '../supplies/Supplies'
import { TurnChecklist } from '../turn'
import type { Apply } from './types'
import { useLiveCharacter, type LogEntry } from './useLiveCharacter'
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

  const showDeath = character.state.currentHp === 0
  return (
    <div className="ff-sheet">
      <Header character={character} apply={apply} onBack={onBack} />
      <QuickCastBar character={character} apply={apply} />
      <div className="sheet-grid">
        <div className="col">
          <HitPoints character={character} apply={apply} />
          {showDeath && <DeathSaves character={character} apply={apply} />}
          <Rests character={character} apply={apply} />
          <Clock character={character} apply={apply} />
          <Exhaustion character={character} apply={apply} />
          <Attunement character={character} apply={apply} />
          <StatsCard character={character} />
        </div>
        <div className="col">
          <TurnChecklist character={character} />
          <ReactionReminders character={character} apply={apply} />
          <SpellSlots character={character} apply={apply} />
          <Resources character={character} apply={apply} />
          <Supplies character={character} apply={apply} />
          <History log={log} onUndo={undo} onUndoTo={undoTo} onRedo={canRedo ? redo : undefined} />
        </div>
      </div>
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
