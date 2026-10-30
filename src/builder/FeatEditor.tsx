// Everything a feat can do to the sheet, as an editor: +1 ability pick (with its save), fixed bonuses, extra skill
// picks, uses tracked on Resources, armor and weapon training, and every item-style effect (resistances, senses,
// speeds, advantage, saves, expertise, spells...). Shared by the builder's custom feat and Homebrew feats.
import { useI18n } from '../i18n'
import { EffectsEditor } from '../inventory'
import {
  ABILITIES, ABILITY_NAMES, ALL_SKILLS,
  type Ability, type ArmorCategory, type Feat, type FeatEffect, type SkillId, type UsesCount, type WeaponCategory,
} from '../rules'
import { Why } from './Why'

const ARMOR: ArmorCategory[] = ['light', 'medium', 'heavy', 'shield']
const WEAPONS: WeaponCategory[] = ['simple', 'martial']
/** Fixed-number effects a feat row can add; labels are `hb.effect.<kind>`. */
const ROW_KINDS = ['ability', 'skill', 'hpPerLevel', 'speed', 'initiative', 'ac', 'armoredAc', 'rangedAttack', 'initiativeProficiency', 'skillPicks'] as const
type RowKind = (typeof ROW_KINDS)[number]
type UsesKind = 'none' | 'fixed' | 'pb' | 'level' | Ability

export type FeatMechanicsValue = Pick<Feat, 'effects' | 'stats' | 'uses' | 'armor' | 'weapons'>

function newRow(kind: RowKind): FeatEffect {
  if (kind === 'ability') return { kind, ability: 'str', amount: 1 }
  if (kind === 'skill') return { kind, skill: 'athletics' }
  if (kind === 'initiativeProficiency') return { kind }
  if (kind === 'skillPicks') return { kind, count: 1 }
  return { kind, amount: kind === 'speed' ? 5 : 1 }
}

const toggle = <T,>(list: T[] | undefined, v: T) => {
  const next = list?.includes(v) ? list.filter(x => x !== v) : [...(list ?? []), v]
  return next.length ? next : undefined
}

export function FeatMechanics({ value, onChange, idPrefix }: { value: FeatMechanicsValue; onChange: (patch: Partial<FeatMechanicsValue>) => void; idPrefix: string }) {
  const { t, term, skill } = useI18n()
  const ability = (a: Ability) => term('ability', a, ABILITY_NAMES[a])
  const choice = value.effects.find((e): e is Extract<FeatEffect, { kind: 'abilityChoice' }> => e.kind === 'abilityChoice')
  const rows = value.effects.filter((e): e is Exclude<FeatEffect, { kind: 'abilityChoice' }> => e.kind !== 'abilityChoice')
  const setRows = (next: FeatEffect[]) => onChange({ effects: [...(choice ? [choice] : []), ...next] })
  const setChoice = (c: typeof choice) => onChange({ effects: [...(c ? [c] : []), ...rows] })
  const setRow = (i: number, e: FeatEffect) => setRows(rows.map((x, j) => (j === i ? e : x)))
  const u = value.uses
  const usesKind: UsesKind = !u ? 'none' : typeof u.count === 'number' ? 'fixed' : u.count
  const setUses = (kind: UsesKind) => {
    if (kind === 'none') return onChange({ uses: undefined })
    const count: UsesCount = kind === 'fixed' ? (typeof u?.count === 'number' ? u.count : 1) : kind
    onChange({ uses: { recharge: u?.recharge ?? 'long', count, ...(u?.label ? { label: u.label } : {}) } })
  }

  return (
    <div className="feat-mechanics">
      <fieldset className="feat-fx">
        <legend className="why-legend">{t('feats.ed.choice')} <Why compact title={t('feats.ed.choice')} text={t('feats.ed.choiceWhy')} /></legend>
        <div className="row">
          {ABILITIES.map(a => (
            <button key={a} type="button" className={`glass-chip ${choice?.from.includes(a) ? 'on' : ''}`} aria-pressed={!!choice?.from.includes(a)}
              onClick={() => {
                const from = toggle(choice?.from, a)
                setChoice(from ? { kind: 'abilityChoice', from, max: choice?.max ?? 20, ...(choice?.save ? { save: true } : {}) } : undefined)
              }}>
              {ability(a)}
            </button>
          ))}
        </div>
        {choice && (
          <div className="row">
            <label className="small">
              {t('feats.ed.max')}{' '}
              <select value={choice.max} onChange={e => setChoice({ ...choice, max: Number(e.target.value) })}>
                <option value={20}>20</option>
                <option value={30}>30</option>
              </select>
            </label>
            <label className="small">
              <input type="checkbox" checked={!!choice.save} onChange={e => setChoice({ ...choice, save: e.target.checked || undefined })} /> {t('feats.ed.save')}
            </label>
          </div>
        )}
      </fieldset>

      <fieldset className="feat-fx">
        <legend className="why-legend">{t('hb.f.effects')} <Why compact title={t('hb.f.effects')} text={t('feats.ed.rowsWhy')} /></legend>
        {rows.map((e, i) => (
          <div key={i} className="row hb-effect">
            <select value={e.kind} aria-label={t('hb.f.effect')} onChange={ev => setRow(i, newRow(ev.target.value as RowKind))}>
              {ROW_KINDS.map(k => <option key={k} value={k}>{t(`hb.effect.${k}`)}</option>)}
            </select>
            {e.kind === 'ability' && (
              <select value={e.ability} aria-label={t('hb.f.ability')} onChange={ev => setRow(i, { ...e, ability: ev.target.value as Ability })}>
                {ABILITIES.map(a => <option key={a} value={a}>{ability(a)}</option>)}
              </select>
            )}
            {e.kind === 'skill' && (
              <select value={e.skill} aria-label={t('hb.f.skill')} onChange={ev => setRow(i, { ...e, skill: ev.target.value as SkillId })}>
                {ALL_SKILLS.map(s => <option key={s} value={s}>{skill(s)}</option>)}
              </select>
            )}
            {'amount' in e && (
              <input type="number" aria-label={t('hb.f.amount')} className="hb-amount" value={e.amount} onChange={ev => setRow(i, { ...e, amount: Math.round(Number(ev.target.value) || 0) })} />
            )}
            {e.kind === 'skillPicks' && (
              <input type="number" min={1} max={18} aria-label={t('hb.f.amount')} className="hb-amount" value={e.count} onChange={ev => setRow(i, { ...e, count: Math.max(1, Math.round(Number(ev.target.value) || 1)) })} />
            )}
            <button type="button" className="glass-btn small icon hb-ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={t('hb.f.removeEffect')}>✕</button>
          </div>
        ))}
        <div><button type="button" className="glass-btn small" onClick={() => setRows([...rows, newRow('ability')])}>{t('hb.f.addEffect')}</button></div>
      </fieldset>

      <div className="row custom-bg-fields">
        <div className="field">
          <label htmlFor={`${idPrefix}-uses`}>{t('builder.cs.uses')} <Why compact title={t('builder.cs.uses')} text={t('feats.ed.usesWhy')} /></label>
          <select id={`${idPrefix}-uses`} value={usesKind} onChange={e => setUses(e.target.value as UsesKind)}>
            <option value="none">{t('builder.cs.uses.none')}</option>
            <option value="fixed">{t('builder.cs.uses.fixed')}</option>
            <option value="pb">{t('builder.cs.uses.pb')}</option>
            <option value="level">{t('feats.ed.uses.level')}</option>
            {ABILITIES.map(a => <option key={a} value={a}>{t('builder.cs.uses.mod', { ability: ability(a) })}</option>)}
          </select>
        </div>
        {u && (
          <>
            <div className="field custom-sub-level">
              <label htmlFor={`${idPrefix}-n`}>{typeof u.count === 'number' ? t('builder.cs.uses.count') : t('builder.cs.uses.add')}</label>
              <input id={`${idPrefix}-n`} type="number" min={typeof u.count === 'number' ? 1 : -5} max={50}
                value={typeof u.count === 'number' ? u.count : (u.add ?? 0)}
                onChange={e => {
                  const n = Math.round(Number(e.target.value) || 0)
                  onChange({ uses: typeof u.count === 'number' ? { ...u, count: Math.max(1, n) } : { ...u, add: n || undefined } })
                }} />
            </div>
            <div className="field">
              <label htmlFor={`${idPrefix}-rest`}>{t('builder.cs.recharge')}</label>
              <select id={`${idPrefix}-rest`} value={u.recharge} onChange={e => onChange({ uses: { ...u, recharge: e.target.value as 'short' | 'long' } })}>
                <option value="short">{t('builder.cs.recharge.short')}</option>
                <option value="long">{t('builder.cs.recharge.long')}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${idPrefix}-label`}>{t('feats.ed.usesLabel')}</label>
              <input id={`${idPrefix}-label`} value={u.label ?? ''} placeholder={t('feats.ed.usesLabelPlaceholder')} onChange={e => onChange({ uses: { ...u, label: e.target.value || undefined } })} />
            </div>
          </>
        )}
      </div>

      <p className="small strong">{t('feats.ed.training')}</p>
      <div className="row">
        {ARMOR.map(a => (
          <button key={a} type="button" className={`glass-chip ${value.armor?.includes(a) ? 'on' : ''}`} aria-pressed={!!value.armor?.includes(a)} onClick={() => onChange({ armor: toggle(value.armor, a) })}>
            {t(`builder.cs.armor.${a}`)}
          </button>
        ))}
        {WEAPONS.map(w => (
          <button key={w} type="button" className={`glass-chip ${value.weapons?.includes(w) ? 'on' : ''}`} aria-pressed={!!value.weapons?.includes(w)} onClick={() => onChange({ weapons: toggle(value.weapons, w) })}>
            {t(`builder.cs.weapons.${w}`)}
          </button>
        ))}
      </div>

      <EffectsEditor legend={t('feats.ed.stats')} effects={value.stats ?? []} onChange={fx => onChange({ stats: fx.length ? fx : undefined })} />
    </div>
  )
}

/** The builder's custom feat: a name, what it does, and its mechanics. */
export function CustomFeatForm({ feat, onChange, idPrefix }: { feat: Feat | undefined; onChange: (f: Feat) => void; idPrefix: string }) {
  const { t } = useI18n()
  const f: Feat = feat ?? { id: 'custom', name: '', description: '', effects: [] }
  const set = (patch: Partial<Feat>) => onChange({ ...f, ...patch })
  return (
    <div className="custom-bg custom-feat">
      <p className="small">{t('feats.custom.intro')} <Why compact title={t('feats.custom.whyTitle')} text={t('feats.custom.why')} /></p>
      <div className="row custom-bg-fields">
        <div className="field">
          <label htmlFor={`${idPrefix}-name`}>{t('feats.custom.name')}</label>
          <input id={`${idPrefix}-name`} value={f.name} placeholder={t('feats.custom.namePlaceholder')} onChange={e => set({ name: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-desc`}>{t('feats.custom.description')}</label>
        <textarea id={`${idPrefix}-desc`} rows={2} value={f.description} onChange={e => set({ description: e.target.value })} />
      </div>
      <FeatMechanics value={f} onChange={set} idPrefix={idPrefix} />
    </div>
  )
}
