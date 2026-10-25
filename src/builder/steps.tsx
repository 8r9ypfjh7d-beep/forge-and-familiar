import type { ComponentType } from 'react'
import { useI18n } from '../i18n'
import type { AbilityMethod } from '../model/character'
import {
  ABILITIES, ALIGNMENTS, ALL_SKILLS, BACKGROUNDS, CLASSES, POINT_BUY_BUDGET, RACES, SKILLS,
  STANDARD_ARRAY, abilityMod, classById, formatMod, getAbilityScores, itemById, pointBuyCost, raceById,
  racialBonuses, startingItemIds, type Ability, type CharacterDraft, type SkillId,
} from '../rules'
import { MulticlassPicker } from './MulticlassPicker'
import { grantedSkills, skillPicks, type StepId } from './validate'
import { Why } from './Why'
import { CLASS_WHY, RACE_WHY } from './why'

export interface StepProps {
  draft: CharacterDraft
  update: (patch: Partial<CharacterDraft>) => void
}

const bonusText = (b: Partial<Record<Ability, number>>, short: (a: Ability) => string) =>
  Object.entries(b).map(([a, v]) => `${short(a as Ability)} ${formatMod(v!)}`).join(', ')

// ---------- Race ----------

function RaceStep({ draft, update }: StepProps) {
  const race = raceById(draft.raceId)
  const { t, term, abilityShort } = useI18n()
  return (
    <>
      <div className="card-grid">
        {RACES.map(r => (
          <button
            key={r.id}
            className={`choice ${draft.raceId === r.id ? 'selected' : ''}`}
            onClick={() => update({ raceId: r.id, subraceId: r.subraces?.[0]?.id, freeAbilityBonuses: [], chosenSkills: [] })}
          >
            <strong>{term('race', r.id, r.name)}</strong>
            <span className="muted small">{bonusText(r.abilityBonuses, abilityShort)}{r.freeAbilityBonuses ? t('builder.race.freeBonus') : ''}</span>
            <span className="muted small">{t('builder.race.sizeSpeed', { size: term('size', r.size, r.size), speed: r.speed })}</span>
          </button>
        ))}
      </div>
      {race?.subraces && (
        <div className="field">
          <label>{t('builder.subrace')} <Why id="subrace" /></label>
          <div className="row">
            {race.subraces.map(s => (
              <button key={s.id} className={`chip ${draft.subraceId === s.id ? 'on' : ''}`} onClick={() => update({ subraceId: s.id })}>
                {term('race', s.id, s.name)} ({bonusText(s.abilityBonuses, abilityShort)})
              </button>
            ))}
          </div>
        </div>
      )}
      {race && (
        <p className="small">
          {RACE_WHY[race.id] && <><strong>Why a {race.name}?</strong> {RACE_WHY[race.id]}<br /></>}
          <strong>{t('builder.traits')}</strong><Why id="traits" /> {[...race.traits, ...(race.subraces?.find(s => s.id === draft.subraceId)?.traits ?? [])].map(x => term('trait', x, x)).join(', ') || t('common.none')}
          <br />
          <strong>{t('builder.languages')}</strong><Why id="languages" /> {race.languages.map(x => term('language', x, x)).join(', ')}
        </p>
      )}
    </>
  )
}

// ---------- Class ----------

function ClassStep({ draft, update }: StepProps) {
  const current = draft.classes[0]
  const cls = classById(current?.classId ?? '')
  const level = current?.level ?? 1
  const extras = draft.classes.slice(1)
  const extraLevels = extras.reduce((n, cl) => n + cl.level, 0)
  const { t, term, ability, abilityShort, className, item } = useI18n()
  return (
    <>
      <div className="card-grid">
        {CLASSES.map(c => (
          <button
            key={c.id}
            className={`choice ${current?.classId === c.id ? 'selected' : ''}`}
            onClick={() => update({ classes: [{ classId: c.id, level }, ...extras.filter(x => x.classId !== c.id)], chosenSkills: [] })}
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
          onChange={e => update({ classes: [{ classId: current!.classId, level: Number(e.target.value) }, ...extras] })}
        >
          {Array.from({ length: Math.max(1, 20 - extraLevels) }, (_, i) => i + 1).map(l => <option key={l} value={l}>{t('builder.level', { level: l })}</option>)}
        </select>
      </div>
      {cls && (
        <p className="small">
          {CLASS_WHY[cls.id] && <><strong>Why a {cls.name}?</strong> {CLASS_WHY[cls.id]}<br /></>}
          <strong>{t('builder.savingThrows')}</strong><Why id="savingThrows" /> {cls.savingThrows.map(ability).join(', ')}
          <br />
          <strong>{t('builder.armor')}</strong><Why id="proficiencies" /> {cls.armor.length ? cls.armor.map(a => term('armor', a, a)).join(', ') : t('common.noneLower')} · <strong>{t('builder.weapons')}</strong>{' '}
          {[...cls.weapons.map(w => term('weapons', w, w)), ...(cls.weaponIds ?? []).map(id => item(id, itemById(id)?.name ?? id))].join(', ') || t('common.noneLower')}
          <br />
          <strong>{t('builder.featuresTo', { level })}</strong><Why id="features" /> {cls.features.filter(f => f.level <= level).map(f => term('feature', f.name, f.name)).join(', ')}
        </p>
      )}
      <MulticlassPicker draft={draft} update={update} />
    </>
  )
}

// ---------- Abilities ----------

const METHODS: AbilityMethod[] = ['standard', 'pointBuy', 'manual']

function suggestedArray(draft: CharacterDraft) {
  const cls = classById(draft.classes[0]?.classId ?? '')
  const order: Ability[] = [...(cls?.primary ?? []), 'con', 'dex', 'wis', 'str', 'cha', 'int']
  const unique = [...new Set(order)]
  const out = { ...draft.baseAbilities }
  unique.forEach((a, i) => { out[a] = STANDARD_ARRAY[i] })
  return out
}

function AbilitiesStep({ draft, update }: StepProps) {
  const race = raceById(draft.raceId)
  const bonus = racialBonuses(draft)
  const final = getAbilityScores(draft)
  const cost = pointBuyCost(draft.baseAbilities)
  const { t, ability } = useI18n()

  const setMethod = (m: AbilityMethod) => {
    const value = m === 'standard' ? 0 : m === 'pointBuy' ? 8 : 10
    update({ abilityMethod: m, baseAbilities: { str: value, dex: value, con: value, int: value, wis: value, cha: value } })
  }
  const setScore = (a: Ability, v: number) => update({ baseAbilities: { ...draft.baseAbilities, [a]: v } })
  const used = ABILITIES.map(a => draft.baseAbilities[a])

  const free = race?.freeAbilityBonuses
  const toggleFree = (a: Ability) => {
    const has = draft.freeAbilityBonuses.includes(a)
    const next = has ? draft.freeAbilityBonuses.filter(x => x !== a) : [...draft.freeAbilityBonuses, a]
    if (free && next.length <= free.count) update({ freeAbilityBonuses: next })
  }

  return (
    <>
      <div className="row tabs">
        {METHODS.map(m => (
          <button key={m} className={`chip ${draft.abilityMethod === m ? 'on' : ''}`} onClick={() => setMethod(m)}>{t(`builder.method.${m}`)}</button>
        ))}
        <Why id={`method:${draft.abilityMethod}`} />
        {draft.abilityMethod === 'standard' && (
          <button className="btn ghost small" onClick={() => update({ baseAbilities: suggestedArray(draft) })}>{t('builder.suggest')}</button>
        )}
        {draft.abilityMethod === 'standard' && <Why id="suggest" />}
      </div>
      {draft.abilityMethod === 'pointBuy' && (
        <p className={`small ${cost !== null && cost > POINT_BUY_BUDGET ? 'bad' : ''}`}>
          {t('builder.pointsSpent', { spent: cost ?? '—', budget: POINT_BUY_BUDGET })}
        </p>
      )}
      <table className="ability-table">
        <thead>
          <tr><th>{t('builder.col.ability')}</th><th>{t('builder.col.base')}</th><th>{t('builder.col.racial')}<Why id="racial" compact /></th><th>{t('builder.col.score')}</th><th>{t('builder.col.mod')}<Why id="modifier" compact /></th>{free && <th>+1<Why id="freeBonus" compact /></th>}</tr>
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
                    <button className="btn ghost small" disabled={draft.baseAbilities[a] <= 8} onClick={() => setScore(a, draft.baseAbilities[a] - 1)} aria-label={t('builder.lower', { ability: ability(a) })}>−</button>
                    <span className="num">{draft.baseAbilities[a]}</span>
                    <button className="btn ghost small" disabled={draft.baseAbilities[a] >= 15} onClick={() => setScore(a, draft.baseAbilities[a] + 1)} aria-label={t('builder.raise', { ability: ability(a) })}>+</button>
                  </span>
                )}
                {draft.abilityMethod === 'manual' && (
                  <input type="number" min={3} max={20} value={draft.baseAbilities[a]} onChange={e => setScore(a, Number(e.target.value))} aria-label={t('builder.baseOf', { ability: ability(a) })} />
                )}
              </td>
              <td className="muted">{bonus[a] ? formatMod(bonus[a]) : ''}</td>
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
    </>
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
  const bg = BACKGROUNDS.find(b => b.id === draft.backgroundId)
  const { t, term, skill, abilityShort } = useI18n()
  return (
    <>
      <div className="field">
        <label htmlFor="bg">{t('builder.background')} <Why id="background" /></label>
        <select id="bg" value={draft.backgroundId} onChange={e => update({ backgroundId: e.target.value, chosenSkills: [] })}>
          {BACKGROUNDS.map(b => <option key={b.id} value={b.id}>{term('background', b.id, b.name)}</option>)}
        </select>
        {bg && <p className="muted small">{t('builder.bgFeature', { feature: term('bgFeature', bg.feature, bg.feature) })}</p>}
      </div>
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
    </>
  )
}

// ---------- Equipment ----------

function EquipmentStep({ draft }: StepProps) {
  const counts = new Map<string, number>()
  for (const id of startingItemIds(draft)) counts.set(id, (counts.get(id) ?? 0) + 1)
  const { t, term } = useI18n()
  return (
    <>
      <p className="small">{t('builder.kitIntro')} <Why id="kit" /></p>
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
      <p className="muted small">{t('builder.plusGold')}</p>
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
        <label className="btn ghost small">
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
        {draft.portrait && <button className="btn ghost small" onClick={() => update({ portrait: undefined })}>{t('common.remove')}</button>}
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
