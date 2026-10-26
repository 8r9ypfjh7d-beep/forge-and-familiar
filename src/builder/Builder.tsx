import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import type { Character } from '../model/character'
import { addSnapshots, takeSnapshot } from '../portability'
import { createCharacter, type CharacterDraft } from '../rules'
import { getCharacter, saveCharacter } from '../storage'
import { applyEdit, draftFrom, startingGearChanged } from './edit'
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

/** Creates a character, or edits `editing` when given. onCreate gets the finished character either way. */
export function Builder({ ownerId, editing, onCreate, onCancel }: {
  ownerId: string
  editing?: Character
  onCreate: (c: Character) => void
  onCancel: () => void
}) {
  const [initial] = useState<CharacterDraft>(() => (editing ? draftFrom(editing) : emptyDraft(ownerId)))
  const [draft, setDraft] = useState<CharacterDraft>(initial)
  const [step, setStep] = useState(0)
  const [replaceGear, setReplaceGear] = useState(true)
  const update = (patch: Partial<CharacterDraft>) => setDraft(d => ({ ...d, ...patch }))
  const { t } = useI18n()

  const issues = useMemo(() => STEPS.map(s => stepIssues(s.id, draft, t)), [draft, t])
  const firstBlocked = issues.findIndex(i => i.length > 0)
  const Current = STEPS[step].Component
  const isLast = step === STEPS.length - 1
  const gearChanged = !!editing && startingGearChanged(editing, draft)
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial), [draft, initial])
  const result = () => (editing ? applyEdit(editing, draft, { replaceGear: gearChanged && replaceGear }) : createCharacter(draft))
  const preview = useMemo(
    () => (editing && firstBlocked === -1 ? applyEdit(editing, draft, { replaceGear: gearChanged && replaceGear }) : undefined),
    [editing, draft, firstBlocked, gearChanged, replaceGear],
  )
  const cancel = () => {
    if (!editing || !dirty || confirm(t('builder.edit.discard'))) onCancel()
  }

  return (
    <div className="builder">
      {editing && (
        <div className="edit-banner" role="note">
          <h2>{t('builder.edit.title', { name: editing.name })}</h2>
          <p className="small">{t('builder.edit.intro')}</p>
        </div>
      )}
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
          <p className="muted">{t(draft.rulesEdition === '2024' && (STEPS[step].id === 'race' || STEPS[step].id === 'abilities') ? `builder.step.${STEPS[step].id as 'race' | 'abilities'}.blurb2024` : `builder.step.${STEPS[step].id}.blurb`)} <Why id={`step.${STEPS[step].id}`} /></p>
          <Current draft={draft} update={update} />
          {issues[step].length > 0 && (
            <ul className="issues">
              {issues[step].map(m => <li key={m}>{m}</li>)}
            </ul>
          )}
          {gearChanged && (STEPS[step].id === 'equipment' || isLast) && (
            <label className="gear-swap small">
              <input type="checkbox" checked={replaceGear} onChange={e => setReplaceGear(e.target.checked)} />
              <span>{t('builder.edit.swapGear')}</span>
            </label>
          )}
          {editing && firstBlocked !== -1 && firstBlocked !== step && (
            <p className="edit-blocked small">
              {t('builder.edit.blocked', { step: t(`builder.step.${STEPS[firstBlocked].id}`) })}{' '}
              <button className="btn ghost small" onClick={() => setStep(firstBlocked)}>{t('builder.edit.goFix')}</button>
            </p>
          )}
          <div className="builder-nav">
            {editing ? (
              <div className="row">
                {step > 0 && <button className="btn ghost" onClick={() => setStep(step - 1)}>{t('builder.back')}</button>}
                <button className="btn ghost" onClick={cancel}>{t('common.cancel')}</button>
              </div>
            ) : (
              <button className="btn ghost" onClick={step === 0 ? onCancel : () => setStep(step - 1)}>
                {step === 0 ? t('common.cancel') : t('builder.back')}
              </button>
            )}
            <div className="row">
              {!isLast && (
                <button className={`btn ${editing ? '' : 'primary'}`} disabled={issues[step].length > 0} onClick={() => setStep(step + 1)}>
                  {t('builder.next')}
                </button>
              )}
              {(isLast || editing) && (
                <button className="btn primary" disabled={firstBlocked !== -1 || (!!editing && !dirty)} onClick={() => onCreate(result())}>
                  {editing ? t('builder.edit.save') : t('builder.create')}
                </button>
              )}
            </div>
          </div>
        </section>
        <Summary draft={draft} preview={preview} />
      </div>
    </div>
  )
}

/** Loads a saved character into the builder. Saving takes a level snapshot first, so the edit can be rolled back. */
export function EditCharacter({ characterId, onSaved, onCancel }: {
  characterId: string
  onSaved: (id: string) => void
  onCancel: () => void
}) {
  const [character, setCharacter] = useState<Character | null | undefined>(undefined)
  const { t } = useI18n()
  useEffect(() => {
    getCharacter(characterId).then(c => setCharacter(c ?? null))
  }, [characterId])

  if (character === undefined) return <p className="muted">{t('common.loading')}</p>
  if (character === null) {
    return (
      <div className="panel empty">
        <p>{t('common.notFound')}</p>
        <button className="btn" onClick={onCancel}>{t('common.back')}</button>
      </div>
    )
  }
  return (
    <Builder
      key={character.id}
      ownerId={character.ownerId}
      editing={character}
      onCancel={onCancel}
      onCreate={async edited => {
        await addSnapshots([takeSnapshot(character, t('builder.edit.snapshot'))])
        const saved = await saveCharacter(edited)
        onSaved(saved.id)
      }}
    />
  )
}
