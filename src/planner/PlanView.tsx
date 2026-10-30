import { useCallback, useEffect, useMemo, useState } from 'react'
import { BUNDLED, loadKind, type Feature } from '../content'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/locales/en'
import type { Character, PlannedLevel } from '../model/character'
import {
  ABILITIES, CUSTOM_SUBCLASS, MAX_CHARACTER_LEVEL, allFeats, classById, classesFor, formatMod, prereqLabel, rulesEdition, subclassesFor, totalLevel,
  type Ability,
} from '../rules'
import { Markdown } from '../rulesqa/Markdown'
import { getCharacter, onCharactersChanged, saveCharacter } from '../storage'
import { fillWith, planAt, planSteps, setClass, setEntry, stepLibraryFeatures, topSlotLevel, type Need, type PlanStep } from './plan'
import './planner.css'

/** Class features with rules text from the content library, for the character's rules edition. Null while loading or offline. */
function useFeatures(edition: '2014' | '2024'): Feature[] | null {
  const [lib, setLib] = useState<{ edition: string; features: Feature[] } | null>(null)
  useEffect(() => {
    let live = true
    loadKind('features', { edition }).then(features => { if (live) setLib({ edition, features }) }, () => {})
    return () => { live = false }
  }, [edition])
  return lib?.edition === edition ? lib.features : null
}

const NEED_LABEL: Record<Need, MessageKey> = { subclass: 'plan.needSubclass', asi: 'plan.needAsi', abilityCap: 'plan.needCap' }

/** Plan a character's levels up to 20: the class of each level, subclass and ASI picks, and what each level brings. */
export function PlanView({ characterId, onBack }: { characterId: string; onBack: () => void }) {
  const [character, setCharacter] = useState<Character | null | undefined>(undefined)
  const { t, className, classLine } = useI18n()

  const load = useCallback(async () => setCharacter((await getCharacter(characterId)) ?? null), [characterId])
  useEffect(() => {
    load()
    return onCharactersChanged(id => { if (!id || id === characterId) load() })
  }, [characterId, load])

  const steps = useMemo(() => (character ? planSteps(character) : []), [character])
  const edition = character ? rulesEdition(character) : '2014'
  const library = useFeatures(edition)
  const source = BUNDLED.find(m => m.source.edition === edition)?.source

  if (character === undefined) return <p className="muted">{t('common.loading')}</p>
  if (character === null) {
    return (
      <section className="glass empty">
        <p>{t('common.notFound')}</p>
        <button type="button" className="glass-btn" onClick={onBack}>{t('common.back')}</button>
      </section>
    )
  }

  const save = (levelPlan: PlannedLevel[]) => {
    const next = { ...character, levelPlan }
    setCharacter(next)
    saveCharacter(next)
  }
  const level = totalLevel(character)
  const last = steps[steps.length - 1]

  return (
    <section className="ff-plan">
      <div className="row spread">
        <div>
          <h2 className="glass-title">{t('plan.title', { name: character.name })}</h2>
          <p className="muted">{t('plan.now', { classes: classLine(character.classes), level })}</p>
        </div>
        <button type="button" className="glass-btn" onClick={onBack}>{t('common.backArrow')} {t('common.back')}</button>
      </div>
      <p className="muted small plan-intro">{t('plan.intro')}</p>

      {level >= MAX_CHARACTER_LEVEL ? (
        <p className="glass plan-done">{t('plan.atMax')}</p>
      ) : (
        <>
          <PlanTools character={character} onFill={classId => save(fillWith(character, classId))} onClear={() => save([])} />
          <ol className="plan-steps">
            {steps.map(s => (
              <StepRow key={s.level} character={character} step={s} library={library} onChange={save} />
            ))}
          </ol>
          {last && <Summary character={character} step={last} />}
          {library && source && (
            <details className="plan-source small">
              <summary>{t('spells.source', { title: source.title })}</summary>
              <p lang="en" dir="ltr">{source.attribution}</p>
            </details>
          )}
        </>
      )}
      <p className="muted small">{t('plan.levelUpHint', { class: steps[0] ? className(steps[0].entry.classId) : '' })}</p>
    </section>
  )
}

function PlanTools({ character, onFill, onClear }: { character: Character; onFill: (classId: string) => void; onClear: () => void }) {
  const { t, className } = useI18n()
  const [classId, setClassId] = useState(character.classes[0]?.classId ?? '')
  const owned = character.classes.map(cl => cl.classId)
  return (
    <div className="glass plan-tools">
      <label className="small" htmlFor="plan-fill">{t('plan.fillLabel')}</label>
      <select id="plan-fill" className="glass-field" value={classId} onChange={e => setClassId(e.target.value)}>
        {owned.map(id => <option key={id} value={id}>{className(id)}</option>)}
      </select>
      <button type="button" className="glass-btn prominent" onClick={() => onFill(classId)}>{t('plan.fill')}</button>
      {!!character.levelPlan?.length && (
        <button type="button" className="glass-btn" onClick={() => confirm(t('plan.confirmClear')) && onClear()}>{t('plan.clear')}</button>
      )}
    </div>
  )
}

function StepRow({ character, step, library, onChange }: {
  character: Character
  step: PlanStep
  library: Feature[] | null
  onChange: (plan: PlannedLevel[]) => void
}) {
  const { t, term, className } = useI18n()
  const edition = rulesEdition(character)
  const def = classById(step.entry.classId, edition)
  const set = (patch: Partial<PlannedLevel>) => onChange(setEntry(character, { ...step.entry, ...patch }))
  const top = topSlotLevel(step.stats)
  const customName = character.customSubclasses?.find(s => s.classId === step.entry.classId)?.name
  return (
    <li className={`glass plan-step${step.issues.length ? ' blocked' : ''}`}>
      <div className="plan-head">
        <span className="plan-level" aria-label={t('plan.levelLabel', { level: step.level })}>{step.level}</span>
        <select
          className="glass-field"
          aria-label={t('plan.classFor', { level: step.level })}
          value={step.entry.classId}
          onChange={e => onChange(setClass(character, step.level, e.target.value))}
        >
          {classesFor(edition).map(c => <option key={c.id} value={c.id}>{className(c.id)}</option>)}
        </select>
        <strong className="plan-classlevel">{className(step.entry.classId)} {step.classLevel}</strong>
        {step.newClass && <span className="glass-chip small">{t('plan.newClass', { prereq: prereqLabel(step.entry.classId) })}</span>}
      </div>

      {step.issues.length > 0 && <p className="plan-issue small" role="alert">{step.issues.join(' ')}</p>}

      {step.subclassDue && def && (
        <label className="plan-pick small">
          <span>{term('feature', def.subclassTitle, def.subclassTitle)}</span>
          <select className="glass-field" value={step.entry.subclassId ?? step.subclassId ?? ''} onChange={e => set({ subclassId: e.target.value || undefined })}>
            <option value="">{t('plan.pickSubclass')}</option>
            {subclassesFor(step.entry.classId, edition).map(s => <option key={s.id} value={s.id}>{term('subclass', s.id, s.name)}</option>)}
            <option value={CUSTOM_SUBCLASS}>{customName || t('builder.customSubclass', { title: term('feature', def.subclassTitle, def.subclassTitle) })}</option>
          </select>
        </label>
      )}

      {step.asiDue && <AsiPick character={character} step={step} set={set} />}

      <ul className="plan-gains small">
        <li className="plan-num">{t('plan.hp', { gain: step.hpGain, total: step.stats.maxHp })}</li>
        {step.profUp && <li className="plan-num">{t('plan.prof', { bonus: formatMod(step.stats.proficiencyBonus) })}</li>}
        {step.newSlotLevel && <li>{t('plan.slot', { level: top })}</li>}
        {library
          ? stepLibraryFeatures(library, step).map(f => (
            <li key={f.id} className="plan-feature">
              <details>
                <summary>{term('feature', f.name, f.name)}</summary>
                <div lang="en" dir="ltr" className="plan-feature-text"><Markdown text={f.description} /></div>
              </details>
            </li>
          ))
          : step.features.map(f => <li key={`${f.className}-${f.name}`} className="plan-feature">{term('feature', f.name, f.name)}</li>)}
      </ul>

      {step.needs.length > 0 && (
        <p className="plan-needs small">{step.needs.map(n => t(NEED_LABEL[n])).join(' · ')}</p>
      )}
    </li>
  )
}

function AsiPick({ character, step, set }: { character: Character; step: PlanStep; set: (patch: Partial<PlannedLevel>) => void }) {
  const { t, term, ability } = useI18n()
  const feats = allFeats(rulesEdition(character)).filter(f => (f.minLevel ?? 0) <= step.level || f.id === step.entry.featId)
  const isFeat = step.entry.featId !== undefined
  const picks = ABILITIES.flatMap(a => Array<Ability>(step.entry.abilities?.[a] ?? 0).fill(a))
  const setPick = (i: number, a: Ability | '') => {
    const next: (Ability | undefined)[] = [picks[0], picks[1]]
    next[i] = a || undefined
    const abilities: Partial<Record<Ability, number>> = {}
    for (const x of next) if (x) abilities[x] = (abilities[x] ?? 0) + 1
    set({ abilities, featId: undefined })
  }
  const feat = isFeat ? feats.find(f => f.id === step.entry.featId) : undefined
  return (
    <div className="plan-pick small">
      <span>{t('plan.asi')}</span>
      <select
        className="glass-field"
        aria-label={t('builder.asi.kind')}
        value={isFeat ? 'feat' : 'asi'}
        onChange={e => set(e.target.value === 'feat' ? { featId: '', abilities: undefined } : { featId: undefined, abilities: {} })}
      >
        <option value="asi">{t('builder.asi.scores')}</option>
        <option value="feat">{t('builder.asi.feat')}</option>
      </select>
      {!isFeat && [0, 1].map(i => (
        <select key={i} className="glass-field" aria-label={t('builder.asi.plusOne')} value={picks[i] ?? ''} onChange={e => setPick(i, e.target.value as Ability | '')}>
          <option value="">+1 …</option>
          {ABILITIES.map(a => <option key={a} value={a}>+1 {ability(a)}</option>)}
        </select>
      ))}
      {isFeat && (
        <select className="glass-field" aria-label={t('builder.asi.feat')} value={step.entry.featId} onChange={e => set({ featId: e.target.value })}>
          <option value="">{t('builder.asi.pickFeat')}</option>
          {feats.map(f => <option key={f.id} value={f.id}>{term('feat', f.id, f.name)}</option>)}
        </select>
      )}
      {feat && <p className="muted plan-feat">{feat.description}</p>}
    </div>
  )
}

/** Where the plan ends up: level 20 stats. */
function Summary({ character, step }: { character: Character; step: PlanStep }) {
  const { t, classLine, abilityShort } = useI18n()
  const s = step.stats
  const top = topSlotLevel(s)
  const classes = classLine(planAt(character, step.level).classes)
  return (
    <section className="glass plan-summary" aria-labelledby="plan-summary-title">
      <h3 id="plan-summary-title">{t('plan.summary', { level: step.level })}</h3>
      <p className="muted small">{classes}</p>
      <dl className="plan-stats">
        <div><dt>{t('stat.hp')}</dt><dd>{s.maxHp}</dd></div>
        <div><dt>{t('stat.ac')}</dt><dd>{s.armorClass.value}</dd></div>
        <div><dt>{t('stat.prof')}</dt><dd dir="ltr">{formatMod(s.proficiencyBonus)}</dd></div>
        {s.spellcasting && <div><dt>{t('stat.spellDc')}</dt><dd>{s.spellcasting.saveDc}</dd></div>}
        {top > 0 && <div><dt>{t('plan.topSlot')}</dt><dd>{top}</dd></div>}
        {ABILITIES.map(a => <div key={a}><dt>{abilityShort(a)}</dt><dd>{s.abilities[a]}</dd></div>)}
      </dl>
      {s.feats.length > 0 && <p className="small">{t('plan.feats', { feats: s.feats.join(', ') })}</p>}
    </section>
  )
}
