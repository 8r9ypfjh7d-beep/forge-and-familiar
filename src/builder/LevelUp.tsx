import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import type { Character } from '../model/character'
import { addSnapshots, takeSnapshot } from '../portability'
import { addClassIssues, classById, classesFor, getSpellcastingByClass, hpRollKey, rulesEdition, totalLevel, type CharacterDraft } from '../rules'
import { getCharacter, saveCharacter } from '../storage'
import { useDice } from '../dice/ui'
import { ClassSkillPicks, WeaponMasteryPicks } from './ClassPicks'
import { Fold } from './Compact'
import { gainedLevel, levelGain, levelUpDraft, newImprovementSlots, newIssues, nextClass, withHpRoll, xpForLevelUp } from './levelup'
import { SpellsStep } from './SpellsStep'
import { ClassPicksFor, Improvements } from './steps'
import { ExplainList, Why } from './Why'
import { explainKey } from './why'
import './builder.css'

/** Loads the character, then shows only what the next level brings. Saving takes a snapshot first. */
export function LevelUp({ characterId, onDone }: { characterId: string; onDone: (id: string, saved: boolean) => void }) {
  const [character, setCharacter] = useState<Character | null | undefined>(undefined)
  const { t } = useI18n()
  useEffect(() => {
    getCharacter(characterId).then(c => setCharacter(c ?? null))
  }, [characterId])
  if (character === undefined) return <p className="muted">{t('common.loading')}</p>
  if (character === null || totalLevel(character) >= 20) {
    return (
      <div className="glass empty">
        <p>{t(character ? 'levelup.max' : 'common.notFound')}</p>
        <button className="glass-btn" onClick={() => onDone(characterId, false)}>{t('common.back')}</button>
      </div>
    )
  }
  return <LevelUpForm key={character.id} character={character} onDone={saved => onDone(character.id, saved)} />
}

function LevelUpForm({ character: c, onDone }: { character: Character; onDone: (saved: boolean) => void }) {
  const { t, term, className } = useI18n()
  const dice = useDice()
  const edition = rulesEdition(c)
  const planned = nextClass(c)
  const [classId, setClassId] = useState(planned.classId)
  const [draft, setDraft] = useState<CharacterDraft>(() => levelUpDraft(c, planned.classId))
  const [saving, setSaving] = useState(false)
  const update = (patch: Partial<CharacterDraft>) => setDraft(d => ({ ...d, ...patch }))
  const pickClass = (id: string) => {
    setClassId(id)
    setDraft(levelUpDraft(c, id))
  }

  const gained = gainedLevel(c, draft)
  const def = classById(classId, edition)
  const gain = useMemo(() => levelGain(c, draft), [c, draft])
  const issues = useMemo(() => newIssues(c, draft, t, term), [c, draft, t, term])
  const slots = newImprovementSlots(c, draft)
  const rolled = gained ? draft.hpRolls?.[hpRollKey(gained.classId, gained.level)] : undefined
  const average = def ? def.hitDie / 2 + 1 : 0
  const casts = getSpellcastingByClass(gain.after).length > 0
  const others = classesFor(edition).filter(x => !c.classes.some(cl => cl.classId === x.id))
  const multiclassIssues = c.classes.some(cl => cl.classId === classId) ? [] : addClassIssues(c, classId)
  const from = totalLevel(c)
  const xpNeeded = xpForLevelUp(c)

  const rollHp = () => {
    if (!def) return
    const r = dice.roll(`1d${def.hitDie}`, { label: t('levelup.hpRollLabel', { name: c.name }) })
    setDraft(d => withHpRoll(c, d, r.total))
  }
  const save = async () => {
    setSaving(true)
    await addSnapshots([takeSnapshot(c, t('levelup.snapshot', { level: from }))])
    await saveCharacter(gain.after)
    onDone(true)
  }

  return (
    <div className="builder levelup">
      <div className="edit-banner" role="note">
        <h2>{t('levelup.title', { name: c.name, from, to: from + 1 })}</h2>
        <p className="small">
          {t('levelup.intro')}
          {xpNeeded !== undefined && <> {t('levelup.xp', { xp: c.xp, next: xpNeeded })}</>}
        </p>
      </div>

      <section className="glass builder-step levelup-body">
        <div className="field">
          <label>{t('levelup.class')} <Why id="multiclass" /></label>
          <div className="row">
            {c.classes.map(cl => (
              <button key={cl.classId} type="button" className={`glass-chip ${classId === cl.classId ? 'on' : ''}`} aria-pressed={classId === cl.classId} onClick={() => pickClass(cl.classId)}>
                {t('levelup.classTo', { className: className(cl.classId), level: cl.level + 1 })}
              </button>
            ))}
            <select className="glass-field" aria-label={t('levelup.otherClass')} value={c.classes.some(cl => cl.classId === classId) ? '' : classId}
              onChange={e => e.target.value && pickClass(e.target.value)}>
              <option value="">{t('levelup.otherClass')}</option>
              {others.map(x => <option key={x.id} value={x.id}>{className(x.id)}</option>)}
            </select>
          </div>
          {planned.planned && classId === planned.classId && <p className="muted small">{t('levelup.fromPlan')}</p>}
          {multiclassIssues.length > 0 && (
            <ul className="step-warnings small" role="note">{multiclassIssues.map(m => <li key={m}>{m}</li>)}</ul>
          )}
        </div>

        {def && (
          <div className="field">
            <label>{t('levelup.hp')} <Why id="hitDie" /></label>
            <div className="glass-segmented" role="radiogroup" aria-label={t('levelup.hp')}>
              <button role="radio" aria-checked={rolled === undefined} onClick={() => setDraft(d => withHpRoll(c, d, undefined))}>
                {t('levelup.hpAverage', { n: average })}
              </button>
              <button role="radio" aria-checked={rolled !== undefined} onClick={rollHp}>
                🎲 {rolled === undefined ? t('levelup.hpRoll', { die: def.hitDie }) : t('levelup.hpRolled', { n: rolled })}
              </button>
            </div>
            <p className="small strong">{t('levelup.hpGain', { n: gain.hp })}</p>
          </div>
        )}

        <div className="field">
          <label>{t('levelup.new', { level: from + 1 })}</label>
          {gain.profUp && <p className="small">{t('levelup.profUp')}</p>}
          {gain.features.length > 0
            ? <ExplainList items={gain.features.map(f => ({ name: term('feature', f.name, f.name), note: f.className, key: explainKey('feature', f.name), text: f.text }))} />
            : <p className="muted small">{t('levelup.noFeatures')}</p>}
        </div>

        {gained && (
          <Fold title={t('levelup.classPicks', { className: className(gained.classId) })} defaultOpen={issues.some(i => i.step === 'class')}
            status={issues.some(i => i.step === 'class') ? <span className="todo">{t('levelup.toPick')}</span> : t('levelup.nothingNew')}>
            <ClassPicksFor draft={draft} update={update} classId={gained.classId} />
          </Fold>
        )}
        {slots.length > 0 && <Improvements draft={draft} update={update} only={slots} />}
        {issues.some(i => i.step === 'skills') && <ClassSkillPicks draft={draft} update={update} />}
        {issues.some(i => i.step === 'equipment') && <WeaponMasteryPicks draft={draft} update={update} />}
        {(casts || issues.some(i => i.step === 'spells')) && (
          <Fold title={t('builder.step.spells')} defaultOpen={def?.caster !== 'none' || issues.some(i => i.step === 'spells')}
            status={issues.some(i => i.step === 'spells') ? <span className="todo">{t('levelup.toPick')}</span> : t('levelup.spellsHint')}>
            <SpellsStep draft={draft} update={update} />
          </Fold>
        )}

        {issues.length > 0 && (
          <ul className="issues">{issues.map((m, i) => <li key={`${i}-${m.message}`}>{m.message}</li>)}</ul>
        )}
        <div className="builder-nav">
          <button className="glass-btn" onClick={() => onDone(false)}>{t('common.cancel')}</button>
          <button className="glass-btn prominent" disabled={issues.length > 0 || saving} onClick={save}>
            {t('levelup.save', { level: from + 1 })}
          </button>
        </div>
        <p className="muted small">{t('levelup.snapshotHint')}</p>
      </section>
    </div>
  )
}
