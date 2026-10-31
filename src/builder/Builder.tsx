import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import type { Character } from '../model/character'
import { addSnapshots, takeSnapshot } from '../portability'
import { BackstoryHook, RandomCharacter, hasPicks, randomCharacterDraft, randomHookKey } from '../random'
import { createCharacter, rulesEdition, type CharacterDraft } from '../rules'
import { followPlan } from '../planner/plan'
import { getCharacter, saveCharacter } from '../storage'
import type { MessageKey } from '../i18n'
import { applyEdit, draftFrom, startingGearChanged } from './edit'
import { ConfirmDialog } from './ConfirmDialog'
import { clearDraft, loadDraft, saveDraft } from './draftStore'
import { STEPS } from './steps'
import { stepIssues, stepWarnings, type StepId } from './validate'
import { Summary } from './Summary'
import { Why } from './Why'
import { draftCard } from '../familiar/context'
import type { FamiliarScreen } from '../familiar/screen'
import { AskFamiliar } from '../familiar/ui/AskFamiliar'
import { useFamiliarScreen } from '../familiar/ui/screen'
import './builder.css'

export function emptyDraft(ownerId: string, playerName = ''): CharacterDraft {
  return {
    ownerId,
    name: '',
    playerName,
    alignment: 'True Neutral',
    raceId: '',
    backgroundId: '',
    classes: [],
    abilityMethod: 'standard',
    baseAbilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    freeAbilityBonuses: [],
    chosenSkills: [],
  }
}

const STEP_CHIPS: Record<StepId, string[]> = {
  race: ['familiar.chip.fits'],
  class: ['familiar.chip.subclasses'],
  abilities: ['familiar.chip.feat'],
  skills: [],
  spells: ['familiar.chip.spells'],
  equipment: [],
  details: [],
}

/** The draft for the Familiar: its card, the draft itself and the step on screen for builder_options. */
function builderScreen(draft: CharacterDraft, step: StepId, characterId?: string): FamiliarScreen {
  return {
    context: { kind: 'builder', ...(characterId ? { characterId } : {}) },
    card: draftCard(draft, step),
    edition: rulesEdition(draft),
    role: 'player',
    data: { draft: () => draft, step: () => step },
    chips: [...STEP_CHIPS[step], 'familiar.chip.missing'],
  }
}

/**
 * Creates a character, or edits `editing` when given. onCreate gets the finished character either way.
 * A new character's unfinished draft is kept per player (draftStore) and picked up again next time.
 */
export function Builder({ ownerId, playerName = '', editing, onCreate, onCancel }: {
  ownerId: string
  /** The signed-in player's name, prefilled on new characters. */
  playerName?: string
  editing?: Character
  onCreate: (c: Character) => void
  onCancel: () => void
}) {
  const [initial] = useState<CharacterDraft>(() => (editing ? draftFrom(editing) : emptyDraft(ownerId, playerName)))
  const [resumed, setResumed] = useState(() => (editing ? undefined : loadDraft(ownerId)))
  const [draft, setDraft] = useState<CharacterDraft>(() => (resumed ? { ...resumed.draft, playerName: resumed.draft.playerName || playerName } : initial))
  const [step, setStep] = useState(() => Math.min(resumed?.step ?? 0, STEPS.length - 1))
  const [furthest, setFurthest] = useState(editing ? STEPS.length - 1 : 0)
  const [replaceGear, setReplaceGear] = useState(true)
  const [hookKey, setHookKey] = useState<string | undefined>(resumed?.hookKey)
  // In Edit, levels gained take the picks saved in the build planner.
  const update = (patch: Partial<CharacterDraft>) => setDraft(d => {
    const next = { ...d, ...patch }
    return editing && patch.classes ? followPlan(editing, d, next) : next
  })
  const { t, term } = useI18n()
  // 2024 calls the first step Species.
  const stepName = (id: StepId) => t(id === 'race' && draft.rulesEdition === '2024' ? 'builder.step.race2024' : `builder.step.${id}`)
  const stepsRef = useRef<HTMLElement>(null)
  // On phones the step bar is one swipeable row: keep the current step in view.
  useEffect(() => {
    stepsRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    setFurthest(f => Math.max(f, step))
  }, [step])

  const issues = useMemo(() => STEPS.map(s => stepIssues(s.id, draft, t, term)), [draft, t, term])
  // Next on a step with missing picks first points at them; a second tap moves on (steps stay open in any order).
  const [nudged, setNudged] = useState<number | null>(null)
  const issuesRef = useRef<HTMLUListElement>(null)
  const next = () => {
    if (issues[step].length && nudged !== step) {
      setNudged(step)
      issuesRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
      return
    }
    setStep(step + 1)
  }
  const firstBlocked = issues.findIndex(i => i.length > 0)
  const warnings = useMemo(() => stepWarnings(STEPS[step].id, draft, t, term), [step, draft, t, term])
  const Current = STEPS[step].Component
  useFamiliarScreen(useMemo(() => builderScreen(draft, STEPS[step].id, editing?.id), [draft, step, editing?.id]))
  const isLast = step === STEPS.length - 1
  const gearChanged = !!editing && startingGearChanged(editing, draft)
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial), [draft, initial])
  // Keep the unfinished new character, so a reload or the phone closing the app doesn't lose it.
  useEffect(() => {
    if (editing) return
    if (dirty) saveDraft({ draft, step, hookKey, savedAt: new Date().toISOString() })
    else clearDraft(ownerId)
  }, [editing, dirty, draft, step, hookKey, ownerId])
  const [asking, setAsking] = useState<'startOver' | 'discard'>()
  const startOver = () => {
    clearDraft(ownerId)
    setResumed(undefined)
    setDraft(initial)
    setHookKey(undefined)
    setStep(0)
  }
  const result = () => (editing
    ? applyEdit(editing, draft, { replaceGear: gearChanged && replaceGear })
    : { ...createCharacter(draft), notes: hookKey ? t(hookKey as MessageKey) : '' })
  // Fills every step at random, keeps the player's name and edition, and jumps to Details to review.
  // Spells come from the content library, so rolling waits for it. Rolling again over an untouched roll doesn't ask.
  const [rolling, setRolling] = useState(false)
  const [rolled, setRolled] = useState<CharacterDraft>()
  const rollRandom = async () => {
    setRolling(true)
    try {
      const next = { ...await randomCharacterDraft(ownerId, rulesEdition(draft)), playerName: draft.playerName }
      setDraft(next)
      setRolled(next)
      setHookKey(randomHookKey())
      setStep(STEPS.length - 1)
    } finally {
      setRolling(false)
    }
  }
  const preview = useMemo(
    () => (editing && firstBlocked === -1 ? applyEdit(editing, draft, { replaceGear: gearChanged && replaceGear }) : undefined),
    [editing, draft, firstBlocked, gearChanged, replaceGear],
  )
  const cancel = () => {
    if (!editing || !dirty) onCancel()
    else setAsking('discard')
  }

  return (
    <div className="builder">
      <ConfirmDialog
        open={!!asking}
        title={t(asking === 'discard' ? 'builder.edit.discard' : 'builder.draft.startOverConfirm')}
        yes={t(asking === 'discard' ? 'builder.draft.discard' : 'builder.draft.startOver')}
        onYes={asking === 'discard' ? onCancel : startOver}
        onClose={() => setAsking(undefined)}
      />
      {editing && (
        <div className="edit-banner" role="note">
          <h2>{t('builder.edit.title', { name: editing.name })}</h2>
          <p className="small">{t('builder.edit.intro')}</p>
        </div>
      )}
      {resumed && dirty && (
        <p className="draft-resumed small" role="status">
          {t('builder.draft.resumed')}{' '}
          <button className="glass-btn small" onClick={() => setAsking('startOver')}>{t('builder.draft.startOver')}</button>
        </p>
      )}
      {!editing && <RandomCharacter onRoll={rollRandom} ask={hasPicks(draft) && draft !== rolled} busy={rolling} />}
      <nav className="steps" ref={stepsRef} aria-label={t('builder.steps')}>
        {STEPS.map((s, i) => {
          // Every step is open in any order; only creating or saving needs them all done.
          return (
            <button
              key={s.id}
              className={`step ${i === step ? 'active' : ''} ${i <= furthest && issues[i].length === 0 ? 'done' : ''}`}
              aria-current={i === step ? 'step' : undefined}
              onClick={() => setStep(i)}
            >
              <span className="step-num">{i + 1}</span> {stepName(s.id)}
            </button>
          )
        })}
      </nav>

      <div className="builder-body">
        <section className="glass builder-step">
          <h2>{stepName(STEPS[step].id)}</h2>
          <p className="muted">{t(draft.rulesEdition === '2024' && (STEPS[step].id === 'race' || STEPS[step].id === 'abilities') ? `builder.step.${STEPS[step].id as 'race' | 'abilities'}.blurb2024` : `builder.step.${STEPS[step].id}.blurb`)} <Why id={`step.${STEPS[step].id}`} /> <AskFamiliar compact label={t('familiar.askStep')} prompt={t('familiar.prompt.step', { step: stepName(STEPS[step].id) })} /></p>
          <Current draft={draft} update={update} editing={!!editing} />
          {!editing && STEPS[step].id === 'details' && <BackstoryHook hookKey={hookKey} setHookKey={setHookKey} />}
          {issues[step].length > 0 && (
            <ul className={`issues ${nudged === step ? 'nudged' : ''}`} ref={issuesRef} role={nudged === step ? 'alert' : undefined}>
              {issues[step].map((m, i) => <li key={`${i}-${m}`}>{m}</li>)}
            </ul>
          )}
          {warnings.length > 0 && (
            <ul className="step-warnings small" role="note">
              {warnings.map(m => <li key={m}>{m}</li>)}
            </ul>
          )}
          {gearChanged && (STEPS[step].id === 'equipment' || isLast) && (
            <label className="gear-swap small">
              <input type="checkbox" checked={replaceGear} onChange={e => setReplaceGear(e.target.checked)} />
              <span>{t('builder.edit.swapGear')}</span>
            </label>
          )}
          {(editing || isLast) && firstBlocked !== -1 && firstBlocked !== step && (
            <p className="edit-blocked small">
              {t(editing ? 'builder.edit.blocked' : 'builder.blocked', { step: stepName(STEPS[firstBlocked].id) })}{' '}
              <button className="glass-btn small" onClick={() => setStep(firstBlocked)}>{t('builder.edit.goFix')}</button>
            </p>
          )}
          <div className="builder-nav">
            {editing ? (
              <div className="row">
                {step > 0 && <button className="glass-btn" onClick={() => setStep(step - 1)}>{t('builder.back')}</button>}
                <button className="glass-btn" onClick={cancel}>{t('common.cancel')}</button>
              </div>
            ) : (
              <button className="glass-btn" onClick={step === 0 ? onCancel : () => setStep(step - 1)}>
                {step === 0 ? t('common.cancel') : t('builder.back')}
              </button>
            )}
            <div className="row">
              {!isLast && (
                <button className={`glass-btn ${editing ? '' : 'prominent'}`} onClick={next}>
                  {t(nudged === step && issues[step].length ? 'builder.nextAnyway' : 'builder.next')}
                </button>
              )}
              {(isLast || editing) && (
                <button className="glass-btn prominent" disabled={firstBlocked !== -1 || (!!editing && !dirty)} onClick={() => { if (!editing) clearDraft(ownerId); onCreate(result()) }}>
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
      <div className="glass empty">
        <p>{t('common.notFound')}</p>
        <button className="glass-btn" onClick={onCancel}>{t('common.back')}</button>
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

/** Home and character list: offers the player's unfinished new character, if there is one. */
export function UnfinishedDraft({ ownerId, onContinue }: { ownerId: string; onContinue: () => void }) {
  const { t } = useI18n()
  const [saved, setSaved] = useState(() => loadDraft(ownerId))
  const [asking, setAsking] = useState(false)
  if (!saved) return null
  const discard = () => {
    clearDraft(ownerId)
    setSaved(undefined)
  }
  return (
    <div className="glass draft-banner" role="note">
      <span>{saved.draft.name.trim() ? t('builder.draft.unfinishedNamed', { name: saved.draft.name.trim() }) : t('builder.draft.unfinished')}</span>
      <span className="row">
        <button className="glass-btn small prominent" onClick={onContinue}>{t('builder.draft.continue')}</button>
        <button className="glass-btn small" onClick={() => setAsking(true)}>{t('builder.draft.discard')}</button>
      </span>
      <ConfirmDialog open={asking} title={t('builder.draft.discardConfirm')} yes={t('builder.draft.discard')} onYes={discard} onClose={() => setAsking(false)} />
    </div>
  )
}
