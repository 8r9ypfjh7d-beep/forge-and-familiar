// Editor for a whole homebrew class: hit die, proficiencies, spellcasting, features by level with their own uses and
// sheet effects, ASI levels, subclass level and multiclass rules. Saved in the pack; the builder lists it like any class.
import { useId, useState, type ReactNode } from 'react'
import { Why } from '../../builder/Why'
import { useI18n } from '../../i18n'
import { EffectsEditor } from '../../inventory'
import {
  ABILITIES, ALL_SKILLS, CLASSES, type Abilities, type Ability, type ArmorCategory, type CasterType, type ClassFeature, type ClassSpellcasting,
  type UsesCount, type WeaponCategory,
} from '../../rules'
import { classIssues, classWarnings, parseSteps, stepsText } from '../pack'
import { HIT_DICE, type HomebrewClass } from '../types'
import { Check, Field, FormShell, LinesField } from './forms'

const ARMOR: ArmorCategory[] = ['light', 'medium', 'heavy', 'shield']
const WEAPONS: WeaponCategory[] = ['simple', 'martial']
const CASTERS: CasterType[] = ['none', 'full', 'half', 'third', 'pact']
const numOr = (s: string, fallback: number) => (s === '' || Number.isNaN(Number(s)) ? fallback : Number(s))
const opt = (s: string) => (s.trim() ? s : undefined)
const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1)
type UsesKind = 'none' | 'fixed' | 'steps' | 'pb' | 'level' | Ability

const usesKind = (f: ClassFeature): UsesKind => (!f.uses ? 'none' : f.uses.steps ? 'steps' : typeof f.uses.count === 'number' ? 'fixed' : f.uses.count)
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

/** A steps table typed as text, read when the field loses focus. */
function StepsField({ label, why, value, onChange }: { label: string; why: string; value: [number, number][]; onChange: (v: [number, number][]) => void }) {
  const { t } = useI18n()
  const [text, setText] = useState(stepsText(value))
  return (
    <div className="hb-field">
      <span>{label} <Why compact title={label} text={why} /></span>
      <input value={text} placeholder={t('hb.cls.stepsPlaceholder')} aria-label={label}
        onChange={e => setText(e.target.value)}
        onBlur={() => { const steps = parseSteps(text); onChange(steps); setText(stepsText(steps)) }} />
    </div>
  )
}

/** A labelled control with a "why?" bubble beside the label (outside it, so the label still names the control). */
function WhyField({ text, why, children }: { text: string; why: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="hb-field">
      <span><label htmlFor={id}>{text}</label> <Why compact title={text} text={why} /></span>
      {children(id)}
    </div>
  )
}

/** A group heading with a "why?" bubble. */
function Label({ text, why }: { text: string; why: string }) {
  return <span>{text} <Why compact title={text} text={why} /></span>
}

function FeatureEditor({ f, index, onChange, onRemove }: { f: ClassFeature; index: number; onChange: (f: ClassFeature) => void; onRemove: () => void }) {
  const { t, ability } = useI18n()
  const set = (patch: Partial<ClassFeature>) => onChange({ ...f, ...patch })
  const setUses = (kind: UsesKind) => {
    if (kind === 'none') return set({ uses: undefined })
    const recharge = f.uses?.recharge ?? 'long'
    if (kind === 'steps') return set({ uses: { count: 0, recharge, steps: f.uses?.steps ?? [[f.level, 2]] } })
    const count: UsesCount = kind === 'fixed' ? (typeof f.uses?.count === 'number' && f.uses.count > 0 ? f.uses.count : 1) : kind
    set({ uses: { count, recharge, ...(kind !== 'fixed' && f.uses?.add ? { add: f.uses.add } : {}) } })
  }
  const kind = usesKind(f)
  return (
    <fieldset className="hb-class-feature">
      <legend className="a11y-sr-only">{f.name || t('hb.cls.featureN', { n: index + 1 })}</legend>
      <div className="hb-fields">
        <Field label={t('hb.f.level')}>
          <select value={f.level} onChange={e => set({ level: Number(e.target.value) })}>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
        <Field label={t('hb.f.featureName')}><input value={f.name} onChange={e => set({ name: e.target.value })} placeholder={t('hb.cls.featurePlaceholder')} /></Field>
        <Field label={t('hb.cls.featureText')} wide><textarea rows={2} value={f.text ?? ''} onChange={e => set({ text: opt(e.target.value) })} /></Field>
        <WhyField text={t('hb.cls.uses')} why={t('hb.cls.usesWhy')}>{id => (
          <select id={id} value={kind} onChange={e => setUses(e.target.value as UsesKind)}>
            <option value="none">{t('builder.cs.uses.none')}</option>
            <option value="fixed">{t('builder.cs.uses.fixed')}</option>
            <option value="steps">{t('hb.cls.uses.steps')}</option>
            <option value="pb">{t('builder.cs.uses.pb')}</option>
            <option value="level">{t('builder.cs.uses.level')}</option>
            {ABILITIES.map(a => <option key={a} value={a}>{t('builder.cs.uses.mod', { ability: ability(a) })}</option>)}
          </select>
        )}</WhyField>
        {f.uses && kind === 'steps' && (
          <StepsField label={t('hb.cls.usesSteps')} why={t('hb.cls.usesStepsWhy')} value={f.uses.steps ?? []} onChange={steps => set({ uses: { ...f.uses!, steps } })} />
        )}
        {f.uses && kind !== 'steps' && (
          <Field label={kind === 'fixed' ? t('builder.cs.uses.count') : t('builder.cs.uses.add')}>
            <input type="number" min={kind === 'fixed' ? 1 : -5} max={50}
              value={typeof f.uses.count === 'number' ? f.uses.count : (f.uses.add ?? 0)}
              onChange={e => {
                const n = Math.round(numOr(e.target.value, 0))
                set({ uses: typeof f.uses!.count === 'number' ? { ...f.uses!, count: Math.max(1, n) } : { ...f.uses!, add: n || undefined } })
              }} />
          </Field>
        )}
        {f.uses && (
          <Field label={t('builder.cs.recharge')}>
            <select value={f.uses.recharge} onChange={e => set({ uses: { ...f.uses!, recharge: e.target.value as 'short' | 'long' } })}>
              <option value="short">{t('builder.cs.recharge.short')}</option>
              <option value="long">{t('builder.cs.recharge.long')}</option>
            </select>
          </Field>
        )}
      </div>
      <EffectsEditor legend={t('hb.cls.effects')} effects={f.effects ?? []} onChange={fx => set({ effects: fx.length ? fx : undefined })} />
      <div><button type="button" className="glass-btn small hb-ghost" onClick={onRemove}>{t('hb.f.removeFeature')}</button></div>
    </fieldset>
  )
}

export function ClassForm({ initial, onSave, onCancel }: { initial: HomebrewClass; onSave: (c: HomebrewClass) => void; onCancel: () => void }) {
  const { t, ability, abilityShort, skill, className } = useI18n()
  const [c, setC] = useState(initial)
  const set = (patch: Partial<HomebrewClass>) => setC(prev => ({ ...prev, ...patch }))
  const casting: ClassSpellcasting = c.spellcasting ?? { list: '', kind: 'prepared', cantrips: [[1, 2]], known: [] }
  const setCasting = (patch: Partial<ClassSpellcasting>) => set({ spellcasting: { ...casting, ...patch } })
  const setCaster = (caster: CasterType) =>
    set(caster === 'none' ? { caster, spellAbility: undefined, spellcasting: undefined } : { caster, spellAbility: c.spellAbility ?? 'int', spellcasting: casting })
  const setPrereq = (a: Ability, v: string) => {
    const prereq: Partial<Abilities> = { ...c.multiclass.prereq }
    if (v === '') delete prereq[a]
    else prereq[a] = Math.min(30, Math.max(1, numOr(v, 13)))
    set({ multiclass: { ...c.multiclass, prereq } })
  }
  const listOptions = CLASSES.filter(k => k.caster !== 'none')
  const warnings = classWarnings(c)

  return (
    <FormShell kind="classes" name={initial.name} value={c} issues={classIssues(c)} onSave={onSave} onCancel={onCancel}>
      <p className="muted small hb-field wide">{t('hb.cls.intro')}</p>
      <Field label={t('hb.f.name')} wide><input value={c.name} onChange={e => set({ name: e.target.value })} autoFocus placeholder={t('hb.cls.namePlaceholder')} /></Field>
      <Field label={t('hb.f.description')} wide><textarea rows={3} value={c.description ?? ''} onChange={e => set({ description: opt(e.target.value) })} /></Field>

      <h4 className="hb-field wide hb-section">{t('hb.cls.basics')}</h4>
      <WhyField text={t('hb.cls.hitDie')} why={t('hb.cls.hitDieWhy')}>{id => (
        <select id={id} value={c.hitDie} onChange={e => set({ hitDie: Number(e.target.value) })}>
          {HIT_DICE.map(d => <option key={d} value={d}>d{d}</option>)}
        </select>
      )}</WhyField>
      <div className="hb-field wide">
        <Label text={t('hb.cls.primary')} why={t('hb.cls.primaryWhy')} />
        <div className="row">{ABILITIES.map(a => <Check key={a} label={ability(a)} checked={c.primary.includes(a)} onChange={() => set({ primary: toggle(c.primary, a) })} />)}</div>
      </div>
      <div className="hb-field wide">
        <Label text={t('hb.cls.saves')} why={t('hb.cls.savesWhy')} />
        <div className="row">{ABILITIES.map(a => <Check key={a} label={ability(a)} checked={c.savingThrows.includes(a)} onChange={() => set({ savingThrows: toggle(c.savingThrows, a) })} />)}</div>
      </div>

      <h4 className="hb-field wide hb-section">{t('hb.cls.profs')}</h4>
      <div className="hb-field wide">
        <Label text={t('hb.cls.armor')} why={t('hb.cls.armorWhy')} />
        <div className="row">
          {ARMOR.map(a => <Check key={a} label={t(`hb.cat.${a}`)} checked={c.armor.includes(a)} onChange={() => set({ armor: toggle(c.armor, a) })} />)}
          {WEAPONS.map(w => <Check key={w} label={t(`hb.cls.weapons.${w}`)} checked={c.weapons.includes(w)} onChange={() => set({ weapons: toggle(c.weapons, w) })} />)}
        </div>
      </div>
      <WhyField text={t('hb.cls.skillCount')} why={t('hb.cls.skillsWhy')}>{id => (
        <input id={id} type="number" min={0} max={18} value={c.skillChoices.count} onChange={e => set({ skillChoices: { ...c.skillChoices, count: Math.min(18, Math.max(0, Math.round(numOr(e.target.value, 0)))) } })} />
      )}</WhyField>
      <div className="hb-field wide">
        <span>{t('hb.cls.skillFrom')}</span>
        <div className="row">
          <Check label={t('hb.cls.anySkill')} checked={c.skillChoices.from.length === ALL_SKILLS.length}
            onChange={on => set({ skillChoices: { ...c.skillChoices, from: on ? [...ALL_SKILLS] : [] } })} />
          {ALL_SKILLS.map(s => <Check key={s} label={skill(s)} checked={c.skillChoices.from.includes(s)} onChange={() => set({ skillChoices: { ...c.skillChoices, from: toggle(c.skillChoices.from, s) } })} />)}
        </div>
      </div>
      <LinesField label={t('hb.cls.tools')} value={c.tools} onChange={tools => set({ tools })} placeholder={t('hb.cls.toolsPlaceholder')} />

      <h4 className="hb-field wide hb-section">{t('hb.cls.casting')}</h4>
      <WhyField text={t('hb.cls.caster')} why={t('hb.cls.casterWhy')}>{id => (
        <select id={id} value={c.caster} onChange={e => setCaster(e.target.value as CasterType)}>
          {CASTERS.map(k => <option key={k} value={k}>{t(`hb.cls.caster.${k}`)}</option>)}
        </select>
      )}</WhyField>
      {c.caster !== 'none' && (
        <>
          <Field label={t('hb.cls.spellAbility')}>
            <select value={c.spellAbility ?? ''} onChange={e => set({ spellAbility: (e.target.value || undefined) as Ability | undefined })}>
              <option value="">{t('hb.f.none')}</option>
              {ABILITIES.map(a => <option key={a} value={a}>{ability(a)}</option>)}
            </select>
          </Field>
          <WhyField text={t('hb.cls.list')} why={t('hb.cls.listWhy')}>{id => (
            <select id={id} value={listOptions.some(k => k.id === casting.list) ? casting.list : ''} onChange={e => setCasting({ list: e.target.value })}>
              <option value="">{t('hb.cls.listOwn')}</option>
              {listOptions.map(k => <option key={k.id} value={k.id}>{className(k.id)}</option>)}
            </select>
          )}</WhyField>
          <WhyField text={t('hb.cls.kind')} why={t('hb.cls.kindWhy')}>{id => (
            <select id={id} value={casting.kind} onChange={e => setCasting({ kind: e.target.value as ClassSpellcasting['kind'] })}>
              <option value="prepared">{t('hb.cls.kind.prepared')}</option>
              <option value="known">{t('hb.cls.kind.known')}</option>
            </select>
          )}</WhyField>
          <StepsField label={t('hb.cls.cantrips')} why={t('hb.cls.cantripsWhy')} value={casting.cantrips} onChange={cantrips => setCasting({ cantrips })} />
          {casting.kind === 'known' && <StepsField label={t('hb.cls.known')} why={t('hb.cls.knownWhy')} value={casting.known} onChange={known => setCasting({ known })} />}
        </>
      )}
      <WhyField text={t('hb.cls.unarmored')} why={t('hb.cls.unarmoredWhy')}>{id => (
        <select id={id} value={c.unarmoredDefense ?? ''} onChange={e => set({ unarmoredDefense: (e.target.value || undefined) as Ability | undefined })}>
          <option value="">{t('hb.f.none')}</option>
          {ABILITIES.map(a => <option key={a} value={a}>{t('hb.cls.unarmoredWith', { ability: abilityShort(a) })}</option>)}
        </select>
      )}</WhyField>

      <h4 className="hb-field wide hb-section">{t('hb.cls.progression')}</h4>
      <Field label={t('hb.cls.subclassTitle')}><input value={c.subclassTitle} onChange={e => set({ subclassTitle: e.target.value })} placeholder={t('hb.cls.subclassTitlePlaceholder')} /></Field>
      <WhyField text={t('hb.cls.subclassLevel')} why={t('hb.cls.subclassLevelWhy')}>{id => (
        <select id={id} value={c.subclassLevel} onChange={e => set({ subclassLevel: Number(e.target.value) })}>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      )}</WhyField>
      <div className="hb-field wide">
        <Label text={t('hb.cls.asi')} why={t('hb.cls.asiWhy')} />
        <div className="row hb-levels">
          {LEVELS.map(l => <Check key={l} label={String(l)} checked={c.asiLevels.includes(l)} onChange={() => set({ asiLevels: toggle(c.asiLevels, l).sort((a, b) => a - b) })} />)}
        </div>
      </div>

      <div className="hb-field wide">
        <Label text={t('hb.f.features')} why={t('hb.cls.featuresWhy')} />
        {c.features.length === 0 && <p className="muted small">{t('hb.cls.noFeatures')}</p>}
        {c.features.map((f, i) => (
          <FeatureEditor key={i} f={f} index={i}
            onChange={next => set({ features: c.features.map((x, j) => (j === i ? next : x)) })}
            onRemove={() => set({ features: c.features.filter((_, j) => j !== i) })} />
        ))}
        <div>
          <button type="button" className="glass-btn small"
            onClick={() => set({ features: [...c.features, { level: Math.min(20, Math.max(1, ...c.features.map(f => f.level))), name: '' }] })}>
            {t('hb.f.addFeature')}
          </button>
        </div>
      </div>

      <h4 className="hb-field wide hb-section">{t('hb.cls.multiclass')} <Why compact title={t('hb.cls.multiclass')} text={t('hb.cls.multiclassWhy')} /></h4>
      <div className="hb-field wide">
        <span>{t('hb.cls.prereq')}</span>
        <div className="row">
          {ABILITIES.map(a => (
            <label key={a} className="hb-check">
              {abilityShort(a)}
              <input type="number" className="hb-amount" min={1} max={30} placeholder="—" value={c.multiclass.prereq[a] ?? ''} onChange={e => setPrereq(a, e.target.value)} />
            </label>
          ))}
        </div>
      </div>
      <div className="hb-field wide">
        <span>{t('hb.cls.mcGrants')}</span>
        <div className="row">
          {ARMOR.map(a => <Check key={a} label={t(`hb.cat.${a}`)} checked={c.multiclass.armor.includes(a)} onChange={() => set({ multiclass: { ...c.multiclass, armor: toggle(c.multiclass.armor, a) } })} />)}
          {WEAPONS.map(w => <Check key={w} label={t(`hb.cls.weapons.${w}`)} checked={c.multiclass.weapons.includes(w)} onChange={() => set({ multiclass: { ...c.multiclass, weapons: toggle(c.multiclass.weapons, w) } })} />)}
        </div>
      </div>
      <Field label={t('hb.cls.gold')}>
        <input type="number" min={0} max={10000} value={c.startingGold ?? ''} onChange={e => set({ startingGold: e.target.value === '' ? undefined : Math.max(0, Math.round(numOr(e.target.value, 0))) })} />
      </Field>

      {warnings.length > 0 && (
        <ul className="hb-field wide hb-warnings small" aria-live="polite">
          {warnings.map(w => <li key={w.key}>{t(w.key, w.vars)}</li>)}
        </ul>
      )}
    </FormShell>
  )
}
