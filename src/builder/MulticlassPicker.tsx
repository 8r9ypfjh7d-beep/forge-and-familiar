import { useState } from 'react'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/locales/en'
import {
  ABILITIES, MAX_CHARACTER_LEVEL, MULTICLASS_PREREQS, MULTICLASS_PROFICIENCIES, MULTICLASS_PROFICIENCIES_2024, classesFor,
  getAbilityScores, getCasterLevel, meetsPrereq, rulesEdition, type Ability, type CharacterDraft, type RulesEdition,
} from '../rules'
import type { StepProps } from './steps'
import { Why } from './Why'

const scoresAssigned = (d: CharacterDraft) => ABILITIES.every(a => d.baseAbilities[a] > 0)

const OTHER_GRANTS: Record<string, MessageKey> = {
  'one musical instrument': 'builder.mc.grant.instrument',
  "thieves' tools": 'builder.mc.grant.thievesTools',
}

/** Optional extra classes after the first, with SRD prerequisites and caster-level math. */
export function MulticlassPicker({ draft, update }: StepProps) {
  const { t, className, abilityShort, item } = useI18n()
  const [open, setOpen] = useState(draft.classes.length > 1)
  const [first, ...extras] = draft.classes
  if (!first) return null
  const total = draft.classes.reduce((n, cl) => n + cl.level, 0)
  const edition: RulesEdition = rulesEdition(draft)
  const known = scoresAssigned(draft)
  const caster = getCasterLevel(draft)
  const scores = getAbilityScores(draft)
  // Missing minimums warn instead of blocking: plenty of tables allow it.
  const short = (classId: string) => known && !meetsPrereq(classId, scores)
  const setExtras = (next: typeof extras) => update({ classes: [first, ...next] })

  /** "STR 13 and CHA 13", "STR 13 or DEX 13", in the current language. */
  const prereq = (classId: string) => {
    const p = MULTICLASS_PREREQS[classId] ?? {}
    const fmt = (m: Partial<Record<Ability, number>>) => (Object.entries(m) as [Ability, number][]).map(([a, n]) => `${abilityShort(a)} ${n}`)
    return [fmt(p.all ?? {}).join(t('builder.mc.and')), fmt(p.any ?? {}).join(t('builder.mc.or'))].filter(Boolean).join(', ')
  }

  const grants = (classId: string) => {
    const g = (edition === '2024' ? MULTICLASS_PROFICIENCIES_2024 : MULTICLASS_PROFICIENCIES)[classId]
    if (!g) return ''
    const parts = [
      ...g.armor.map(a => t(`builder.mc.grant.${a}`)),
      ...g.weapons.map(w => t(`builder.mc.grant.${w}`)),
      ...(g.weaponIds ?? []).map(id => item(id, id)),
      ...(g.skills ? [t('builder.mc.grant.skill')] : []),
      ...(g.other ?? []).map(o => (OTHER_GRANTS[o] ? t(OTHER_GRANTS[o]) : o)),
    ]
    return parts.length ? parts.join(', ') : t('builder.mc.grant.none')
  }

  // Same math as getCasterLevel().explanation, built from translated pieces.
  const slotMath = caster.parts
    .map(p => (p.rounding
      ? t(p.rounding === 'up' ? 'builder.mc.halfUp' : 'builder.mc.halfDown', { className: className(p.classId), level: p.level })
      : `${className(p.classId)} ${p.level}`))
    .join(' + ')

  if (!open) {
    return <p className="multiclass-open"><button className="glass-btn" onClick={() => setOpen(true)}>{t('builder.mc.open')}</button> <Why id="multiclass" /></p>
  }

  const candidates = classesFor(edition).filter(c => !draft.classes.some(cl => cl.classId === c.id))

  return (
    <section className="multiclass" aria-label={t('builder.mc.title')}>
      <h3>{t('builder.mc.title')} <Why id="multiclass" /></h3>
      <p className="muted small">
        {t('builder.mc.intro', { className: className(first.classId), prereq: prereq(first.classId) })}
        {!known && <> {t('builder.mc.scoresLater')}</>}
      </p>
      {extras.length > 0 && draft.classes.filter(cl => short(cl.classId)).map(cl => (
        <p key={cl.classId} className="small multiclass-warn" role="note">{t('builder.mc.unmet', { className: className(cl.classId), prereq: prereq(cl.classId) })}</p>
      ))}
      {extras.map((cl, i) => {
        const name = className(cl.classId)
        const others = total - cl.level
        return (
          <div key={cl.classId} className="multiclass-row">
            <strong>{name}</strong>
            <select
              aria-label={t('builder.mc.levelOf', { className: name })}
              value={cl.level}
              onChange={e => setExtras(extras.map((x, j) => (j === i ? { ...x, level: Number(e.target.value) } : x)))}
            >
              {Array.from({ length: Math.max(1, MAX_CHARACTER_LEVEL - others) }, (_, l) => l + 1).map(l => <option key={l} value={l}>{t('builder.level', { level: l })}</option>)}
            </select>
            <span className="muted small">{t('builder.mc.gains', { list: grants(cl.classId) })}</span>
            <button className="glass-btn icon" onClick={() => setExtras(extras.filter((_, j) => j !== i))} aria-label={t('builder.mc.remove', { className: name })}>✕</button>
          </div>
        )
      })}
      {total < MAX_CHARACTER_LEVEL && (
        <div className="multiclass-add">
          {candidates.map(c => {
            const warn = short(c.id)
            return (
              <button
                key={c.id}
                className={`glass-chip ${warn ? 'short' : ''}`}
                title={t(warn ? 'builder.mc.blocked' : 'builder.mc.hint', { className: className(c.id), prereq: prereq(c.id), list: grants(c.id) })}
                onClick={() => setExtras([...extras, { classId: c.id, level: 1 }])}
              >
                + {className(c.id)} <span className="muted small">{warn && '⚠ '}{prereq(c.id)}</span>
              </button>
            )
          })}
        </div>
      )}
      <p className="small">
        <strong>{t('builder.mc.total')}</strong> {total} / {MAX_CHARACTER_LEVEL}
        {caster.parts.length > 0 && <><br /><strong>{t('builder.mc.slots')}</strong> {t('builder.mc.casterLevel', { math: slotMath, level: caster.casterLevel })}</>}
      </p>
      <p className="muted small">{t('builder.mc.firstOnly', { className: className(first.classId) })}</p>
    </section>
  )
}
