// The player's own subclass (a custom patron, domain, oath...): name, features by level with their own uses and
// sheet effects, spells, and the proficiencies and numbers a subclass can change. Saved in Character.customSubclasses.
import { useI18n } from '../i18n'
import { EffectsEditor } from '../inventory'
import {
  ABILITIES, ABILITY_NAMES, blankSubclass, classById, rulesEdition,
  type Ability, type ArmorCategory, type CharacterDraft, type SubclassData, type SubclassFeature, type UsesCount, type WeaponCategory,
} from '../rules'
import { Why } from './Why'

const ARMOR: ArmorCategory[] = ['light', 'medium', 'heavy', 'shield']
const WEAPONS: WeaponCategory[] = ['simple', 'martial']
type UsesKind = 'none' | 'fixed' | 'pb' | 'level' | Ability

const usesKind = (f: SubclassFeature): UsesKind => (!f.uses ? 'none' : typeof f.uses.count === 'number' ? 'fixed' : f.uses.count)

export function CustomSubclassForm({ draft, classId, update }: { draft: CharacterDraft; classId: string; update: (patch: Partial<CharacterDraft>) => void }) {
  const { t, term } = useI18n()
  const def = classById(classId, rulesEdition(draft))
  const from = def?.subclassLevel ?? 1
  const sub = draft.customSubclasses?.find(s => s.classId === classId) ?? blankSubclass(classId)
  const set = (patch: Partial<SubclassData>) =>
    update({ customSubclasses: [...(draft.customSubclasses ?? []).filter(s => s.classId !== classId), { ...sub, ...patch }] })
  const setFeature = (i: number, patch: Partial<SubclassFeature>) => set({ features: sub.features.map((f, j) => (j === i ? { ...f, ...patch } : f)) })
  const toggle = <T,>(list: T[] | undefined, v: T) => (list?.includes(v) ? list.filter(x => x !== v) : [...(list ?? []), v])
  const spells = sub.spells ?? []
  const setSpells = (i: number, patch: Partial<{ level: number; names: string[] }>) => set({ spells: spells.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const level = (v: string) => Math.min(20, Math.max(from, Number(v) || from))

  const setUses = (i: number, f: SubclassFeature, kind: UsesKind) => {
    if (kind === 'none') return setFeature(i, { uses: undefined })
    const count: UsesCount = kind === 'fixed' ? (typeof f.uses?.count === 'number' ? f.uses.count : 1) : kind
    setFeature(i, { uses: { recharge: f.uses?.recharge ?? 'long', count, ...(kind !== 'fixed' && f.uses?.add ? { add: f.uses.add } : {}) } })
  }

  return (
    <div className="custom-bg custom-sub">
      <p className="small">{t('builder.cs.intro', { title: def?.subclassTitle ?? '' })} <Why title={t('builder.cs.why.title')} text={t('builder.cs.why.text')} /></p>
      <div className="row custom-bg-fields">
        <div className="field">
          <label htmlFor={`cs-name-${classId}`}>{t('builder.cs.name')}</label>
          <input id={`cs-name-${classId}`} value={sub.name} placeholder={t('builder.cs.namePlaceholder')} onChange={e => set({ name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`cs-desc-${classId}`}>{t('builder.cs.description')}</label>
          <input id={`cs-desc-${classId}`} value={sub.description ?? ''} placeholder={t('builder.cs.descriptionPlaceholder')} onChange={e => set({ description: e.target.value || undefined })} />
        </div>
      </div>

      <p className="small strong">{t('builder.cs.features')}</p>
      {sub.features.length === 0 && <p className="muted small">{t('builder.cs.noFeatures')}</p>}
      {sub.features.map((f, i) => (
        <fieldset key={i} className="custom-sub-feature">
          <legend className="a11y-sr-only">{f.name || t('builder.cs.featureN', { n: i + 1 })}</legend>
          <div className="row custom-bg-fields">
            <div className="field custom-sub-level">
              <label htmlFor={`cs-f-lvl-${classId}-${i}`}>{t('builder.cs.level')}</label>
              <input id={`cs-f-lvl-${classId}-${i}`} type="number" min={from} max={20} value={f.level} onChange={e => setFeature(i, { level: level(e.target.value) })} />
            </div>
            <div className="field">
              <label htmlFor={`cs-f-name-${classId}-${i}`}>{t('builder.cs.featureName')}</label>
              <input id={`cs-f-name-${classId}-${i}`} value={f.name} onChange={e => setFeature(i, { name: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor={`cs-f-text-${classId}-${i}`}>{t('builder.cs.featureText')}</label>
            <textarea id={`cs-f-text-${classId}-${i}`} rows={2} value={f.text ?? ''} onChange={e => setFeature(i, { text: e.target.value || undefined })} />
          </div>
          <div className="row custom-bg-fields">
            <div className="field">
              <label htmlFor={`cs-f-uses-${classId}-${i}`}>{t('builder.cs.uses')} <Why compact title={t('builder.cs.uses')} text={t('builder.cs.usesWhy')} /></label>
              <select id={`cs-f-uses-${classId}-${i}`} value={usesKind(f)} onChange={e => setUses(i, f, e.target.value as UsesKind)}>
                <option value="none">{t('builder.cs.uses.none')}</option>
                <option value="fixed">{t('builder.cs.uses.fixed')}</option>
                <option value="pb">{t('builder.cs.uses.pb')}</option>
                <option value="level">{t('builder.cs.uses.level')}</option>
                {ABILITIES.map(a => <option key={a} value={a}>{t('builder.cs.uses.mod', { ability: term('ability', a, ABILITY_NAMES[a]) })}</option>)}
              </select>
            </div>
            {f.uses && (
              <>
                <div className="field custom-sub-level">
                  <label htmlFor={`cs-f-n-${classId}-${i}`}>{typeof f.uses.count === 'number' ? t('builder.cs.uses.count') : t('builder.cs.uses.add')}</label>
                  <input id={`cs-f-n-${classId}-${i}`} type="number" min={typeof f.uses.count === 'number' ? 1 : -5} max={50}
                    value={typeof f.uses.count === 'number' ? f.uses.count : (f.uses.add ?? 0)}
                    onChange={e => {
                      const n = Math.round(Number(e.target.value) || 0)
                      setFeature(i, { uses: typeof f.uses!.count === 'number' ? { ...f.uses!, count: Math.max(1, n) } : { ...f.uses!, add: n || undefined } })
                    }} />
                </div>
                <div className="field">
                  <label htmlFor={`cs-f-rest-${classId}-${i}`}>{t('builder.cs.recharge')}</label>
                  <select id={`cs-f-rest-${classId}-${i}`} value={f.uses.recharge} onChange={e => setFeature(i, { uses: { ...f.uses!, recharge: e.target.value as 'short' | 'long' } })}>
                    <option value="short">{t('builder.cs.recharge.short')}</option>
                    <option value="long">{t('builder.cs.recharge.long')}</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <EffectsEditor legend={t('builder.cs.effects')} effects={f.effects ?? []} onChange={fx => setFeature(i, { effects: fx.length ? fx : undefined })} />
          <button type="button" className="glass-btn small" onClick={() => set({ features: sub.features.filter((_, j) => j !== i) })}>{t('builder.cs.removeFeature')}</button>
        </fieldset>
      ))}
      <div className="row">
        <button type="button" className="glass-btn small" onClick={() => set({ features: [...sub.features, { level: from, name: '' }] })}>{t('builder.cs.addFeature')}</button>
      </div>

      <p className="small strong">{t('builder.cs.spells')} <Why compact title={t('builder.cs.spells')} text={t('builder.cs.spellsWhy')} /></p>
      {spells.map((s, i) => (
        <div key={i} className="row custom-bg-fields">
          <div className="field custom-sub-level">
            <label htmlFor={`cs-s-lvl-${classId}-${i}`}>{t('builder.cs.level')}</label>
            <input id={`cs-s-lvl-${classId}-${i}`} type="number" min={from} max={20} value={s.level} onChange={e => setSpells(i, { level: level(e.target.value) })} />
          </div>
          <div className="field">
            <label htmlFor={`cs-s-names-${classId}-${i}`}>{t('builder.cs.spellNames')}</label>
            <input id={`cs-s-names-${classId}-${i}`} value={s.names.join(', ')} placeholder={t('builder.cs.spellNamesPlaceholder')}
              onChange={e => setSpells(i, { names: e.target.value.split(',').map(x => x.trimStart()) })}
              onBlur={() => setSpells(i, { names: s.names.map(x => x.trim()).filter(Boolean) })} />
          </div>
          <button type="button" className="glass-btn small" aria-label={t('builder.cs.removeSpells')} onClick={() => set({ spells: spells.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}
      <div className="row">
        <button type="button" className="glass-btn small" onClick={() => set({ spells: [...spells, { level: from, names: [] }] })}>{t('builder.cs.addSpells')}</button>
      </div>

      <p className="small strong">{t('builder.cs.profs')}</p>
      <div className="row">
        {ARMOR.map(a => (
          <button key={a} type="button" className={`glass-chip ${sub.armor?.includes(a) ? 'on' : ''}`} aria-pressed={!!sub.armor?.includes(a)} onClick={() => set({ armor: toggle(sub.armor, a) })}>
            {t(`builder.cs.armor.${a}`)}
          </button>
        ))}
        {WEAPONS.map(w => (
          <button key={w} type="button" className={`glass-chip ${sub.weapons?.includes(w) ? 'on' : ''}`} aria-pressed={!!sub.weapons?.includes(w)} onClick={() => set({ weapons: toggle(sub.weapons, w) })}>
            {t(`builder.cs.weapons.${w}`)}
          </button>
        ))}
      </div>
      <div className="row custom-bg-fields">
        <div className="field custom-sub-level">
          <label htmlFor={`cs-hp-${classId}`}>{t('builder.cs.hpPerLevel')}</label>
          <input id={`cs-hp-${classId}`} type="number" min={0} max={5} value={sub.hpPerLevel ?? 0} onChange={e => set({ hpPerLevel: Math.min(5, Math.max(0, Number(e.target.value) || 0)) || undefined })} />
        </div>
        <div className="field">
          <label htmlFor={`cs-ac-${classId}`}>{t('builder.cs.unarmored')}</label>
          <select id={`cs-ac-${classId}`} value={sub.unarmoredAbility ?? ''} onChange={e => set({ unarmoredAbility: (e.target.value || undefined) as Ability | undefined })}>
            <option value="">{t('common.none')}</option>
            {ABILITIES.map(a => <option key={a} value={a}>{t('builder.cs.unarmoredWith', { ability: term('ability', a, ABILITY_NAMES[a]) })}</option>)}
          </select>
        </div>
      </div>
      {classId === 'warlock' && (
        <label className="small">
          <input type="checkbox" checked={!!sub.castingWeapon} onChange={e => set({ castingWeapon: e.target.checked || undefined })} /> {t('builder.cs.castingWeapon')}
        </label>
      )}
    </div>
  )
}
