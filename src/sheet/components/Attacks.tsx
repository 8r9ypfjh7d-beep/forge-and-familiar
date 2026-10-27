import { useState } from 'react'
import type { AttackOutcome, RollMode } from '../../dice'
import { FadingResult, RollView } from '../../dice/ui'
import { ShowMath } from '../../explain/ShowMath'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { derive, formatMod, getCritRange, getDamageRiders, getRollMode, type DamageRider } from '../../rules'
import { useSheetRolls } from '../dice'

/** Every equipped attack. One tap rolls to-hit and damage with all modifiers, conditions and toggled riders. */
export function Attacks({ character }: { character: Character }) {
  const { t, attackName, term } = useI18n()
  const rolls = useSheetRolls(character)
  const [mode, setMode] = useState<RollMode>('normal')
  const [on, setOn] = useState<Partial<Record<DamageRider['id'], boolean>>>({})
  const [twoHanded, setTwoHanded] = useState<Record<string, boolean>>({})
  const [last, setLast] = useState<(AttackOutcome & { name: string }) | null>(null)
  const { attacks } = derive(character)
  if (!attacks.length) return null

  const own = getRollMode(character, 'attack')
  const critRange = getCritRange(character)
  const offered = new Map<DamageRider['id'], DamageRider>()
  for (const a of attacks) for (const r of getDamageRiders(character, a)) if (!offered.has(r.id)) offered.set(r.id, r)

  const attack = (a: (typeof attacks)[number]) => {
    const riders = getDamageRiders(character, a).filter(r => on[r.id])
    // An item's own extra damage ("1d6 fire") rolls on every hit, like a rider that is always on.
    const extra = a.extraDamage ? /^(\S+)\s*(.*)$/.exec(a.extraDamage) : null
    const all = extra ? [...riders, { name: extra[2] || a.name, damage: extra[1] }] : riders
    const out = rolls.attack(a, { mode, critRange, riders: all, twoHanded: twoHanded[a.name] })
    setLast({ ...out, name: a.name })
    // Sneak Attack is once per turn, so it switches itself off once it has been rolled.
    if (out.damage && riders.some(r => r.oncePerTurn)) setOn(o => ({ ...o, sneakAttack: false }))
  }

  return (
    <section className="card attacks" aria-labelledby="attacks-title">
      <div className="card-head">
        <h2 id="attacks-title">{t('sheet.attacks.title')}</h2>
        <span className="hint">{t('sheet.attacks.hint')}</span>
      </div>

      <div className="segmented" role="group" aria-label={t('sheet.attacks.mode')}>
        {(['advantage', 'normal', 'disadvantage'] as const).map(m => (
          <button key={m} type="button" className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => setMode(m)}>
            {t(m === 'advantage' ? 'dice.adv' : m === 'disadvantage' ? 'dice.dis' : 'dice.normal')}
          </button>
        ))}
      </div>
      {own !== 'normal' && (
        <p className="hint">{t(own === 'advantage' ? 'sheet.attacks.ownAdv' : 'sheet.attacks.ownDis')}</p>
      )}
      {critRange < 20 && <p className="hint">{t('sheet.attacks.critRange', { n: critRange })}</p>}

      {offered.size > 0 && (
        <div className="riders">
          {[...offered.values()].map(r => (
            <label key={r.id} className="rider">
              <input type="checkbox" checked={!!on[r.id]} onChange={e => setOn(o => ({ ...o, [r.id]: e.target.checked }))} />
              {t(r.id === 'rage' ? 'sheet.attacks.raging' : 'sheet.attacks.sneak', { name: term('feature', r.name, r.name), damage: r.damage })}
            </label>
          ))}
        </div>
      )}

      <ul className="attack-rows">
        {attacks.map((a, i) => {
          const name = attackName(a.name)
          const damage = twoHanded[a.name] && a.versatile ? a.versatile : a.damage
          return (
            <li key={a.name}>
              <button type="button" className="attack-roll" onClick={() => attack(a)}
                aria-label={t('sheet.attacks.rollLabel', { name, bonus: formatMod(a.bonus), damage })}>
                <span className="name">{name}</span>
                <span className="hit">{t('sheet.attacks.toHit', { bonus: formatMod(a.bonus) })}</span>
                <span className="dmg">{damage} {term('damage', a.damageType, a.damageType)}{a.extraDamage ? ` + ${a.extraDamage}` : ''}</span>
              </button>
              <ShowMath character={character} stat={`attack:${i}`} className="attack-math">{t('sheet.attacks.math')}</ShowMath>
              {a.versatile && (
                <label className="rider">
                  <input type="checkbox" checked={!!twoHanded[a.name]}
                    onChange={e => setTwoHanded(h => ({ ...h, [a.name]: e.target.checked }))} />
                  {t('sheet.attacks.twoHanded')}
                </label>
              )}
            </li>
          )
        })}
      </ul>

      {last && (
        <FadingResult key={last.attack.id} className="attack-result" onDone={() => setLast(null)}>
          <RollView roll={last.attack} compact />
          {last.damage ? <RollView roll={last.damage} compact /> : <p className="hint">{t('sheet.attacks.miss')}</p>}
        </FadingResult>
      )}
    </section>
  )
}
