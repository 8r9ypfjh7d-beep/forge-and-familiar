// The sheet's combat mode, laid out like Roll20's character page: a summary (who, HP, abilities,
// AC and speed), the skills on the side, and tabs. Tabs reuse the sheet's own cards; only the
// summary, skills rail, attacks table, effects, action lists and features view live here.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BUNDLED, loadKind, type Equipment, type Feat, type Feature, type Spell, type Trait } from '../../content'
import type { RollMode, RollResult } from '../../dice'
import { ShowMath } from '../../explain/ShowMath'
import { useI18n, type MessageKey } from '../../i18n'
import type { Character } from '../../model/character'
import type { Ability, ItemEffect } from '../../rules/types'
import { EffectsEditor, effectText } from '../../inventory'
import { spendSlot, slotChoices, spellDamage } from '../../quickcast/quickcast'
import { ABILITIES, ALL_SKILLS, SKILLS, derive, formatMod, getBackground, getCritRange, getDamageRiders, subclassById, xpForNextLevel, type DerivedStats } from '../../rules'
import { Markdown } from '../../rulesqa/Markdown'
import { editionOf, sourceFor } from '../../spellbook/access'
import { FadingResult } from '../../dice/ui'
import { useSheetRolls } from '../dice'
import type { CombatTab, SheetSection } from '../mode'
import type { Apply } from '../types'
import {
  ACTION_KINDS, actionRoll, actionsOf, addAction, isHealing, effectToggles, masteryLimit, matchFeature, newActionId, removeAction, resolveDice, setActionActive, spellAttackRows, updateAction,
  effectsUsed, type ActionKind, type CustomAction, type EffectToggle, type UsedEffect, type SpellAttackRow,
} from './combat'
import './combat.css'

interface Library {
  spells: Spell[]
  features: Feature[]
  traits: Trait[]
  feats: Feat[]
  equipment: Equipment[]
}

const EMPTY: Library = { spells: [], features: [], traits: [], feats: [], equipment: [] }

/** The character's edition of the content library. Empty while loading or if it fails: the page still works. */
function useLibrary(character: Character): Library {
  const source = sourceFor(editionOf(character))
  const [lib, setLib] = useState<{ source: string; data: Library } | null>(null)
  useEffect(() => {
    let live = true
    const sources = [source]
    Promise.all([
      loadKind('spells', { sources }), loadKind('features', { sources }), loadKind('traits', { sources }),
      loadKind('feats', { sources }), loadKind('equipment', { sources }),
    ])
      .then(([spells, features, traits, feats, equipment]) => { if (live) setLib({ source, data: { spells, features, traits, feats, equipment } }) })
      .catch(() => { if (live) setLib({ source, data: EMPTY }) })
    return () => { live = false }
  }, [source])
  return lib?.source === source ? lib.data : EMPTY
}

/** A roll and what it is for, e.g. "To hit" or "Damage (force)". */
interface Shown { roll: RollResult; what: string }

/**
 * The last roll a panel made, one labeled line per roll so "to hit" and "damage" can't be mixed up.
 * The dice history keeps them all. With `onDone` it fades away on its own (see FadingResult).
 */
function LastRoll({ rolls, note, onDone }: { rolls: Shown[]; note?: string; onDone?: () => void }) {
  const { t } = useI18n()
  if (!rolls.length && !note) return null
  const body = (
    <>
      {rolls.map(({ roll: r, what }) => {
        const crit = r.d20?.crit
        const fumble = r.d20?.fumble
        const mode = r.d20 && r.d20.mode !== 'normal' ? t(r.d20.mode === 'advantage' ? 'dice.advShort' : 'dice.disShort') : ''
        return (
          <div key={r.id} className={`cs-rollline type-${r.type}${crit ? ' crit' : ''}${fumble ? ' fumble' : ''}`}>
            <span className="what">{what}{mode && <small> ({mode})</small>}</span>
            <span className="total">{r.total}</span>
            <span className="how" dir="ltr">{r.breakdown}</span>
            {r.type === 'attack' && (
              <span className="meaning">
                {fumble ? t('cs.roll.fumble') : crit ? t('cs.roll.crit') : t('cs.roll.hitsAc', { n: r.total })}
              </span>
            )}
          </div>
        )
      })}
      {note && <p className="hint">{note}</p>}
    </>
  )
  return onDone
    ? <FadingResult className="cs-last" onDone={onDone}>{body}</FadingResult>
    : <div className="cs-last" aria-live="polite">{body}</div>
}

// ---------- Character card (both modes) ----------

/**
 * The top card in both sheet modes: portrait and level, class, race, background, XP, proficiency,
 * armor class, speed and passive perception, Level Up and Initiative, with the sheet's HP and Rest.
 */
export function CharacterCard({ character, vitals, onEdit }: { character: Character; vitals: ReactNode; onEdit?: () => void }) {
  const { t, term, className, raceName } = useI18n()
  const d = derive(character)
  const rolls = useSheetRolls(character)
  const [last, setLast] = useState<Shown | null>(null)
  const bg = getBackground(character)
  const next = xpForNextLevel(d.level)
  const classes = character.classes.map(cl => {
    const sub = cl.subclassId ? subclassById(cl.subclassId, character.rulesEdition) : undefined
    const base = `${className(cl.classId)} ${cl.level}`
    return sub ? `${base} - ${term('subclass', sub.id, sub.name)}` : base
  }).join(' / ')
  const m = (stat: Parameters<typeof ShowMath>[0]['stat'], text: string | number) => <ShowMath character={character} stat={stat}>{text}</ShowMath>

  return (
    <section className="card cs-top" aria-labelledby="cs-name">
      <div className="cs-hero">
        <div className="cs-portrait">
          {character.portrait
            ? <img src={character.portrait} alt="" />
            : <div className="placeholder" aria-hidden="true">{character.name.slice(0, 1)}</div>}
          <span className="cs-level" aria-label={t('cs.level', { n: d.level })}>{d.level}</span>
        </div>
        <div className="cs-who">
          <h1 id="cs-name">{character.name}</h1>
          <p className="cs-class">{classes}</p>
          <p>{[raceName(character.raceId, character.subraceId, character.rulesEdition), bg && term('background', bg.id, bg.name)].filter(Boolean).join(' · ')}</p>
          <p className="cs-xp">{next ? t('cs.xp', { xp: character.xp, next }) : t('cs.xpMax', { xp: character.xp })}</p>
        </div>
        <dl className="cs-stats">
          <div><dt>{t('stat.ac')}</dt><dd className="cs-shield">{m('ac', d.armorClass.value)}</dd></div>
          <div><dt>{t('stat.speed')}</dt><dd className="cs-hex">{m('speed', d.speed)}</dd></div>
          <div><dt>{t('stat.prof')}</dt><dd>{m('proficiency', formatMod(d.proficiencyBonus))}</dd></div>
          <div><dt>{t('stat.passivePerception')}</dt><dd>{m('passivePerception', d.passivePerception)}</dd></div>
        </dl>
        <div className="cs-hero-actions">
          {onEdit && <button type="button" className="btn cs-levelup" onClick={onEdit}>{t('cs.levelUp')}</button>}
          <button type="button" className="btn primary cs-init" onClick={() => setLast({ roll: rolls.initiative(d), what: t('cs.roll.initiative') })}>
            {t('cs.initiative', { bonus: formatMod(d.initiative) })}
          </button>
        </div>
        {last && <LastRoll key={last.roll.id} rolls={[last]} onDone={() => setLast(null)} />}
      </div>
      <div className="cs-vitals">{vitals}</div>
    </section>
  )
}

/** The six abilities, each with a Mod (check) and Save roll, and the last roll made from them. */
export function AbilitiesPanel({ character }: { character: Character }) {
  const { t, abilityShort } = useI18n()
  const d = derive(character)
  const rolls = useSheetRolls(character)
  const [last, setLast] = useState<Shown | null>(null)
  const m = (stat: Parameters<typeof ShowMath>[0]['stat'], text: string | number) => <ShowMath character={character} stat={stat}>{text}</ShowMath>
  return (
    <section className="card cs-abilities" aria-labelledby="cs-abilities-title">
      <h2 id="cs-abilities-title">{t('cs.abilities')}</h2>
      <ul className="cs-ability-row">
        {ABILITIES.map(a => (
          <li key={a} className="cs-ability">
            <div className="cs-ability-head">
              <span className="abbr">{abilityShort(a)}</span>
              <span className="cs-score">{m(`ability:${a}`, d.abilities[a])}</span>
            </div>
            <div className="cs-ability-rolls">
              <button type="button" className="cs-roll" onClick={() => setLast({ roll: rolls.check(d, a), what: t('cs.roll.check', { ability: abilityShort(a) }) })}
                aria-label={t('cs.rollCheck', { ability: abilityShort(a), bonus: formatMod(d.mods[a]) })}>
                <span dir="ltr">{formatMod(d.mods[a])}</span><small>{t('cs.mod')}</small>
              </button>
              <button type="button" className={`cs-roll save${d.saves[a].proficient ? ' prof' : ''}`} onClick={() => setLast({ roll: rolls.save(d, a), what: t('cs.roll.save', { ability: abilityShort(a) }) })}
                aria-label={t(d.saves[a].proficient ? 'cs.rollSaveProf' : 'cs.rollSave', { ability: abilityShort(a), bonus: formatMod(d.saves[a].bonus) })}>
                <span dir="ltr">{formatMod(d.saves[a].bonus)}</span><i className="dot" aria-hidden="true" /><small>{t('cs.save')}</small>
              </button>
            </div>
          </li>
        ))}
      </ul>
      {last && <LastRoll key={last.roll.id} rolls={[last]} onDone={() => setLast(null)} />}
    </section>
  )
}

// ---------- Skills rail ----------

export function SkillsPanel({ character }: { character: Character }) {
  const { t, term, skill, abilityShort } = useI18n()
  const d = derive(character)
  const rolls = useSheetRolls(character)
  const [last, setLast] = useState<Shown | null>(null)
  return (
    <section className="card cs-skills" aria-labelledby="cs-skills-title">
      <h2 id="cs-skills-title">{t('cs.skills')}</h2>
      <ul>
        {ALL_SKILLS.map(s => (
          <li key={s}>
            <button type="button" className={d.skills[s].proficient ? 'prof' : ''} onClick={() => setLast({ roll: rolls.skill(d, s), what: skill(s) })}
              aria-label={t(d.skills[s].proficient ? 'cs.rollSkillProf' : 'cs.rollSkill', { skill: skill(s), bonus: formatMod(d.skills[s].bonus) })}>
              <span className="name">{skill(s)}</span>
              <span className="abbr">{abilityShort(SKILLS[s].ability)}</span>
              <span className="bonus" dir="ltr">{formatMod(d.skills[s].bonus)}</span>
              <i className="dot" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {last && <LastRoll key={last.roll.id} rolls={[last]} onDone={() => setLast(null)} />}
      <h2 className="cs-tools-title">{t('cs.tools')}</h2>
      {d.tools.length
        ? <ul className="cs-tools">{d.tools.map(x => <li key={x}>{term('tool', x, x)}</li>)}</ul>
        : <p className="hint">{t('common.none')}</p>}
    </section>
  )
}

// ---------- Tabs ----------

const TAB_KEYS: Record<CombatTab, MessageKey> = {
  combat: 'cs.tab.combat', spells: 'cs.tab.spells', inventory: 'cs.tab.inventory', features: 'cs.tab.features', notes: 'cs.tab.notes',
}

export function CombatTabs({ tabs, render }: { tabs: Record<CombatTab, SheetSection[]>; render: (s: SheetSection) => ReactNode }) {
  const { t } = useI18n()
  const [tab, setTab] = useState<CombatTab>('combat')
  const ids = Object.keys(tabs) as CombatTab[]
  const move = (e: React.KeyboardEvent, i: number) => {
    const by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!by) return
    // In right-to-left pages the arrows still point the way the eye moves.
    const dir = getComputedStyle(e.currentTarget).direction === 'rtl' ? -by : by
    const next = ids[(i + dir + ids.length) % ids.length]
    setTab(next)
    document.getElementById(`cs-tab-${next}`)?.focus()
  }
  return (
    <div className="cs-tabs">
      <div className="cs-tablist" role="tablist" aria-label={t('cs.tabs')}>
        {ids.map((id, i) => (
          <button key={id} id={`cs-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls="cs-tabpanel"
            tabIndex={tab === id ? 0 : -1} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} onKeyDown={e => move(e, i)}>
            {t(TAB_KEYS[id])}
          </button>
        ))}
      </div>
      <div id="cs-tabpanel" role="tabpanel" aria-labelledby={`cs-tab-${tab}`} className="cs-tabpanel">
        {tabs[tab].map(render)}
      </div>
    </div>
  )
}

// ---------- Combat tab: attacks, weapon mastery, effects, actions ----------

interface Outcome { name: string; rolls: Shown[]; note?: string; effects?: UsedEffect[] }

export function Fight({ character, apply }: { character: Character; apply: Apply }) {
  const i18n = useI18n()
  const { t, term, attackName, abilityShort } = i18n
  const lib = useLibrary(character)
  const d = derive(character)
  const rolls = useSheetRolls(character)
  const [mode, setMode] = useState<RollMode>('normal')
  const [on, setOn] = useState<Record<string, boolean>>({})
  const [twoHanded, setTwoHanded] = useState<Record<string, boolean>>({})
  const [out, setOut] = useState<Outcome | null>(null)
  const [outKey, setOutKey] = useState(0)
  // Every tap gets a fresh card, so a repeat roll restarts its fade clock.
  const show = (o: Outcome) => { setOut(o); setOutKey(k => k + 1) }
  const outRef = useRef<HTMLDivElement>(null)
  // Actions sit far below the result box, so bring the result into view after every roll.
  useEffect(() => { if (out) outRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }) }, [out])
  const spellNames = Object.fromEntries(lib.spells.map(s => [s.id, s.name]))
  const effects = effectToggles(character, d, spellNames)
  const spells = spellAttackRows(character, d, lib.spells)
  const critRange = getCritRange(character)
  // Custom action effects are saved on the action (their stat changes reach derive()); the rest are per-session switches.
  const isOn = (e: EffectToggle) => (e.id.startsWith('act:') ? !!character.customActions?.find(a => `act:${a.id}` === e.id)?.active : !!on[e.id])
  const toggle = (e: EffectToggle, value: boolean) => {
    if (!e.id.startsWith('act:')) return setOn(o => ({ ...o, [e.id]: value }))
    apply(t(value ? 'cs.log.effectOn' : 'cs.log.effectOff', { name: e.name }), c => setActionActive(c, e.id.slice(4), value))
  }
  const active = effects.filter(isOn)
  const damaging = active.filter((e): e is EffectToggle & { damage: string } => !!e.damage)

  const weapon = (a: DerivedStats['attacks'][number]) => {
    const own = getDamageRiders(character, a).map(r => r.id as string)
    const used = damaging.filter(e => !e.weaponOnly || own.includes(e.id))
    const riders = used.map(e => ({ name: e.name, damage: e.damage }))
    const extra = a.extraDamage ? /^(\S+)\s*(.*)$/.exec(a.extraDamage) : null
    const all = extra ? [...riders, { name: extra[2] || a.name, damage: extra[1] }] : riders
    const r = rolls.attack(a, { mode, critRange, riders: all, twoHanded: twoHanded[a.name] })
    const type = term('damage', a.damageType, a.damageType)
    show({
      name: attackName(a.name),
      rolls: [{ roll: r.attack, what: t('cs.roll.toHit') }, ...(r.damage ? [{ roll: r.damage, what: t('cs.roll.damage', { type }) }] : [])],
      effects: effectsUsed(active, r.damage ? used.map(e => e.id) : [], f =>
        f.kind === 'attack' || (f.kind === 'damage' && !!r.damage) || ((f.kind === 'ability' || f.kind === 'abilitySet') && f.ability === a.ability)),
    })
    if (r.damage && active.some(e => e.oncePerTurn)) setOn(o => ({ ...o, ...Object.fromEntries(active.filter(e => e.oncePerTurn).map(e => [e.id, false])) }))
  }

  const cast = (r: SpellAttackRow) => {
    const notes: string[] = []
    const choice = r.level > 0 ? slotChoices(character, r.level)[0] : undefined
    if (choice) {
      apply(t(choice.source === 'pact' ? 'cs.log.castPact' : 'cs.log.cast', { name: r.name, level: choice.level }), c => spendSlot(c, choice))
      notes.push(t(choice.source === 'pact' ? 'cs.usedPact' : 'cs.usedSlot', { level: choice.level }))
    } else if (r.level > 0) notes.push(t('cs.noSlot'))
    if (r.kind === 'save' && r.save) notes.push(t('cs.saveNote', { dc: r.value, ability: abilityShort(r.save) }))
    const sc = d.spellcasting
    const damage = spellDamage({ ...r.entry, id: '', kind: 'spell' }, choice?.level ?? r.level, d.level, sc ? d.mods[sc.ability] : 0)
    const used = r.kind === 'attack' && r.damageType !== 'healing' ? damaging.filter(e => !e.weaponOnly) : []
    const riders = used.map(e => ({ name: e.name, damage: e.damage }))
    const res = rolls.spell(r.name, { attackBonus: r.kind === 'attack' ? r.value : undefined, damage, damageType: r.damageType, mode, riders })
    const type = r.damageType ? term('damage', r.damageType, r.damageType) : ''
    const list: Shown[] = [
      ...('attack' in res && res.attack ? [{ roll: res.attack, what: t('cs.roll.toHit') }] : []),
      ...(res.damage ? [{ roll: res.damage, what: r.damageType === 'healing' ? t('cs.roll.healing') : t(type ? 'cs.roll.damage' : 'cs.roll.damagePlain', { type }) }] : []),
    ]
    show({
      name: r.name, rolls: list, note: notes.join(' · ') || undefined,
      effects: effectsUsed(active, res.damage ? used.map(e => e.id) : [], f =>
        (r.kind === 'attack' ? f.kind === 'spellAttack' : f.kind === 'spellDc') || ((f.kind === 'ability' || f.kind === 'abilitySet') && f.ability === sc?.ability)),
    })
  }

  /** A custom action: attack roll (with toggled effects on a hit) or save DC, then its dice. */
  const runAction = (a: CustomAction) => {
    const r = actionRoll(a, d)
    const healing = isHealing(a.roll?.type)
    const used = r.attackBonus !== undefined && !healing ? damaging.filter(e => !e.weaponOnly && e.id !== `act:${a.id}`) : []
    const riders = used.map(e => ({ name: e.name, damage: e.damage }))
    const res = rolls.spell(a.name, { attackBonus: r.attackBonus, damage: r.dice, damageType: a.roll?.type, mode, riders })
    const type = a.roll?.type ? term('damage', a.roll.type, a.roll.type) : ''
    show({
      name: a.name,
      rolls: [
        ...('attack' in res && res.attack ? [{ roll: res.attack, what: t('cs.roll.toHit') }] : []),
        ...(res.damage ? [{ roll: res.damage, what: healing ? t('cs.roll.healing') : r.attackBonus !== undefined || r.dc !== undefined ? t(type ? 'cs.roll.damage' : 'cs.roll.damagePlain', { type }) : t('cs.roll.result') }] : []),
      ],
      note: r.dc !== undefined ? t('cs.saveNote', { dc: r.dc, ability: r.save ? abilityShort(r.save) : '' }) : undefined,
      effects: effectsUsed(active.filter(e => e.id !== `act:${a.id}`), res.damage ? used.map(e => e.id) : [], f =>
        (f.kind === 'ability' || f.kind === 'abilitySet') && f.ability === a.roll?.ability),
    })
  }

  const ft = (n: number) => t('cs.feet', { n })
  const masteries = masteryLimit(character)
  const mastered = masteries
    ? d.attacks.flatMap(a => {
        const m = lib.equipment.find(e => e.id === a.itemId)?.weapon?.mastery
        return m ? [{ weapon: attackName(a.name), mastery: m }] : []
      }).slice(0, masteries)
    : []

  return (
    <section className="card cs-fight" aria-labelledby="cs-attacks-title">
      <div className="card-head">
        <h2 id="cs-attacks-title">{t('cs.attacks')}</h2>
        <div className="segmented" role="group" aria-label={t('sheet.attacks.mode')}>
          {(['advantage', 'normal', 'disadvantage'] as const).map(m => (
            <button key={m} type="button" className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {t(m === 'advantage' ? 'dice.adv' : m === 'disadvantage' ? 'dice.dis' : 'dice.normal')}
            </button>
          ))}
        </div>
      </div>

      <div className="cs-table-head" aria-hidden="true">
        <span>{t('cs.col.name')}</span><span>{t('cs.col.range')}</span><span>{t('cs.col.hit')}</span><span>{t('cs.col.damage')}</span>
      </div>
      <ul className="cs-attack-list">
        {d.attacks.map(a => {
          const name = attackName(a.name)
          const damage = twoHanded[a.name] && a.versatile ? a.versatile : a.damage
          const range = a.reach && a.range ? `${ft(a.reach)} (${a.range})` : a.reach ? ft(a.reach) : a.range ? t('cs.feetRange', { range: a.range }) : ''
          return (
            <li key={a.name}>
              <button type="button" className="cs-attack" onClick={() => weapon(a)}
                aria-label={t('sheet.attacks.rollLabel', { name, bonus: formatMod(a.bonus), damage })}>
                <span className="name">{name}<small>{t(a.reach ? 'cs.melee' : 'cs.ranged')}</small></span>
                <span className="range" dir="ltr">{range}</span>
                <span className="hit" dir="ltr">{formatMod(a.bonus)}</span>
                <span className="dmg"><span dir="ltr">{damage}{a.extraDamage ? ` + ${a.extraDamage}` : ''}</span> {term('damage', a.damageType, a.damageType)}</span>
              </button>
              {a.versatile && (
                <label className="rider">
                  <input type="checkbox" checked={!!twoHanded[a.name]} onChange={e => setTwoHanded(h => ({ ...h, [a.name]: e.target.checked }))} />
                  {t('sheet.attacks.twoHanded')}
                </label>
              )}
            </li>
          )
        })}
        {spells.map(r => (
          <li key={`spell-${r.name}`}>
            <button type="button" className="cs-attack spell" onClick={() => cast(r)}
              aria-label={t('cs.castLabel', { name: r.name })}>
              <span className="name">{r.name}<small>{t(r.kind === 'attack' ? 'cs.spellAttack' : 'cs.spellSave')}{r.level === 0 ? ` · ${t('cs.cantrip')}` : ''}</small></span>
              <span className="range">{r.range}</span>
              <span className="hit" dir="ltr">{r.kind === 'attack' ? formatMod(r.value) : `${r.save ? abilityShort(r.save) : ''} ${r.value}`}</span>
              <span className="dmg">{r.damage ? <><span dir="ltr">{r.damage}</span> {r.damageType ? term('damage', r.damageType, r.damageType) : ''}</> : '—'}</span>
            </button>
          </li>
        ))}
      </ul>
      {out && (
        <FadingResult key={outKey} ref={outRef} className="cs-out" onDone={() => setOut(null)}>
          <strong>{out.name}</strong>
          <LastRoll rolls={out.rolls} note={out.note} />
          {!!out.effects?.length && (
            <div className="cs-used">
              <span className="cs-used-title">{t('cs.effectsUsed')}</span>
              <ul>
                {out.effects.map(e => (
                  <li key={e.id}>
                    <strong>{e.name}</strong>{' '}
                    <span>{[
                      e.damage ? t('cs.effectDice', { dice: e.damage, type: e.damageType ? ` ${term('damage', e.damageType, e.damageType)}` : '' }) : '',
                      ...e.stats.map(f => effectText(i18n, f)),
                    ].filter(Boolean).join(' · ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </FadingResult>
      )}

      <h3 className="cs-sub">{t('cs.mastery')} <span className="cs-count" dir="ltr">{mastered.length}/{masteries}</span></h3>
      {mastered.length
        ? <ul className="cs-rows">{mastered.map(m => <li key={m.weapon}><span>{term('mastery', m.mastery, cap(m.mastery))}</span><span className="hint">{m.weapon}</span></li>)}</ul>
        : <p className="hint">{t('cs.noMastery')}</p>}

      <h3 className="cs-sub">{t('cs.effects')}</h3>
      {effects.length
        ? (
          <ul className="cs-rows cs-effects">
            {effects.map(e => (
              <li key={e.id}>
                <label className="cs-switch">
                  <input type="checkbox" role="switch" checked={isOn(e)} onChange={ev => toggle(e, ev.target.checked)} />
                  <span>{e.weaponOnly ? term('feature', e.name, e.name) : e.name}</span>
                </label>
                {e.damage && <span className="dmg" dir="ltr">{e.damage}</span>}
                <span className="hint">
                  {[
                    e.damage ? `${t(e.weaponOnly ? 'cs.affects.weapon' : 'cs.affects.damage')}${e.damageType ? ` (${term('damage', e.damageType, e.damageType)})` : ''}` : '',
                    ...(e.stats ?? []).map(f => effectText(i18n, f)),
                  ].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        )
        : <p className="hint">{t('cs.noEffects')}</p>}

      <CustomActions character={character} apply={apply} onRoll={runAction} />
    </section>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const KIND_TITLE: Record<ActionKind, MessageKey> = {
  action: 'cs.actions', bonus: 'cs.bonusActions', reaction: 'cs.reactions', free: 'cs.freeActions', other: 'cs.otherActions',
}

/** The player's own actions, bonus actions, reactions, free actions and other abilities, grouped like Roll20. */
function CustomActions({ character, apply, onRoll }: { character: Character; apply: Apply; onRoll: (a: CustomAction) => void }) {
  const { t, abilityShort, term } = useI18n()
  const d = derive(character)
  const [adding, setAdding] = useState<ActionKind | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  /** "+6 · 1d8+3 force" or "DC 14 WIS · 2d6" */
  const summary = (a: CustomAction) => {
    const r = actionRoll(a, d)
    const bits = [
      r.attackBonus !== undefined ? formatMod(r.attackBonus) : '',
      r.dc !== undefined ? t('cs.dcShort', { dc: r.dc, ability: r.save ? abilityShort(r.save) : '' }).trim() : '',
      r.dice ? `${r.dice}${a.roll?.type ? ` ${term('damage', a.roll.type, a.roll.type)}` : ''}` : '',
    ].filter(Boolean)
    return bits.join(' · ')
  }
  return (
    <>
      {ACTION_KINDS.map(k => {
        const list = actionsOf(character, k)
        return (
          <div key={k} className="cs-actions">
            <h3 className="cs-sub">
              {t(KIND_TITLE[k])}
              <button type="button" className="btn ghost small cs-add" aria-expanded={adding === k}
                aria-label={t('cs.addTo', { group: t(KIND_TITLE[k]) })} onClick={() => setAdding(adding === k ? null : k)}>+ {t('common.add')}</button>
            </h3>
            {adding === k && (
              <ActionForm kind={k} stats={d} onCancel={() => setAdding(null)}
                onSave={a => { apply(t('cs.log.actionAdded', { name: a.name }), c => addAction(c, { ...a, id: newActionId() })); setAdding(null) }} />
            )}
            {list.length === 0 && adding !== k && <p className="hint">{t('cs.noActions')}</p>}
            <ul className="cs-rows">
              {list.map(a => {
                if (editing === a.id) {
                  return (
                    <li key={a.id} className="cs-action">
                      <ActionForm kind={a.kind} stats={d} initial={a} onCancel={() => setEditing(null)}
                        onSave={p => { apply(t('cs.log.actionEdited', { name: p.name }), c => updateAction(c, a.id, { roll: undefined, effect: undefined, stats: undefined, description: undefined, ...p })); setEditing(null) }} />
                    </li>
                  )
                }
                const sum = summary(a)
                return (
                  <li key={a.id} className="cs-action">
                    <div className="cs-action-row">
                      {a.description
                        ? <details><summary><span>{a.name}</span></summary><p className="cs-desc-text">{a.description}</p></details>
                        : <span className="cs-action-name">{a.name}</span>}
                      <span className="cs-action-tools">
                        {sum && (
                          <button type="button" className="btn small cs-action-roll" onClick={() => onRoll(a)} aria-label={t('cs.rollAction', { name: a.name, what: sum })}>
                            <span aria-hidden="true">🎲</span> <span dir="ltr">{sum}</span>
                          </button>
                        )}
                        {(a.effect || a.stats?.length) && <span className={`cs-effect-tag${a.active ? ' on' : ''}`} title={t('cs.effectTagHint')}>{t('cs.effectTag')}</span>}
                        <button type="button" className="btn ghost small" aria-label={t('cs.editAction', { name: a.name })} onClick={() => setEditing(a.id)}>✎</button>
                        <button type="button" className="btn ghost small" aria-label={t('cs.removeAction', { name: a.name })}
                          onClick={() => apply(t('cs.log.actionRemoved', { name: a.name }), c => removeAction(c, a.id))}>×</button>
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </>
  )
}

type Check = 'none' | 'attack' | 'save'

function ActionForm({ kind, stats, initial, onSave, onCancel }: {
  kind: ActionKind
  stats: DerivedStats
  initial?: CustomAction
  onSave: (a: Omit<CustomAction, 'id'>) => void
  onCancel: () => void
}) {
  const { t, abilityShort } = useI18n()
  const [name, setName] = useState(initial?.name ?? '')
  const [text, setText] = useState(initial?.description ?? '')
  const [group, setGroup] = useState<ActionKind>(kind)
  const [check, setCheck] = useState<Check>(initial?.roll?.check ?? 'none')
  const [ability, setAbility] = useState<Ability>(initial?.roll?.ability ?? stats.spellcasting?.ability ?? 'str')
  const [save, setSave] = useState<Ability>(initial?.roll?.save ?? 'wis')
  const [dice, setDice] = useState(initial?.roll?.dice ?? '')
  const [type, setType] = useState(initial?.roll?.type ?? '')
  const [hasEffect, setHasEffect] = useState(!!initial?.effect)
  const [fx, setFx] = useState(initial?.effect?.damage ?? '')
  const [fxType, setFxType] = useState(initial?.effect?.type ?? '')
  const [statFx, setStatFx] = useState<ItemEffect[]>(initial?.stats ?? [])
  const diceBad = !!dice.trim() && !resolveDice(dice, stats)
  const fxBad = hasEffect && !resolveDice(fx, stats)
  const ok = !!name.trim() && !diceBad && !fxBad

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ok) return
    const roll: CustomAction['roll'] = {
      ...(check !== 'none' ? { check, ability } : {}),
      ...(check === 'save' ? { save } : {}),
      ...(dice.trim() ? { dice: dice.trim() } : {}),
      ...(dice.trim() && type.trim() ? { type: type.trim() } : {}),
    }
    onSave({
      kind: group, name: name.trim(),
      ...(text.trim() ? { description: text.trim() } : {}),
      ...(Object.keys(roll).length ? { roll } : {}),
      ...(hasEffect ? { effect: { damage: fx.trim(), ...(fxType.trim() ? { type: fxType.trim() } : {}) } } : {}),
      ...(statFx.length ? { stats: statFx } : {}),
    })
  }
  const abilitySelect = (value: Ability, set: (a: Ability) => void, label: string) => (
    <label>{label}
      <select value={value} onChange={e => set(e.target.value as Ability)}>
        {ABILITIES.map(a => <option key={a} value={a}>{abilityShort(a)}</option>)}
      </select>
    </label>
  )

  return (
    <form className="cs-action-form" onSubmit={submit}>
      <label>{t('cs.actionName')}<input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder={t('cs.actionNamePlaceholder')} /></label>
      <label>{t('cs.actionGroup')}
        <select value={group} onChange={e => setGroup(e.target.value as ActionKind)}>
          {ACTION_KINDS.map(k => <option key={k} value={k}>{t(KIND_TITLE[k])}</option>)}
        </select>
      </label>
      <label className="wide">{t('cs.actionText')}<textarea rows={3} value={text} onChange={e => setText(e.target.value)} placeholder={t('cs.actionTextPlaceholder')} /></label>

      <fieldset className="wide cs-fieldset">
        <legend>{t('cs.form.roll')}</legend>
        <label>{t('cs.form.check')}
          <select value={check} onChange={e => setCheck(e.target.value as Check)}>
            <option value="none">{t('cs.form.checkNone')}</option>
            <option value="attack">{t('cs.form.checkAttack')}</option>
            <option value="save">{t('cs.form.checkSave')}</option>
          </select>
        </label>
        {check !== 'none' && abilitySelect(ability, setAbility, t('cs.form.ability'))}
        {check === 'save' && abilitySelect(save, setSave, t('cs.form.saveAbility'))}
        <label>{t('cs.form.dice')}
          <input value={dice} onChange={e => setDice(e.target.value)} placeholder="1d8+CHA" dir="ltr" aria-invalid={diceBad} />
        </label>
        <label>{t('cs.form.type')}
          <input value={type} onChange={e => setType(e.target.value)} placeholder={t('cs.form.typePlaceholder')} />
        </label>
        <p className="hint wide">{diceBad ? t('cs.form.diceBad') : t('cs.form.diceHint')}</p>
      </fieldset>

      <fieldset className="wide cs-fieldset">
        <legend>{t('cs.form.effect')}</legend>
        <label className="cs-check wide"><input type="checkbox" checked={hasEffect} onChange={e => setHasEffect(e.target.checked)} />{t('cs.form.effectOn')}</label>
        {hasEffect && <>
          <label>{t('cs.form.effectDice')}<input value={fx} onChange={e => setFx(e.target.value)} placeholder="1d6" dir="ltr" aria-invalid={fxBad} /></label>
          <label>{t('cs.form.type')}<input value={fxType} onChange={e => setFxType(e.target.value)} placeholder={t('cs.form.typePlaceholder')} /></label>
          {fxBad && <p className="hint wide">{t('cs.form.diceBad')}</p>}
        </>}
      </fieldset>

      <div className="wide cs-stats-editor">
        <EffectsEditor effects={statFx} onChange={setStatFx} legend={t('cs.form.stats')} />
        <p className="hint">{t('cs.form.statsHint')}</p>
      </div>

      <div className="row">
        <button type="submit" className="btn primary" disabled={!ok}>{t('cs.save.action')}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}

// ---------- Features & Traits tab ----------

export function FeaturesTraits({ character }: { character: Character }) {
  const { t, term } = useI18n()
  const lib = useLibrary(character)
  const d = derive(character)
  const bg = getBackground(character)
  const source = BUNDLED.find(m => m.source.id === sourceFor(editionOf(character)))?.source
  const traitText = (name: string) => {
    const base = name.replace(/\s*\(.*$/, '').toLowerCase()
    return lib.traits.find(x => x.name.toLowerCase() === base)?.description
  }
  const featText = (name: string) => lib.feats.find(x => x.name.toLowerCase() === name.toLowerCase())?.description
  const list = (kind: string, xs: string[]) => xs.map(x => term(kind, x, x)).join(', ') || t('common.none')
  return (
    <section className="card cs-features" aria-labelledby="cs-features-title">
      <h2 id="cs-features-title">{t('cs.classFeatures')}</h2>
      <ul className="cs-rows">
        {d.features.map(f => (
          <Described key={`${f.className}-${f.level}-${f.name}`} name={term('feature', f.name, f.name)} meta={t('cs.featureMeta', { cls: f.className, level: f.level })}
            text={matchFeature(lib.features, f.name, f.className)?.description} />
        ))}
      </ul>
      <h3 className="cs-sub">{t('cs.racialTraits')}</h3>
      {d.traits.length
        ? <ul className="cs-rows">{d.traits.map(x => <Described key={x} name={term('trait', x, x)} text={traitText(x)} />)}</ul>
        : <p className="hint">{t('common.none')}</p>}
      {d.feats.length > 0 && <>
        <h3 className="cs-sub">{t('cs.feats')}</h3>
        <ul className="cs-rows">{d.feats.map(x => <Described key={x} name={term('feat', x, x)} text={featText(x)} />)}</ul>
      </>}
      {bg?.feature && <>
        <h3 className="cs-sub">{t('sheet.story.bgFeature')}</h3>
        <p>{term('feature', bg.feature, bg.feature)}</p>
      </>}
      <h3 className="cs-sub">{t('cs.proficiencies')}</h3>
      <dl className="story-facts">
        <div><dt>{t('builder.languagesTitle')}</dt><dd>{list('language', d.languages)}</dd></div>
        <div><dt>{t('builder.toolsTitle')}</dt><dd>{list('tool', d.tools)}</dd></div>
      </dl>
      {source && <p className="hint cs-attribution">{source.attribution}</p>}
    </section>
  )
}

function Described({ name, meta, text }: { name: string; meta?: string; text?: string }) {
  return (
    <li className="cs-action">
      {text
        ? <details><summary><span>{name}</span>{meta && <small className="hint">{meta}</small>}</summary><div className="cs-desc" dir="ltr"><Markdown text={text} /></div></details>
        : <span>{name}{meta && <small className="hint"> {meta}</small>}</span>}
    </li>
  )
}
