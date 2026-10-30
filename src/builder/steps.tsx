import { useState, type ComponentType } from 'react'
import { useI18n } from '../i18n'
import type { AbilityMethod } from '../model/character'
import type { CustomBackground, Improvement } from '../model/character'
import {
  ABILITIES, ALIGNMENTS, ALL_SKILLS, CUSTOM_BACKGROUND, CUSTOM_SUBCLASS, LANGUAGES, POINT_BUY_BUDGET, SKILLS, TOOLS,
  ROLLED_NOTATION, STANDARD_ARRAY, abilityMod, assignRolled, allFeats, featAbilityChoices, allRaces, anyFilter, anyOptions, backgroundsFor, choiceKey, classById, classChoices, classesFor,
  featById, featureDetail, fixedLanguages, fixedRacialBonuses, fixedTools, formatMod, getAbilityScores, getBackground, improvementBonuses, improvementSlots, itemById,
  ITEMS, bookOrigin, canSwapOrigin, languagePickCount, pickedOptions, pointBuyCost, racialLanguages, raceById, raceProfile, racialBonuses, rulesEdition, startingGold, startingItemIds, blankSubclass, subclassOf, subclassesFor, toolPickGroups,
  type Ability, type Background, type CharacterDraft, type RulesEdition, type SkillId, type TraitChoice,
  averageWealth, BACKGROUND_GOLD_2024, takesBackgroundGold, takesClassGold, wealthDice,
} from '../rules'
import type { OriginSwaps } from '../model/character'
import { RandomName } from '../random/RandomBar'
import { useDice } from '../dice/ui'
import type { RollResult } from '../dice'
import { ClassSkillPicks, WeaponMasteryPicks } from './ClassPicks'
import { Shop } from './Shop'
import { CustomSubclassForm } from './CustomSubclassForm'
import { MetamagicPicker } from './MetamagicPicker'
import { MulticlassPicker } from './MulticlassPicker'
import { grantedSkills, skillPicks, subclassSlots, type StepId } from './validate'
import { Explain, ExplainList, Why } from './Why'
import { explainKey, featureKey, pitchKey, type WhyId } from './why'
import { groupKitItems } from './kit'
import { PickOrWrite, useLanguageGroups, useToolGroups } from './ProficiencyPick'

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
    raceId: '', subraceId: undefined, freeAbilityBonuses: [], originSwaps: undefined, chosenSkills: [], chosenLanguages: [], chosenTools: [], traitChoices: {},
    backgroundId: 'acolyte', originFeatId: undefined, featureChoices: {}, classPicks: {}, weaponMasteries: [], improvements: [], equipmentPicks: [], startingWealth: undefined, purchases: [],
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
  const profile = raceProfile(draft)
  const raceTraits = race ? profile.traits : []
  const featList = profile.featChoice === 'origin' ? originFeats : allFeats(edition)
  const toggleOption = (ch: TraitChoice, id: string) => {
    const now = pickedOptions(draft, ch.id)
    const next = now.includes(id) ? now.filter(x => x !== id) : (ch.count ?? 1) === 1 ? [id] : [...now, id].slice(-(ch.count ?? 1))
    update({ traitChoices: { ...draft.traitChoices, [ch.id]: next.join(',') }, chosenSkills: [] })
  }
  return (
    <>
      <EditionPicker draft={draft} update={update} />
      <p className="muted small why-legend">
        {t('builder.cardLegend')}
        <Why id={edition === '2024' ? 'bgBonus' : 'racial'} label={t('builder.legend.bonus')} />
        <Why id="size" label={t('builder.legend.size')} />
        <Why id="speed" label={t('builder.legend.speed')} />
      </p>
      <div className="card-grid">
        {allRaces(edition).map(r => (
          <button
            key={r.id}
            className={`choice ${draft.raceId === r.id ? 'selected' : ''}`}
            onClick={() => update({ raceId: r.id, subraceId: r.subraceOptional ? undefined : r.subraces?.[0]?.id, freeAbilityBonuses: edition === '2024' ? draft.freeAbilityBonuses : [], racialBonusTargets: undefined, originSwaps: undefined, chosenSkills: [], chosenLanguages: [], chosenTools: [], traitChoices: {}, originFeatId: undefined, sizeChoice: undefined })}
          >
            <strong>{term('race', r.id, r.name)}</strong>
            <span className="muted small">
              {edition === '2024' ? t('builder.race.noBonus') : r.flexibleAbilityBonuses ? t('builder.race.flexBonus') : bonusText(r.abilityBonuses, abilityShort)}
              {r.freeAbilityBonuses ? t('builder.race.freeBonus', { count: r.freeAbilityBonuses.count }) : ''}
            </span>
            <span className="muted small">{t('builder.race.sizeSpeed', { size: (r.sizeOptions ?? [r.size]).map(x => term('size', x, x)).join(' / '), speed: r.speed })}</span>
            {r.source && <span className="muted small">{r.source}</span>}
          </button>
        ))}
      </div>
      {race?.subraces && (
        <div className="field">
          <label>{t(edition === '2024' ? 'builder.lineage' : 'builder.subrace')} <Why id="subrace" /></label>
          <div className="row">
            {race.subraceOptional && (
              <button className={`glass-chip ${!draft.subraceId ? 'on' : ''}`} onClick={() => update({ subraceId: undefined, chosenLanguages: [], chosenSkills: [], freeAbilityBonuses: [], originFeatId: undefined, racialBonusTargets: undefined, originSwaps: undefined })}>
                {t('builder.race.noSubrace')}
              </button>
            )}
            {race.subraces.map(s => (
              <button key={s.id} className={`glass-chip ${draft.subraceId === s.id ? 'on' : ''}`} onClick={() => update({ subraceId: s.id, chosenLanguages: [], chosenSkills: [], freeAbilityBonuses: [], originFeatId: undefined, racialBonusTargets: undefined, originSwaps: undefined })}>
                {term('race', s.id, s.name)}{subBonus(s.abilityBonuses)}
              </button>
            ))}
          </div>
          {draft.subraceId && <Explain kind={edition === '2024' ? 'sub2024' : 'sub2014'} id={draft.subraceId} />}
        </div>
      )}
      {race && race.sizeOptions && race.sizeOptions.length > 1 && (
        <div className="field">
          <label>{t('builder.race.size')} <Why id="size" /></label>
          <div className="row">
            {race.sizeOptions.map(x => (
              <button key={x} className={`glass-chip ${profile.size === x ? 'on' : ''}`} onClick={() => update({ sizeChoice: x })}>{term('size', x, x)}</button>
            ))}
          </div>
        </div>
      )}
      {profile.featChoice && (
        <div className="field">
          <label htmlFor="origin-feat">{t(profile.featChoice === 'origin' ? 'builder.originFeat' : 'builder.race.feat')} <Why id="originFeat" /></label>
          <select id="origin-feat" value={draft.originFeatId ?? ''} onChange={e => update({ originFeatId: e.target.value || undefined, chosenSkills: [] })}>
            <option value="">{t('builder.asi.pickFeat')}</option>
            {featList.map(f => <option key={f.id} value={f.id}>{term('feat', f.id, f.name)}</option>)}
          </select>
          {(() => {
            const f = featById(draft.originFeatId ?? '', edition)
            return f && <p className="muted small">{f.description}</p>
          })()}
        </div>
      )}
      {race?.traitChoice && (
        <div className="field">
          <label>{term('trait', race.traitChoice.name, race.traitChoice.name)} <Why id="ancestry" /></label>
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
      {profile.choices.map(ch => {
        const picked = pickedOptions(draft, ch.id)
        const key = explainKey('trait', ch.name)
        return (
          <div className="field" key={ch.id}>
            <label>{term('trait', ch.name, ch.name)}{(ch.count ?? 1) > 1 ? ` (${picked.length}/${ch.count})` : ''} {key && <Why title={term('trait', ch.name, ch.name)} text={t(key)} />}</label>
            <div className="row">
              {ch.options.map(o => (
                <button key={o.id} className={`glass-chip ${picked.includes(o.id) ? 'on' : ''}`} title={o.detail} onClick={() => toggleOption(ch, o.id)}>
                  {term('trait', o.name, o.name)}
                </button>
              ))}
            </div>
            {ch.options.filter(o => picked.includes(o.id) && o.detail).map(o => <p key={o.id} className="muted small" dir="auto">{o.name}: {o.detail}</p>)}
          </div>
        )
      })}
      <p className="muted small">{t('builder.race.homebrewHint')}</p>
      {race && (
        <p className="small">
          {racePitch && <><strong>{t('why.pick', { name: term('race', race.id, race.name) })}</strong> {t(racePitch)}<br /></>}
          <strong>{t('builder.languages')}</strong><Why id="languages" />{' '}
          {edition === '2024' ? t('builder.languages2024') : racialLanguages(draft).map(x => term('language', x, x)).join(', ')}
          {languagePickCount({ ...draft, backgroundId: '' }) > 0 && <> {t('builder.languagesPlus', { count: languagePickCount({ ...draft, backgroundId: '' }) })}</>}
          <br />
          <strong>{t('builder.traits')}</strong><Why id="traits" />{' '}
          {raceTraits.length === 0 && t('common.none')}
        </p>
      )}
      {race && <ExplainList items={raceTraits.map(x => ({ name: term('trait', x, x), key: explainKey('trait', x) }))} />}
      {canSwapOrigin(draft) && <OriginSwapsPicker draft={draft} update={update} />}
    </>
  )
}

/** Tasha's Customizing Your Origin: swap each race skill, language and weapon for another of the same kind. */
function OriginSwapsPicker({ draft, update }: StepProps) {
  const { t, term, skill } = useI18n()
  const book = bookOrigin(draft)
  const swaps = draft.originSwaps
  const on = swaps !== undefined
  const weapons = ITEMS.filter(i => i.kind === 'weapon')
  const set = <K extends keyof OriginSwaps>(kind: K, from: string, to: string) =>
    update({ originSwaps: { ...swaps, [kind]: { ...swaps?.[kind], [from]: to === from ? undefined : to } } })
  const rows: { kind: keyof OriginSwaps; ids: string[]; options: string[]; name: (id: string) => string }[] = [
    { kind: 'skills', ids: book.skills, options: ALL_SKILLS, name: id => skill(id as SkillId) },
    { kind: 'languages', ids: book.languages, options: LANGUAGES, name: id => term('language', id, id) },
    { kind: 'weapons', ids: book.weapons, options: weapons.map(w => w.id), name: id => term('item', id, itemById(id)?.name ?? id) },
  ]
  return (
    <div className="field origin-swaps">
      <label className="small">
        <input type="checkbox" checked={on} onChange={e => update({ originSwaps: e.target.checked ? {} : undefined })} />
        {' '}{t('builder.originSwap.toggle')} <Why id="originSwap" />
      </label>
      {on && <p className="muted small">{t('builder.originSwap.intro')}</p>}
      {on && rows.filter(r => r.ids.length).map(r => (
        <div key={r.kind}>
          <strong className="small">{t(`builder.originSwap.${r.kind}`)}</strong>
          <div className="row">
          {r.ids.map(id => (
            <span key={id} className="bg-bonus-pick-row">
              <span className="small">{t('builder.originSwap.from', { name: r.name(id) })}</span>
              <select
                value={(swaps?.[r.kind] as Record<string, string> | undefined)?.[id] || id}
                aria-label={t('builder.originSwap.replace', { name: r.name(id) })}
                onChange={e => set(r.kind, id, e.target.value)}
              >
                {r.options.map(x => <option key={x} value={x}>{r.name(x)}</option>)}
              </select>
            </span>
          ))}
          </div>
        </div>
      ))}
    </div>
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
  const classAbout = cls && explainKey('about', cls.id)
  const detailOf = (d?: string) => (d ? ` · ${term('detail', d, d)}` : '')
  return (
    <>
      <p className="muted small why-legend">
        {t('builder.cardLegend')}
        <Why id="hitDie" label={t('builder.legend.hitDie')} />
        <Why id="primary" label={t('builder.legend.primary')} />
        <Why id="casting" label={t('builder.legend.casting')} />
      </p>
      <div className="card-grid">
        {classesFor(edition).map(c => (
          <button
            key={c.id}
            className={`choice ${current?.classId === c.id ? 'selected' : ''}`}
            onClick={() => update({ classes: [{ classId: c.id, level }, ...extras.filter(x => x.classId !== c.id)], chosenSkills: [], chosenTools: [], equipmentPicks: [], startingWealth: undefined, improvements: [], featureChoices: {}, classPicks: {}, weaponMasteries: [] })}
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
          {classAbout && <>{t(classAbout)}<br /></>}
          <strong>{t('builder.savingThrows')}</strong><Why id="savingThrows" /> {cls.savingThrows.map(ability).join(', ')}
          <br />
          <strong>{t('builder.armor')}</strong><Why id="proficiencies" /> {cls.armor.length ? cls.armor.map(a => term('armor', a, a)).join(', ') : t('common.noneLower')} · <strong>{t('builder.weapons')}</strong>{' '}
          {[...cls.weapons.map(w => term('weapons', w, w)), ...(cls.weaponIds ?? []).map(id => item(id, itemById(id)?.name ?? id))].join(', ') || t('common.noneLower')}
          <br />
          <strong>{t('builder.featuresTo', { level })}</strong><Why id="features" />
        </p>
      )}
      {cls && <ExplainList items={cls.features.filter(f => f.level <= level).map(f => ({ name: term('feature', f.name, f.name), note: t('builder.level', { level: f.level }) + detailOf(featureDetail(f, level)), key: explainKey('feature', f.name) }))} />}
      {cls && <SubclassPicker draft={draft} update={update} />}
      {cls && <ClassChoices draft={draft} update={update} />}
      {cls && <MetamagicPicker draft={draft} update={update} />}
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
          <label>{term('feature', choice.name, choice.name)} ({className(classId)}) <Why id={`choice.${choice.id}` as WhyId} /></label>
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
        const custom = cl.subclassId === CUSTOM_SUBCLASS
        const picked = custom ? subclassOf(draft, cl) : subclassesFor(cl.classId, edition).find(s => s.id === cl.subclassId)
        const pickCustom = () => update({
          classes: draft.classes.map(x => (x.classId === cl.classId ? { ...x, subclassId: CUSTOM_SUBCLASS } : x)),
          customSubclasses: draft.customSubclasses?.some(s => s.classId === cl.classId) ? draft.customSubclasses : [...(draft.customSubclasses ?? []), blankSubclass(cl.classId)],
        })
        const spells = (picked?.spells ?? []).filter(s => s.level <= cl.level && s.names.length)
        return (
          <div className="field" key={cl.classId}>
            <label>{t('builder.subclass', { title: term('feature', def.subclassTitle, def.subclassTitle), className: className(def.id) })} <Why id="subclassChoice" /></label>
            <div className="row">
              {subclassesFor(cl.classId, edition).map(sc => (
                <button key={sc.id} className={`glass-chip ${cl.subclassId === sc.id ? 'on' : ''}`} onClick={() => setSub(cl.classId, sc.id)}>
                  {term('subclass', sc.id, sc.name)}
                </button>
              ))}
              <button className={`glass-chip ${custom ? 'on' : ''}`} onClick={pickCustom}>
                {t('builder.customSubclass', { title: term('feature', def.subclassTitle, def.subclassTitle) })}
              </button>
            </div>
            {picked && !custom && <Explain kind="subclass" id={picked.id} />}
            {picked?.source && <p className="muted small">{t('builder.subSource', { source: picked.source })}</p>}
            {picked && !custom && <ExplainList items={picked.features.filter(f => f.level <= cl.level).map(f => ({ name: term('feature', f.name, f.name), note: t('builder.level', { level: f.level }), key: featureKey(f.name, picked.id), text: f.text }))} />}
            {!custom && spells.length > 0 && (
              <p className="small">
                <strong>{t('builder.subSpells')}</strong> {spells.map(s => `${t('builder.level', { level: s.level })}: ${s.names.map(n => term('spell', n, n)).join(', ')}`).join(' · ')}
              </p>
            )}
            {custom && <CustomSubclassForm draft={draft} classId={cl.classId} update={update} />}
          </div>
        )
      })}
      {slots.length > 0 && <p className="muted small">{t('builder.subclassHint')}</p>}
    </>
  )
}

// ---------- Abilities ----------

const METHODS: AbilityMethod[] = ['standard', 'pointBuy', 'rolled', 'manual']

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
  const bonus = racialBonuses(draft)
  const asi = improvementBonuses(draft)
  for (const { ability: a } of featAbilityChoices(draft)) asi[a] += 1
  const hasAsi = improvementSlots(draft).length > 0
  const final = getAbilityScores(draft)
  const cost = pointBuyCost(draft.baseAbilities)
  const { t, ability } = useI18n()

  const setMethod = (m: AbilityMethod) => {
    const value = m === 'standard' || m === 'rolled' ? 0 : m === 'pointBuy' ? 8 : 10
    update({ abilityMethod: m, baseAbilities: { str: value, dex: value, con: value, int: value, wis: value, cha: value } })
  }
  const setScore = (a: Ability, v: number) => update({ baseAbilities: { ...draft.baseAbilities, [a]: v } })
  // Standard array: picking a value another ability holds swaps the two, so nothing has to be cleared first.
  const setStandard = (a: Ability, v: number) => {
    const other = ABILITIES.find(x => x !== a && v && draft.baseAbilities[x] === v)
    update({ baseAbilities: { ...draft.baseAbilities, [a]: v, ...(other ? { [other]: draft.baseAbilities[a] } : {}) } })
  }

  const raceInfo = raceProfile(draft)
  const free = edition === '2014' ? raceInfo.freeAbilityBonuses : undefined
  const flexible = edition === '2014' && raceInfo.flexibleAbilityBonuses
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
      {draft.abilityMethod === 'rolled' && <RolledScores draft={draft} update={update} />}
      {draft.abilityMethod === 'pointBuy' && (
        <p className={`small ${cost !== null && cost > POINT_BUY_BUDGET ? 'bad' : ''}`}>
          {t('builder.pointsSpent', { spent: cost ?? '—', budget: POINT_BUY_BUDGET })}
        </p>
      )}
      {edition === '2024' && <BackgroundBonuses draft={draft} update={update} />}
      {flexible && <FlexibleRaceBonuses draft={draft} />}
      <table className="ability-table">
        <thead>
          <tr><th>{t('builder.col.ability')}</th><th>{t('builder.col.base')}</th><th>{t(edition === '2024' ? 'builder.col.background' : 'builder.col.racial')}<Why id={edition === '2024' ? 'bgBonus' : 'racial'} compact /></th>{hasAsi && <th>{t('builder.col.asi')}</th>}<th>{t('builder.col.score')}</th><th>{t('builder.col.mod')}<Why id="modifier" compact /></th>{free && <th>+1<Why id="freeBonus" compact /></th>}</tr>
        </thead>
        <tbody>
          {ABILITIES.map(a => (
            <tr key={a}>
              <th scope="row">{ability(a)}<Why title={ability(a)} text={t(`why.ability.${a}`)} compact /></th>
              <td>
                {draft.abilityMethod === 'standard' && (
                  <select value={draft.baseAbilities[a]} onChange={e => setStandard(a, Number(e.target.value))} aria-label={t('builder.baseOf', { ability: ability(a) })}>
                    <option value={0}>—</option>
                    {STANDARD_ARRAY.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                )}
                {draft.abilityMethod === 'rolled' && (
                  <select value={draft.baseAbilities[a]} disabled={!draft.rolledScores?.length} onChange={e => update({ baseAbilities: assignRolled(draft.baseAbilities, draft.rolledScores ?? [], a, Number(e.target.value)) })} aria-label={t('builder.baseOf', { ability: ability(a) })}>
                    <option value={0}>—</option>
                    {[...new Set(draft.rolledScores ?? [])].sort((x, y) => y - x).map(v => <option key={v} value={v}>{v}</option>)}
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
              <td className="muted">
                {edition === '2024' || flexible
                  ? <BackgroundBonusPick draft={draft} update={update} a={a} />
                  : bonus[a] ? formatMod(bonus[a]) : ''}
              </td>
              {hasAsi && <td className="muted">{asi[a] ? formatMod(asi[a]) : ''}</td>}
              <td className="num strong">{draft.baseAbilities[a] ? final[a] : '—'}</td>
              <td className="num">{draft.baseAbilities[a] ? formatMod(abilityMod(final[a])) : ''}</td>
              {free && (
                <td>
                  <input
                    type="checkbox"
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
      {edition === '2014' && <MoveRacialBonuses draft={draft} update={update} />}
      <Improvements draft={draft} update={update} />
    </>
  )
}

/** Rolled method: rolls 4d6-drop-lowest six times with the dice roller (so the rolls land in dice history) and shows the pool. */
function RolledScores({ draft, update }: StepProps) {
  const { t } = useI18n()
  const dice = useDice()
  // Dice of this session's rolls, so each total can show its dropped die. Saved drafts keep only the totals.
  const [rolls, setRolls] = useState<RollResult[]>([])
  const pool = draft.rolledScores ?? []
  const rollAll = () => {
    const next = Array.from({ length: 6 }, (_, i) => dice.roll(ROLLED_NOTATION, { label: t('builder.rollLabel', { n: i + 1 }) }))
    setRolls(next)
    update({ rolledScores: next.map(r => r.total), baseAbilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } })
  }
  const shown = rolls.length === pool.length && rolls.every((r, i) => r.total === pool[i]) ? rolls : null
  const sum = pool.reduce((n, v) => n + v, 0)
  return (
    <div className="rolled-pool">
      <div className="row">
        <button className="glass-btn small" onClick={rollAll}>{t(pool.length ? 'builder.reroll' : 'builder.rollScores')}</button>
        <Why id="reroll" />
      </div>
      {pool.length > 0 && (
        <>
          <ul className="rolled-chips" aria-label={t('builder.rolledPool')}>
            {pool.map((v, i) => (
              <li key={i} className="glass-chip">
                <strong className="num">{v}</strong>
                {shown && (
                  <span className="muted small rolled-dice">
                    {shown[i].terms.flatMap(term => (term.kind === 'dice' ? term.rolls : [])).map((d, j) => d.kept ? <span key={j}>{d.value}</span> : <s key={j} title={t('builder.droppedDie')}>{d.value}</s>)}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="muted small">{t('builder.rolledTotal', { sum, mods: formatMod(pool.reduce((n, v) => n + abilityMod(v), 0)) })}</p>
        </>
      )}
    </div>
  )
}

/** 2014 races with free bonuses (Monsters of the Multiverse style): +2/+1 or +1/+1/+1 to any abilities, picked in the table. */
function FlexibleRaceBonuses({ draft }: Pick<StepProps, 'draft'>) {
  const { t } = useI18n()
  return <p className="small">{t('builder.flexBonus.intro', { total: draft.freeAbilityBonuses.length })} <Why id="racial" /></p>
}

/** 2024: a new background keeps bonuses the player placed off its list, and clears ones that followed the old list. */
function bonusesAfterBackground(draft: CharacterDraft): Ability[] {
  const listed = getBackground(draft)?.abilityScores ?? []
  return draft.freeAbilityBonuses.some(a => !listed.includes(a)) ? draft.freeAbilityBonuses : []
}

/** 2024 suggestion: +2 and +1 to the background's two listed abilities with the best base scores. */
function suggestedBonuses(draft: CharacterDraft): Ability[] {
  const listed = [...(getBackground(draft)?.abilityScores ?? [])]
  const [first, second] = listed.sort((a, b) => draft.baseAbilities[b] - draft.baseAbilities[a])
  return first && second ? [first, first, second] : []
}

/**
 * 2024: pick the background here (it suggests the bonuses), then +2/+1 or +1/+1/+1 to any abilities
 * in the table's Background column. Off-list picks only warn.
 */
function BackgroundBonuses({ draft, update }: StepProps) {
  const { t, term, ability } = useI18n()
  const bg = getBackground(draft)
  const listed = bg?.abilityScores ?? []
  const total = draft.freeAbilityBonuses.length
  const suggestion = suggestedBonuses(draft)
  const onSuggestion = suggestion.length > 0 && [...suggestion].sort().join() === [...draft.freeAbilityBonuses].sort().join()
  return (
    <div className="field bg-bonus">
      <label htmlFor="bg-abilities">{t('builder.background')} <Why id="background" /></label>
      <select id="bg-abilities" value={draft.backgroundId} onChange={e => update({ backgroundId: e.target.value, freeAbilityBonuses: bonusesAfterBackground(draft), chosenSkills: [], chosenLanguages: [], chosenTools: [] })}>
        {backgroundsFor('2024').map(b => <option key={b.id} value={b.id}>{term('background', b.id, b.name)}</option>)}
      </select>
      <BackgroundExplain kind="bg2024" bg={bg} id={draft.backgroundId} />
      <p className="small">
        {t('builder.bgBonus.intro', { total, background: bg ? term('background', bg.id, bg.name) : '', abilities: listed.map(a => ability(a)).join(', ') })}
        {' '}<Why id="bgBonus" />
      </p>
      {!onSuggestion && suggestion.length > 0 && (
        <button className="glass-btn small" onClick={() => update({ freeAbilityBonuses: suggestion })}>{t('builder.bgBonus.suggest')}</button>
      )}
    </div>
  )
}

/** 2024 (and flexible 2014 races): one ability's bonus (—, +1 or +2) in the ability table. Options that would pass +3 in total are off. */
function BackgroundBonusPick({ draft, update, a }: StepProps & { a: Ability }) {
  const { t, ability } = useI18n()
  const listed = getBackground(draft)?.abilityScores ?? []
  const count = draft.freeAbilityBonuses.filter(x => x === a).length
  const total = draft.freeAbilityBonuses.length
  const set = (n: number) => {
    const rest = draft.freeAbilityBonuses.filter(x => x !== a)
    update({ freeAbilityBonuses: [...rest, ...Array<Ability>(n).fill(a)] })
  }
  return (
    <select className={`bg-bonus-pick ${listed.includes(a) ? 'listed' : ''}`} value={count} aria-label={t('builder.bgBonus.of', { ability: ability(a) })} onChange={e => set(Number(e.target.value))}>
      {[0, 1, 2].map(n => <option key={n} value={n} disabled={n > 0 && total - count + n > 3}>{n ? `+${n}` : '—'}</option>)}
    </select>
  )
}

/** 2014: put the race's and subrace's fixed bonuses on other abilities (a common table rule). Only warns. */
function MoveRacialBonuses({ draft, update }: StepProps) {
  const { t, term, ability } = useI18n()
  const bonuses = fixedRacialBonuses(draft)
  if (bonuses.length === 0) return null
  const on = draft.racialBonusTargets !== undefined
  const setTarget = (i: number, a: Ability) => {
    const next = bonuses.map(b => b.ability)
    next[i] = a
    update({ racialBonusTargets: next })
  }
  return (
    <div className="field move-racial">
      <label className="small">
        <input type="checkbox" checked={on} onChange={e => update({ racialBonusTargets: e.target.checked ? bonuses.map(b => b.book) : undefined })} />
        {' '}{t('builder.racialMove.toggle')} <Why id="racial" />
      </label>
      {on && <p className="muted small">{t('builder.racialMove.intro')}</p>}
      {on && (
        <div className="row">
          {bonuses.map((b, i) => (
            <span key={i} className="bg-bonus-pick-row">
              <span className="small">{t('builder.racialMove.of', { value: b.value, source: term('race', b.sourceId, b.source) })}</span>
              <select value={b.ability} aria-label={t('builder.racialMove.of', { value: b.value, source: b.source })} onChange={e => setTarget(i, e.target.value as Ability)}>
                {ABILITIES.map(x => <option key={x} value={x}>{ability(x)}</option>)}
              </select>
            </span>
          ))}
        </div>
      )}
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
      <label>{t('builder.asi.title')} <Why id="asi" /></label>
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
            <span className="small strong">{className(classId)} {level}{edition === '2024' && level === 19 && <> · {term('feature', 'Epic Boon', 'Epic Boon')} <Why id="epicBoon" /></>}</span>
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
                {feats.map(f => {
                  const name = term('feat', f.id, f.name)
                  return <option key={f.id} value={f.id}>{(f.minLevel ?? 0) > level ? t('builder.asi.featLevel', { feat: name, level: f.minLevel! }) : name}</option>
                })}
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
    ...(edition === '2024' ? { freeAbilityBonuses: bonusesAfterBackground(draft) } : {}),
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
        {!custom && <BackgroundExplain kind={edition === '2024' ? 'bg2024' : 'bg'} bg={bg} id={draft.backgroundId} />}
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
          // Any skill can be picked; ones off the class list are dimmed and only warn.
          const suggested = raceCount > 0 || classFrom.includes(s)
          const checked = isGranted || draft.chosenSkills.includes(s)
          return (
            <label key={s} className={`skill ${isGranted ? 'granted' : ''} ${!suggested && !isGranted ? 'dim' : ''}`}>
              <input type="checkbox" checked={checked} disabled={isGranted} onChange={() => toggle(s)} />
              {skill(s)} <span className="muted small">{abilityShort(SKILLS[s].ability)}</span>
              <Why title={skill(s)} text={t(`why.skill.${s}`)} compact />
              {isGranted && <span className="tag">{t('builder.tag.granted')}</span>}
              {!isGranted && classFrom.includes(s) && <span className="tag class">{t('builder.tag.class')}</span>}
            </label>
          )
        })}
      </div>
      <ClassSkillPicks draft={draft} update={update} />
      <LanguagesAndTools draft={draft} update={update} />
    </>
  )
}

/** A book background's explanation, or a homebrew one's own text and what homebrew backgrounds are. */
function BackgroundExplain({ kind, bg, id }: { kind: 'bg' | 'bg2024'; bg?: Background; id: string }) {
  const { t } = useI18n()
  if (!id.startsWith('hb:')) return <Explain kind={kind} id={id} />
  return (
    <p className="why-explain small" style={{ whiteSpace: 'pre-line' }}>
      {bg?.description ?? t('why.homebrew')} <Why id="hbBackground" />
    </p>
  )
}

/** PHB "Customizing a Background": any two skills, two tools or languages in total, and a feature. */
function CustomBackgroundForm({ draft, update }: StepProps) {
  const { t, skill } = useI18n()
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
      <p className="small">{t('builder.custom.intro')} <Why id="customBackground" /></p>
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
        {[0, 1].map(i => <CustomBackgroundProf key={i} i={i} profs={profs} known={known} edition={rulesEdition(draft)} onChange={v => setProf(i, v)} />)}
      </div>
      <p className="muted small">{t('builder.custom.gear')}</p>
    </div>
  )
}

/** One of the custom background's two picks: any language or tool, or one the player writes. */
function CustomBackgroundProf({ i, profs, known, edition, onChange }: { i: number; profs: string[]; known: string[]; edition: RulesEdition; onChange: (v: string) => void }) {
  const { t } = useI18n()
  const taken = (v: string) => profs[i] !== v && profs.includes(v)
  const langs = useLanguageGroups(edition, l => known.includes(l) || taken(`lang:${l}`), 'lang:')
  const tools = useToolGroups(x => taken(`tool:${x}`), undefined, 'tool:')
  return (
    <PickOrWrite
      value={profs[i] ?? ''}
      onChange={onChange}
      groups={[...langs, ...tools]}
      write={[{ prefix: 'lang:', label: t('builder.writeLanguage') }, { prefix: 'tool:', label: t('builder.writeTool') }]}
      placeholder="—"
      ariaLabel={t('builder.custom.profN', { n: i + 1 })}
    />
  )
}

/** One language pick: the edition's table, every other official language, or one the player writes. */
function LanguagePick({ i, langs, fixedLangs, edition, onChange }: { i: number; langs: string[]; fixedLangs: string[]; edition: RulesEdition; onChange: (v: string) => void }) {
  const { t } = useI18n()
  const groups = useLanguageGroups(edition, l => fixedLangs.includes(l) || (langs[i] !== l && langs.includes(l)))
  return (
    <PickOrWrite
      value={langs[i] ?? ''}
      onChange={onChange}
      groups={groups}
      write={[{ prefix: '', label: t('builder.writeLanguage') }]}
      placeholder={t('builder.pickLanguage', { n: i + 1 })}
      ariaLabel={t('builder.pickLanguage', { n: i + 1 })}
    />
  )
}

/** One tool pick: the pick's own list first, then every other tool by kind, or one the player writes. */
function ToolPick({ i, tools, known, from, onChange }: { i: number; tools: string[]; known: string[]; from: string[]; onChange: (v: string) => void }) {
  const { t } = useI18n()
  const groups = useToolGroups(x => known.includes(x) || (tools[i] !== x && tools.includes(x)), from.length < TOOLS.length ? from : undefined)
  return (
    <PickOrWrite
      value={tools[i] ?? ''}
      onChange={onChange}
      groups={groups}
      write={[{ prefix: '', label: t('builder.writeTool') }]}
      placeholder="—"
      ariaLabel={t('builder.pickTool', { n: i + 1 })}
    />
  )
}

/** Language and tool picks from race, class and background. */
function LanguagesAndTools({ draft, update }: StepProps) {
  const { t, term } = useI18n()
  const edition = rulesEdition(draft)
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
  // A name the player wrote has no line of ours; say so instead of calling it group homebrew.
  const explained = (kind: 'language' | 'tool', x: string) => ({
    name: term(kind, x, x), key: explainKey(kind, x), text: (kind === 'language' ? LANGUAGES : TOOLS).includes(x) ? undefined : t('builder.writtenOwn'),
  })
  let offset = 0
  return (
    <div className="field">
      <label>{t('builder.languagesTitle')} <Why id="languages" /></label>
      <p className="small">{t('builder.knownLanguages', { list: fixedLangs.map(l => term('language', l, l)).join(', ') || t('common.noneLower') })}</p>
      {langCount > 0 && (
        <div className="row">
          {Array.from({ length: langCount }, (_, i) => (
            <LanguagePick key={i} i={i} langs={langs} fixedLangs={fixedLangs} edition={edition} onChange={v => setLang(i, v)} />
          ))}
        </div>
      )}
      <ExplainList items={[...fixedLangs, ...langs.filter(Boolean)].map(l => explained('language', l))} />
      <label>{t('builder.toolsTitle')} <Why id="tools" /></label>
      <p className="small">{t('builder.knownTools', { list: known.map(x => term('tool', x, x)).join(', ') || t('common.noneLower') })}</p>
      {groups.map(g => {
        const start = offset
        offset += g.count
        return (
          <div key={g.source} className="row">
            <span className="small">{t('builder.toolsFrom', { source: g.source, count: g.count })}</span>
            {Array.from({ length: g.count }, (_, k) => (
              <ToolPick key={start + k} i={start + k} tools={tools} known={known} from={g.from} onChange={v => setTool(start + k, v)} />
            ))}
          </div>
        )
      })}
      <ExplainList items={[...known, ...tools.filter(Boolean)].map(x => explained('tool', x))} />
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
      <p className="small">{t('builder.kitChoices')} <Why id="kitChoice" /></p>
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
                  <span className="kit-items">
                    {groupKitItems(opt.items).map(({ id, n: count }, k) => {
                      const filter = anyFilter(id)
                      if (!filter) return <span key={k}>{k > 0 && '+ '}{itemName(id)}{count > 1 ? ` ×${count}` : ''}</span>
                      const n = slot++
                      const list = anyOptions(filter)
                      return (
                        <span key={k}>
                          {k > 0 && '+ '}
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
                    {opt.items.length > 0 && opt.gold ? <span className="muted small">{t('builder.kitGold', { gp: opt.gold })}</span> : null}
                  </span>
                </label>
              )
            })}
          </fieldset>
        )
      })}
    </div>
  )
}

/** 2014: the class and background gear, or the class's gold to buy gear with. */
function WealthChoice({ draft, update }: StepProps) {
  const { t, className } = useI18n()
  const tray = useDice()
  const cls = classById(draft.classes[0]?.classId ?? '', '2014')
  const dice = cls && wealthDice(cls)
  if (!cls || !dice) return null
  const gold = takesClassGold(draft)
  const diceText = dice.multiplier > 1 ? `${dice.notation} × ${dice.multiplier}` : dice.notation
  const average = averageWealth(cls)
  const set = (classGold: number | undefined, rolls?: number[]) =>
    update({ startingWealth: classGold === undefined ? undefined : { classGold, ...(rolls ? { rolls } : {}) } })
  const rollGold = () => {
    const r = tray.roll(dice.notation, { label: t('builder.wealth.rollLabel') })
    set(r.total * dice.multiplier, r.terms.flatMap(x => (x.kind === 'dice' ? x.rolls.map(d => d.value) : [])))
  }
  const rolls = draft.startingWealth?.rolls
  return (
    <div className="field wealth-pick">
      <label>{t('builder.wealth.label')} <Why id="startingGold" /></label>
      <div className="glass-segmented" role="radiogroup" aria-label={t('builder.wealth.label')}>
        <button role="radio" aria-checked={!gold} onClick={() => gold && set(undefined)}>{t('builder.wealth.kit')}</button>
        <button role="radio" aria-checked={gold} onClick={() => !gold && set(average)}>{t('builder.wealth.gold', { dice: diceText })}</button>
      </div>
      {gold && (
        <>
          <p className="muted small">{t('builder.wealth.goldHint', { class: className(cls.id) })}</p>
          <div className="wealth-row">
            <button type="button" className="glass-btn small" onClick={rollGold}>🎲 {t('builder.wealth.roll', { dice: diceText })}</button>
            <button type="button" className="glass-btn small" onClick={() => set(average)}>{t('builder.wealth.average', { gp: average })}</button>
            <label className="small">
              {t('builder.wealth.amount')}{' '}
              <input type="number" inputMode="numeric" min={0} value={draft.startingWealth?.classGold ?? 0}
                onChange={e => set(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
            </label>
          </div>
          {rolls?.length ? (
            <p className="muted small" dir="ltr">{t('builder.wealth.rolled', { rolls: rolls.join(' + '), gp: draft.startingWealth?.classGold ?? 0 })}</p>
          ) : null}
        </>
      )}
    </div>
  )
}

/** 2024: the background's items and coins (option A) or 50 gp (option B). */
function BackgroundGearChoice({ draft, update }: StepProps) {
  const { t, term } = useI18n()
  const bg = getBackground(draft)
  if (!bg || (!bg.equipment.length && !bg.gold)) return null
  const gold = takesBackgroundGold(draft)
  const set = (backgroundGold: boolean) => update({ startingWealth: backgroundGold ? { backgroundGold } : undefined })
  return (
    <fieldset className="kit-choice">
      <legend className="small muted">{t('builder.bgGear.label', { background: term('background', bg.id, bg.name) })} <Why id="bgGold" /></legend>
      <label className="kit-option">
        <input type="radio" name="bg-gear" checked={!gold} onChange={() => set(false)} />
        <span>{t('builder.bgGear.items', { gp: bg.gold ?? 0 })}</span>
      </label>
      <label className="kit-option">
        <input type="radio" name="bg-gear" checked={gold} onChange={() => set(true)} />
        <span>{t('builder.goldOnly', { gp: BACKGROUND_GOLD_2024 })}</span>
      </label>
    </fieldset>
  )
}

function EquipmentStep({ draft, update }: StepProps) {
  const counts = new Map<string, number>()
  for (const id of startingItemIds(draft)) counts.set(id, (counts.get(id) ?? 0) + 1)
  const { t, term } = useI18n()
  const edition = rulesEdition(draft)
  const classGold = takesClassGold(draft)
  return (
    <>
      <p className="small">{t('builder.kitIntro')} <Why id="kit" /></p>
      {edition === '2014' && <WealthChoice draft={draft} update={update} />}
      {!classGold && <EquipmentChoices draft={draft} update={update} />}
      {edition === '2024' && <BackgroundGearChoice draft={draft} update={update} />}
      <WeaponMasteryPicks draft={draft} update={update} />
      <h4 className="small">{t('builder.kitTotal')} <Why id="kitList" /></h4>
      {counts.size === 0 && <p className="muted small">{t('builder.wealth.noKit')}</p>}
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
      <p className="muted small">
        {edition === '2024' ? t('builder.gold2024', { gp: startingGold(draft) }) : classGold ? t('builder.wealth.plus', { gp: startingGold(draft) }) : t('builder.plusGold', { gp: startingGold(draft) })}
      </p>
      <Shop draft={draft} update={update} />
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
          <div className="name-row">
            <input id="name" value={draft.name} onChange={e => update({ name: e.target.value })} placeholder={t('builder.namePlaceholder')} />
            <RandomName raceId={draft.raceId} onName={name => update({ name })} />
          </div>
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
          {draft.alignment && <Explain kind="align" id={draft.alignment} />}
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
  { id: 'equipment', title: 'Equipment', blurb: 'Pick your starting gear or gold, then shop.', Component: EquipmentStep },
  { id: 'details', title: 'Details', blurb: 'Name your character and add art.', Component: DetailsStep },
]
