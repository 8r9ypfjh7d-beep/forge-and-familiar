import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import type { Character } from '../model/character'
import { createCharacter, type CharacterDraft } from '../rules'
import { STEPS } from './steps'
import { stepIssues } from './validate'
import { Summary } from './Summary'
import { Why } from './Why'
import './builder.css'

export function emptyDraft(ownerId: string): CharacterDraft {
  return {
    ownerId,
    name: '',
    playerName: '',
    alignment: 'True Neutral',
    raceId: '',
    backgroundId: 'acolyte',
    classes: [],
    abilityMethod: 'standard',
    baseAbilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    freeAbilityBonuses: [],
    chosenSkills: [],
  }
}

export function Builder({ ownerId, onCreate, onCancel }: {
  ownerId: string
  onCreate: (c: Character) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<CharacterDraft>(() => emptyDraft(ownerId))
  const [step, setStep] = useState(0)
  const update = (patch: Partial<CharacterDraft>) => setDraft(d => ({ ...d, ...patch }))
  const { t } = useI18n()

  const issues = useMemo(() => STEPS.map(s => stepIssues(s.id, draft, t)), [draft, t])
  const firstBlocked = issues.findIndex(i => i.length > 0)
  const Current = STEPS[step].Component
  const isLast = step === STEPS.length - 1

  return (
    <div className="builder">
      <nav className="steps" aria-label={t('builder.steps')}>
        {STEPS.map((s, i) => {
          const reachable = firstBlocked === -1 || i <= firstBlocked
          return (
            <button
              key={s.id}
              className={`step ${i === step ? 'active' : ''} ${reachable && issues[i].length === 0 ? 'done' : ''}`}
              disabled={!reachable}
              aria-current={i === step ? 'step' : undefined}
              onClick={() => setStep(i)}
            >
              <span className="step-num">{i + 1}</span> {t(`builder.step.${s.id}`)}
            </button>
          )
        })}
      </nav>

      <div className="builder-body">
        <section className="panel builder-step">
          <h2>{t(`builder.step.${STEPS[step].id}`)}</h2>
          <p className="muted">{t(`builder.step.${STEPS[step].id}.blurb`)} <Why id={`step:${STEPS[step].id}`} /></p>
          <Current draft={draft} update={update} />
          {issues[step].length > 0 && (
            <ul className="issues">
              {issues[step].map(m => <li key={m}>{m}</li>)}
            </ul>
          )}
          <div className="builder-nav">
            <button className="btn ghost" onClick={step === 0 ? onCancel : () => setStep(step - 1)}>
              {step === 0 ? t('common.cancel') : t('builder.back')}
            </button>
            {isLast ? (
              <button className="btn primary" disabled={firstBlocked !== -1} onClick={() => onCreate(createCharacter(draft))}>
                {t('builder.create')}
              </button>
            ) : (
              <button className="btn primary" disabled={issues[step].length > 0} onClick={() => setStep(step + 1)}>
                {t('builder.next')}
              </button>
            )}
          </div>
        </section>
        <Summary draft={draft} />
      </div>
    </div>
  )
}
