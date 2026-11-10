import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { mayHaveSpells } from './SpellsStep'
import { stepIssues, stepWarnings, type StepId } from './validate'
import { Summary, SummaryPeek } from './Summary'
import { Why } from './Why'
import { draftCard } from '../familiar/context'
import type { FamiliarScreen } from '../familiar/screen'
import { AskFamiliar } from '../familiar/ui/AskFamiliar'
import { useFamiliarScreen } from '../familiar/ui/screen'
import { applyInBuilder } from '../familiar/changes'
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
function builderScreen(draft: CharacterDraft, step: StepId, update: (patch: Partial<CharacterDraft>) => void, characterId?: string): FamiliarScreen {
  return {
    context: { kind: 'builder', ...(characterId ? { characterId } : {}) },
    card: draftCard(draft, step),
    edition: rulesEdition(draft),
    role: 'player',
    // A tapped Apply card changes the draft as tapping that option on the step would (src/builder/picks.ts).
    data: { draft: () => draft, step: () => step, applyChange: p => applyInBuilder(p, draft, update) },
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
  const update = useCallback((patch: Partial<CharacterDraft>) => setDraft(d => {
    const next = { ...d, ...patch }
    return editing && patch.classes ? followPlan(editing, d, next) : next
  }), [editing])
  const { t, term } = useI18n()
  // 2024 calls the first step Species, picks the background with the abilities and leaves skills and languages for step 4.
  const is2024 = draft.rulesEdition === '2024'
  const stepName = (id: StepId) => t(is2024 && (id === 'race' || id === 'abilities' || id === 'skills') ? `builder.step.${id}2024` : `builder.step.${id}`)
  const stepsRef = useRef<HTMLElement>(null)
  // On phones the step bar is one swipeable row: keep the current step in view.
  useEffect(() => {
    stepsRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    setFurthest(f => Math.max(f, step))
  }, [step])

  const issues = useMemo(() => STEPS.map(s => stepIssues(s.id, draft, t, term)), [draft, t, term])
  // A character with no spells from class, race or feat skips the Spells step; it comes back when a pick adds some.
  const hasSpells = mayHaveSpells(draft)
  const shown = (i: number) => STEPS[i].id !== 'spells' || hasSpells || i === step
  const nextStep = (from: number) => { let i = from + 1; while (i < STEPS.length - 1 && !shown(i)) i++; return i }
  const prevStep = (from: number) => { let i = from - 1; while (i > 0 && !shown(i)) i--; return i }
  // Next on a step with missing picks first points at them; a second tap moves on (steps stay open in any order).
  const [nudged, setNudged] = useState<number | null>(null)
  const issuesRef = useRef<HTMLUListElement>(null)
  const next = () => {
    if (issues[step].length && nudged !== step) {
      setNudged(step)
      issuesRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
      return
    }
    setStep(nextStep(step))
  }
  const firstBlocked = issues.findIndex(i => i.length > 0)
  const warnings = useMemo(() => stepWarnings(STEPS[step].id, draft, t, term), [step, draft, t, term])
  const Current = STEPS[step].Component
  useFamiliarScreen(useMemo(() => builderScreen(draft, STEPS[step].id, update, editing?.id), [draft, step, update, editing?.id]))
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
      <nav className="steps" ref={stepsRef} aria-label={t('builder.steps')}>
        {STEPS.map((s, i) => {
          // Every step is open in any order; only creating or saving needs them all done.
          if (!shown(i)) return null
          return (
            <button
              key={s.id}
              className={`step ${i === step ? 'active' : ''} ${i <= furthest && issues[i].length === 0 ? 'done' : ''}`}
              aria-current={i === step ? 'step' : undefined}
              onClick={() => setStep(i)}
            >
              <span className="step-num">{STEPS.slice(0, i + 1).filter((_, j) => shown(j)).length}</span> {stepName(s.id)}
            </button>
          )
        })}
      </nav>

      <div className="builder-body">
        <div className="builder-main">
        <section className="glass builder-step">
          {/* One Familiar entry in the builder (the floating buttons are hidden here); Random sits beside it on the first step. */}
          <div className="step-head">
            <h2>{stepName(STEPS[step].id)}</h2>
            <div className="step-head-actions">
              {!editing && step === 0 && <RandomCharacter compact onRoll={rollRandom} ask={hasPicks(draft) && draft !== rolled} busy={rolling} />}
              <AskFamiliar label={t('familiar.askStep')} prompt={t('familiar.prompt.step', { step: stepName(STEPS[step].id) })} />
            </div>
          </div>
          <p className="muted">{t(is2024 && (STEPS[step].id === 'race' || STEPS[step].id === 'abilities' || STEPS[step].id === 'skills') ? `builder.step.${STEPS[step].id as 'race' | 'abilities' | 'skills'}.blurb2024` : `builder.step.${STEPS[step].id}.blurb`)}{' '}
            {/* Equipment: the kit sentence lives in the tip, so the step opens with one line. */}
            {STEPS[step].id === 'equipment'
              ? <Why title={t('why.kit.title')} text={`${t('builder.kitIntro')} ${t('why.kit.text')}`} />
              : <Why id={`step.${STEPS[step].id}`} />}</p>
          <Current draft={draft} update={update} editing={!!editing} />
          {!editing && STEPS[step].id === 'details' && <BackstoryHook hookKey={hookKey} setHookKey={setHookKey} />}
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
        </section>
        {/* Sticky at the bottom of the screen: missing picks, the phone summary line, Back and Next. */}
        <div className="builder-foot">
          {issues[step].length > 0 && (
            <ul className={`issues ${nudged === step ? 'nudged' : ''}`} ref={issuesRef} role={nudged === step ? 'alert' : undefined}>
              {issues[step].map((m, i) => <li key={`${i}-${m}`}>{m}</li>)}
            </ul>
          )}
          <SummaryPeek draft={draft} preview={preview} />
          <div className="builder-nav">
            {editing ? (
              <div className="row">
                {step > 0 && <button className="glass-btn" onClick={() => setStep(prevStep(step))}>{t('builder.back')}</button>}
                <button className="glass-btn" onClick={cancel}>{t('common.cancel')}</button>
              </div>
            ) : (
              <button className="glass-btn" onClick={step === 0 ? onCancel : () => setStep(prevStep(step))}>
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
        </div>
        </div>
        <div className="summary-side"><Summary draft={draft} preview={preview} /></div>
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

export { UnfinishedDraft } from './UnfinishedDraft'
