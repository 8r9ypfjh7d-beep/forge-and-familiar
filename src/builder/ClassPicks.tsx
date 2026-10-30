// Class multi-picks in the builder: Expertise and Primal Knowledge skills (Skills step) and Weapon Mastery weapons (Equipment step).
// Off-list picks are allowed and dimmed; stepWarnings says why.
import { useI18n, type MessageKey } from '../i18n'
import { ALL_SKILLS, MASTERY_WEAPONS, classPickSlots, getWeaponMasteryCount, pickKey, weaponMastery, type SkillId } from '../rules'
import type { StepProps } from './steps'
import { suggestedForPick, suggestedMasteryWeapons } from './validate'
import { Why } from './Why'

export function ClassSkillPicks({ draft, update }: StepProps) {
  const { t, term, skill, className } = useI18n()
  const slots = classPickSlots(draft).filter(s => s.pick.kind !== 'language')
  if (slots.length === 0) return null
  const set = (key: string, list: string[]) => update({ classPicks: { ...draft.classPicks, [key]: list } })
  return (
    <>
      {slots.map(({ classId, pick, picked }) => {
        const key = pickKey(classId, pick.id)
        const suggested = suggestedForPick(draft, pick)
        const toggle = (s: SkillId) => {
          if (picked.includes(s)) set(key, picked.filter(x => x !== s))
          else if (picked.length < pick.count) set(key, [...picked, s])
          else if (pick.count === 1) set(key, [s])
        }
        return (
          <div className="field" key={key}>
            <label>
              {term('feature', pick.name, pick.name)} ({className(classId)} {pick.level}) <Why id={pick.kind === 'expertise' ? 'pick.expertise' : 'pick.skill'} />
            </label>
            <p className="muted small">{t(pick.kind === 'expertise' ? 'builder.pick.expertise' : 'builder.pick.skill', { count: pick.count, chosen: picked.length })}</p>
            <div className="row">
              {ALL_SKILLS.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`glass-chip ${picked.includes(s) ? 'on' : ''} ${suggested.includes(s) ? '' : 'dim'}`}
                  aria-pressed={picked.includes(s)}
                  onClick={() => toggle(s)}
                >
                  {skill(s)}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}

export function WeaponMasteryPicks({ draft, update }: StepProps) {
  const { t, term, item } = useI18n()
  const count = getWeaponMasteryCount(draft)
  if (count === 0) return null
  const picked = (draft.weaponMasteries ?? []).slice(0, count)
  const suggested = suggestedMasteryWeapons(draft)
  const toggle = (id: string) => {
    if (picked.includes(id)) update({ weaponMasteries: picked.filter(x => x !== id) })
    else if (picked.length < count) update({ weaponMasteries: [...picked, id] })
  }
  return (
    <div className="field">
      <label>{term('feature', 'Weapon Mastery', 'Weapon Mastery')} <Why id="pick.mastery" /></label>
      <p className="muted small">{t('builder.pick.mastery', { count, chosen: picked.length })}</p>
      <div className="row">
        {MASTERY_WEAPONS.map(w => {
          const m = weaponMastery(w.id)!
          return (
            <button
              key={w.id}
              type="button"
              className={`glass-chip ${picked.includes(w.id) ? 'on' : ''} ${suggested.includes(w.id) ? '' : 'dim'}`}
              aria-pressed={picked.includes(w.id)}
              title={t(`why.mastery.${m}` as MessageKey)}
              onClick={() => toggle(w.id)}
            >
              {item(w.id, w.name)} · {term('mastery', m, m[0].toUpperCase() + m.slice(1))}
            </button>
          )
        })}
      </div>
      {picked.length > 0 && (
        <ul className="muted small">
          {[...new Set(picked.map(id => weaponMastery(id)!))].map(m => (
            <li key={m}><strong>{term('mastery', m, m[0].toUpperCase() + m.slice(1))}</strong>: {t(`why.mastery.${m}` as MessageKey)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
