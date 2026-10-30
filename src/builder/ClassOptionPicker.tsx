// Picks from class option lists (Eldritch Invocations, 2014 Pact Boons). Prerequisites and counts only warn:
// the player may take anything, the way their DM allows.
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/locales/en'
import {
  allFeats, classOptions, optionIssues, optionKindsFor, rulesEdition, type ClassOption, type ClassOptionKind, type ClassOptionPick, type OptionIssue,
} from '../rules'
import type { StepProps } from './steps'
import { Fold, useFilter } from './Compact'
import { ExplainList, Why } from './Why'
import { explainKey, type WhyId } from './why'

const KIND_TOPIC: Partial<Record<ClassOptionKind, WhyId>> = { invocation: 'invocations', pactBoon: 'pactBoon' }

export function ClassOptionPicker({ draft, update, classId }: StepProps & { classId: string }) {
  return (
    <>
      {draft.classes.filter(cl => cl.classId === classId).flatMap(cl => optionKindsFor(draft, cl.classId).map(({ kind, count }) => (
        <OptionKind key={`${cl.classId}-${kind}`} draft={draft} update={update} classId={cl.classId} level={cl.level} kind={kind} count={count} />
      )))}
    </>
  )
}

/** One option list of one class, folded with its count; open while picks are missing. */
function OptionKind({ draft, update, classId, level, kind, count }: StepProps & { classId: string; level: number; kind: ClassOptionKind; count: number }) {
  const { t, term, className } = useI18n()
  const edition = rulesEdition(draft)
  const picks = draft.classOptions ?? []
  const setPicks = (next: ClassOptionPick[]) => update({ classOptions: next })
  const filter = useFilter(classOptions(kind, edition).length, t(`builder.opt.kind.${kind}` as MessageKey))
  const issueText = (issues: OptionIssue[]) => issues.map(i => (i.kind === 'level'
    ? t('builder.opt.needsLevel', { level: i.level })
    : t('builder.opt.needs', { names: i.names.map(n => term('feature', n, n)).join(', ') }))).join(' · ')

  const mine = picks.filter(p => p.kind === kind && (p.classId ?? classId) === classId)
  const list = classOptions(kind, edition).filter(o => !o.classIds || o.classIds.includes(classId))
  const toggle = (o: ClassOption) => {
    if (mine.some(p => p.id === o.id)) return setPicks(picks.filter(p => !(p.id === o.id && (p.classId ?? classId) === classId)))
    const pick: ClassOptionPick = { kind, id: o.id, classId, level }
    // A single pick (2014 Pact Boon) swaps instead of adding a second one.
    setPicks(count === 1 ? [...picks.filter(p => !mine.includes(p)), pick] : [...picks, pick])
  }
  const again = (o: ClassOption) => setPicks([...picks, { kind, id: o.id, classId, level }])
  const setChoice = (i: number, choice: string) => setPicks(picks.map(p => (p === mine[i] ? { ...p, choice } : p)))
  const remove = (i: number) => setPicks(picks.filter(p => p !== mine[i]))
  const topic = KIND_TOPIC[kind]
  const name = (o: ClassOption) => term('feature', o.name, o.name)
  return (
    <Fold defaultOpen={mine.length < count}
      title={<>{t(`builder.opt.kind.${kind}` as MessageKey)} ({className(classId)})</>}
      status={<span className={mine.length < count ? 'todo' : ''}>{t('builder.opt.count', { picked: mine.length, count })}</span>}
      why={topic && <Why id={topic} />}>
      {mine.length > count && <p className="small opt-count warn">{t('builder.opt.over')}</p>}
      {filter.field}
      <div className="row chip-scroll">
        {list.filter(o => mine.some(p => p.id === o.id) || filter.keep([name(o), o.name])).map(o => {
          const on = mine.some(p => p.id === o.id)
          const issues = optionIssues({ ...draft, classOptions: picks }, o, classId)
          const hint = [o.prerequisite && term('prereq', o.prerequisite, o.prerequisite), issueText(issues)].filter(Boolean).join(' · ')
          return (
            <button key={o.id} className={`glass-chip ${on ? 'on' : ''} ${issues.length && !on ? 'opt-off' : ''}`} title={hint || undefined} onClick={() => toggle(o)}>
              {name(o)}{issues.length > 0 && on ? ' ⚠' : ''}
            </button>
          )
        })}
      </div>
      <ExplainList items={mine.map(p => {
        const o = list.find(x => x.id === p.id)
        if (!o) return { name: p.id }
        const issues = optionIssues(draft, o, classId)
        const notes = [
          o.minLevel && !issues.some(i => i.kind === 'level') && t('builder.level', { level: o.minLevel }),
          o.prerequisite && term('prereq', o.prerequisite, o.prerequisite),
          issueText(issues),
          o.source && t('builder.opt.source', { source: o.source }),
        ].filter(Boolean)
        return { name: name(o), note: notes.join(' · '), key: explainKey('invocation', o.id), text: o.text }
      })} />
      {mine.map((p, i) => {
        const o = list.find(x => x.id === p.id)
        if (!o?.choiceKind && !o?.repeatable) return null
        return (
          <div className="row" key={`${p.id}-${i}`}>
            <span className="small strong">{name(o)}</span>
            {o.choiceKind === 'originFeat' && (
              <select aria-label={t('builder.opt.feat')} value={p.choice ?? ''} onChange={e => setChoice(i, e.target.value)}>
                <option value="">{t('builder.opt.feat')}</option>
                {allFeats(edition).filter(f => f.category === 'origin').map(f => <option key={f.id} value={f.id}>{term('feat', f.id, f.name)}</option>)}
              </select>
            )}
            {o.choiceKind === 'cantrip' && (
              <input aria-label={t('builder.opt.cantrip')} placeholder={t('builder.opt.cantripHint')} value={p.choice ?? ''} onChange={e => setChoice(i, e.target.value)} />
            )}
            {o.repeatable && <button className="glass-chip" onClick={() => again(o)}>{t('builder.opt.again')}</button>}
            {mine.filter(x => x.id === p.id).length > 1 && <button className="glass-chip" onClick={() => remove(i)}>{t('common.remove')}</button>}
          </div>
        )
      })}
      <p className="muted small">{t('builder.opt.swap')}</p>
    </Fold>
  )
}
