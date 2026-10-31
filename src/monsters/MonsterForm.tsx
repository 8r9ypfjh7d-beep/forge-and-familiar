// Editor for a whole monster stat block. Controlled: it shows `value` and reports every change through
// `onChange`; the screen around it (homebrew pack, NPC creator) decides when to save. Numbers the book
// derives (XP and proficiency from CR, hit points from hit dice, saves and skills from proficiency,
// passive Perception, spell DC) fill themselves in and can still be typed over.
import { useId, useState, type ReactNode } from 'react'
import { Why } from '../builder/Why'
import type { Ability, MonsterAction, Size } from '../content/types'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/locales/en'
import { ABILITIES } from '../rules/types'
import {
  AC_TYPES, ACTION_GROUPS, ALIGNMENTS, CONDITION_IDS, CR_STEPS, DAMAGE_TYPES, MONSTER_SIZES, MONSTER_TYPES, SENSE_KINDS, SKILL_IDS, SKILLS, SPEED_KINDS,
  averageOf, blankAction, hitDieForSize, hitPointsRollFor, perceptionFromSkills, proficiencyForCr, proficientSave, proficientSkill, xpForCr,
  type ActionGroup, type MonsterBlock,
} from './model'
import type { MonsterSpellcasting } from '../content/types'
import { monsterMod as abilityMod } from './block'
import { crLabel } from './format'
import './form.css'

export interface MonsterFormProps {
  value: MonsterBlock
  onChange: (m: MonsterBlock) => void
}

const feet = (s: string | boolean | undefined) => (typeof s === 'string' ? Number(s.replace(/[^0-9]/g, '')) || 0 : 0)
const ft = (n: number) => `${n} ft.`
const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const numOr = (s: string, fallback: number) => (s === '' || Number.isNaN(Number(s)) ? fallback : Number(s))

function Field({ label, children, wide, why }: { label: string; children: ReactNode; wide?: boolean; why?: MessageKey }) {
  const { t } = useI18n()
  return (
    <label className={`mf-field ${wide ? 'wide' : ''}`}>
      <span className={why ? 'why-legend' : undefined}>{label}{why && <> <Why compact title={label} text={t(why)} /></>}</span>
      {children}
    </label>
  )
}

function Section({ title, why, children, actions }: { title: string; why?: MessageKey; children: ReactNode; actions?: ReactNode }) {
  const { t } = useI18n()
  return (
    <fieldset className="mf-section">
      <legend className={why ? 'why-legend' : undefined}>{title}{why && <> <Why compact title={title} text={t(why)} /></>}</legend>
      {children}
      {actions && <div className="row mf-section-actions">{actions}</div>}
    </fieldset>
  )
}

function Chip({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`mf-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={onToggle}>{label}</button>
  )
}

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter(y => y !== x) : [...xs, x])

export function MonsterForm({ value: m, onChange }: MonsterFormProps) {
  const { t, term, ability, abilityShort, skill: skillName, locale } = useI18n()
  const uid = useId()
  const set = (patch: Partial<MonsterBlock>) => onChange({ ...m, ...patch })
  const dieCount = Number(m.hitDice.match(/^(\d+)d/)?.[1] ?? 1)
  // Hit points follow size, CON and the dice count until the DM types their own numbers.
  const [autoHp, setAutoHp] = useState(() => m.hitPointsRoll === hitPointsRollFor(dieCount, m.sizes[0] ?? 'Medium', m.abilities.con) && m.hitPoints === Math.max(1, averageOf(m.hitPointsRoll)))
  const [autoPp, setAutoPp] = useState(() => m.senses.passive_perception === perceptionFromSkills(m))

  const withHp = (next: MonsterBlock, count = dieCount): MonsterBlock => {
    if (!autoHp) return next
    const roll = hitPointsRollFor(count, next.sizes[0] ?? 'Medium', next.abilities.con)
    return { ...next, hitDice: `${count}d${hitDieForSize(next.sizes[0] ?? 'Medium')}`, hitPointsRoll: roll, hitPoints: Math.max(1, averageOf(roll)) }
  }
  const withPp = (next: MonsterBlock): MonsterBlock => (autoPp ? { ...next, senses: { ...next.senses, passive_perception: perceptionFromSkills(next) } } : next)
  /** Saves and skills that were at their proficient value follow a changed ability or CR. */
  const withDerived = (next: MonsterBlock): MonsterBlock => {
    const saves = { ...next.savingThrows }
    for (const a of ABILITIES) if (saves[a] !== undefined && saves[a] === proficientSave(m, a)) saves[a] = proficientSave(next, a)
    const skills = { ...next.skills }
    for (const s of Object.keys(skills)) {
      if (skills[s] === proficientSkill(m, s)) skills[s] = proficientSkill(next, s)
      else if (skills[s] === proficientSkill(m, s, true)) skills[s] = proficientSkill(next, s, true)
    }
    return withPp({ ...next, savingThrows: saves, skills })
  }

  const setAbility = (a: Ability, score: number) => onChange(withHp(withDerived({ ...m, abilities: { ...m.abilities, [a]: Math.max(1, Math.min(30, score)) } })))
  const setSizes = (sizes: Size[]) => onChange(withHp({ ...m, sizes: MONSTER_SIZES.filter(s => sizes.includes(s)) }))
  const setCr = (cr: number) => onChange(withDerived({ ...m, challengeRating: cr, xp: xpForCr(cr), proficiencyBonus: proficiencyForCr(cr) }))
  const setDice = (count: number) => onChange(withHp({ ...m }, Math.max(1, Math.min(60, count))))
  const setSpeed = (k: (typeof SPEED_KINDS)[number], n: string) => {
    const speed = { ...m.speed }
    if (n === '') delete speed[k]
    else speed[k] = ft(Math.max(0, numOr(n, 0)))
    set({ speed })
  }
  const setSense = (k: (typeof SENSE_KINDS)[number], n: string) => {
    const senses = { ...m.senses }
    if (n === '') delete senses[k]
    else senses[k] = ft(Math.max(0, numOr(n, 0)))
    set({ senses })
  }
  const setSave = (a: Ability, on: boolean, bonus?: number) => {
    const saves = { ...m.savingThrows }
    if (!on) delete saves[a]
    else saves[a] = bonus ?? proficientSave(m, a)
    set({ savingThrows: saves })
  }
  const skillLevel = (s: string): 'none' | 'prof' | 'expert' | 'custom' => {
    const v = m.skills[s]
    if (v === undefined) return 'none'
    if (v === proficientSkill(m, s)) return 'prof'
    if (v === proficientSkill(m, s, true)) return 'expert'
    return 'custom'
  }
  const setSkill = (s: string, level: string, bonus?: number) => {
    const skills = { ...m.skills }
    if (level === 'none') delete skills[s]
    else if (level === 'prof') skills[s] = proficientSkill(m, s)
    else if (level === 'expert') skills[s] = proficientSkill(m, s, true)
    else skills[s] = bonus ?? skills[s] ?? proficientSkill(m, s)
    onChange(withPp({ ...m, skills }))
  }
  const setActions = (g: ActionGroup, list: MonsterAction[]) => {
    const next = { ...m, [g]: list } as MonsterBlock
    if (g === 'lairActions' && !list.length) delete next.lairActions
    onChange(next)
  }
  const setSpellcasting = (sc: MonsterSpellcasting | undefined) => {
    const next = { ...m }
    if (sc) next.spellcasting = sc
    else delete next.spellcasting
    onChange(next)
  }

  const casterDefaults = (a: Ability) => ({ saveDc: 8 + m.proficiencyBonus + abilityMod(m.abilities[a]), attackBonus: m.proficiencyBonus + abilityMod(m.abilities[a]) })
  const dmgType = (d: string) => term('damage', d, d)
  const typeList = `${uid}-types`
  const alignList = `${uid}-align`
  const acList = `${uid}-ac`
  const dmgList = `${uid}-dmg`

  return (
    <div className="mf" dir={locale === 'he' ? 'rtl' : 'ltr'}>
      <datalist id={typeList}>{MONSTER_TYPES.map(x => <option key={x} value={x} />)}</datalist>
      <datalist id={alignList}>{ALIGNMENTS.map(x => <option key={x} value={x} />)}</datalist>
      <datalist id={acList}>{AC_TYPES.map(x => <option key={x} value={x} />)}</datalist>
      <datalist id={dmgList}>{DAMAGE_TYPES.map(x => <option key={x} value={x} />)}</datalist>

      <Section title={t('mf.sec.identity')}>
        <div className="mf-fields">
          <Field label={t('mf.f.name')} wide><input value={m.name} onChange={e => set({ name: e.target.value })} autoFocus placeholder={t('mf.f.namePlaceholder')} /></Field>
          <div className="mf-field wide">
            <span className="why-legend">{t('mf.f.size')} <Why compact title={t('mf.f.size')} text={t('mf.why.size')} /></span>
            <div className="mf-chips">
              {MONSTER_SIZES.map(s => <Chip key={s} label={t(`mf.size.${s}`)} on={m.sizes.includes(s)} onToggle={() => { const next = toggle(m.sizes, s); if (next.length) setSizes(next) }} />)}
            </div>
          </div>
          <Field label={t('mf.f.type')}><input list={typeList} value={m.type} onChange={e => set({ type: e.target.value.toLowerCase() })} /></Field>
          <Field label={t('mf.f.subtype')}><input value={m.subtype ?? ''} placeholder={t('mf.f.subtypePlaceholder')} onChange={e => set({ subtype: e.target.value.trim() ? e.target.value : undefined })} /></Field>
          <Field label={t('mf.f.alignment')}><input list={alignList} value={m.alignment} onChange={e => set({ alignment: e.target.value })} /></Field>
          <Field label={t('mf.f.languages')} wide><input value={m.languages} onChange={e => set({ languages: e.target.value })} placeholder={t('mf.f.languagesPlaceholder')} /></Field>
        </div>
      </Section>

      <Section title={t('mf.sec.challenge')} why="mf.why.cr">
        <div className="mf-fields">
          <Field label={t('mf.f.cr')}>
            <select value={m.challengeRating} onChange={e => setCr(Number(e.target.value))}>
              {CR_STEPS.map(cr => <option key={cr} value={cr}>{crLabel(cr)}</option>)}
            </select>
          </Field>
          <Field label={t('mf.f.xp')}><input type="number" min={0} value={m.xp} onChange={e => set({ xp: Math.max(0, numOr(e.target.value, 0)) })} /></Field>
          <Field label={t('mf.f.pb')} why="mf.why.pb"><input type="number" min={2} max={9} value={m.proficiencyBonus} onChange={e => onChange(withDerived({ ...m, proficiencyBonus: Math.max(2, Math.min(9, numOr(e.target.value, 2))) }))} /></Field>
        </div>
      </Section>

      <Section title={t('mf.sec.abilities')} why="mf.why.abilities">
        <div className="mf-abilities">
          {ABILITIES.map(a => (
            <label key={a} className="mf-ability">
              <span>{abilityShort(a)}</span>
              <input type="number" min={1} max={30} value={m.abilities[a]} aria-label={ability(a)} onChange={e => setAbility(a, numOr(e.target.value, 10))} />
              <small>{sign(abilityMod(m.abilities[a]))}</small>
            </label>
          ))}
        </div>
      </Section>

      <Section title={t('mf.sec.defenses')}>
        <div className="mf-fields">
          <div className="mf-field wide">
            <span className="why-legend">{t('mf.f.ac')} <Why compact title={t('mf.f.ac')} text={t('mf.why.ac')} /></span>
            {m.armorClass.map((ac, i) => (
              <div key={i} className="row mf-row">
                <input type="number" min={0} max={40} className="mf-num" value={ac.value} aria-label={t('mf.f.acValue')} onChange={e => set({ armorClass: m.armorClass.map((x, j) => (j === i ? { ...x, value: numOr(e.target.value, 10) } : x)) })} />
                <input list={acList} value={ac.type ?? ''} placeholder={t('mf.f.acType')} aria-label={t('mf.f.acType')} onChange={e => set({ armorClass: m.armorClass.map((x, j) => (j === i ? { ...x, type: e.target.value || undefined } : x)) })} />
                <input value={ac.note ?? ''} placeholder={t('mf.f.acNote')} aria-label={t('mf.f.acNote')} onChange={e => set({ armorClass: m.armorClass.map((x, j) => (j === i ? { ...x, note: e.target.value || undefined } : x)) })} />
                {m.armorClass.length > 1 && <button type="button" className="glass-btn small mf-ghost" aria-label={t('mf.remove')} onClick={() => set({ armorClass: m.armorClass.filter((_, j) => j !== i) })}>✕</button>}
              </div>
            ))}
            {m.armorClass.length < 4 && <button type="button" className="glass-btn small mf-add" onClick={() => set({ armorClass: [...m.armorClass, { value: m.armorClass[0]?.value ?? 10 }] })}>{t('mf.addAc')}</button>}
          </div>
          <Field label={t('mf.f.hitDice')} why="mf.why.hp">
            <div className="row mf-row">
              <input type="number" min={1} max={60} className="mf-num" value={dieCount} onChange={e => { setAutoHp(true); setDice(numOr(e.target.value, 1)) }} />
              <span className="mf-static">d{hitDieForSize(m.sizes[0] ?? 'Medium')}</span>
            </div>
          </Field>
          <Field label={t('mf.f.hp')}><input type="number" min={1} max={2000} value={m.hitPoints} onChange={e => { setAutoHp(false); set({ hitPoints: Math.max(1, numOr(e.target.value, 1)) }) }} /></Field>
          <Field label={t('mf.f.hpRoll')}><input value={m.hitPointsRoll} onChange={e => { setAutoHp(false); set({ hitPointsRoll: e.target.value, hitDice: e.target.value.replace(/[+-].*$/, '') }) }} placeholder="5d8+10" /></Field>
          {!autoHp && <button type="button" className="glass-btn small mf-add" onClick={() => { setAutoHp(true); onChange({ ...m, hitDice: `${dieCount}d${hitDieForSize(m.sizes[0] ?? 'Medium')}`, hitPointsRoll: hitPointsRollFor(dieCount, m.sizes[0] ?? 'Medium', m.abilities.con), hitPoints: Math.max(1, averageOf(hitPointsRollFor(dieCount, m.sizes[0] ?? 'Medium', m.abilities.con))) }) }}>{t('mf.recalcHp')}</button>}
        </div>
        <div className="mf-fields mf-speeds">
          {SPEED_KINDS.map(k => (
            <Field key={k} label={t(`mf.speed.${k}`)}>
              <div className="row mf-row">
                <input type="number" min={0} max={999} className="mf-num" value={typeof m.speed[k] === 'string' ? feet(m.speed[k]) : ''} placeholder="—" onChange={e => setSpeed(k, e.target.value)} />
                <span className="mf-static">{t('mf.ft')}</span>
              </div>
            </Field>
          ))}
          <label className="mf-check"><input type="checkbox" checked={m.speed.hover === true} onChange={e => { const speed = { ...m.speed }; if (e.target.checked) speed.hover = true; else delete speed.hover; set({ speed }) }} />{t('mf.speed.hover')}</label>
        </div>
      </Section>

      <Section title={t('mf.sec.saves')} why="mf.why.saves">
        <div className="mf-grid-rows">
          {ABILITIES.map(a => {
            const v = m.savingThrows[a]
            return (
              <div key={a} className="row mf-row">
                <label className="mf-check"><input type="checkbox" checked={v !== undefined} onChange={e => setSave(a, e.target.checked)} />{ability(a)}</label>
                {v !== undefined && <input type="number" min={-10} max={40} className="mf-num" value={v} aria-label={t('mf.f.bonus', { name: ability(a) })} onChange={e => setSave(a, true, numOr(e.target.value, 0))} />}
                {v === undefined && <span className="mf-static muted">{sign(abilityMod(m.abilities[a]))}</span>}
              </div>
            )
          })}
        </div>
      </Section>

      <Section title={t('mf.sec.skills')} why="mf.why.skills">
        <div className="mf-grid-rows">
          {SKILL_IDS.map(s => {
            const level = skillLevel(s)
            return (
              <div key={s} className="row mf-row">
                <span className="mf-skill">{skillName(s)} <small className="muted">({abilityShort(SKILLS[s].ability)})</small></span>
                <select value={level} aria-label={skillName(s)} onChange={e => setSkill(s, e.target.value)}>
                  <option value="none">—</option>
                  <option value="prof">{t('mf.skill.prof', { bonus: sign(proficientSkill(m, s)) })}</option>
                  <option value="expert">{t('mf.skill.expert', { bonus: sign(proficientSkill(m, s, true)) })}</option>
                  <option value="custom">{t('mf.skill.custom')}</option>
                </select>
                {level === 'custom' && <input type="number" min={-10} max={40} className="mf-num" value={m.skills[s]} aria-label={t('mf.f.bonus', { name: skillName(s) })} onChange={e => setSkill(s, 'custom', numOr(e.target.value, 0))} />}
              </div>
            )
          })}
        </div>
      </Section>

      <Section title={t('mf.sec.senses')} why="mf.why.senses">
        <div className="mf-fields mf-speeds">
          {SENSE_KINDS.map(k => (
            <Field key={k} label={t(`mf.sense.${k}`)}>
              <div className="row mf-row">
                <input type="number" min={0} max={999} className="mf-num" value={typeof m.senses[k] === 'string' ? feet(m.senses[k]) : ''} placeholder="—" onChange={e => setSense(k, e.target.value)} />
                <span className="mf-static">{t('mf.ft')}</span>
              </div>
            </Field>
          ))}
          <Field label={t('mf.f.passivePerception')}>
            <input type="number" min={0} max={40} value={m.senses.passive_perception ?? ''} onChange={e => { setAutoPp(false); set({ senses: { ...m.senses, passive_perception: numOr(e.target.value, 10) } }) }} />
          </Field>
        </div>
      </Section>

      <Section title={t('mf.sec.damage')} why="mf.why.damage">
        {(['damageVulnerabilities', 'damageResistances', 'damageImmunities'] as const).map(k => (
          <div key={k} className="mf-field wide">
            <span>{t(`mf.f.${k}`)}</span>
            <div className="mf-chips">
              {DAMAGE_TYPES.map(d => <Chip key={d} label={dmgType(d)} on={m[k].includes(d)} onToggle={() => set({ [k]: toggle(m[k], d) } as Partial<MonsterBlock>)} />)}
            </div>
            <CustomLines lines={m[k].filter(x => !(DAMAGE_TYPES as readonly string[]).includes(x))} placeholder={t('mf.f.damageCustom')} onChange={extra => set({ [k]: [...m[k].filter(x => (DAMAGE_TYPES as readonly string[]).includes(x)), ...extra] } as Partial<MonsterBlock>)} />
          </div>
        ))}
        <div className="mf-field wide">
          <span>{t('mf.f.conditionImmunities')}</span>
          <div className="mf-chips">
            {CONDITION_IDS.map(c => <Chip key={c} label={term('condition', c, c)} on={m.conditionImmunities.includes(c)} onToggle={() => set({ conditionImmunities: toggle(m.conditionImmunities, c) })} />)}
            <Chip label={term('condition', 'exhaustion', 'exhaustion')} on={m.conditionImmunities.includes('exhaustion')} onToggle={() => set({ conditionImmunities: toggle(m.conditionImmunities, 'exhaustion') })} />
          </div>
        </div>
      </Section>

      {ACTION_GROUPS.map(g => (
        <Section
          key={g}
          title={t(`mf.group.${g}`)}
          why={`mf.why.${g}` as MessageKey}
          actions={<button type="button" className="glass-btn small mf-add" onClick={() => setActions(g, [...(m[g] ?? []), blankAction()])}>{t(`mf.add.${g}`)}</button>}
        >
          {g === 'legendaryActions' && (
            <div className="mf-fields">
              <Field label={t('mf.f.legendaryCount')} why="mf.why.legendaryCount">
                <input type="number" min={0} max={10} value={m.legendary?.actions ?? 0} onChange={e => {
                  const n = Math.max(0, Math.min(10, numOr(e.target.value, 0)))
                  const next = { ...m }
                  if (n > 0) next.legendary = { ...(m.legendary ?? {}), actions: n }
                  else delete next.legendary
                  onChange(next)
                }} />
              </Field>
              {m.legendary && (
                <Field label={t('mf.f.legendaryResistance')} why="mf.why.legendaryResistance">
                  <input type="number" min={0} max={10} value={m.legendary.resistance ?? 0} onChange={e => set({ legendary: { ...m.legendary!, resistance: Math.max(0, Math.min(10, numOr(e.target.value, 0))) || undefined } })} />
                </Field>
              )}
            </div>
          )}
          {(m[g] ?? []).map((a, i) => (
            <ActionEditor
              key={i}
              action={a}
              group={g}
              dmgList={dmgList}
              onChange={next => setActions(g, (m[g] ?? []).map((x, j) => (j === i ? next : x)))}
              onRemove={() => setActions(g, (m[g] ?? []).filter((_, j) => j !== i))}
            />
          ))}
          {!(m[g] ?? []).length && <p className="muted small mf-empty">{t(`mf.empty.${g}`)}</p>}
        </Section>
      ))}

      <Section
        title={t('mf.sec.spellcasting')}
        why="mf.why.spellcasting"
        actions={m.spellcasting
          ? <button type="button" className="glass-btn small mf-ghost" onClick={() => setSpellcasting(undefined)}>{t('mf.removeSpellcasting')}</button>
          : <button type="button" className="glass-btn small mf-add" onClick={() => setSpellcasting({ ability: 'int', ...casterDefaults('int'), groups: [{ label: 'Cantrips (at will)', spells: [] }] })}>{t('mf.addSpellcasting')}</button>}
      >
        {m.spellcasting ? (
          <div className="mf-fields">
            <Field label={t('mf.f.spellAbility')}>
              <select value={m.spellcasting.ability} onChange={e => { const a = e.target.value as Ability; setSpellcasting({ ...m.spellcasting!, ability: a, ...casterDefaults(a) }) }}>
                {ABILITIES.map(a => <option key={a} value={a}>{ability(a)}</option>)}
              </select>
            </Field>
            <Field label={t('mf.f.spellDc')}><input type="number" min={1} max={40} value={m.spellcasting.saveDc ?? ''} onChange={e => setSpellcasting({ ...m.spellcasting!, saveDc: e.target.value === '' ? undefined : numOr(e.target.value, 10) })} /></Field>
            <Field label={t('mf.f.spellAttack')}><input type="number" min={-10} max={40} value={m.spellcasting.attackBonus ?? ''} onChange={e => setSpellcasting({ ...m.spellcasting!, attackBonus: e.target.value === '' ? undefined : numOr(e.target.value, 0) })} /></Field>
            <Field label={t('mf.f.spellNote')} wide><input value={m.spellcasting.note ?? ''} placeholder={t('mf.f.spellNotePlaceholder')} onChange={e => setSpellcasting({ ...m.spellcasting!, note: e.target.value || undefined })} /></Field>
            {m.spellcasting.groups.map((g, i) => (
              <div key={i} className="mf-field wide mf-spell-group">
                <div className="row mf-row">
                  <input value={g.label} placeholder={t('mf.f.spellGroupLabel')} aria-label={t('mf.f.spellGroupLabel')} onChange={e => setSpellcasting({ ...m.spellcasting!, groups: m.spellcasting!.groups.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <button type="button" className="glass-btn small mf-ghost" aria-label={t('mf.remove')} onClick={() => setSpellcasting({ ...m.spellcasting!, groups: m.spellcasting!.groups.filter((_, j) => j !== i) })}>✕</button>
                </div>
                <textarea rows={2} value={g.spells.join(', ')} placeholder={t('mf.f.spellsPlaceholder')} aria-label={t('mf.f.spells')} onChange={e => setSpellcasting({ ...m.spellcasting!, groups: m.spellcasting!.groups.map((x, j) => (j === i ? { ...x, spells: e.target.value.split(/\s*,\s*|\n/).map(s => s.trimStart()).filter((s, k, arr) => s || k === arr.length - 1) } : x)) })} onBlur={() => setSpellcasting({ ...m.spellcasting!, groups: m.spellcasting!.groups.map(x => ({ ...x, spells: x.spells.map(s => s.trim()).filter(Boolean) })) })} />
              </div>
            ))}
            <div className="mf-field wide">
              <div className="row">
                {/* Stat block text stays English, and these exact labels let the NPC sheet count slots and uses (block.ts). */}
                {SPELL_GROUP_PRESETS.map(label => (
                  <button key={label} type="button" className="glass-btn small mf-add" onClick={() => setSpellcasting({ ...m.spellcasting!, groups: [...m.spellcasting!.groups, { label, spells: [] }] })}>+ {label}</button>
                ))}
              </div>
            </div>
          </div>
        ) : <p className="muted small mf-empty">{t('mf.empty.spellcasting')}</p>}
      </Section>

      <Section title={t('mf.sec.description')}>
        <textarea rows={4} value={m.description ?? ''} placeholder={t('mf.f.descriptionPlaceholder')} aria-label={t('mf.sec.description')} onChange={e => set({ description: e.target.value || undefined })} />
      </Section>
    </div>
  )
}

/** Free-text lines next to the damage type chips ("bludgeoning from nonmagical attacks"). */
function CustomLines({ lines, placeholder, onChange }: { lines: string[]; placeholder: string; onChange: (lines: string[]) => void }) {
  const { t } = useI18n()
  return (
    <div className="mf-lines">
      {lines.map((l, i) => (
        <div key={i} className="row mf-row">
          <input value={l} onChange={e => onChange(lines.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="glass-btn small mf-ghost" aria-label={t('mf.remove')} onClick={() => onChange(lines.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="glass-btn small mf-add" onClick={() => onChange([...lines, ''])}>{placeholder}</button>
    </div>
  )
}

const USAGE = ['none', 'per day', 'recharge', 'per rest'] as const
const SPELL_GROUP_PRESETS = ['Cantrips (at will)', '1st level (4 slots)', '2nd level (3 slots)', '3rd level (3 slots)', '1/day each', '3/day each', 'At will']

function ActionEditor({ action: a, group, dmgList, onChange, onRemove }: {
  action: MonsterAction
  group: ActionGroup
  dmgList: string
  onChange: (a: MonsterAction) => void
  onRemove: () => void
}) {
  const { t, ability, term } = useI18n()
  const set = (patch: Partial<MonsterAction>) => onChange({ ...a, ...patch })
  const usage = a.usage?.type ?? 'none'
  const setUsage = (type: string) => {
    const next = { ...a }
    if (type === 'per day') next.usage = { type: 'per day', times: 1 }
    else if (type === 'recharge') next.usage = { type: 'recharge', dice: '1d6', minimum: 5 }
    else if (type === 'per rest') next.usage = { type: 'per rest', rests: ['short'] }
    else delete next.usage
    onChange(next)
  }
  const setDamage = (i: number, patch: Partial<{ dice: string; type: string }>) => set({ damage: a.damage.map((d, j) => (j === i ? { ...d, ...patch } : d)) })
  return (
    <div className="mf-action glass thin">
      <div className="mf-fields">
        <Field label={t('mf.a.name')} wide>
          <div className="row mf-row">
            <input value={a.name} placeholder={t(`mf.a.namePlaceholder.${group}`)} onChange={e => set({ name: e.target.value })} />
            <button type="button" className="glass-btn small mf-ghost mf-danger" onClick={onRemove}>{t('mf.remove')}</button>
          </div>
        </Field>
        <Field label={t('mf.a.text')} wide><textarea rows={3} value={a.description} placeholder={t('mf.a.textPlaceholder')} onChange={e => set({ description: e.target.value })} /></Field>
        <Field label={t('mf.a.toHit')} why="mf.why.toHit">
          <input type="number" min={-10} max={40} value={a.attackBonus ?? ''} placeholder="—" onChange={e => { const next = { ...a }; if (e.target.value === '') delete next.attackBonus; else next.attackBonus = numOr(e.target.value, 0); onChange(next) }} />
        </Field>
        <Field label={t('mf.a.usage')} why="mf.why.usage">
          <select value={usage} onChange={e => setUsage(e.target.value)}>
            {USAGE.map(u => <option key={u} value={u}>{t(`mf.usage.${u.replace(' ', '')}` as MessageKey)}</option>)}
          </select>
        </Field>
        {a.usage?.type === 'per day' && (
          <Field label={t('mf.a.timesPerDay')}><input type="number" min={1} max={20} value={a.usage.times} onChange={e => set({ usage: { type: 'per day', times: Math.max(1, numOr(e.target.value, 1)) } })} /></Field>
        )}
        {a.usage?.type === 'recharge' && (
          <Field label={t('mf.a.rechargeOn')}>
            <select value={a.usage.minimum} onChange={e => set({ usage: { type: 'recharge', dice: '1d6', minimum: Number(e.target.value) } })}>
              {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n === 6 ? '6' : `${n}–6`}</option>)}
            </select>
          </Field>
        )}
        {a.usage?.type === 'per rest' && (
          <Field label={t('mf.a.rests')}>
            <select value={a.usage.rests[0] ?? 'short'} onChange={e => set({ usage: { type: 'per rest', rests: [e.target.value] } })}>
              <option value="short">{t('mf.rest.short')}</option>
              <option value="long">{t('mf.rest.long')}</option>
            </select>
          </Field>
        )}
        <div className="mf-field wide">
          <span className="why-legend">{t('mf.a.damage')} <Why compact title={t('mf.a.damage')} text={t('mf.why.damageLines')} /></span>
          {a.damage.map((d, i) => (
            <div key={i} className="row mf-row">
              <input className="mf-dice" value={d.dice} placeholder="2d6+3" aria-label={t('mf.a.dice')} onChange={e => setDamage(i, { dice: e.target.value })} />
              <input list={dmgList} value={d.type} placeholder={t('mf.a.damageType')} aria-label={t('mf.a.damageType')} onChange={e => setDamage(i, { type: e.target.value })} />
              <span className="mf-static muted">{term('damage', d.type, d.type)}</span>
              <button type="button" className="glass-btn small mf-ghost" aria-label={t('mf.remove')} onClick={() => set({ damage: a.damage.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button type="button" className="glass-btn small mf-add" onClick={() => set({ damage: [...a.damage, { dice: '1d6', type: 'slashing' }] })}>{t('mf.a.addDamage')}</button>
        </div>
        <div className="mf-field wide">
          <span className="why-legend">{t('mf.a.save')} <Why compact title={t('mf.a.save')} text={t('mf.why.save')} /></span>
          <div className="row mf-row">
            <select value={a.save?.ability ?? ''} aria-label={t('mf.a.saveAbility')} onChange={e => { const next = { ...a }; if (!e.target.value) delete next.save; else next.save = { ability: e.target.value as Ability, dc: a.save?.dc ?? 13, onSuccess: a.save?.onSuccess ?? 'none' }; onChange(next) }}>
              <option value="">—</option>
              {ABILITIES.map(x => <option key={x} value={x}>{ability(x)}</option>)}
            </select>
            {a.save && <>
              <span className="mf-static">DC</span>
              <input type="number" min={1} max={40} className="mf-num" value={a.save.dc} aria-label={t('mf.a.saveDc')} onChange={e => set({ save: { ...a.save!, dc: numOr(e.target.value, 10) } })} />
              <select value={a.save.onSuccess} aria-label={t('mf.a.onSuccess')} onChange={e => set({ save: { ...a.save!, onSuccess: e.target.value } })}>
                <option value="none">{t('mf.onSuccess.none')}</option>
                <option value="half">{t('mf.onSuccess.half')}</option>
              </select>
            </>}
          </div>
        </div>
      </div>
    </div>
  )
}
