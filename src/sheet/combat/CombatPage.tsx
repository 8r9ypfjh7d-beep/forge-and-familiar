// The sheet's combat mode, laid out like Roll20's character page: a summary (who, HP, abilities,
// AC and speed), the skills on the side, and tabs. Tabs reuse the sheet's own cards; only the
// summary, skills rail, attacks table, effects, action lists and features view live here.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BUNDLED, loadKind, type CharacterClass, type Equipment, type Feat, type Feature, type Spell, type Subclass, type Trait } from '../../content'
import type { RollMode } from '../../dice'
import { featExplainKey, optionKey, optionName } from '../../builder/why'
import { ShowMath } from '../../explain/ShowMath'
import { useI18n, type MessageKey } from '../../i18n'
import type { Character } from '../../model/character'
import type { Ability, ItemEffect, Recharge } from '../../rules/types'
import { EffectsEditor, advantageName, effectText } from '../../inventory'
import type { SlotChoice } from '../../quickcast'
import { slotChoices, spellBeams, spellDamage } from '../../quickcast/quickcast'
import { castPlan, castSpell, fixedAmount } from '../../spellbook/cast'
import { CastButton, useCast } from '../../spellbook/Cast'
import { SpellRow } from '../../spellbook/Spellbook'
import { spellAccess } from '../../spellbook/access'
import { isMeleeWeapon, summonPactWeapon } from '../../inventory'
import { updateEntry } from '../../inventory/inventory'
import { heal } from '../engine'
import { applyUse, spendResource } from '../uses'
import { PoolForm, useResourceUse } from '../components/Resources'
import { FormPicker } from '../components/WildShape'
import { turnActions, type TurnRow } from './turn'
import { spendOnceEffects, startEffect } from '../effects'
import { EffectRows, toggleEffect } from '../components/Effects'
import { ABILITIES, ALL_SKILLS, ITEMS, SKILLS, castingKind, classOptionById, derive, entryItem, planUse, formatMod, getBackground, getFeats, getCritRange, getDamageRiders, itemById, missingSubclasses, rulesEdition, subclassOf, totalLevel, xpForNextLevel, xpReady, type DerivedStats } from '../../rules'
import { Markdown } from '../../rulesqa/Markdown'
import { editionOf, sourceFor, spellSourcesFor } from '../../spellbook/access'
import { FadingResult } from '../../dice/ui'
import { RockSenseButton } from '../../rocksense'
import { useSheetRolls } from '../dice'
import { effectiveMaxHp } from '../engine'
import type { CombatTab, SheetSection } from '../mode'
import type { Apply } from '../types'
import {
  ACTION_KINDS, actionRoll, actionUses, actionsOf, hasActionEffect, isUsable, setActionActive, spendAction, addAction, isHealing, effectToggles, masteredWeapons, masteryLimit, featureDescription, newActionId, removeAction, resolveDice, spellAttackRows, updateAction,
  effectsUsed, type ActionKind, type CustomAction, type EffectToggle, type UsedEffect, type SpellAttackRow,
} from './combat'
import './combat.css'
import { LastRoll, type Shown } from './LastRoll'

interface Library {
  spells: Spell[]
  features: Feature[]
  traits: Trait[]
  feats: Feat[]
  equipment: Equipment[]
  classes: CharacterClass[]
  subclasses: Subclass[]
}

const EMPTY: Library = { spells: [], features: [], traits: [], feats: [], equipment: [], classes: [], subclasses: [] }

/** The character's edition of the content library. Empty while loading or if it fails: the page still works. */
function useLibrary(character: Character): Library {
  const edition = editionOf(character)
  const source = sourceFor(edition)
  const [lib, setLib] = useState<{ source: string; data: Library } | null>(null)
  useEffect(() => {
    let live = true
    const sources = [source]
    Promise.all([
      loadKind('spells', { sources: spellSourcesFor(edition) }), loadKind('features', { sources }), loadKind('traits', { sources }),
      loadKind('feats', { sources }), loadKind('equipment', { sources }),
      loadKind('classes', { sources: spellSourcesFor(edition) }), loadKind('subclasses', { sources: spellSourcesFor(edition) }),
    ])
      .then(([spells, features, traits, feats, equipment, classes, subclasses]) => { if (live) setLib({ source, data: { spells, features, traits, feats, equipment, classes, subclasses } }) })
      .catch(() => { if (live) setLib({ source, data: EMPTY }) })
    return () => { live = false }
  }, [source])
  return lib?.source === source ? lib.data : EMPTY
}

// ---------- Character card (both modes) ----------

/**
 * The top card in both sheet modes: portrait and level, class, race, background, XP, proficiency,
 * armor class, speed and passive perception, Level Up and Initiative, with the sheet's HP and Rest.
 */
export function CharacterCard({ character, vitals, onLevelUp, apply }: { character: Character; vitals: ReactNode; onLevelUp?: () => void; apply?: Apply }) {
  const { t, term, className, raceName } = useI18n()
  const d = derive(character)
  const rolls = useSheetRolls(character)
  const [last, setLast] = useState<Shown | null>(null)
  const bg = getBackground(character)
  const next = xpForNextLevel(d.level)
  const classes = character.classes.map(cl => {
    const sub = subclassOf(character, cl)
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
          {missingSubclasses(character).map(cl => (
            <p key={cl.classId} className="cs-warn" role="note">{t('cs.subclassMissing', { className: className(cl.classId), id: cl.subclassId! })}</p>
          ))}
          <p>{[raceName(character.raceId, character.subraceId, character.rulesEdition), bg && term('background', bg.id, bg.name)].filter(Boolean).join(' · ')}</p>
          <XpLine character={character} next={next} apply={apply} />
        </div>
        <dl className="cs-stats">
          <div><dt>{t('stat.ac')}</dt><dd className="cs-shield">{m('ac', d.armorClass.value)}</dd></div>
          <div><dt>{t('stat.speed')}</dt><dd className="cs-hex">{m('speed', d.speed)}</dd></div>
          <div><dt>{t('stat.prof')}</dt><dd>{m('proficiency', formatMod(d.proficiencyBonus))}</dd></div>
          <div><dt>{t('stat.passivePerception')}</dt><dd>{m('passivePerception', d.passivePerception)}</dd></div>
        </dl>
        <Perks d={d} />
        <div className="cs-hero-actions">
          {onLevelUp && d.level < 20 && (
            <button type="button" className={`btn cs-levelup${xpReady(character) ? ' primary ready' : ''}`} onClick={onLevelUp}
              title={xpReady(character) ? t('xp.ready', { level: d.level + 1 }) : undefined}>
              {xpReady(character) && <span aria-hidden="true">⬆ </span>}{t('cs.levelUp')}
            </button>
          )}
          <button type="button" className="btn primary cs-init" onClick={() => setLast({ roll: rolls.initiative(d), what: t('cs.roll.initiative') })}>
            {t('cs.initiative', { bonus: formatMod(d.initiative) })}
          </button>
          <RockSenseButton character={character} />
        </div>
        {last && <LastRoll key={last.roll.id} rolls={[last]} onDone={() => setLast(null)} />}
      </div>
      <div className="cs-vitals">{vitals}</div>
    </section>
  )
}

/** XP under the name: tap it to add XP (a minus number takes some away). */
function XpLine({ character, next, apply }: { character: Character; next?: number; apply?: Apply }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const text = next ? t('cs.xp', { xp: character.xp, next }) : t('cs.xpMax', { xp: character.xp })
  if (!apply) return <p className="cs-xp">{text}</p>
  const n = Math.trunc(Number(amount))
  const add = () => {
    if (!n) return
    apply(t('xp.log', { n: n > 0 ? `+${n}` : n }), c => ({ ...c, xp: Math.max(0, c.xp + n) }))
    setAmount('')
    setOpen(false)
  }
  return (
    <div className="cs-xp">
      <button type="button" className="cs-xp-btn" aria-expanded={open} onClick={() => setOpen(o => !o)} title={t('xp.add')}>
        {text} <span aria-hidden="true">＋</span>
      </button>
      {xpReady(character) && <span className="cs-xp-ready small">{t('xp.ready', { level: totalLevel(character) + 1 })}</span>}
      {open && (
        <form className="cs-xp-add" onSubmit={e => { e.preventDefault(); add() }}>
          <input type="number" inputMode="numeric" autoFocus value={amount} onChange={e => setAmount(e.target.value)} aria-label={t('xp.addLabel')} placeholder="XP" />
          <button className="btn small primary" disabled={!n}>{t('xp.addButton')}</button>
        </form>
      )}
    </div>
  )
}

/** Fly speed, darkvision, resistances, advantages: what items and switched-on actions add beyond the numbers. */
function Perks({ d }: { d: DerivedStats }) {
  const i18n = useI18n()
  const { t, term } = i18n
  const chips = [
    ...Object.entries(d.speeds).map(([mode, n]) => t('inv.fx.text.moveSpeed', { mode: t(`inv.move.${mode as 'fly'}`), n })),
    ...Object.entries(d.senses).map(([sense, n]) => t('inv.fx.text.sense', { sense: t(`inv.sense.${sense as 'darkvision'}`), n })),
    ...d.defenses.resistances.map(x => t('inv.fx.text.resistance', { damage: term('damage', x, x) })),
    ...d.defenses.immunities.map(x => t('inv.fx.text.immunity', { damage: term('damage', x, x) })),
    ...d.defenses.conditionImmunities.map(x => t('inv.fx.text.conditionImmunity', { condition: term('condition', x, x) })),
    ...d.advantages.map(a => t(a.when ? 'inv.fx.text.advantageWhen' : 'inv.fx.text.advantage', { on: advantageName(i18n, a.on), when: a.when ?? '' })),
  ]
  if (!chips.length) return null
  return (
    <ul className="cs-perks" aria-label={t('cs.perks')}>
      {[...new Set(chips)].map(c => <li key={c}><bdi>{c}</bdi></li>)}
    </ul>
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
                {d.saves[a].advantage && <small className="cs-adv">{t('cs.advBadge')}</small>}
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
              <span className="name">{skill(s)}{d.skills[s].advantage && <small className="cs-adv">{t('cs.advBadge')}</small>}</span>
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
  combat: 'cs.tab.combat', checks: 'cs.tab.checks', spells: 'cs.tab.spells', inventory: 'cs.tab.inventory', features: 'cs.tab.features', notes: 'cs.tab.notes',
}

/**
 * The combat page's tab bar and panel. `aside` sits beside the tabs (phones: the HP chip); with it
 * the bar sticks to the top of the screen, and switching tabs while it is stuck shows the new tab from its start.
 */
export function CombatTabs({ tabs, render, aside }: { tabs: Partial<Record<CombatTab, SheetSection[]>>; render: (s: SheetSection) => ReactNode; aside?: ReactNode }) {
  const { t } = useI18n()
  const [picked, setPicked] = useState<CombatTab>('combat')
  const box = useRef<HTMLDivElement>(null)
  const ids = Object.keys(tabs) as CombatTab[]
  // A tab that only exists on phones (Checks) falls back to Combat when the screen widens.
  const tab = tabs[picked] ? picked : 'combat'
  const setTab = (id: CombatTab) => {
    setPicked(id)
    const el = box.current
    if (aside && el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' })
  }
  const move = (e: React.KeyboardEvent, i: number) => {
    const by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!by) return
    // In right-to-left pages the arrows still point the way the eye moves.
    const dir = getComputedStyle(e.currentTarget).direction === 'rtl' ? -by : by
    const next = ids[(i + dir + ids.length) % ids.length]
    setTab(next)
    document.getElementById(`cs-tab-${next}`)?.focus()
  }
  const list = (
    <div className="cs-tablist" role="tablist" aria-label={t('cs.tabs')}>
      {ids.map((id, i) => (
        <button key={id} id={`cs-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls="cs-tabpanel"
          tabIndex={tab === id ? 0 : -1} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} onKeyDown={e => move(e, i)}>
          {t(TAB_KEYS[id])}
        </button>
      ))}
    </div>
  )
  return (
    <div className="cs-tabs" ref={box}>
      {aside ? <div className="cs-tabbar">{list}{aside}</div> : list}
      <div id="cs-tabpanel" role="tabpanel" aria-labelledby={`cs-tab-${tab}`} className="cs-tabpanel">
        {(tabs[tab] ?? []).map(render)}
      </div>
    </div>
  )
}

/** Phones: current HP in the sticky tab bar. Tapping it jumps to the HP card with the amount box ready. */
export function HpChip({ character }: { character: Character }) {
  const { t } = useI18n()
  const { currentHp, tempHp } = character.state
  const max = effectiveMaxHp(character)
  const pct = max ? (currentHp / max) * 100 : 0
  const go = () => {
    const input = document.getElementById('hp-amount') as HTMLInputElement | null
    input?.closest('section')?.scrollIntoView({ block: 'center' })
    input?.focus({ preventScroll: true })
  }
  return (
    <button type="button" className={`cs-hpchip ${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}`} onClick={go}
      aria-label={t('cs.hpChip', { hp: currentHp, max, temp: tempHp })}>
      <span aria-hidden="true">♥</span> {currentHp}<span className="of">/{max}</span>
      {tempHp > 0 && <span className="temp">+{tempHp}</span>}
    </button>
  )
}

// ---------- Combat tab: attacks, weapon mastery, effects, actions ----------

interface Outcome { name: string; rolls: Shown[]; note?: string; effects?: UsedEffect[]; healMe?: number }

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
  const effects = effectToggles(character, d, lib.spells)
  // The attacks table holds action spells; bonus action and reaction spells (Hellish Rebuke) sit in their own lists below.
  const spells = spellAttackRows(character, d, lib.spells).filter(r => {
    const s = lib.spells.find(x => x.name.toLowerCase() === r.name.toLowerCase())
    return !s || castingKind(s.castingTime) === 'action'
  })
  const alwaysPrepared = spellAccess(character, lib.classes, lib.subclasses, d.abilities, undefined, lib.spells).flatMap(a => a.alwaysPrepared)
  const turn = turnActions(character, d, { spells: lib.spells, alwaysPrepared, inTable: new Set(spells.map(r => r.name.toLowerCase())) })
  const [healedKey, setHealedKey] = useState(-1)
  const critRange = getCritRange(character)
  // Custom action effects are saved on the action, running spells on the character (their stat changes reach derive()); Rage and Sneak Attack are per-session switches.
  const isOn = (e: EffectToggle) =>
    e.id.startsWith('act:') ? !!character.customActions?.find(a => `act:${a.id}` === e.id)?.active
      : e.live || e.start ? !!e.live?.on
        : !!on[e.id]
  // A spell switched on is cast like Cast, and its rolls and notes show in the result box.
  const casting = useCast(character, apply)
  const toggle = (e: EffectToggle, value: boolean, slot?: SlotChoice) =>
    toggleEffect(e, value, apply, t, () => setOn(o => ({ ...o, [e.id]: value })), (spell, s) => show(casting.cast(spell, s)), slot)
  const active = effects.filter(isOn)
  const listed = effects.filter(e => !e.id.startsWith('act:'))
  const damaging = active.filter((e): e is EffectToggle & { damage: string } => !!e.damage)

  const weapon = (a: DerivedStats['attacks'][number]) => {
    const own = getDamageRiders(character, a).map(r => r.id as string)
    const used = damaging.filter(e => (!e.feature || own.includes(e.id)) && (!e.pactOnly || a.pact))
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
    // A 2014 smite is spent by the hit it rode on.
    const spent = used.filter(e => e.live?.once)
    if (r.damage && spent.length) apply(t('fx.log.spent', { name: spent.map(e => e.name).join(', ') }), spendOnceEffects)
  }

  const cast = (r: SpellAttackRow) => {
    const notes: string[] = []
    const choice = r.level > 0 ? slotChoices(character, r.level)[0] : undefined
    // A library spell also starts its running effect, so concentration (Hold Person) is tracked under Effects.
    const spell = lib.spells.find(s => s.name.toLowerCase() === r.name.toLowerCase())
    const plan = spell ? castPlan(character, d, spell, choice) : {}
    if (choice || plan.effect) {
      const log = choice ? t(choice.source === 'pact' ? 'cs.log.castPact' : 'cs.log.cast', { name: r.name, level: choice.level }) : t('cast.log', { name: r.name })
      apply(log, c => castSpell(c, plan, { slot: choice }).character)
    }
    if (choice) notes.push(t(choice.source === 'pact' ? 'cs.usedPact' : 'cs.usedSlot', { level: choice.level }))
    else if (r.level > 0) notes.push(t('cs.noSlot'))
    for (const name of plan.effect ? startEffect(character, plan.effect).ended : []) notes.push(t('cast.concEnded', { name }))
    if (r.kind === 'save' && r.save) notes.push(t('cs.saveNote', { dc: r.value, ability: abilityShort(r.save) }))
    const sc = d.spellcasting
    // A cantrip's row already has its damage with Agonizing Blast and Potent Spellcasting; a leveled spell may be upcast.
    const damage = r.level === 0 ? r.damage : spellDamage({ ...r.entry, id: '', kind: 'spell' }, choice?.level ?? r.level, d.level, sc ? d.mods[sc.ability] : 0)
    const used = r.kind === 'attack' && r.damageType !== 'healing' ? damaging.filter(e => !e.weaponOnly) : []
    const type = r.damageType ? term('damage', r.damageType, r.damageType) : ''
    // Each beam (Eldritch Blast, Scorching Ray) rolls to hit and for damage on its own, with the riders on every hit.
    const beams = r.kind === 'attack' ? spellBeams(r.entry, choice?.level ?? r.level, d.level) : 1
    const list: Shown[] = []
    let hit = false
    for (let i = 1; i <= beams; i++) {
      const riders = used.filter(e => !(hit && e.oncePerTurn)).map(e => ({ name: e.name, damage: e.damage }))
      const res = rolls.spell(r.name, { attackBonus: r.kind === 'attack' ? r.value : undefined, damage, damageType: r.damageType, mode, riders })
      const what = (s: string) => (beams > 1 ? t('cs.roll.beam', { what: s, n: i }) : s)
      if ('attack' in res && res.attack) list.push({ roll: res.attack, what: what(t('cs.roll.toHit')) })
      if (res.damage) list.push({ roll: res.damage, what: what(r.damageType === 'healing' ? t('cs.roll.healing') : t(type ? 'cs.roll.damage' : 'cs.roll.damagePlain', { type })) })
      hit ||= !!res.damage
    }
    show({
      name: r.name, rolls: list, note: notes.join(' · ') || undefined,
      effects: effectsUsed(active, hit ? used.map(e => e.id) : [], f =>
        (r.kind === 'attack' ? f.kind === 'spellAttack' : f.kind === 'spellDc') || ((f.kind === 'ability' || f.kind === 'abilitySet') && f.ability === sc?.ability)),
    })
  }

  /** A custom action: attack roll (with toggled effects on a hit) or save DC, then its dice. `extra` notes what Use did. */
  const runAction = (a: CustomAction, extra: string[] = []) => {
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
      note: [...extra, r.dc !== undefined ? t('cs.saveNote', { dc: r.dc, ability: r.save ? abilityShort(r.save) : '' }) : ''].filter(Boolean).join(' · ') || undefined,
      effects: effectsUsed(active.filter(e => e.id !== `act:${a.id}`), res.damage ? used.map(e => e.id) : [], f =>
        (f.kind === 'ability' || f.kind === 'abilitySet') && f.ability === a.roll?.ability),
    })
  }

  /** Use: spends a use, switches its effect on and rolls whatever it rolls, all in one tap. Out of uses still works, with a note. */
  const spendUse = (a: CustomAction) => {
    const uses = actionUses(character, a)
    const notes = [
      uses ? (uses.left <= 0 ? t('use.noneLeft') : t('use.left', { n: uses.left - 1, max: uses.max })) : '',
      hasActionEffect(a) && !a.active ? t('cs.actionOn', { name: a.name }) : '',
    ].filter(Boolean)
    apply(t('use.log', { label: a.name }), c => spendAction(c, a.id))
    if (actionRoll(a, d).dice || a.roll?.check) runAction(a, notes)
    else show({ name: a.name, rolls: [], note: notes.join(' · ') || undefined })
  }

  const ft = (n: number) => t('cs.feet', { n })
  const masteries = masteryLimit(character)
  const mastered = masteredWeapons(character, d.attacks.flatMap(a => (a.itemId ? [a.itemId] : [])))
    .map(m => ({ weapon: i18n.item(m.itemId, itemById(m.itemId)?.name ?? m.itemId), mastery: m.mastery }))

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
                <span className="name">{name}<small>{t(a.reach ? 'cs.melee' : 'cs.ranged')}{a.attacks ? ` · ${t('cs.attacksN', { n: a.attacks })}` : ''}</small></span>
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
              <span className="dmg">{r.damage ? <><span dir="ltr">{r.beams ? `${r.beams}× ` : ''}{r.damage}</span> {r.damageType ? term('damage', r.damageType, r.damageType) : ''}</> : '—'}</span>
            </button>
          </li>
        ))}
      </ul>
      {out && (
        <FadingResult key={outKey} ref={outRef} className="cs-out" onDone={() => setOut(null)}>
          <strong>{out.name}</strong>
          <LastRoll rolls={out.rolls} note={out.note} />
          {out.healMe !== undefined && healedKey !== outKey && character.state.currentHp > 0 && (
            <button type="button" className="glass-btn small" onClick={() => {
              setHealedKey(outKey)
              apply(t('cast.log.healMe', { n: out.healMe!, name: out.name }), c => heal(c, out.healMe!))
            }}>{t('cast.healMe', { n: out.healMe })}</button>
          )}
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

      {/* Weapon Mastery is a 2024 rule: characters without it (every 2014 one) get no box. */}
      {masteries > 0 && <>
        <h3 className="cs-sub">{t('cs.mastery')} <span className="cs-count" dir="ltr">{mastered.length}/{masteries}</span></h3>
        {mastered.length
          ? <ul className="cs-rows">{mastered.map(m => <li key={m.weapon}><span>{term('mastery', m.mastery, cap(m.mastery))}</span><span className="hint">{m.weapon}</span></li>)}</ul>
          : <p className="hint">{t('cs.noMastery')}</p>}
      </>}

      <CunningStrike character={character} d={d} />

      <h3 className="cs-sub">{t('cs.effects')}</h3>
      {/* The player's own actions keep their switch on their row below, so each shows once. */}
      {listed.length
        ? <EffectRows character={character} effects={listed} isOn={isOn} onToggle={toggle} apply={apply} />
        : <p className="hint">{t('cs.noEffects')}</p>}

      <CustomActions character={character} apply={apply} onRoll={a => runAction(a)} onUse={spendUse}
        auto={k => <TurnRows rows={turn[k]} character={character} apply={apply} features={lib.features} onOut={show} />} hasAuto={k => turn[k].length > 0} />
    </section>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const KIND_TITLE: Record<ActionKind, MessageKey> = {
  action: 'cs.actions', bonus: 'cs.bonusActions', reaction: 'cs.reactions', free: 'cs.freeActions', other: 'cs.otherActions',
}

/** The player's own actions, bonus actions, reactions, free actions and other abilities, grouped like Roll20. */
function CustomActions({ character, apply, onRoll, onUse, auto, hasAuto }: {
  character: Character; apply: Apply; onRoll: (a: CustomAction) => void; onUse: (a: CustomAction) => void
  /** The rows filled in from the character's spells and features, above the player's own. */
  auto: (k: ActionKind) => ReactNode; hasAuto: (k: ActionKind) => boolean
}) {
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
            {list.length === 0 && adding !== k && !hasAuto(k) && <p className="hint">{t('cs.noActions')}</p>}
            {auto(k)}
            <ul className="cs-rows">
              {list.map(a => {
                if (editing === a.id) {
                  return (
                    <li key={a.id} className="cs-action">
                      <ActionForm kind={a.kind} stats={d} initial={a} onCancel={() => setEditing(null)}
                        onSave={p => { apply(t('cs.log.actionEdited', { name: p.name }), c => updateAction(c, a.id, { roll: undefined, effect: undefined, stats: undefined, description: undefined, uses: undefined, ...p })); setEditing(null) }} />
                    </li>
                  )
                }
                const sum = summary(a)
                const uses = actionUses(character, a)
                return (
                  <li key={a.id} className="cs-action">
                    <div className="cs-action-row">
                      {a.description
                        ? <details><summary><span>{a.name}</span></summary><p className="cs-desc-text">{a.description}</p></details>
                        : <span className="cs-action-name">{a.name}</span>}
                      <span className="cs-action-tools">
                        {uses && <span className={`cs-uses${uses.left ? '' : ' empty'}`} title={t('use.left', { n: uses.left, max: uses.max })} dir="ltr">{uses.left}/{uses.max}</span>}
                        {isUsable(a)
                          ? (
                            <button type="button" className="glass-btn small prominent cs-action-use" onClick={() => onUse(a)}
                              aria-label={sum ? t('cs.useAction', { name: a.name, what: sum }) : t('use.useName', { label: a.name })}>
                              {t('use.use')}{sum && <> · <span dir="ltr">{sum}</span></>}
                            </button>
                          )
                          : sum && (
                            <button type="button" className="btn small cs-action-roll" onClick={() => onRoll(a)} aria-label={t('cs.rollAction', { name: a.name, what: sum })}>
                              <span aria-hidden="true">🎲</span> <span dir="ltr">{sum}</span>
                            </button>
                          )}
                        {hasActionEffect(a) && (
                          <label className="cs-switch cs-action-switch" title={t('cs.effectTagHint')}>
                            <input type="checkbox" role="switch" checked={!!a.active} aria-label={t('cs.actionSwitch', { name: a.name })}
                              onChange={e => apply(t(e.target.checked ? 'cs.log.effectOn' : 'cs.log.effectOff', { name: a.name }), c => setActionActive(c, a.id, e.target.checked))} />
                            <span>{t('cs.effectTag')}</span>
                          </label>
                        )}
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

/**
 * The rows filled in from the character: spells with Cast (free ones spend their own use), resources with Use,
 * features that spend a pool or trigger (Dark One's Blessing), reminders (Cunning Action) and the pact weapon.
 */
function TurnRows({ rows, character, apply, features, onOut }: { rows: TurnRow[]; character: Character; apply: Apply; features: Feature[]; onOut: (o: Outcome) => void }) {
  const i18n = useI18n()
  const { t, term } = i18n
  const casting = useCast(character, apply)
  const uses = useResourceUse(character, apply, onOut)
  const rolls = useSheetRolls(character)
  const d = derive(character)
  if (!rows.length) return null
  const spellRows = rows.filter((r): r is Extract<TurnRow, { type: 'spell' }> => r.type === 'spell')
  const other = rows.filter(r => r.type !== 'spell')
  const left = (id: string) => {
    const r = d.resources.find(x => x.id === id)
    return r ? { n: r.max - (character.state.resources[r.id]?.used ?? 0), max: r.max, label: term('resource', r.id, r.label) } : undefined
  }
  const castFree = (r: Extract<TurnRow, { type: 'spell' }>) => onOut(casting.cast(r.spell, undefined, r.free))

  /** A feature without uses: spends from its pool (Flurry of Blows) and does what its template says (Dark One's Blessing). */
  const triggerFeature = (r: Extract<TurnRow, { type: 'feature' }>) => {
    const cl = character.classes.find(x => x.classId === r.className.toLowerCase())
    const plan = r.use ? planUse(r.use, r.name, { edition: rulesEdition(character), classLevel: cl?.level ?? d.level, mods: d.mods }) : {}
    const shown: Shown[] = []
    const amount = (notation: string | undefined, what: string) => {
      if (!notation) return undefined
      const fixed = fixedAmount(notation)
      if (fixed !== undefined) return fixed
      const roll = rolls.spell(r.name, { damage: notation, damageType: what }).damage
      if (roll) shown.push({ roll, what })
      return roll?.total
    }
    const tempHp = amount(plan.tempHp, t('cast.tempHp'))
    const healed = amount(plan.heal, t('cs.roll.healing'))
    const pool = r.spend && left(r.spend.id)
    const notes = [
      pool ? t('turn.spent', { n: r.spend!.n, pool: pool.label }) : '',
      pool ? (pool.n < r.spend!.n ? t('use.noneLeft') : t('use.left', { n: pool.n - r.spend!.n, max: pool.max })) : '',
      tempHp ? t('cast.gotTempHp', { n: tempHp }) : '', healed ? t('cast.healed', { n: healed }) : '', plan.effect ? t('cast.inEffect') : '',
    ].filter(Boolean)
    apply(t('use.log', { label: r.name }), c => r.spend ? spendResource(c, r.spend.id, plan, { tempHp, heal: healed }, r.spend.n) : applyUse(c, plan, { tempHp, heal: healed }))
    onOut({ name: r.name, rolls: shown, note: notes.join(' · ') || undefined })
  }

  return (
    <>
      {other.length > 0 && (
        <ul className="cs-rows cs-turn">
          {other.map(r => {
            if (r.type === 'pact') return <PactRow key={r.key} character={character} apply={apply} />
            if (r.type === 'resource') {
              const res = r.resource
              const label = term('resource', res.id, res.label)
              const l = left(res.id)
              return (
                <li key={r.key} className="cs-action">
                  <div className="cs-action-row">
                    <FeatureName name={label} text={describe(features, d, res.label, t)} />
                    <span className="cs-action-tools">
                      {l && <span className="track-count" dir="ltr">{l.n}/{l.max}</span>}
                      <button type="button" className="glass-btn small prominent" aria-label={t('use.useName', { label })} aria-expanded={uses.pool === res.id || undefined}
                        onClick={() => (uses.pool === res.id ? uses.setPool(null) : uses.use(res, label))}>{t('use.use')}</button>
                    </span>
                  </div>
                  {uses.pool === res.id && l && (
                    <PoolForm left={l.n} missing={Math.max(0, d.maxHp - character.state.currentHp)} label={label} onSpend={(n, self) => uses.spendPool(res, label, n, self)} />
                  )}
                  {uses.picking?.id === res.id && <FormPicker character={character} limit={uses.picking.limit} label={label} onPick={f => uses.pickForm(res, label, f)} />}
                </li>
              )
            }
            const l = r.spend && left(r.spend.id)
            const button = r.use === 'dark-ones-blessing' ? t('turn.droppedFoe') : t('use.use')
            return (
              <li key={r.key} className="cs-action">
                <div className="cs-action-row">
                  <FeatureName name={r.name} text={r.text ?? describe(features, d, r.name, t)} />
                  {(r.use || r.spend) && (
                    <span className="cs-action-tools">
                      {l && <span className="track-count" dir="ltr">{l.n}/{l.max}</span>}
                      <button type="button" className="glass-btn small prominent" onClick={() => triggerFeature(r)}
                        aria-label={r.use === 'dark-ones-blessing' ? t('turn.droppedFoeName', { name: r.name }) : t('use.useName', { label: r.name })}>{button}</button>
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {spellRows.length > 0 && (
        <ul className="sb-list cs-turn-spells">
          {spellRows.map(r => {
            const badge = r.spell.level === 0 ? t('spells.cantrip') : t(`sheet.slot.${r.free?.level ?? r.spell.level}` as MessageKey)
            const running = (character.state.effects ?? []).some(e => e.id === `spell:${r.spell.id}` && e.on)
            const l = r.free?.spend && left(r.free.spend.id)
            return (
              <SpellRow key={r.key} spell={r.spell} badge={r.free ? `${badge} · ${t('turn.from', { source: r.free.source })}` : badge} running={running}>
                {l && <span className="track-count" dir="ltr">{l.n}/{l.max}</span>}
                {r.free
                  ? <button type="button" className="glass-btn small prominent" aria-label={t('use.castFree', { name: r.spell.name, source: r.free.source })} onClick={() => castFree(r)}>{t('cast.cast')}</button>
                  : <CastButton character={character} spell={r.spell} onCast={(s, slot) => onOut(casting.cast(s, slot))} />}
              </SpellRow>
            )
          })}
        </ul>
      )}
    </>
  )
}

/** A feature's text from the library or the builder's explanations, found by its name. */
function describe(features: Feature[], d: DerivedStats, name: string, explain: (key: MessageKey) => string): string | undefined {
  const base = name.replace(/\s*\(.*\)\s*$/, '')
  const f = d.features.find(x => x.name === name || x.name === base)
  return f ? featureDescription(features, f, explain) : undefined
}

/** The feature's name; tapping it opens its text when there is any. */
function FeatureName({ name, text }: { name: string; text?: string }) {
  return text
    ? <details><summary><span>{name}</span></summary><div className="cs-desc-text"><Markdown text={text} /></div></details>
    : <span className="cs-action-name">{name}</span>
}

/** Pact of the Blade: which weapon is the pact weapon now, and Summon to make one of yours it or conjure a new one. */
/** 2024 Pact of the Blade: the pact weapon can deal necrotic, psychic or radiant damage instead of its own. */
const PACT_TYPES = ['necrotic', 'psychic', 'radiant']

function PactRow({ character, apply }: { character: Character; apply: Apply }) {
  const i18n = useI18n()
  const { t, term } = i18n
  const [open, setOpen] = useState(false)
  const nameOf = (e: Character['inventory'][number]) => e.name ?? i18n.item(e.itemId, entryItem(e)?.name ?? e.itemId)
  const current = character.inventory.find(e => e.pact)
  const mine = character.inventory.filter(e => isMeleeWeapon(entryItem(e)))
  const conjurable = ITEMS.filter(isMeleeWeapon)
  const summon = (pick: { uid: string } | { itemId: string }, name: string) => {
    apply(t('turn.log.pact', { name }), c => summonPactWeapon(c, pick))
    setOpen(false)
  }
  return (
    <li className="cs-action">
      <div className="cs-action-row">
        <span className="cs-action-name">{t('turn.pact')}<small className="hint"> · {current ? nameOf(current) : t('turn.pactNone')}</small></span>
        <span className="cs-action-tools">
          {current && (
            <select className="cs-pact-type" value={current.damageType ?? ''} aria-label={t('turn.pactType')}
              onChange={e => { const v = e.target.value; apply(t('turn.log.pactType', { type: v ? term('damage', v, v) : t('turn.pactTypeOwn') }), c => updateEntry(c, current.uid, { damageType: v || undefined })) }}>
              <option value="">{t('turn.pactTypeOwn')}</option>
              {PACT_TYPES.map(d => <option key={d} value={d}>{term('damage', d, d)}</option>)}
            </select>
          )}
          <button type="button" className="glass-btn small prominent" aria-expanded={open} aria-label={t('turn.pactSummonName')} onClick={() => setOpen(o => !o)}>{t('turn.pactSummon')}</button>
        </span>
      </div>
      {open && (
        <div className="cs-pact" role="group" aria-label={t('turn.pactSummonName')}>
          {mine.length > 0 && <>
            <span className="hint">{t('turn.pactYours')}</span>
            <div className="cs-pact-chips">
              {mine.map(e => (
                <button key={e.uid} type="button" className={`glass-chip${e.pact ? ' on' : ''}`} aria-pressed={!!e.pact} onClick={() => summon({ uid: e.uid }, nameOf(e))}>{nameOf(e)}</button>
              ))}
            </div>
          </>}
          <label className="hint">{t('turn.pactConjure')}
            <select value="" onChange={e => { const w = conjurable.find(x => x.id === e.target.value); if (w) summon({ itemId: w.id }, i18n.item(w.id, w.name)) }}>
              <option value="">…</option>
              {conjurable.map(w => <option key={w.id} value={w.id}>{i18n.item(w.id, w.name)}</option>)}
            </select>
          </label>
        </div>
      )}
    </li>
  )
}

type Check = 'none' | 'attack' | 'save'
/** How many uses: unlimited, a typed number, the proficiency bonus or an ability modifier. */
type UsesCount = 'none' | 'number' | 'pb' | Ability

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
  const initialCount = initial?.uses?.count
  const [usesKind, setUsesKind] = useState<UsesCount>(initialCount === undefined ? 'none' : typeof initialCount === 'number' ? 'number' : initialCount)
  const [usesN, setUsesN] = useState(typeof initialCount === 'number' ? String(initialCount) : '1')
  const [recharge, setRecharge] = useState<Recharge>(initial?.uses?.recharge ?? 'long')
  const usesBad = usesKind === 'number' && !(Number(usesN) >= 1)
  const diceBad = !!dice.trim() && !resolveDice(dice, stats)
  const fxBad = hasEffect && !resolveDice(fx, stats)
  const ok = !!name.trim() && !diceBad && !fxBad && !usesBad

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
      ...(usesKind !== 'none' ? { uses: { count: usesKind === 'number' ? Math.floor(Number(usesN)) : usesKind, recharge } } : {}),
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
        <legend>{t('cs.form.uses')}</legend>
        <label>{t('cs.form.usesCount')}
          <select value={usesKind} onChange={e => setUsesKind(e.target.value as UsesCount)}>
            <option value="none">{t('cs.form.usesNone')}</option>
            <option value="number">{t('cs.form.usesNumber')}</option>
            <option value="pb">{t('cs.form.usesPb')}</option>
            {ABILITIES.map(a => <option key={a} value={a}>{t('cs.form.usesMod', { ability: abilityShort(a) })}</option>)}
          </select>
        </label>
        {usesKind === 'number' && (
          <label>{t('cs.form.usesN')}<input type="number" min={1} inputMode="numeric" value={usesN} onChange={e => setUsesN(e.target.value)} aria-invalid={usesBad} /></label>
        )}
        {usesKind !== 'none' && (
          <label>{t('cs.form.recharge')}
            <select value={recharge} onChange={e => setRecharge(e.target.value as Recharge)}>
              {(['short', 'long', 'dawn', 'none'] as const).map(r => <option key={r} value={r}>{t(`rest.${r}`)}</option>)}
            </select>
          </label>
        )}
        <p className="hint wide">{t('cs.form.usesHint')}</p>
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

/** SRD 5.2 Cunning Strike (Rogue 5) and Devious Strikes (Rogue 14): what Sneak Attack dice can buy, and the save DC. */
const CUNNING_STRIKES: { id: string; cost: number; level: number }[] = [
  { id: 'poison', cost: 1, level: 5 }, { id: 'trip', cost: 1, level: 5 }, { id: 'withdraw', cost: 1, level: 5 },
  { id: 'daze', cost: 2, level: 14 }, { id: 'knockOut', cost: 6, level: 14 }, { id: 'obscure', cost: 3, level: 14 },
]

function CunningStrike({ character, d }: { character: Character; d: DerivedStats }) {
  const { t } = useI18n()
  const rogue = character.classes.filter(cl => cl.classId === 'rogue').reduce((n, cl) => n + cl.level, 0)
  if (character.rulesEdition !== '2024' || rogue < 5) return null
  const dc = 8 + d.mods.dex + d.proficiencyBonus
  return (
    <>
      <h3 className="cs-sub">{t('cs.cunning')} <span className="cs-count" dir="ltr">{t('cs.cunningDc', { dc })}</span></h3>
      <p className="hint">{t(rogue >= 11 ? 'cs.cunningIntroTwo' : 'cs.cunningIntro')}</p>
      <ul className="cs-rows">
        {CUNNING_STRIKES.filter(x => rogue >= x.level).map(x => (
          <li key={x.id}>
            <span>{t(`cs.cunning.${x.id}` as MessageKey)} <span className="hint" dir="ltr">−{x.cost}d6</span></span>
            <span className="hint">{t(`cs.cunning.${x.id}.text` as MessageKey)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

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
  // Our own summary (every official feat has one), then the player's text, then the SRD library.
  const feats = getFeats(character)
  const featText = (f: (typeof feats)[number]) => {
    const key = featExplainKey(f.id, rulesEdition(character))
    return (key ? t(key) : undefined) || f.description || lib.feats.find(x => x.name.toLowerCase() === f.name.toLowerCase())?.description
  }
  // Custom subclass text, then that subclass's own summary or SRD entry (see featureDescription).
  const option = (f: DerivedStats['features'][number]) => (f.optionId ? classOptionById(f.optionId, rulesEdition(character)) : undefined)
  const featureName = (f: DerivedStats['features'][number]) => {
    const o = option(f)
    // A repeated 2024 invocation keeps its cantrip: "Agonizing Blast (Eldritch Blast)".
    return o ? optionName(o, term) + f.name.slice(f.name.startsWith(o.name) ? o.name.length : f.name.length) : term('feature', f.name, f.name)
  }
  const featureText = (f: DerivedStats['features'][number]) => {
    const o = option(f)
    if (o) {
      const k = optionKey(o)
      return f.text || (k ? t(k) : undefined)
    }
    return featureDescription(lib.features, f, t)
  }
  const list = (kind: string, xs: string[]) => xs.map(x => term(kind, x, x)).join(', ') || t('common.none')
  return (
    <section className="card cs-features" aria-labelledby="cs-features-title">
      <h2 id="cs-features-title">{t('cs.classFeatures')}</h2>
      <ul className="cs-rows">
        {d.features.map(f => (
          <Described key={`${f.className}-${f.level}-${f.optionId ?? f.name}`} name={featureName(f)} meta={t('cs.featureMeta', { cls: f.className, level: f.level }) + (f.detail ? ` · ${term('detail', f.detail, f.detail)}` : '')}
            text={featureText(f)} />
        ))}
      </ul>
      <h3 className="cs-sub">{t('cs.racialTraits')}</h3>
      {d.traits.length
        ? <ul className="cs-rows">{d.traits.map(x => <Described key={x} name={term('trait', x, x)} text={traitText(x)} />)}</ul>
        : <p className="hint">{t('common.none')}</p>}
      {feats.length > 0 && <>
        <h3 className="cs-sub">{t('cs.feats')}</h3>
        <ul className="cs-rows">{feats.map((f, i) => <Described key={`${f.id}-${i}`} name={term('feat', f.id, f.name)} text={featText(f)} />)}</ul>
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
