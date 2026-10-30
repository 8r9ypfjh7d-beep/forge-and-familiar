// Entry editors for homebrew spells, items, feats, races, subclasses, backgrounds, class options, languages and tools (classes are in ClassForm.tsx). Each edits a copy and hands it back on save.
import { useState, type ReactNode } from 'react'
import { SubclassMechanicsEditor } from '../../builder/CustomSubclassForm'
import { FeatMechanics } from '../../builder/FeatEditor'
import { Why } from '../../builder/Why'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n/locales/en'
import { EffectsEditor } from '../../inventory'
import {
  ABILITIES, ALL_SKILLS, CLASSES, classById, classesFor, HOMEBREW_OPTION_KINDS, ITEMS, OPTION_KIND_CLASSES, SIZES, allFeats, allRaces, isUsefulEffect, itemById,
  type Ability, type ArmorCategory, type Size, type SkillId, type UsesCount, type WeaponCategory, type WeaponProperty,
} from '../../rules'
import {
  backgroundIssues, classOptionIssues, featIssues, itemIssues, languageIssues, raceIssues, spellIssues, subclassIssues, toolIssues,
} from '../pack'
import {
  BACKGROUND_EDITIONS, LANGUAGE_KINDS, RARITIES, SPELL_SCHOOLS, TOOL_KINDS,
  type BackgroundEditions, type ContentKind, type FeatEffect, type HomebrewBackground, type HomebrewClassOption, type HomebrewFeat, type HomebrewItem,
  type HomebrewLanguage, type HomebrewOptionKind, type HomebrewPack, type HomebrewRace, type HomebrewSpell, type HomebrewSubclass, type HomebrewTool,
  type LanguageKind, type Rarity, type SpellSchool, type ToolKind,
} from '../types'

const WEAPON_PROPS: WeaponProperty[] = ['finesse', 'light', 'heavy', 'reach', 'thrown', 'two-handed', 'versatile', 'ammunition', 'loading', 'ranged']

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`hb-field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="hb-check">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

const numOr = (s: string, fallback: number) => (s === '' || Number.isNaN(Number(s)) ? fallback : Number(s))
const opt = (s: string) => (s.trim() ? s : undefined)

export function FormShell<T>({ kind, name, value, issues, onSave, onCancel, children }: {
  /** Which entry this edits, for the title. */
  kind: ContentKind
  /** The saved name, or empty for a new entry. */
  name: string
  value: T
  issues: string[]
  onSave: (v: T) => void
  onCancel: () => void
  children: ReactNode
}) {
  const { t } = useI18n()
  const [tried, setTried] = useState(false)
  return (
    <form
      className="glass thick hb-form"
      onSubmit={e => {
        e.preventDefault()
        setTried(true)
        if (issues.length === 0) onSave(value)
      }}
    >
      <h3>{name ? t('hb.form.edit', { name }) : t(`hb.form.new.${kind}`)}</h3>
      <div className="hb-fields">{children}</div>
      {tried && issues.length > 0 && <ul className="issues" role="alert">{issues.map(i => <li key={i}>{i}</li>)}</ul>}
      <div className="row hb-form-actions">
        <button type="button" className="glass-btn" onClick={onCancel}>{t('hb.form.cancel')}</button>
        <button className="glass-btn prominent">{t('hb.form.save')}</button>
      </div>
    </form>
  )
}

export function SpellForm({ initial, onSave, onCancel }: { initial: HomebrewSpell; onSave: (s: HomebrewSpell) => void; onCancel: () => void }) {
  const { t, ability, className } = useI18n()
  const [s, setS] = useState(initial)
  const set = (patch: Partial<HomebrewSpell>) => setS(prev => ({ ...prev, ...patch }))
  const comp = (patch: Partial<HomebrewSpell['components']>) => set({ components: { ...s.components, ...patch } })
  const casters = classesFor().filter(c => c.caster !== 'none')
  return (
    <FormShell kind="spells" name={initial.name} value={s} issues={spellIssues(s)} onSave={onSave} onCancel={onCancel}>
      <Field label={t('hb.f.name')} wide><input value={s.name} onChange={e => set({ name: e.target.value })} autoFocus /></Field>
      <Field label={t('hb.f.level')}>
        <select value={s.level} onChange={e => set({ level: Number(e.target.value) })}>
          {Array.from({ length: 10 }, (_, l) => <option key={l} value={l}>{l === 0 ? t('hb.f.cantrip') : t('hb.f.levelN', { n: l })}</option>)}
        </select>
      </Field>
      <Field label={t('hb.f.school')}>
        <select value={s.school} onChange={e => set({ school: e.target.value as SpellSchool })}>
          {SPELL_SCHOOLS.map(x => <option key={x} value={x}>{t(`hb.school.${x}`)}</option>)}
        </select>
      </Field>
      <Field label={t('hb.f.castingTime')}><input value={s.castingTime} onChange={e => set({ castingTime: e.target.value })} /></Field>
      <Field label={t('hb.f.range')}><input value={s.range} onChange={e => set({ range: e.target.value })} /></Field>
      <Field label={t('hb.f.duration')}><input value={s.duration} onChange={e => set({ duration: e.target.value })} /></Field>
      <div className="hb-field wide">
        <span>{t('hb.f.componentsTags')}</span>
        <div className="row">
          <Check label={t('hb.f.verbal')} checked={s.components.v} onChange={v => comp({ v })} />
          <Check label={t('hb.f.somatic')} checked={s.components.s} onChange={v => comp({ s: v })} />
          <Check label={t('hb.f.material')} checked={s.components.m} onChange={m => comp({ m })} />
          <Check label={t('hb.f.concentration')} checked={s.concentration} onChange={concentration => set({ concentration })} />
          <Check label={t('hb.f.ritual')} checked={s.ritual} onChange={ritual => set({ ritual })} />
        </div>
      </div>
      {s.components.m && (
        <Field label={t('hb.f.materialComponent')} wide>
          <input value={s.components.material ?? ''} onChange={e => comp({ material: e.target.value })} placeholder={t('hb.f.materialPlaceholder')} />
        </Field>
      )}
      <Field label={t('hb.f.roll')}>
        <input value={s.damage ?? ''} onChange={e => set({ damage: opt(e.target.value) })} placeholder="3d6" />
      </Field>
      <Field label={t('hb.f.damageType')}><input value={s.damageType ?? ''} onChange={e => set({ damageType: opt(e.target.value) })} placeholder={t('hb.f.damageTypePlaceholder')} /></Field>
      <Field label={t('hb.f.save')}>
        <select value={s.save ?? ''} onChange={e => set({ save: (e.target.value || undefined) as Ability | undefined })}>
          <option value="">{t('hb.f.none')}</option>
          {ABILITIES.map(a => <option key={a} value={a}>{ability(a)}</option>)}
        </select>
      </Field>
      <div className="hb-field wide">
        <span>{t('hb.f.classes')}</span>
        <div className="row">
          {casters.map(c => (
            <Check
              key={c.id}
              label={className(c.id)}
              checked={s.classes.includes(c.id)}
              onChange={on => set({ classes: on ? [...s.classes, c.id] : s.classes.filter(x => x !== c.id) })}
            />
          ))}
        </div>
      </div>
      <Field label={t('hb.f.description')} wide><textarea rows={5} value={s.description} onChange={e => set({ description: e.target.value })} /></Field>
      <Field label={t('hb.f.higherLevels')} wide><textarea rows={2} value={s.higherLevels ?? ''} onChange={e => set({ higherLevels: opt(e.target.value) })} /></Field>
    </FormShell>
  )
}

export function ItemForm({ initial, onSave, onCancel }: { initial: HomebrewItem; onSave: (i: HomebrewItem) => void; onCancel: () => void }) {
  const { t } = useI18n()
  const [item, setItem] = useState(initial)
  const set = (patch: Partial<HomebrewItem>) => setItem(prev => ({ ...prev, ...patch }) as HomebrewItem)
  const base = { id: item.id, name: item.name, weight: item.weight, description: item.description, rarity: item.rarity }
  const switchKind = (kind: HomebrewItem['kind']) => {
    if (kind === item.kind) return
    if (kind === 'weapon') setItem({ ...base, kind, category: 'simple', damage: '1d6', damageType: 'slashing', properties: [] })
    else if (kind === 'armor') setItem({ ...base, kind, category: 'light', baseAc: 11 })
    else setItem({ ...base, kind })
  }
  return (
    <FormShell kind="items" name={initial.name} value={item} issues={itemIssues(item)} onSave={onSave} onCancel={onCancel}>
      <Field label={t('hb.f.name')} wide><input value={item.name} onChange={e => set({ name: e.target.value })} autoFocus /></Field>
      <Field label={t('hb.f.type')}>
        <select value={item.kind} onChange={e => switchKind(e.target.value as HomebrewItem['kind'])}>
          <option value="weapon">{t('hb.f.kind.weapon')}</option>
          <option value="armor">{t('hb.f.kind.armor')}</option>
          <option value="gear">{t('hb.f.kind.gear')}</option>
        </select>
      </Field>
      <Field label={t('hb.f.rarity')}>
        <select value={item.rarity ?? ''} onChange={e => set({ rarity: (e.target.value || undefined) as Rarity | undefined })}>
          <option value="">{t('hb.f.mundane')}</option>
          {RARITIES.map(r => <option key={r} value={r}>{t(`hb.rarity.${r}`)}</option>)}
        </select>
      </Field>
      <Field label={t('hb.f.weight')}><input type="number" min={0} step={0.5} value={item.weight} onChange={e => set({ weight: numOr(e.target.value, 0) })} /></Field>

      {item.kind === 'weapon' && (
        <>
          <Field label={t('hb.f.category')}>
            <select value={item.category} onChange={e => set({ category: e.target.value as 'simple' | 'martial' })}>
              <option value="simple">{t('hb.cat.simple')}</option>
              <option value="martial">{t('hb.cat.martial')}</option>
            </select>
          </Field>
          <Field label={t('hb.f.damage')}><input value={item.damage} onChange={e => set({ damage: e.target.value })} placeholder="1d8" /></Field>
          <Field label={t('hb.f.damageType')}><input value={item.damageType} onChange={e => set({ damageType: e.target.value })} /></Field>
          {item.properties.includes('versatile') && (
            <Field label={t('hb.f.versatile')}><input value={item.versatile ?? ''} onChange={e => set({ versatile: opt(e.target.value) })} placeholder="1d10" /></Field>
          )}
          {(item.properties.includes('thrown') || item.properties.includes('ranged')) && (
            <Field label={t('hb.f.rangeFt')}><input value={item.range ?? ''} onChange={e => set({ range: opt(e.target.value) })} placeholder="20/60" /></Field>
          )}
          <div className="hb-field wide">
            <span>{t('hb.f.properties')}</span>
            <div className="row">
              {WEAPON_PROPS.map(p => (
                <Check
                  key={p}
                  label={t(`hb.prop.${p}`)}
                  checked={item.properties.includes(p)}
                  onChange={on => set({ properties: on ? [...item.properties, p] : item.properties.filter(x => x !== p) })}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {item.kind === 'armor' && (
        <>
          <Field label={t('hb.f.category')}>
            <select value={item.category} onChange={e => set({ category: e.target.value as 'light' | 'medium' | 'heavy' | 'shield' })}>
              {ARMOR_TYPES.map(a => <option key={a} value={a}>{t(`hb.cat.${a}`)}</option>)}
            </select>
          </Field>
          <Field label={t(item.category === 'shield' ? 'hb.f.acBonus' : 'hb.f.baseAc')}>
            <input type="number" min={0} max={30} value={item.baseAc} onChange={e => set({ baseAc: numOr(e.target.value, 0) })} />
          </Field>
          {item.category !== 'shield' && (
            <Field label={t('hb.f.maxDex')}>
              <select value={item.dexCap ?? ''} onChange={e => set({ dexCap: e.target.value === '' ? undefined : Number(e.target.value) })}>
                <option value="">{t('hb.f.noLimit')}</option>
                {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n === 0 ? t('hb.f.none') : `+${n}`}</option>)}
              </select>
            </Field>
          )}
          <Field label={t('hb.f.strength')}>
            <input type="number" min={0} max={30} value={item.strengthReq ?? ''} onChange={e => set({ strengthReq: e.target.value ? numOr(e.target.value, 0) : undefined })} placeholder={t('hb.f.strengthPlaceholder')} />
          </Field>
          <div className="hb-field">
            <span>{t('hb.f.stealth')}</span>
            <Check label={t('hb.f.disadvantage')} checked={!!item.stealthDisadvantage} onChange={v => set({ stealthDisadvantage: v || undefined })} />
          </div>
        </>
      )}

      <Field label={t('hb.f.description')} wide><textarea rows={4} value={item.description ?? ''} onChange={e => set({ description: opt(e.target.value) })} /></Field>
    </FormShell>
  )
}

/** Effects a homebrew feat can have; labels are `hb.effect.<kind>`. */
const EFFECT_KINDS = ['ability', 'skill', 'hpPerLevel', 'speed', 'initiative', 'ac', 'armoredAc', 'rangedAttack', 'initiativeProficiency'] as const
/** Backgrounds can also hand out free skill picks. */
const BG_EFFECT_KINDS = [...EFFECT_KINDS, 'skillPicks'] as const

function newEffect(kind: FeatEffect['kind']): FeatEffect {
  if (kind === 'ability') return { kind, ability: 'str', amount: 1 }
  if (kind === 'skill') return { kind, skill: 'athletics' }
  if (kind === 'initiativeProficiency') return { kind }
  if (kind === 'skillPicks') return { kind, count: 1 }
  if (kind === 'abilityChoice') return { kind, from: [...ABILITIES], max: 20 }
  return { kind, amount: kind === 'speed' ? 5 : 1 }
}

/** Edits a list of rule effects (feats and backgrounds). */
function EffectsField({ effects, onChange, hint, kinds = EFFECT_KINDS, why }: {
  effects: FeatEffect[]
  onChange: (effects: FeatEffect[]) => void
  hint: string
  kinds?: readonly FeatEffect['kind'][]
  why?: ReactNode
}) {
  const { t, ability, skill } = useI18n()
  const setEffect = (i: number, e: FeatEffect) => onChange(effects.map((x, j) => (j === i ? e : x)))
  return (
    <div className="hb-field wide">
      <span>{t('hb.f.effects')} {why}</span>
      <p className="muted small">{hint}</p>
      {effects.map((e, i) => (
        <div key={i} className="row hb-effect">
          <select value={e.kind} aria-label={t('hb.f.effect')} onChange={ev => setEffect(i, newEffect(ev.target.value as FeatEffect['kind']))}>
            {kinds.map(k => <option key={k} value={k}>{t(`hb.effect.${k as (typeof BG_EFFECT_KINDS)[number]}`)}</option>)}
          </select>
          {e.kind === 'ability' && (
            <select value={e.ability} aria-label={t('hb.f.ability')} onChange={ev => setEffect(i, { ...e, ability: ev.target.value as Ability })}>
              {ABILITIES.map(a => <option key={a} value={a}>{ability(a)}</option>)}
            </select>
          )}
          {e.kind === 'skill' ? (
            <select value={e.skill} aria-label={t('hb.f.skill')} onChange={ev => setEffect(i, { ...e, skill: ev.target.value as SkillId })}>
              {ALL_SKILLS.map(s => <option key={s} value={s}>{skill(s)}</option>)}
            </select>
          ) : e.kind === 'skillPicks' ? (
            <input type="number" min={1} max={6} aria-label={t('hb.f.amount')} className="hb-amount" value={e.count} onChange={ev => setEffect(i, { ...e, count: numOr(ev.target.value, 1) })} />
          ) : 'amount' in e && (
            <input type="number" aria-label={t('hb.f.amount')} className="hb-amount" value={e.amount} onChange={ev => setEffect(i, { ...e, amount: numOr(ev.target.value, 0) })} />
          )}
          <button type="button" className="glass-btn small icon hb-ghost" onClick={() => onChange(effects.filter((_, j) => j !== i))} aria-label={t('hb.f.removeEffect')}>✕</button>
        </div>
      ))}
      <div><button type="button" className="glass-btn small" onClick={() => onChange([...effects, newEffect('ability')])}>{t('hb.f.addEffect')}</button></div>
    </div>
  )
}

export function FeatForm({ initial, onSave, onCancel }: { initial: HomebrewFeat; onSave: (f: HomebrewFeat) => void; onCancel: () => void }) {
  const { t } = useI18n()
  const [f, setF] = useState(initial)
  const set = (patch: Partial<HomebrewFeat>) => setF(prev => ({ ...prev, ...patch }))
  return (
    <FormShell kind="feats" name={initial.name} value={f} issues={featIssues(f)} onSave={onSave} onCancel={onCancel}>
      <Field label={t('hb.f.name')} wide><input value={f.name} onChange={e => set({ name: e.target.value })} autoFocus /></Field>
      <Field label={t('hb.f.prereq')} wide><input value={f.prerequisite ?? ''} onChange={e => set({ prerequisite: opt(e.target.value) })} placeholder={t('hb.f.prereqPlaceholder')} /></Field>
      <Field label={t('hb.f.description')} wide><textarea rows={5} value={f.description} onChange={e => set({ description: e.target.value })} /></Field>
      <div className="hb-field wide">
        <span>{t('hb.f.effects')}</span>
        <p className="muted small">{t('hb.f.effectsHint')}</p>
        <FeatMechanics value={f} onChange={set} idPrefix={`hb-feat-${f.id || 'new'}`} />
      </div>
    </FormShell>
  )
}

/** One entry per line, for traits and languages. */
export function LinesField({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState(value.join('\n'))
  return (
    <Field label={label} wide>
      <textarea
        rows={3}
        value={text}
        placeholder={placeholder}
        onChange={e => {
          setText(e.target.value)
          onChange(e.target.value.split('\n').map(x => x.trim()).filter(Boolean))
        }}
      />
    </Field>
  )
}

/** A label with a "why?" bubble (by message key) explaining the field to someone writing their first species. */
function WhyKey({ label, why }: { label: string; why: MessageKey }) {
  const { t } = useI18n()
  return <span className="why-legend">{label} <Why compact title={label} text={t(why)} /></span>
}

const WEAPON_TYPES: WeaponCategory[] = ['simple', 'martial']

export function RaceForm({ initial, pack, onSave, onCancel }: { initial: HomebrewRace; pack: HomebrewPack; onSave: (r: HomebrewRace) => void; onCancel: () => void }) {
  const { t, abilityShort, skill } = useI18n()
  const [r, setR] = useState(initial)
  const set = (patch: Partial<HomebrewRace>) => setR(prev => ({ ...prev, ...patch }))
  const ownRaces = pack.races.filter(x => !x.parentRaceId && x.id !== r.id)
  // Subraces attach by id in both editions, so 2024-only species (Goliath, Orc) are offered too.
  const official = [...allRaces('2014'), ...allRaces('2024')].filter((x, i, all) => all.findIndex(y => y.id === x.id) === i)
  const parents = [...official.filter(x => !ownRaces.some(o => o.id === x.id) && x.id !== r.id), ...ownRaces]
  const own = !r.parentRaceId
  const only2024 = r.edition === '2024'
  const setBonus = (a: Ability, n: number) => {
    const next = { ...r.abilityBonuses }
    if (n) next[a] = n
    else delete next[a]
    set({ abilityBonuses: next })
  }
  const toggle = <T,>(list: T[] | undefined, x: T, on: boolean): T[] | undefined => {
    const next = on ? [...(list ?? []), x] : (list ?? []).filter(y => y !== x)
    return next.length ? next : undefined
  }
  const choice = r.choice
  const setOption = (i: number, patch: Partial<NonNullable<HomebrewRace['choice']>['options'][number]>) =>
    choice && set({ choice: { ...choice, options: choice.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) } })
  return (
    <FormShell kind="races" name={initial.name} value={r} issues={raceIssues(r)} onSave={onSave} onCancel={onCancel}>
      <Field label={t('hb.f.name')} wide><input value={r.name} onChange={e => set({ name: e.target.value })} autoFocus placeholder={t('hb.f.raceNamePlaceholder')} /></Field>
      <Field label={t('hb.f.subraceOf')} wide>
        <select value={r.parentRaceId ?? ''} onChange={e => set({ parentRaceId: e.target.value || undefined })}>
          <option value="">{t('hb.f.ownRace')}</option>
          {parents.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
      {own && (
        <>
          <label className="hb-field wide">
            <WhyKey label={t('hb.f.edition')} why="hb.why.edition" />
            <select value={r.edition ?? ''} onChange={e => set({ edition: (e.target.value || undefined) as HomebrewRace['edition'] })}>
              <option value="">{t('hb.f.editionBoth')}</option>
              <option value="2024">{t('hb.f.edition2024')}</option>
              <option value="2014">{t('hb.f.edition2014')}</option>
            </select>
          </label>
          <label className="hb-field">
            <WhyKey label={t('hb.f.size')} why="hb.why.size" />
            <select value={r.size} onChange={e => set({ size: e.target.value as Size, sizeOptions: r.sizeOptions?.filter(x => x !== e.target.value) })}>
              {SIZES.map(x => <option key={x} value={x}>{t(`hb.size.${x}`)}</option>)}
            </select>
          </label>
          <Field label={t('hb.f.speed')}><input type="number" min={0} max={120} step={5} value={r.speed} onChange={e => set({ speed: numOr(e.target.value, 30) })} /></Field>
          <div className="hb-field wide">
            <WhyKey label={t('hb.f.sizeOptions')} why="hb.why.sizeOptions" />
            <div className="row">
              {SIZES.filter(x => x !== r.size).map(x => (
                <Check key={x} label={t(`hb.size.${x}`)} checked={!!r.sizeOptions?.includes(x)} onChange={on => set({ sizeOptions: toggle(r.sizeOptions, x, on) })} />
              ))}
            </div>
          </div>
        </>
      )}
      {only2024 ? (
        <p className="hb-field wide muted small">{t('hb.f.asi2024')}</p>
      ) : (
        <div className="hb-field wide">
          <WhyKey label={t('hb.f.asi')} why="hb.why.asi" />
          <div className="row">
            {ABILITIES.map(a => (
              <label key={a} className="hb-check">
                {abilityShort(a)}
                <input type="number" className="hb-amount" min={-5} max={5} value={r.abilityBonuses[a] ?? 0} onChange={e => setBonus(a, numOr(e.target.value, 0))} />
              </label>
            ))}
            <label className="hb-check">
              {t('hb.f.anyBonus')}
              <input type="number" className="hb-amount" min={0} max={6} value={r.freeAbilityBonuses} onChange={e => set({ freeAbilityBonuses: numOr(e.target.value, 0) })} />
            </label>
          </div>
        </div>
      )}
      <div className="hb-field wide">
        <span>{t('hb.f.skills')}</span>
        <div className="row">
          {ALL_SKILLS.map(sk => (
            <Check
              key={sk}
              label={skill(sk)}
              checked={r.skillProficiencies.includes(sk)}
              onChange={on => set({ skillProficiencies: on ? [...r.skillProficiencies, sk] : r.skillProficiencies.filter(x => x !== sk) })}
            />
          ))}
        </div>
      </div>
      <Field label={t('hb.f.skillChoices')}><input type="number" min={0} max={6} value={r.freeSkillChoices} onChange={e => set({ freeSkillChoices: numOr(e.target.value, 0) })} /></Field>
      <label className="hb-field">
        <WhyKey label={t('hb.f.languageChoices')} why="hb.why.languages" />
        <input type="number" min={0} max={6} value={r.languageChoices} onChange={e => set({ languageChoices: numOr(e.target.value, 0) })} />
      </label>
      <Field label={t('hb.f.hp')}><input type="number" min={0} max={5} value={r.hpPerLevel} onChange={e => set({ hpPerLevel: numOr(e.target.value, 0) })} /></Field>
      {own && <LinesField label={t('hb.f.languages')} value={r.languages} onChange={languages => set({ languages })} placeholder={t('hb.f.languagesPlaceholder')} />}
      {own && (
        <>
          <LinesField label={t('hb.f.tools')} value={r.tools ?? []} onChange={tools => set({ tools: tools.length ? tools : undefined })} placeholder={t('hb.f.toolsPlaceholder')} />
          <label className="hb-field">
            <WhyKey label={t('hb.f.toolChoices')} why="hb.why.toolChoices" />
            <input type="number" min={0} max={6} value={r.toolChoices ?? 0} onChange={e => set({ toolChoices: numOr(e.target.value, 0) || undefined })} />
          </label>
          <label className="hb-field">
            <WhyKey label={t('hb.f.naturalArmor')} why="hb.why.naturalArmor" />
            <input type="number" min={0} max={20} placeholder={t('hb.f.naturalArmorNone')} value={r.naturalArmor || ''} onChange={e => set({ naturalArmor: numOr(e.target.value, 0) || undefined })} />
          </label>
          <div className="hb-field wide">
            <WhyKey label={t('hb.f.training')} why="hb.why.training" />
            <div className="row">
              {ARMOR_TYPES.map(a => <Check key={a} label={t(`hb.cat.${a}`)} checked={!!r.armor?.includes(a)} onChange={on => set({ armor: toggle(r.armor, a, on) })} />)}
              {WEAPON_TYPES.map(w => <Check key={w} label={t('hb.f.weaponsOf', { category: t(`hb.cat.${w}`) })} checked={!!r.weapons?.includes(w)} onChange={on => set({ weapons: toggle(r.weapons, w, on) })} />)}
            </div>
          </div>
        </>
      )}
      <EffectsEditor legend={t('hb.f.raceEffects')} effects={r.effects ?? []} onChange={fx => set({ effects: fx.length ? fx : undefined })} />
      {own && (
        <fieldset className="hb-field wide hb-choice">
          <legend><WhyKey label={t('hb.f.choice')} why="hb.why.choice" /></legend>
          {!choice && (
            <div>
              <button type="button" className="glass-btn small" onClick={() => set({ choice: { name: t('hb.f.choiceDefault'), options: [{ name: '', detail: '' }, { name: '', detail: '' }] } })}>{t('hb.f.addChoice')}</button>
            </div>
          )}
          {choice && (
            <>
              <div className="row">
                <input aria-label={t('hb.f.choiceName')} value={choice.name} placeholder={t('hb.f.choiceDefault')} onChange={e => set({ choice: { ...choice, name: e.target.value } })} />
                <button type="button" className="glass-btn small hb-ghost hb-danger" onClick={() => set({ choice: undefined })}>{t('hb.f.removeChoice')}</button>
              </div>
              {choice.options.map((o, i) => (
                <div key={i} className="glass thin hb-option">
                  <div className="row">
                    <input aria-label={t('hb.f.optionName')} placeholder={t('hb.f.optionPlaceholder')} value={o.name} onChange={e => setOption(i, { name: e.target.value })} />
                    <button type="button" className="glass-btn small icon hb-ghost" aria-label={t('hb.f.removeOption')} onClick={() => set({ choice: { ...choice, options: choice.options.filter((_, j) => j !== i) } })}>✕</button>
                  </div>
                  <textarea rows={2} aria-label={t('hb.f.optionDetail')} placeholder={t('hb.f.optionDetail')} value={o.detail} onChange={e => setOption(i, { detail: e.target.value })} />
                  <EffectsEditor legend={t('hb.f.optionEffects')} effects={o.effects ?? []} onChange={fx => setOption(i, { effects: fx.length ? fx : undefined })} />
                </div>
              ))}
              <div>
                <button type="button" className="glass-btn small" onClick={() => set({ choice: { ...choice, options: [...choice.options, { name: '', detail: '' }] } })}>{t('hb.f.addOption')}</button>
              </div>
            </>
          )}
        </fieldset>
      )}
      <LinesField label={t('hb.f.traits')} value={r.traits} onChange={traits => set({ traits })} placeholder={t('hb.f.traitsPlaceholder')} />
      <Field label={t('hb.f.description')} wide><textarea rows={4} value={r.description ?? ''} onChange={e => set({ description: opt(e.target.value) })} /></Field>
    </FormShell>
  )
}

export function LanguageForm({ initial, onSave, onCancel }: { initial: HomebrewLanguage; onSave: (l: HomebrewLanguage) => void; onCancel: () => void }) {
  const { t } = useI18n()
  const [l, setL] = useState(initial)
  const set = (patch: Partial<HomebrewLanguage>) => setL(prev => ({ ...prev, ...patch }))
  return (
    <FormShell kind="languages" name={initial.name} value={l} issues={languageIssues(l)} onSave={onSave} onCancel={onCancel}>
      <Field label={t('hb.f.name')} wide><input value={l.name} onChange={e => set({ name: e.target.value })} autoFocus placeholder={t('hb.f.languagePlaceholder')} /></Field>
      <label className="hb-field">
        <WhyKey label={t('hb.f.langKind')} why="hb.why.langKind" />
        <select value={l.kind} onChange={e => set({ kind: e.target.value as LanguageKind })}>
          {LANGUAGE_KINDS.map(k => <option key={k} value={k}>{t(`hb.langKind.${k}`)}</option>)}
        </select>
      </label>
      <Field label={t('hb.f.script')}><input value={l.script ?? ''} placeholder={t('hb.f.scriptPlaceholder')} onChange={e => set({ script: opt(e.target.value) })} /></Field>
      <Field label={t('hb.f.speakers')} wide><input value={l.speakers ?? ''} placeholder={t('hb.f.speakersPlaceholder')} onChange={e => set({ speakers: opt(e.target.value) })} /></Field>
      <Field label={t('hb.f.description')} wide><textarea rows={4} value={l.description ?? ''} onChange={e => set({ description: opt(e.target.value) })} /></Field>
      <p className="hb-field wide muted small">{t('hb.f.languageHint')}</p>
    </FormShell>
  )
}

export function ToolForm({ initial, onSave, onCancel }: { initial: HomebrewTool; onSave: (x: HomebrewTool) => void; onCancel: () => void }) {
  const { t, ability } = useI18n()
  const [x, setX] = useState(initial)
  const set = (patch: Partial<HomebrewTool>) => setX(prev => ({ ...prev, ...patch }))
  return (
    <FormShell kind="tools" name={initial.name} value={x} issues={toolIssues(x)} onSave={onSave} onCancel={onCancel}>
      <Field label={t('hb.f.name')} wide><input value={x.name} onChange={e => set({ name: e.target.value })} autoFocus placeholder={t('hb.f.toolPlaceholder')} /></Field>
      <label className="hb-field">
        <WhyKey label={t('hb.f.toolKind')} why="hb.why.toolKind" />
        <select value={x.kind} onChange={e => set({ kind: e.target.value as ToolKind })}>
          {TOOL_KINDS.map(k => <option key={k} value={k}>{t(`hb.toolKind.${k}`)}</option>)}
        </select>
      </label>
      <label className="hb-field">
        <WhyKey label={t('hb.f.toolAbility')} why="hb.why.toolAbility" />
        <select value={x.ability ?? ''} onChange={e => set({ ability: (e.target.value || undefined) as Ability | undefined })}>
          <option value="">{t('hb.f.none')}</option>
          {ABILITIES.map(a => <option key={a} value={a}>{ability(a)}</option>)}
        </select>
      </label>
      <Field label={t('hb.f.description')} wide><textarea rows={4} value={x.description ?? ''} placeholder={t('hb.f.toolDescPlaceholder')} onChange={e => set({ description: opt(e.target.value) })} /></Field>
      <p className="hb-field wide muted small">{t('hb.f.toolHint')}</p>
    </FormShell>
  )
}

const ARMOR_TYPES: ArmorCategory[] = ['light', 'medium', 'heavy', 'shield']

export function SubclassForm({ initial, onSave, onCancel }: { initial: HomebrewSubclass; onSave: (s: HomebrewSubclass) => void; onCancel: () => void }) {
  const { t, className, term } = useI18n()
  const [sc, setSc] = useState(initial)
  const set = (patch: Partial<HomebrewSubclass>) => setSc(prev => ({ ...prev, ...patch }))
  return (
    <FormShell kind="subclasses" name={initial.name} value={sc} issues={subclassIssues(sc)} onSave={onSave} onCancel={onCancel}>
      <Field label={t('hb.f.name')} wide><input value={sc.name} onChange={e => set({ name: e.target.value })} autoFocus placeholder={t('hb.f.subclassPlaceholder')} /></Field>
      <Field label={t('hb.f.class')}>
        <select value={sc.classId} onChange={e => set({ classId: e.target.value })}>
          {classesFor().map(c => <option key={c.id} value={c.id}>{className(c.id)} ({term('feature', c.subclassTitle, c.subclassTitle)})</option>)}
        </select>
      </Field>
      <Field label={t('hb.f.description')} wide><textarea rows={4} value={sc.description ?? ''} onChange={e => set({ description: opt(e.target.value) })} /></Field>
      <div className="hb-field wide custom-sub">
        <SubclassMechanicsEditor sub={sc} set={patch => set({ ...patch, armor: patch.armor ?? sc.armor })} classId={sc.classId} from={classLevel(sc.classId)} idBase="hb-sub" />
      </div>
    </FormShell>
  )
}

/** The lowest level the class gets its subclass in either edition (2014 Cleric 1, 2024 Cleric 3), since homebrew subclasses serve both. */
const classLevel = (classId: string) =>
  Math.min(...(['2014', '2024'] as const).map(e => classById(classId, e)?.subclassLevel ?? 3))

export function BackgroundForm({ initial, pack, onSave, onCancel }: { initial: HomebrewBackground; pack: HomebrewPack; onSave: (b: HomebrewBackground) => void; onCancel: () => void }) {
  const { t, abilityShort, skill, term } = useI18n()
  const [b, setB] = useState(initial)
  const set = (patch: Partial<HomebrewBackground>) => setB(prev => ({ ...prev, ...patch }))
  const uses2024 = b.editions !== '2014'
  const whyOf = (id: 'hbBgEditions' | 'hbBgFeature' | 'hbBgAbilities' | 'hbBgFeat' | 'hbBgProfs' | 'hbBgGear' | 'hbBgEffects') => <Why title={t(`why.${id}.title`)} text={t(`why.${id}.text`)} compact />
  // This pack's feats and items first (they may not be saved yet), then every registered one.
  const homebrewFeats = [...pack.feats, ...allFeats('2024').filter(f => f.id.startsWith('hb:') && !pack.feats.some(p => p.id === f.id))]
  const bookFeats = allFeats('2024').filter(f => !f.id.startsWith('hb:')).sort((x, y) => (x.category === 'origin' ? 0 : 1) - (y.category === 'origin' ? 0 : 1))
  const items = [...pack.items, ...ITEMS]
  const itemName = (id: string) => items.find(i => i.id === id)?.name ?? itemById(id)?.name ?? id
  const toggleAbility = (a: Ability, on: boolean) => {
    if (on && b.abilityScores.length >= 3) return
    set({ abilityScores: on ? [...b.abilityScores, a] : b.abilityScores.filter(x => x !== a) })
  }
  return (
    <FormShell kind="backgrounds" name={initial.name} value={b} issues={backgroundIssues(b)} onSave={onSave} onCancel={onCancel}>
      <Field label={t('hb.f.name')} wide><input value={b.name} onChange={e => set({ name: e.target.value })} autoFocus placeholder={t('hb.f.bgNamePlaceholder')} /></Field>
      <div className="hb-field">
        <span>{t('hb.f.editions')} {whyOf('hbBgEditions')}</span>
        <select value={b.editions} onChange={e => set({ editions: e.target.value as BackgroundEditions })}>
          {BACKGROUND_EDITIONS.map(x => <option key={x} value={x}>{t(`hb.bg.editions.${x}`)}</option>)}
        </select>
      </div>
      <div className="hb-field">
        <span>{t('hb.f.feature')} {whyOf('hbBgFeature')}</span>
        <input value={b.feature} onChange={e => set({ feature: e.target.value })} placeholder={t('hb.f.featurePlaceholderBg')} />
      </div>
      <Field label={t('hb.f.featureText')} wide><textarea rows={3} value={b.featureText ?? ''} onChange={e => set({ featureText: opt(e.target.value) })} /></Field>
      <div className="hb-field wide">
        <span>{t('hb.f.skills')} {whyOf('hbBgProfs')}</span>
        <div className="row">
          {ALL_SKILLS.map(sk => (
            <Check
              key={sk}
              label={skill(sk)}
              checked={b.skillProficiencies.includes(sk)}
              onChange={on => set({ skillProficiencies: on ? [...b.skillProficiencies, sk] : b.skillProficiencies.filter(x => x !== sk) })}
            />
          ))}
        </div>
      </div>
      <LinesField label={t('hb.f.tools')} value={b.tools} onChange={tools => set({ tools })} placeholder={t('hb.f.toolsPlaceholder')} />
      <Field label={t('hb.f.toolChoices')}><input type="number" min={0} max={6} value={b.toolChoices} onChange={e => set({ toolChoices: numOr(e.target.value, 0) })} /></Field>
      {b.toolChoices > 0 && <LinesField label={t('hb.f.toolChoiceFrom')} value={b.toolChoiceFrom} onChange={toolChoiceFrom => set({ toolChoiceFrom })} />}
      <LinesField label={t('hb.f.bgLanguages')} value={b.languages} onChange={languages => set({ languages })} />
      <Field label={t('hb.f.languageChoices')}><input type="number" min={0} max={6} value={b.languageChoices} onChange={e => set({ languageChoices: numOr(e.target.value, 0) })} /></Field>
      <div className="hb-field wide">
        <span>{t('hb.f.equipment')} {whyOf('hbBgGear')}</span>
        {b.equipment.length > 0 && (
          <div className="row">
            {b.equipment.map((id, i) => (
              <button key={`${id}-${i}`} type="button" className="glass-chip on" aria-label={t('hb.f.removeItem', { item: itemName(id) })} onClick={() => set({ equipment: b.equipment.filter((_, j) => j !== i) })}>
                {term('item', id, itemName(id))} ✕
              </button>
            ))}
          </div>
        )}
        <select value="" aria-label={t('hb.f.addItem')} onChange={e => e.target.value && set({ equipment: [...b.equipment, e.target.value] })}>
          <option value="">{t('hb.f.addItem')}</option>
          {items.map(i => <option key={i.id} value={i.id}>{term('item', i.id, i.name)}</option>)}
        </select>
      </div>
      <Field label={t('hb.f.gold')}><input type="number" min={0} value={b.gold} onChange={e => set({ gold: numOr(e.target.value, 0) })} /></Field>
      {uses2024 && (
        <>
          <div className="hb-field wide">
            <span>{t('hb.f.bgAbilities', { chosen: b.abilityScores.length })} {whyOf('hbBgAbilities')}</span>
            <div className="row">
              {ABILITIES.map(a => <Check key={a} label={abilityShort(a)} checked={b.abilityScores.includes(a)} onChange={on => toggleAbility(a, on)} />)}
            </div>
          </div>
          <div className="hb-field">
            <span>{t('hb.f.originFeat')} {whyOf('hbBgFeat')}</span>
            <select value={b.originFeatId ?? ''} onChange={e => set({ originFeatId: e.target.value || undefined })}>
              <option value="">{t('hb.f.none')}</option>
              {homebrewFeats.length > 0 && <optgroup label={t('hb.f.homebrewFeats')}>{homebrewFeats.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</optgroup>}
              <optgroup label={t('hb.f.bookFeats')}>{bookFeats.map(f => <option key={f.id} value={f.id}>{term('feat', f.id, f.name)}</option>)}</optgroup>
            </select>
          </div>
          {b.originFeatId && <Field label={t('hb.f.originFeatNote')}><input value={b.originFeatNote ?? ''} onChange={e => set({ originFeatNote: opt(e.target.value) })} placeholder={t('hb.f.originFeatNotePlaceholder')} /></Field>}
        </>
      )}
      <EffectsField effects={b.effects} onChange={effects => set({ effects })} hint={t('hb.f.bgEffectsHint')} kinds={BG_EFFECT_KINDS} why={whyOf('hbBgEffects')} />
      <Field label={t('hb.f.description')} wide><textarea rows={4} value={b.description ?? ''} onChange={e => set({ description: opt(e.target.value) })} /></Field>
    </FormShell>
  )
}

/** Classes that have option lists, plus the Artificer (infusions) whether or not its class data is loaded. */
const OPTION_CLASSES = [...new Set([...CLASSES.map(c => c.id), 'artificer'])]
type UsesKind = 'none' | 'fixed' | 'pb' | 'level' | Ability
const usesKind = (o: HomebrewClassOption): UsesKind => (!o.uses ? 'none' : typeof o.uses.count === 'number' ? 'fixed' : o.uses.count)

/** A field label with a "why?" bubble. */
function WhyLabel({ label, why }: { label: string; why: string }) {
  return <span>{label} <Why compact title={label} text={why} /></span>
}

export function ClassOptionForm({ initial, onSave, onCancel }: { initial: HomebrewClassOption; onSave: (o: HomebrewClassOption) => void; onCancel: () => void }) {
  const { t, className, ability } = useI18n()
  const [o, setO] = useState(initial)
  const set = (patch: Partial<HomebrewClassOption>) => setO(prev => ({ ...prev, ...patch }))
  const infusion = o.kind === 'infusion'
  const setKind = (kind: HomebrewOptionKind) => {
    // Keep the author's class picks unless they are still the old kind's defaults.
    const defaults = OPTION_KIND_CLASSES[o.kind].join() === o.classIds.join()
    const effects = infusion ? o.item?.effects : o.effects
    set({
      kind,
      classIds: defaults ? OPTION_KIND_CLASSES[kind] : o.classIds,
      ...(kind === 'infusion' ? { item: { ...o.item, effects: effects ?? [] }, effects: undefined } : { effects: effects ?? [], item: undefined }),
      ...(kind !== 'metamagic' ? { costPerSpellLevel: undefined } : {}),
    })
  }
  const setUses = (kind: UsesKind) => {
    if (kind === 'none') return set({ uses: undefined })
    const count: UsesCount = kind === 'fixed' ? (typeof o.uses?.count === 'number' ? o.uses.count : 1) : kind
    set({ uses: { recharge: o.uses?.recharge ?? 'long', count, ...(kind !== 'fixed' && o.uses?.add ? { add: o.uses.add } : {}) } })
  }
  const toggleClass = (id: string, on: boolean) => set({ classIds: on ? [...o.classIds, id] : o.classIds.filter(x => x !== id) })
  return (
    <FormShell kind="classOptions" name={initial.name} value={o} issues={classOptionIssues(o)} onCancel={onCancel}
      onSave={v => onSave({
        ...v,
        ...(v.effects ? { effects: v.effects.filter(isUsefulEffect) } : {}),
        ...(v.item ? { item: { ...v.item, effects: (v.item.effects ?? []).filter(isUsefulEffect) } } : {}),
      })}>
      <Field label={t('hb.f.name')} wide><input value={o.name} onChange={e => set({ name: e.target.value })} autoFocus placeholder={t(`hb.opt.placeholder.${o.kind}`)} /></Field>
      <label className="hb-field">
        <WhyLabel label={t('hb.opt.kind')} why={t(`hb.opt.why.kind.${o.kind}`)} />
        <select value={o.kind} onChange={e => setKind(e.target.value as HomebrewOptionKind)}>
          {HOMEBREW_OPTION_KINDS.map(k => <option key={k} value={k}>{t(`hb.opt.kind.${k}`)}</option>)}
        </select>
      </label>
      <label className="hb-field">
        <WhyLabel label={t('hb.opt.edition')} why={t('hb.opt.why.edition')} />
        <select value={o.edition ?? ''} onChange={e => set({ edition: (e.target.value || undefined) as HomebrewClassOption['edition'] })}>
          <option value="">{t('hb.opt.edition.both')}</option>
          <option value="2014">{t('hb.opt.edition.2014')}</option>
          <option value="2024">{t('hb.opt.edition.2024')}</option>
        </select>
      </label>
      <div className="hb-field wide">
        <WhyLabel label={t('hb.opt.classes')} why={t('hb.opt.why.classes')} />
        <div className="row">
          {OPTION_CLASSES.map(id => <Check key={id} label={className(id)} checked={o.classIds.includes(id)} onChange={on => toggleClass(id, on)} />)}
        </div>
      </div>
      <label className="hb-field">
        <WhyLabel label={t('hb.opt.minLevel')} why={t('hb.opt.why.minLevel')} />
        <input type="number" min={1} max={20} value={o.minLevel ?? 1} onChange={e => { const n = Math.min(20, Math.max(1, numOr(e.target.value, 1))); set({ minLevel: n > 1 ? n : undefined }) }} />
      </label>
      <label className="hb-field">
        <WhyLabel label={t('hb.f.prereq')} why={t('hb.opt.why.prereq')} />
        <input value={o.prerequisite ?? ''} onChange={e => set({ prerequisite: opt(e.target.value) })} placeholder={t(`hb.opt.prereqPlaceholder.${o.kind}`)} />
      </label>
      {o.kind !== 'fightingStyle' && !infusion && (
        <label className="hb-field">
          <WhyLabel label={t(`hb.opt.cost.${o.kind}`)} why={t(`hb.opt.why.cost.${o.kind}`)} />
          <input type="number" min={0} max={20} value={o.cost ?? 0} onChange={e => { const n = Math.max(0, numOr(e.target.value, 0)); set({ cost: n || undefined, ...(n ? {} : { costPerSpellLevel: undefined }) }) }} />
        </label>
      )}
      {o.kind === 'metamagic' && !!o.cost && (
        <div className="hb-field">
          <span>{t('hb.opt.cost.metamagic')}</span>
          <label className="hb-check hb-plain"><input type="checkbox" checked={!!o.costPerSpellLevel} onChange={e => set({ costPerSpellLevel: e.target.checked || undefined })} />{t('hb.opt.perSpellLevel')}</label>
        </div>
      )}
      <div className="hb-field">
        <WhyLabel label={t('hb.opt.picks')} why={t('hb.opt.why.repeatable')} />
        <label className="hb-check hb-plain"><input type="checkbox" checked={!!o.repeatable} onChange={e => set({ repeatable: e.target.checked || undefined })} />{t('hb.opt.repeatable')}</label>
      </div>
      <Field label={t('hb.f.description')} wide><textarea rows={4} value={o.text} onChange={e => set({ text: e.target.value })} placeholder={t('hb.opt.textPlaceholder')} /></Field>
      <div className="hb-field wide">
        <WhyLabel label={t('hb.opt.uses')} why={t('hb.opt.why.uses')} />
        <div className="row">
          <select aria-label={t('hb.opt.uses')} value={usesKind(o)} onChange={e => setUses(e.target.value as UsesKind)}>
            <option value="none">{t('builder.cs.uses.none')}</option>
            <option value="fixed">{t('builder.cs.uses.fixed')}</option>
            <option value="pb">{t('builder.cs.uses.pb')}</option>
            <option value="level">{t('builder.cs.uses.level')}</option>
            {ABILITIES.map(a => <option key={a} value={a}>{t('builder.cs.uses.mod', { ability: ability(a) })}</option>)}
          </select>
          {o.uses && (
            <>
              <input type="number" className="hb-amount" min={typeof o.uses.count === 'number' ? 1 : -5} max={50}
                aria-label={typeof o.uses.count === 'number' ? t('builder.cs.uses.count') : t('builder.cs.uses.add')}
                title={typeof o.uses.count === 'number' ? t('builder.cs.uses.count') : t('builder.cs.uses.add')}
                value={typeof o.uses.count === 'number' ? o.uses.count : (o.uses.add ?? 0)}
                onChange={e => {
                  const n = Math.round(Number(e.target.value) || 0)
                  set({ uses: typeof o.uses!.count === 'number' ? { ...o.uses!, count: Math.max(1, n) } : { ...o.uses!, add: n || undefined } })
                }} />
              <select aria-label={t('builder.cs.recharge')} value={o.uses.recharge} onChange={e => set({ uses: { ...o.uses!, recharge: e.target.value as 'short' | 'long' } })}>
                <option value="short">{t('builder.cs.recharge.short')}</option>
                <option value="long">{t('builder.cs.recharge.long')}</option>
              </select>
            </>
          )}
        </div>
      </div>
      {infusion ? (
        <>
          <label className="hb-field">
            <WhyLabel label={t('hb.opt.magicBonus')} why={t('hb.opt.why.magicBonus')} />
            <select value={o.item?.magicBonus ?? 0} onChange={e => { const n = Number(e.target.value); set({ item: { ...o.item, magicBonus: n || undefined } }) }}>
              {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n ? `+${n}` : t('hb.opt.magicBonus.none')}</option>)}
            </select>
          </label>
          <EffectsEditor legend={t('hb.opt.itemEffects')} effects={o.item?.effects ?? []} onChange={fx => set({ item: { ...o.item, effects: fx } })} />
        </>
      ) : (
        <EffectsEditor legend={t('hb.opt.effects')} effects={o.effects ?? []} onChange={fx => set({ effects: fx })} />
      )}
    </FormShell>
  )
}
