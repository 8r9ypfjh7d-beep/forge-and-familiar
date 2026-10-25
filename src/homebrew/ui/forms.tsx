// Entry editors for homebrew spells, items and feats. Each edits a copy and hands it back on save.
import { useState, type ReactNode } from 'react'
import { ABILITIES, ABILITY_NAMES, ALL_SKILLS, CLASSES, SKILLS, type Ability, type SkillId, type WeaponProperty } from '../../rules'
import { featIssues, itemIssues, spellIssues } from '../pack'
import { RARITIES, SPELL_SCHOOLS, type FeatEffect, type HomebrewFeat, type HomebrewItem, type HomebrewSpell, type Rarity, type SpellSchool } from '../types'

const WEAPON_PROPS: WeaponProperty[] = ['finesse', 'light', 'heavy', 'reach', 'thrown', 'two-handed', 'versatile', 'ammunition', 'loading', 'ranged']

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`hb-field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="hb-check">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

const numOr = (s: string, fallback: number) => (s === '' || Number.isNaN(Number(s)) ? fallback : Number(s))
const opt = (s: string) => (s.trim() ? s : undefined)

function FormShell<T>({ title, value, issues, onSave, onCancel, children }: {
  title: string
  value: T
  issues: string[]
  onSave: (v: T) => void
  onCancel: () => void
  children: ReactNode
}) {
  const [tried, setTried] = useState(false)
  return (
    <form
      className="panel hb-form"
      onSubmit={e => {
        e.preventDefault()
        setTried(true)
        if (issues.length === 0) onSave(value)
      }}
    >
      <h3>{title}</h3>
      <div className="hb-fields">{children}</div>
      {tried && issues.length > 0 && <ul className="issues" role="alert">{issues.map(i => <li key={i}>{i}</li>)}</ul>}
      <div className="row hb-form-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn primary">Save</button>
      </div>
    </form>
  )
}

export function SpellForm({ initial, onSave, onCancel }: { initial: HomebrewSpell; onSave: (s: HomebrewSpell) => void; onCancel: () => void }) {
  const [s, setS] = useState(initial)
  const set = (patch: Partial<HomebrewSpell>) => setS(prev => ({ ...prev, ...patch }))
  const comp = (patch: Partial<HomebrewSpell['components']>) => set({ components: { ...s.components, ...patch } })
  const casters = CLASSES.filter(c => c.caster !== 'none')
  return (
    <FormShell title={initial.name ? `Edit ${initial.name}` : 'New spell'} value={s} issues={spellIssues(s)} onSave={onSave} onCancel={onCancel}>
      <Field label="Name" wide><input value={s.name} onChange={e => set({ name: e.target.value })} autoFocus /></Field>
      <Field label="Level">
        <select value={s.level} onChange={e => set({ level: Number(e.target.value) })}>
          {Array.from({ length: 10 }, (_, l) => <option key={l} value={l}>{l === 0 ? 'Cantrip' : `Level ${l}`}</option>)}
        </select>
      </Field>
      <Field label="School">
        <select value={s.school} onChange={e => set({ school: e.target.value as SpellSchool })}>
          {SPELL_SCHOOLS.map(x => <option key={x}>{x}</option>)}
        </select>
      </Field>
      <Field label="Casting time"><input value={s.castingTime} onChange={e => set({ castingTime: e.target.value })} /></Field>
      <Field label="Range"><input value={s.range} onChange={e => set({ range: e.target.value })} /></Field>
      <Field label="Duration"><input value={s.duration} onChange={e => set({ duration: e.target.value })} /></Field>
      <div className="hb-field wide">
        <span>Components and tags</span>
        <div className="row">
          <Check label="Verbal" checked={s.components.v} onChange={v => comp({ v })} />
          <Check label="Somatic" checked={s.components.s} onChange={v => comp({ s: v })} />
          <Check label="Material" checked={s.components.m} onChange={m => comp({ m })} />
          <Check label="Concentration" checked={s.concentration} onChange={concentration => set({ concentration })} />
          <Check label="Ritual" checked={s.ritual} onChange={ritual => set({ ritual })} />
        </div>
      </div>
      {s.components.m && (
        <Field label="Material component" wide>
          <input value={s.components.material ?? ''} onChange={e => comp({ material: e.target.value })} placeholder="a pinch of sulfur" />
        </Field>
      )}
      <Field label="Damage or healing roll">
        <input value={s.damage ?? ''} onChange={e => set({ damage: opt(e.target.value) })} placeholder="3d6" />
      </Field>
      <Field label="Damage type"><input value={s.damageType ?? ''} onChange={e => set({ damageType: opt(e.target.value) })} placeholder="fire" /></Field>
      <Field label="Saving throw">
        <select value={s.save ?? ''} onChange={e => set({ save: (e.target.value || undefined) as Ability | undefined })}>
          <option value="">None</option>
          {ABILITIES.map(a => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}
        </select>
      </Field>
      <div className="hb-field wide">
        <span>Classes</span>
        <div className="row">
          {casters.map(c => (
            <Check
              key={c.id}
              label={c.name}
              checked={s.classes.includes(c.id)}
              onChange={on => set({ classes: on ? [...s.classes, c.id] : s.classes.filter(x => x !== c.id) })}
            />
          ))}
        </div>
      </div>
      <Field label="Description" wide><textarea rows={5} value={s.description} onChange={e => set({ description: e.target.value })} /></Field>
      <Field label="At higher levels" wide><textarea rows={2} value={s.higherLevels ?? ''} onChange={e => set({ higherLevels: opt(e.target.value) })} /></Field>
    </FormShell>
  )
}

export function ItemForm({ initial, onSave, onCancel }: { initial: HomebrewItem; onSave: (i: HomebrewItem) => void; onCancel: () => void }) {
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
    <FormShell title={initial.name ? `Edit ${initial.name}` : 'New item'} value={item} issues={itemIssues(item)} onSave={onSave} onCancel={onCancel}>
      <Field label="Name" wide><input value={item.name} onChange={e => set({ name: e.target.value })} autoFocus /></Field>
      <Field label="Type">
        <select value={item.kind} onChange={e => switchKind(e.target.value as HomebrewItem['kind'])}>
          <option value="weapon">Weapon</option>
          <option value="armor">Armor or shield</option>
          <option value="gear">Gear, potion, trinket</option>
        </select>
      </Field>
      <Field label="Rarity">
        <select value={item.rarity ?? ''} onChange={e => set({ rarity: (e.target.value || undefined) as Rarity | undefined })}>
          <option value="">Mundane</option>
          {RARITIES.map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
        </select>
      </Field>
      <Field label="Weight (lb)"><input type="number" min={0} step={0.5} value={item.weight} onChange={e => set({ weight: numOr(e.target.value, 0) })} /></Field>

      {item.kind === 'weapon' && (
        <>
          <Field label="Category">
            <select value={item.category} onChange={e => set({ category: e.target.value as 'simple' | 'martial' })}>
              <option value="simple">Simple</option>
              <option value="martial">Martial</option>
            </select>
          </Field>
          <Field label="Damage"><input value={item.damage} onChange={e => set({ damage: e.target.value })} placeholder="1d8" /></Field>
          <Field label="Damage type"><input value={item.damageType} onChange={e => set({ damageType: e.target.value })} /></Field>
          {item.properties.includes('versatile') && (
            <Field label="Two-handed damage"><input value={item.versatile ?? ''} onChange={e => set({ versatile: opt(e.target.value) })} placeholder="1d10" /></Field>
          )}
          {(item.properties.includes('thrown') || item.properties.includes('ranged')) && (
            <Field label="Range (ft.)"><input value={item.range ?? ''} onChange={e => set({ range: opt(e.target.value) })} placeholder="20/60" /></Field>
          )}
          <div className="hb-field wide">
            <span>Properties</span>
            <div className="row">
              {WEAPON_PROPS.map(p => (
                <Check
                  key={p}
                  label={p}
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
          <Field label="Category">
            <select value={item.category} onChange={e => set({ category: e.target.value as 'light' | 'medium' | 'heavy' | 'shield' })}>
              <option value="light">Light</option>
              <option value="medium">Medium</option>
              <option value="heavy">Heavy</option>
              <option value="shield">Shield</option>
            </select>
          </Field>
          <Field label={item.category === 'shield' ? 'AC bonus' : 'Base AC'}>
            <input type="number" min={0} max={30} value={item.baseAc} onChange={e => set({ baseAc: numOr(e.target.value, 0) })} />
          </Field>
          {item.category !== 'shield' && (
            <Field label="Max DEX bonus">
              <select value={item.dexCap ?? ''} onChange={e => set({ dexCap: e.target.value === '' ? undefined : Number(e.target.value) })}>
                <option value="">No limit</option>
                {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n === 0 ? 'None' : `+${n}`}</option>)}
              </select>
            </Field>
          )}
          <Field label="Strength needed">
            <input type="number" min={0} max={30} value={item.strengthReq ?? ''} onChange={e => set({ strengthReq: e.target.value ? numOr(e.target.value, 0) : undefined })} placeholder="none" />
          </Field>
          <div className="hb-field">
            <span>Stealth</span>
            <Check label="Disadvantage" checked={!!item.stealthDisadvantage} onChange={v => set({ stealthDisadvantage: v || undefined })} />
          </div>
        </>
      )}

      <Field label="Description" wide><textarea rows={4} value={item.description ?? ''} onChange={e => set({ description: opt(e.target.value) })} /></Field>
    </FormShell>
  )
}

const EFFECT_LABELS: Record<FeatEffect['kind'], string> = {
  ability: 'Ability score', skill: 'Skill proficiency', hpPerLevel: 'HP per level', speed: 'Speed (ft.)', initiative: 'Initiative', ac: 'Armor class',
}

function newEffect(kind: FeatEffect['kind']): FeatEffect {
  if (kind === 'ability') return { kind, ability: 'str', amount: 1 }
  if (kind === 'skill') return { kind, skill: 'athletics' }
  return { kind, amount: kind === 'speed' ? 5 : 1 }
}

export function FeatForm({ initial, onSave, onCancel }: { initial: HomebrewFeat; onSave: (f: HomebrewFeat) => void; onCancel: () => void }) {
  const [f, setF] = useState(initial)
  const set = (patch: Partial<HomebrewFeat>) => setF(prev => ({ ...prev, ...patch }))
  const setEffect = (i: number, e: FeatEffect) => set({ effects: f.effects.map((x, j) => (j === i ? e : x)) })
  return (
    <FormShell title={initial.name ? `Edit ${initial.name}` : 'New feat'} value={f} issues={featIssues(f)} onSave={onSave} onCancel={onCancel}>
      <Field label="Name" wide><input value={f.name} onChange={e => set({ name: e.target.value })} autoFocus /></Field>
      <Field label="Prerequisite" wide><input value={f.prerequisite ?? ''} onChange={e => set({ prerequisite: opt(e.target.value) })} placeholder="Strength 13 or higher" /></Field>
      <Field label="Description" wide><textarea rows={5} value={f.description} onChange={e => set({ description: e.target.value })} /></Field>
      <div className="hb-field wide">
        <span>Effects on the sheet</span>
        <p className="muted small">Applied when a character takes this feat at level up.</p>
        {f.effects.map((e, i) => (
          <div key={i} className="row hb-effect">
            <select value={e.kind} aria-label="Effect" onChange={ev => setEffect(i, newEffect(ev.target.value as FeatEffect['kind']))}>
              {Object.entries(EFFECT_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            {e.kind === 'ability' && (
              <select value={e.ability} aria-label="Ability" onChange={ev => setEffect(i, { ...e, ability: ev.target.value as Ability })}>
                {ABILITIES.map(a => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}
              </select>
            )}
            {e.kind === 'skill' ? (
              <select value={e.skill} aria-label="Skill" onChange={ev => setEffect(i, { ...e, skill: ev.target.value as SkillId })}>
                {ALL_SKILLS.map(s => <option key={s} value={s}>{SKILLS[s].name}</option>)}
              </select>
            ) : (
              <input type="number" aria-label="Amount" className="hb-amount" value={e.amount} onChange={ev => setEffect(i, { ...e, amount: numOr(ev.target.value, 0) })} />
            )}
            <button type="button" className="btn ghost small" onClick={() => set({ effects: f.effects.filter((_, j) => j !== i) })} aria-label="Remove effect">✕</button>
          </div>
        ))}
        <div><button type="button" className="btn small" onClick={() => set({ effects: [...f.effects, newEffect('ability')] })}>+ Add effect</button></div>
      </div>
    </FormShell>
  )
}
