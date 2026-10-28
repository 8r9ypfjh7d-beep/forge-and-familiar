import type { ComponentType } from 'react'
import { useI18n } from '../i18n'
import type { AbilityMethod } from '../model/character'
import type { CustomBackground, Improvement } from '../model/character'
import {
  ABILITIES, ALIGNMENTS, ALL_SKILLS, CUSTOM_BACKGROUND, LANGUAGES, POINT_BUY_BUDGET, SKILLS, TOOLS,
  STANDARD_ARRAY, abilityMod, allFeats, featAbilityChoices, allRaces, anyFilter, anyOptions, backgroundsFor, choiceKey, classById, classChoices, classesFor,
  featById, fixedLanguages, fixedTools, formatMod, getAbilityScores, getBackground, improvementBonuses, improvementSlots, itemById,
  languagePickCount, pointBuyCost, raceById, racialBonuses, rulesEdition, startingGold, startingItemIds, subclassesFor, toolPickGroups,
  type Ability, type CharacterDraft, type RulesEdition, type SkillId,
} from '../rules'
import { MulticlassPicker } from './MulticlassPicker'
import { grantedSkills, skillPicks, subclassSlots, type StepId } from './validate'
import { Why } from './Why'
import { pitchKey } from './why'

export interface StepProps {
  draft: CharacterDraft
  update: (patch: Partial<CharacterDraft>) => void
}

const bonusText = (b: Partial<Record<Ability, number>>, short: (a: Ability) => string) =>
  Object.entries(b).map(([a, v]) => `${short(a as Ability)} ${formatMod(v!)}`).join(', ')

// ---------- Race ----------

/** Everything that depends on the edition's content. Switching rules clears it; classes keep their levels. */
function switchEdition(draft: CharacterDraft, edition: RulesEdition): Partial<CharacterDraft> {
  return {
    rulesEdition: edition === '2024' ? '2024' : undefined,
    // Spells follow the rules edition again.
    spellEdition: undefined,
    raceId: '', subraceId: undefined, freeAbilityBonuses: [], chosenSkills: [], chosenLanguages: [], chosenTools: [], traitChoices: {},
    backgroundId: 'acolyte', originFeatId: undefined, featureChoices: {}, improvements: [], equipmentPicks: [],
    classes: draft.classes.map(cl => ({ classId: cl.classId, level: cl.level })),
  }
}

/** 2014 (SRD 5.1) or 2024 (SRD 5.2) rules for this character. */
function EditionPicker({ draft, update }: StepProps) {
  const { t } = useI18n()
  const edition = rulesEdition(draft)
  return (
    <div className="field edition-pick">
      <label>{t('builder.edition')} <Why id="edition" /></label>
      <div className="glass-segmented" role="radiogroup" aria-label={t('builder.edition')}>
        {(['2014', '2024'] as const).map(e => (
          <button
            key={e}
            role="radio"
            aria-checked={edition === e}
            onClick={() => edition !== e && update(switchEdition(draft, e))}
          >
            {t(`builder.edition.${e}`)}
          </button>
        ))}
      </div>
      <p className="muted small">{t(`builder.edition.${edition}.hint`)}</p>
    </div>
  )
}

function RaceStep({ draft, update }: StepProps) {
  const edition = rulesEdition(draft)
  const race = raceById(draft.raceId, edition)
  const { t, term, abilityShort } = useI18n()
  const racePitch = race && pitchKey(edition === '2024' ? 'race2024' : 'race', race.id)
  const subBonus = (b: Partial<Record<Ability, number>>) => (Object.keys(b).length ? ` (${bonusText(b, abilityShort)})` : '')
  const originFeats = allFeats(edition).filter(f => f.category === 'origin')
  return (
    <>
      <EditionPicker draft={draft} update={update} />
      <div className="card-grid">
        {allRaces(edition).map(r => (
          <button
            key={r.id}
            className={`choice ${draft.raceId === r.id ? 'selected' : ''}`}
            onClick={() => update({ raceId: r.id, subraceId: r.subraces?.[0]?.id, freeAbilityBonuses: edition === '2024' ? draft.freeAbilityBonuses : [], chosenSkills: [], chosenLanguages: [], chosenTools: [], traitChoices: {}, originFeatId: undefined })}
          >
            <strong>{term('race', r.id, r.name)}</strong>
            <span className="muted small">
              {edition === '2024' ? t('builder.race.noBonus') : bonusText(r.abilityBonuses, abilityShort)}
              {r.freeAbilityBonuses ? t('builder.race.freeBonus', { count: r.freeAbilityBonuses.count }) : ''}
            </span>
            <span className="muted small">{t('builder.race.sizeSpeed', { size: term('size', r.size, r.size), speed: r.speed })}</span>
          </button>
        ))}
      </div>
      {race?.subraces && (
        <div className="field">
          <label>{t(edition === '2024' ? 'builder.lineage' : 'builder.subrace')} <Why id="subrace" /></label>
          <div className="row">
            {race.subraces.map(s => (
              <button key={s.id} className={`glass-chip ${draft.subraceId === s.id ? 'on' : ''}`} onClick={() => update({ subraceId: s.id, chosenLanguages: [] })}>
                {term('race', s.id, s.name)}{subBonus(s.abilityBonuses)}
              </button>
            ))}
          </div>
        </div>
      )}
      {race?.originFeatChoice && (
        <div className="field">
          <label htmlFor="origin-feat">{t('builder.originFeat')} <Why id="originFeat" /></label>
          <select id="origin-feat" value={draft.originFeatId ?? ''} onChange={e => update({ originFeatId: e.target.value || undefined, chosenSkills: [] })}>
            <option value="">{t('builder.asi.pickFeat')}</option>
            {originFeats.map(f => <option key={f.id} value={f.id}>{term('feat', f.id, f.name)}</option>)}
          </select>
          {(() => {
            const f = featById(draft.originFeatId ?? '', edition)
            return f && <p className="muted small">{f.description}</p>
          })()}
        </div>
      )}
      {race?.traitChoice && (
        <div className="field">
          <label>{term('trait', race.traitChoice.name, race.traitChoice.name)}</label>
          <div className="row">
            {race.traitChoice.options.map(o => (
              <button
                key={o.id}
                className={`glass-chip ${draft.traitChoices?.[race.traitChoice!.id] === o.id ? 'on' : ''}`}
                title={o.detail}
                onClick={() => update({ traitChoices: { ...draft.traitChoices, [race.traitChoice!.id]: o.id } })}
              >
                {o.name}
              </button>
            ))}
          </div>
          {(() => {
            const o = race.traitChoice.options.find(x => x.id === draft.traitChoices?.[race.traitChoice!.id])
            return o && <p className="muted small" dir="auto">{o.detail}</p>
          })()}
        </div>
      )}
      <p className="muted small">{t('builder.race.homebrewHint')}</p>
      {race && (
        <p className="small">
          {racePitch && <><strong>{t('why.pick', { name: term('race', race.id, race.name) })}</strong> {t(racePitch)}<br /></>}
          <strong>{t('builder.traits')}</strong><Why id="traits" /> {[...race.traits, ...(race.subraces?.find(s => s.id === draft.subraceId)?.traits ?? [])].map(x => term('trait', x, x)).join(', ') || t('common.none')}
          <br />
          <strong>{t('builder.languages')}</strong><Why id="languages" />{' '}
          {edition === '2024' ? t('builder.languages2024') : race.languages.map(x => term('language', x, x)).join(', ')}
          {languagePickCount({ ...draft, backgroundId: '' }) > 0 && <> {t('builder.languagesPlus', { count: languagePickCount({ ...draft, backgroundId: '' }) })}</>}
        </p>
      )}
    </>
  )
}

// ---------- Class ----------

function ClassStep({ draft, update }: StepProps) {
  const edition = rulesEdition(draft)
  const current = draft.classes[0]
  const cls = classById(current?.classId ?? '', edition)
  const level = current?.level ?? 1
  const extras = draft.classes.slice(1)
  const extraLevels = extras.reduce((n, cl) => n + cl.level, 0)
  const { t, term, ability, abilityShort, className, item } = useI18n()
  const classPitch = cls && pitchKey('class', cls.id)
  return (
    <>
      <div className="card-grid">
        {classesFor(edition).map(c => (
          <button
            key={c.id}
            className={`choice ${current?.classId === c.id ? 'selected' : ''}`}
            onClick={() => update({ classes: [{ classId: c.id, level }, ...extras.filter(x => x.classId !== c.id)], chosenSkills: [], chosenTools: [], equipmentPicks: [], improvements: [], featureChoices: {} })}
          >
            <strong>{className(c.id)}</strong>
            <span className="muted small">{t('builder.class.hitDie', { die: c.hitDie, primary: c.primary.map(abilityShort).join('/') })}</span>
            <span className="muted small">{t(c.caster === 'none' ? 'builder.class.noCasting' : c.caster === 'pact' ? 'builder.class.pact' : c.caster === 'full' ? 'builder.class.full' : 'builder.class.half')}</span>
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="level">{t('builder.startLevel')} <Why id="level" /></label>
        <select
          id="level"
          value={level}
          disabled={!cls}
          onChange={e => update({ classes: [{ ...current!, level: Number(e.target.value) }, ...extras] })}
        >
          {Array.from({ length: Math.max(1, 20 - extraLevels) }, (_, i) => i + 1).map(l => <option key={l} value={l}>{t('builder.level', { level: l })}</option>)}
        </select>
      </div>
      {cls && (
        <p className="small">
          {classPitch && <><strong>{t('why.pick', { name: className(cls.id) })}</strong> {t(classPitch)}<br /></>}
          <strong>{t('builder.savingThrows')}</strong><Why id="savingThrows" /> {cls.savingThrows.map(ability).join(', ')}
          <br />
          <strong>{t('builder.armor')}</strong><Why id="proficiencies" /> {cls.armor.length ? cls.armor.map(a => term('armor', a, a)).join(', ') : t('common.noneLower')} · <strong>{t('builder.weapons')}</strong>{' '}
          {[...cls.weapons.map(w => term('weapons', w, w)), ...(cls.weaponIds ?? []).map(id => item(id, itemById(id)?.name ?? id))].join(', ') || t('common.noneLower')}
          <br />
          <strong>{t('builder.featuresTo', { level })}</strong><Why id="features" /> {cls.features.filter(f => f.level <= level).map(f => term('feature', f.name, f.name)).join(', ')}
        </p>
      )}
      {cls && <SubclassPicker draft={draft} update={update} />}
      {cls && <ClassChoices draft={draft} update={update} />}
      <MulticlassPicker draft={draft} update={update} />
    </>
  )
}

/** 2024 class picks: Fighting Style, Divine Order, Primal Order. */
function ClassChoices({ draft, update }: StepProps) {
  const { term, className } = useI18n()
  const list = classChoices(draft)
  if (list.length === 0) return null
  const pick = (classId: string, choiceId: string, optionId: string) =>
    update({ featureChoices: { ...draft.featureChoices, [choiceKey(classId, choiceId)]: optionId } })
  return (
    <>
      {list.map(({ classId, choice, picked }) => (
        <div className="field" key={choiceKey(classId, choice.id)}>
          <label>{term('feature', choice.name, choice.name)} ({className(classId)})</label>
          <div className="row">
            {choice.options.map(o => (
              <button key={o.id} className={`glass-chip ${picked?.id === o.id ? 'on' : ''}`} title={o.detail} onClick={() => pick(classId, choice.id, o.id)}>
                {o.featId ? term('feat', o.featId, o.name) : term('feature', o.name, o.name)}
              </button>
            ))}
          </div>
          {picked && <p className="muted small" dir="auto">{picked.detail}</p>}
        </div>
      ))}
    </>
  )
}

function SubclassPicker({ draft, update }: StepProps) {
  const { t, term, className } = useI18n()
  const edition = rulesEdition(draft)
  const first = draft.classes[0]
  const firstDef = classById(first.classId, edition)!
  const slots = subclassSlots(draft)
  const setSub = (classId: string, subclassId: string) =>
    update({ classes: draft.classes.map(cl => (cl.classId === classId ? { ...cl, subclassId } : cl)) })
  return (
    <>
      {first.level < firstDef.subclassLevel && (
        <p className="muted small">{t('builder.subclassLater', { title: term('feature', firstDef.subclassTitle, firstDef.subclassTitle), level: firstDef.subclassLevel })}</p>
      )}
      {slots.map(cl => {
        const def = classById(cl.classId, edition)!
        const picked = subclassesFor(cl.classId, edition).find(s => s.id === cl.subclassId)
        return (
          <div className="field" key={cl.classId}>
            <label>{t('builder.subclass', { title: term('feature', def.subclassTitle, def.subclassTitle), className: className(def.id) })}</label>
            <div className="row">
              {subclassesFor(cl.classId, edition).map(sc => (
                <button key={sc.id} className={`glass-chip ${cl.subclassId === sc.id ? 'on' : ''}`} onClick={() => setSub(cl.classId, sc.id)}>
                  {term('subclass', sc.id, sc.name)}
                </button>
              ))}
            </div>
            {picked && (
              <p className="muted small">
                {picked.features.filter(f => f.level <= cl.level).map(f => term('feature', f.name, f.name)).join(', ')}
              </p>
            )}
          </div>
        )
      })}
      {slots.length > 0 && <p className="muted small">{t('builder.subclassHint')}</p>}
    </>
  )
}

// ---------- Abilities ----------

const METHODS: AbilityMethod[] = ['standard', 'pointBuy', 'manual']

function suggestedArray(draft: CharacterDraft) {
  const cls = classById(draft.classes[0]?.classId ?? '', draft.rulesEdition)
  const order: Ability[] = [...(cls?.primary ?? []), 'con', 'dex', 'wis', 'str', 'cha', 'int']
  const unique = [...new Set(order)]
  const out = { ...draft.baseAbilities }
  unique.forEach((a, i) => { out[a] = STANDARD_ARRAY[i] })
  return out
}

function AbilitiesStep({ draft, update }: StepProps) {
  const edition = rulesEdition(draft)
  const race = raceById(draft.raceId, edition)
  const bonus = racialBonuses(draft)
  const asi = improvementBonuses(draft)
  for (const { ability: a } of featAbilityChoices(draft)) asi[a] += 1
  const hasAsi = improvementSlots(draft).length > 0
  const final = getAbilityScores(draft)
  const cost = pointBuyCost(draft.baseAbilities)
  const { t, ability } = useI18n()

  const setMethod = (m: AbilityMethod) => {
    const value = m === 'standard' ? 0 : m === 'pointBuy' ? 8 : 10
    update({ abilityMethod: m, baseAbilities: { str: value, dex: value, con: value, int: value, wis: value, cha: value } })
  }
  const setScore = (a: Ability, v: number) => update({ baseAbilities: { ...draft.baseAbilities, [a]: v } })
  const used = ABILITIES.map(a => draft.baseAbilities[a])

  const free = edition === '2014' ? race?.freeAbilityBonuses : undefined
  const toggleFree = (a: Ability) => {
    const has = draft.freeAbilityBonuses.includes(a)
    const next = has ? draft.freeAbilityBonuses.filter(x => x !== a) : [...draft.freeAbilityBonuses, a]
    if (free && next.length <= free.count) update({ freeAbilityBonuses: next })
  }

  return (
    <>
      <div className="row tabs">
        {METHODS.map(m => (
          <button key={m} className={`glass-chip ${draft.abilityMethod === m ? 'on' : ''}`} onClick={() => setMethod(m)}>{t(`builder.method.${m}`)}</button>
        ))}
        <Why id={`method.${draft.abilityMethod}`} />
        {draft.abilityMethod === 'standard' && (
          <button className="glass-btn small" onClick={() => update({ baseAbilities: suggestedArray(draft) })}>{t('builder.suggest')}</button>
        )}
        {draft.abilityMethod === 'standard' && <Why id="suggest" />}
      </div>
      {draft.abilityMethod === 'pointBuy' && (
        <p className={`small ${cost !== null && cost > POINT_BUY_BUDGET ? 'bad' : ''}`}>
          {t('builder.pointsSpent', { spent: cost ?? '—', budget: POINT_BUY_BUDGET })}
        </p>
      )}
      {edition === '2024' && <BackgroundBonuses draft={draft} update={update} />}
      <table className="ability-table">
        <thead>
          <tr><th>{t('builder.col.ability')}</th><th>{t('builder.col.base')}</th><th>{t(edition === '2024' ? 'builder.col.background' : 'builder.col.racial')}<Why id={edition === '2024' ? 'bgBonus' : 'racial'} compact /></th>{hasAsi && <th>{t('builder.col.asi')}</th>}<th>{t('builder.col.score')}</th><th>{t('builder.col.mod')}<Why id="modifier" compact /></th>{free && <th>+1<Why id="freeBonus" compact /></th>}</tr>
        </thead>
        <tbody>
          {ABILITIES.map(a => (
            <tr key={a}>
              <th scope="row">{ability(a)}</th>
              <td>
                {draft.abilityMethod === 'standard' && (
                  <select value={draft.baseAbilities[a]} onChange={e => setScore(a, Number(e.target.value))} aria-label={t('builder.baseOf', { ability: ability(a) })}>
                    <option value={0}>—</option>
                    {STANDARD_ARRAY.filter(v => v === draft.baseAbilities[a] || !used.includes(v)).map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                )}
                {draft.abilityMethod === 'pointBuy' && (
                  <span className="stepper">
                    <button className="glass-btn small" disabled={draft.baseAbilities[a] <= 8} onClick={() => setScore(a, draft.baseAbilities[a] - 1)} aria-label={t('builder.lower', { ability: ability(a) })}>−</button>
                    <span className="num">{draft.baseAbilities[a]}</span>
                    <button className="glass-btn small" disabled={draft.baseAbilities[a] >= 15} onClick={() => setScore(a, draft.baseAbilities[a] + 1)} aria-label={t('builder.raise', { ability: ability(a) })}>+</button>
                  </span>
                )}
                {draft.abilityMethod === 'manual' && (
                  <input type="number" min={3} max={20} value={draft.baseAbilities[a]} onChange={e => setScore(a, Number(e.target.value))} aria-label={t('builder.baseOf', { ability: ability(a) })} />
                )}
              </td>
              <td className="muted">{bonus[a] ? formatMod(bonus[a]) : ''}</td>
              {hasAsi && <td className="muted">{asi[a] ? formatMod(asi[a]) : ''}</td>}
              <td className="num strong">{draft.baseAbilities[a] ? final[a] : '—'}</td>
              <td className="num">{draft.baseAbilities[a] ? formatMod(abilityMod(final[a])) : ''}</td>
              {free && (
                <td>
                  <input
                    type="checkbox"
                    disabled={free.exclude.includes(a)}
                    checked={draft.freeAbilityBonuses.includes(a)}
                    onChange={() => toggleFree(a)}
                    aria-label={t('builder.racialPlusOne', { ability: ability(a) })}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <Improvements draft={draft} update={update} />
    </>
  )
}

/** 2024: pick the background here (it sets the bonuses), then +2/+1 or +1/+1/+1 among its three abilities. */
function BackgroundBonuses({ draft, update }: StepProps) {
  const { t, term, ability } = useI18n()
  const bg = getBackground(draft)
  const allowed = bg?.abilityScores ?? []
  const count = (a: Ability) => draft.freeAbilityBonuses.filter(x => x === a).length
  const set = (a: Ability, n: number) => {
    const rest = draft.freeAbilityBonuses.filter(x => x !== a && allowed.includes(x))
    update({ freeAbilityBonuses: [...rest, ...Array<Ability>(n).fill(a)].slice(0, 3) })
  }
  const total = draft.freeAbilityBonuses.length
  return (
    <div className="field bg-bonus">
      <label htmlFor="bg-abilities">{t('builder.background')} <Why id="background" /></label>
      <select id="bg-abilities" value={draft.backgroundId} onChange={e => update({ backgroundId: e.target.value, freeAbilityBonuses: [], chosenSkills: [], chosenLanguages: [], chosenTools: [] })}>
        {backgroundsFor('2024').map(b => <option key={b.id} value={b.id}>{term('background', b.id, b.name)}</option>)}
      </select>
      <p className="small">{t('builder.bgBonus.intro', { total })}</p>
      <div className="row">
        {allowed.map(a => (
          <span key={a} className="bg-bonus-pick">
            <span className="small">{ability(a)}</span>
            <select value={count(a)} aria-label={t('builder.bgBonus.of', { ability: ability(a) })} onChange={e => set(a, Number(e.target.value))}>
              {[0, 1, 2].map(n => <option key={n} value={n} disabled={n > 0 && total - count(a) + n > 3}>{n ? `+${n}` : '—'}</option>)}
            </select>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Ability Score Improvements (or a feat) for starting above 3rd level. */
function Improvements({ draft, update }: StepProps) {
  const { t, term, ability, className } = useI18n()
  const edition = rulesEdition(draft)
  const slots = improvementSlots(draft)
  if (slots.length === 0) return null
  const feats = allFeats(edition)
  const find = (classId: string, level: number) => draft.improvements?.find(i => i.classId === classId && i.level === level)
  const save = (next: Improvement) =>
    update({ improvements: [...(draft.improvements ?? []).filter(i => i.classId !== next.classId || i.level !== next.level), next] })
  return (
    <div className="field asi">
      <label>{t('builder.asi.title')}</label>
      <p className="muted small">{t('builder.asi.intro')}</p>
      {slots.map(({ classId, level }) => {
        const imp = find(classId, level)
        const isFeat = imp?.featId !== undefined
        const picks = ABILITIES.flatMap(a => Array<Ability>(imp?.abilities?.[a] ?? 0).fill(a))
        const setPick = (i: number, a: Ability | '') => {
          const next: (Ability | undefined)[] = [picks[0], picks[1]]
          next[i] = a || undefined
          const abilities: Partial<Record<Ability, number>> = {}
          for (const x of next) if (x) abilities[x] = (abilities[x] ?? 0) + 1
          save({ classId, level, abilities })
        }
        const feat = isFeat ? feats.find(f => f.id === imp.featId) : undefined
        const choice = feat?.effects.find(e => e.kind === 'abilityChoice')
        return (
          <div key={`${classId}-${level}`} className="asi-row">
            <span className="small strong">{className(classId)} {level}</span>
            <select
              value={isFeat ? 'feat' : 'asi'}
              aria-label={t('builder.asi.kind')}
              onChange={e => save(e.target.value === 'feat' ? { classId, level, featId: '' } : { classId, level, abilities: {} })}
            >
              <option value="asi">{t('builder.asi.scores')}</option>
              <option value="feat">{t('builder.asi.feat')}</option>
            </select>
            {!isFeat && [0, 1].map(i => (
              <select key={i} value={picks[i] ?? ''} aria-label={t('builder.asi.plusOne')} onChange={e => setPick(i, e.target.value as Ability | '')}>
                <option value="">+1 …</option>
                {ABILITIES.map(a => <option key={a} value={a}>+1 {ability(a)}</option>)}
              </select>
            ))}
            {isFeat && (
              <select value={imp.featId} aria-label={t('builder.asi.feat')} onChange={e => save({ classId, level, featId: e.target.value })}>
                <option value="">{t('builder.asi.pickFeat')}</option>
                {feats.filter(f => (f.minLevel ?? 0) <= level || f.id === imp.featId).map(f => <option key={f.id} value={f.id}>{term('feat', f.id, f.name)}</option>)}
              </select>
            )}
            {choice?.kind === 'abilityChoice' && (
              <select value={imp?.featAbility ?? ''} aria-label={t('builder.asi.plusOne')} onChange={e => save({ classId, level, featId: imp!.featId, featAbility: (e.target.value || undefined) as Ability | undefined })}>
                <option value="">+1 …</option>
                {choice.from.map(a => <option key={a} value={a}>+1 {ability(a)}</option>)}
              </select>
            )}
            {feat && (
              <p className="muted small asi-feat">
                {feat.prerequisite && <>{t('builder.asi.prereq', { prereq: feat.prerequisite })} </>}
                {feat.description}
              </p>
            )}
          </div>
        )
      })}
      <p className="muted small">{t(edition === '2024' ? 'builder.asi.homebrewHint2024' : 'builder.asi.homebrewHint')}</p>
    </div>
  )
}

// ---------- Background & skills ----------

function SkillsStep({ draft, update }: StepProps) {
  const granted = grantedSkills(draft)
  const { classCount, classFrom, raceCount } = skillPicks(draft)
  const total = classCount + raceCount
  const toggle = (s: SkillId) => {
    const has = draft.chosenSkills.includes(s)
    if (has) update({ chosenSkills: draft.chosenSkills.filter(x => x !== s) })
    else if (draft.chosenSkills.length < total) update({ chosenSkills: [...draft.chosenSkills, s] })
  }
  const bg = getBackground(draft)
  const edition = rulesEdition(draft)
  const custom = draft.backgroundId === CUSTOM_BACKGROUND && edition === '2014'
  const { t, term, skill, abilityShort } = useI18n()
  const pickBackground = (id: string) => update({
    backgroundId: id,
    chosenSkills: [],
    chosenLanguages: [],
    chosenTools: [],
    ...(edition === '2024' ? { freeAbilityBonuses: [] } : {}),
    customBackground: id === CUSTOM_BACKGROUND ? draft.customBackground ?? { name: '', feature: '', skills: [], tools: [], languages: [] } : draft.customBackground,
  })
  return (
    <>
      <div className="field">
        <label htmlFor="bg">{t('builder.background')} <Why id="background" /></label>
        <select id="bg" value={draft.backgroundId} onChange={e => pickBackground(e.target.value)}>
          {backgroundsFor(edition).map(b => <option key={b.id} value={b.id}>{term('background', b.id, b.name)}</option>)}
          {edition === '2014' && <option value={CUSTOM_BACKGROUND}>{t('builder.customBackground')}</option>}
        </select>
        {bg && !custom && edition === '2014' && <p className="muted small">{t('builder.bgFeature', { feature: term('bgFeature', bg.feature, bg.feature) })}</p>}
        {bg?.feat && (
          <p className="muted small">
            {t('builder.bgFeat', { feat: `${term('feat', bg.feat.id, featById(bg.feat.id, edition)?.name ?? bg.feat.id)}${bg.feat.note ? ` (${bg.feat.note})` : ''}` })}
            {edition === '2024' && <> {t('builder.bgFeat.bonusNote')}</>}
          </p>
        )}
      </div>
      {custom && <CustomBackgroundForm draft={draft} update={update} />}
      <p className="small">
        {raceCount
          ? t('builder.chosenMixed', { chosen: draft.chosenSkills.length, total, classCount, raceCount })
          : t('builder.chosenClass', { chosen: draft.chosenSkills.length, total })}
        <Why id="skills" />
      </p>
      <div className="skill-grid">
        {ALL_SKILLS.map(s => {
          const isGranted = granted.has(s)
          const allowed = raceCount > 0 || classFrom.includes(s)
          const checked = isGranted || draft.chosenSkills.includes(s)
          return (
            <label key={s} className={`skill ${isGranted ? 'granted' : ''} ${!allowed && !isGranted ? 'dim' : ''}`}>
              <input type="checkbox" checked={checked} disabled={isGranted || (!allowed && !checked)} onChange={() => toggle(s)} />
              {skill(s)} <span className="muted small">{abilityShort(SKILLS[s].ability)}</span>
              {isGranted && <span className="tag">{t('builder.tag.granted')}</span>}
              {!isGranted && classFrom.includes(s) && <span className="tag class">{t('builder.tag.class')}</span>}
            </label>
          )
        })}
      </div>
      <LanguagesAndTools draft={draft} update={update} />
    </>
  )
}

/** PHB "Customizing a Background": any two skills, two tools or languages in total, and a feature. */
function CustomBackgroundForm({ draft, update }: StepProps) {
  const { t, skill, term } = useI18n()
  const cb: CustomBackground = draft.customBackground ?? { name: '', feature: '', skills: [], tools: [], languages: [] }
  const set = (patch: Partial<CustomBackground>) => update({ customBackground: { ...cb, ...patch }, chosenSkills: patch.skills ? [] : draft.chosenSkills })
  const toggleSkill = (s: SkillId) => {
    if (cb.skills.includes(s)) set({ skills: cb.skills.filter(x => x !== s) })
    else if (cb.skills.length < 2) set({ skills: [...cb.skills, s] })
  }
  const profs = [...cb.languages.map(l => `lang:${l}`), ...cb.tools.map(x => `tool:${x}`)]
  const setProf = (i: number, v: string) => {
    const next = [profs[0] ?? '', profs[1] ?? '']
    next[i] = v
    const chosen = next.filter(Boolean)
    set({
      languages: chosen.filter(x => x.startsWith('lang:')).map(x => x.slice(5)),
      tools: chosen.filter(x => x.startsWith('tool:')).map(x => x.slice(5)),
    })
  }
  const known = fixedLanguages({ ...draft, backgroundId: '' })
  return (
    <div className="custom-bg">
      <p className="small">{t('builder.custom.intro')}</p>
      <div className="row custom-bg-fields">
        <div className="field">
          <label htmlFor="cb-name">{t('builder.custom.name')}</label>
          <input id="cb-name" value={cb.name} onChange={e => set({ name: e.target.value })} placeholder={t('builder.custom.namePlaceholder')} />
        </div>
        <div className="field">
          <label htmlFor="cb-feature">{t('builder.custom.feature')}</label>
          <input id="cb-feature" value={cb.feature} onChange={e => set({ feature: e.target.value })} placeholder={t('builder.custom.featurePlaceholder')} />
        </div>
      </div>
      <p className="small strong">{t('builder.custom.skills', { chosen: cb.skills.length })}</p>
      <div className="row">
        {ALL_SKILLS.map(s => (
          <button key={s} className={`glass-chip ${cb.skills.includes(s) ? 'on' : ''}`} disabled={!cb.skills.includes(s) && cb.skills.length >= 2} onClick={() => toggleSkill(s)}>
            {skill(s)}
          </button>
        ))}
      </div>
      <p className="small strong">{t('builder.custom.profs')}</p>
      <div className="row">
        {[0, 1].map(i => (
          <select key={i} value={profs[i] ?? ''} aria-label={t('builder.custom.profN', { n: i + 1 })} onChange={e => setProf(i, e.target.value)}>
            <option value="">—</option>
            <optgroup label={t('builder.languagesTitle')}>
              {LANGUAGES.filter(l => !known.includes(l) && (profs[i] === `lang:${l}` || !profs.includes(`lang:${l}`))).map(l => <option key={l} value={`lang:${l}`}>{term('language', l, l)}</option>)}
            </optgroup>
            <optgroup label={t('builder.toolsTitle')}>
              {TOOLS.filter(x => profs[i] === `tool:${x}` || !profs.includes(`tool:${x}`)).map(x => <option key={x} value={`tool:${x}`}>{term('tool', x, x)}</option>)}
            </optgroup>
          </select>
        ))}
      </div>
      <p className="muted small">{t('builder.custom.gear')}</p>
    </div>
  )
}

/** Language and tool picks from race, class and background. */
function LanguagesAndTools({ draft, update }: StepProps) {
  const { t, term } = useI18n()
  const fixedLangs = fixedLanguages(draft)
  const langCount = languagePickCount(draft)
  const langs = draft.chosenLanguages ?? []
  const setLang = (i: number, v: string) => {
    const next = Array.from({ length: langCount }, (_, j) => langs[j] ?? '')
    next[i] = v
    update({ chosenLanguages: next })
  }
  const groups = toolPickGroups(draft)
  const known = fixedTools(draft)
  const tools = draft.chosenTools ?? []
  const toolTotal = groups.reduce((n, g) => n + g.count, 0)
  const setTool = (i: number, v: string) => {
    const next = Array.from({ length: toolTotal }, (_, j) => tools[j] ?? '')
    next[i] = v
    update({ chosenTools: next })
  }
  let offset = 0
  return (
    <div className="field">
      <label>{t('builder.languagesTitle')} <Why id="languages" /></label>
      <p className="small">{t('builder.knownLanguages', { list: fixedLangs.map(l => term('language', l, l)).join(', ') || t('common.noneLower') })}</p>
      {langCount > 0 && (
        <div className="row">
          {Array.from({ length: langCount }, (_, i) => (
            <select key={i} value={langs[i] ?? ''} aria-label={t('builder.pickLanguage', { n: i + 1 })} onChange={e => setLang(i, e.target.value)}>
              <option value="">{t('builder.pickLanguage', { n: i + 1 })}</option>
              {LANGUAGES.filter(l => !fixedLangs.includes(l) && (langs[i] === l || !langs.includes(l))).map(l => <option key={l} value={l}>{term('language', l, l)}</option>)}
            </select>
          ))}
        </div>
      )}
      <label>{t('builder.toolsTitle')}</label>
      <p className="small">{t('builder.knownTools', { list: known.map(x => term('tool', x, x)).join(', ') || t('common.noneLower') })}</p>
      {groups.map(g => {
        const start = offset
        offset += g.count
        return (
          <div key={g.source} className="row">
            <span className="small">{t('builder.toolsFrom', { source: g.source, count: g.count })}</span>
            {Array.from({ length: g.count }, (_, k) => {
              const i = start + k
              return (
                <select key={i} value={tools[i] ?? ''} aria-label={t('builder.pickTool', { n: i + 1 })} onChange={e => setTool(i, e.target.value)}>
                  <option value="">—</option>
                  {g.from.filter(x => !known.includes(x) && (tools[i] === x || !tools.includes(x))).map(x => <option key={x} value={x}>{term('tool', x, x)}</option>)}
                </select>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ---------- Equipment ----------

function EquipmentChoices({ draft, update }: StepProps) {
  const cls = classById(draft.classes[0]?.classId ?? '', draft.rulesEdition)
  const { t, term } = useI18n()
  const choices = cls?.equipmentChoices ?? []
  if (choices.length === 0) return null
  const picks = draft.equipmentPicks ?? []
  const setPick = (i: number, option: number, items: string[]) => {
    const next = choices.map((_, j) => picks[j] ?? { option: 0, items: [] })
    next[i] = { option, items }
    update({ equipmentPicks: next })
  }
  const itemName = (id: string) => term('item', id, itemById(id)?.name ?? id)
  return (
    <div className="kit-choices">
      {choices.map((choice, i) => {
        const sel = picks[i] ?? { option: 0, items: [] }
        return (
          <fieldset key={i} className="kit-choice">
            <legend className="small muted">{t('builder.kitChoice', { n: i + 1 })}</legend>
            {choice.options.map((opt, o) => {
              let slot = 0
              return (
                <label key={o} className="kit-option">
                  <input type="radio" name={`kit-${i}`} checked={sel.option === o} onChange={() => setPick(i, o, [])} />
                  {opt.items.length === 0 && opt.gold !== undefined && <span>{t('builder.goldOnly', { gp: opt.gold })}</span>}
                  {opt.items.map((id, k) => {
                    const filter = anyFilter(id)
                    if (!filter) return <span key={k}>{k > 0 && ' + '}{itemName(id)}</span>
                    const n = slot++
                    const list = anyOptions(filter)
                    return (
                      <span key={k}>
                        {k > 0 && ' + '}
                        {sel.option === o ? (
                          <select
                            value={sel.items[n] ?? ''}
                            aria-label={t(`builder.any.${filter}`)}
                            onChange={e => { const items = [...sel.items]; items[n] = e.target.value; setPick(i, o, items) }}
                          >
                            <option value="">{t(`builder.any.${filter}`)}</option>
                            {list.map(x => <option key={x.id} value={x.id}>{itemName(x.id)}</option>)}
                          </select>
                        ) : t(`builder.any.${filter}`)}
                      </span>
                    )
                  })}
                  {opt.items.length > 0 && opt.gold ? <span className="muted small"> + {opt.gold} gp</span> : null}
                </label>
              )
            })}
          </fieldset>
        )
      })}
    </div>
  )
}

function EquipmentStep({ draft, update }: StepProps) {
  const counts = new Map<string, number>()
  for (const id of startingItemIds(draft)) counts.set(id, (counts.get(id) ?? 0) + 1)
  const { t, term } = useI18n()
  return (
    <>
      <p className="small">{t('builder.kitIntro')} <Why id="kit" /></p>
      <EquipmentChoices draft={draft} update={update} />
      <h4 className="small">{t('builder.kitTotal')}</h4>
      <ul className="kit">
        {[...counts].map(([id, n]) => {
          const item = itemById(id)
          if (!item) return null
          const detail = item.kind === 'weapon' ? `${item.damage} ${term('damage', item.damageType, item.damageType)}` : item.kind === 'armor' ? (item.category === 'shield' ? t('builder.shieldAc') : t('builder.armorAc', { ac: item.baseAc })) : ''
          return (
            <li key={id}>
              <span>{term('item', item.id, item.name)}{n > 1 ? ` ×${n}` : ''}</span>
              <span className="muted small">{detail}</span>
            </li>
          )
        })}
      </ul>
      <p className="muted small">{rulesEdition(draft) === '2024' ? t('builder.gold2024', { gp: startingGold(draft) }) : t('builder.plusGold')}</p>
    </>
  )
}

// ---------- Details ----------

/** Shrink an uploaded portrait so it fits comfortably in storage. */
function resizeImage(file: File, size = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, size / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(img.src)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

function DetailsStep({ draft, update }: StepProps) {
  const { t, term } = useI18n()
  return (
    <div className="details">
      <div className="portrait-pick">
        {draft.portrait ? <img src={draft.portrait} alt={t('builder.portrait')} /> : <div className="portrait-empty">{t('builder.noArt')}</div>}
        <label className="glass-btn small">
          {t('builder.uploadArt')}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async e => {
              const f = e.target.files?.[0]
              if (f) update({ portrait: await resizeImage(f) })
            }}
          />
        </label>
        {draft.portrait && <button className="glass-btn small" onClick={() => update({ portrait: undefined })}>{t('common.remove')}</button>}
      </div>
      <div>
        <div className="field">
          <label htmlFor="name">{t('builder.name')}</label>
          <input id="name" value={draft.name} onChange={e => update({ name: e.target.value })} placeholder={t('builder.namePlaceholder')} />
        </div>
        <div className="field">
          <label htmlFor="player">{t('builder.playerName')}</label>
          <input id="player" value={draft.playerName} onChange={e => update({ playerName: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="align">{t('builder.alignment')} <Why id="alignment" /></label>
          <select id="align" value={draft.alignment} onChange={e => update({ alignment: e.target.value })}>
            {ALIGNMENTS.map(a => <option key={a} value={a}>{term('alignment', a, a)}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

export const STEPS: { id: StepId; title: string; blurb: string; Component: ComponentType<StepProps> }[] = [
  { id: 'race', title: 'Race', blurb: 'Your ancestry sets ability bonuses, speed and traits.', Component: RaceStep },
  { id: 'class', title: 'Class', blurb: 'Your class sets hit points, proficiencies and features.', Component: ClassStep },
  { id: 'abilities', title: 'Abilities', blurb: 'Set your six ability scores. Racial bonuses are added for you.', Component: AbilitiesStep },
  { id: 'skills', title: 'Background & skills', blurb: 'Pick a background and your skill proficiencies.', Component: SkillsStep },
  { id: 'equipment', title: 'Equipment', blurb: 'Review your starting gear.', Component: EquipmentStep },
  { id: 'details', title: 'Details', blurb: 'Name your character and add art.', Component: DetailsStep },
]
