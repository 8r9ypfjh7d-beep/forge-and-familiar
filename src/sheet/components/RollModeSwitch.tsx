// The Adv / Normal / Dis switch for attacks, shared by story mode's Attacks card and the combat tab.
// It lights the mode the next roll will really use, so a Poisoned character sees Dis lit, with the cause underneath.
import type { RollMode } from '../../dice'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { rollModeCauses, type RollModeCause } from '../../rules'

/** The order everywhere a roll mode is picked (sheet, dice roller, secret roll). */
export const ROLL_MODES = ['advantage', 'normal', 'disadvantage'] as const

/** What the picked mode becomes once the character's own conditions are added (advantage and disadvantage cancel). */
export function effectiveMode(picked: RollMode, own: RollMode): RollMode {
  if (picked === 'normal') return own
  if (own === 'normal' || own === picked) return picked
  return 'normal'
}

/** The character's forced attack mode and its causes in words: "Poisoned, Prone". */
export function useOwnAttackMode(character: Pick<Character, 'state'>): { own: RollMode; why: string } {
  const { term } = useI18n()
  const c = rollModeCauses(character, 'attack')
  const name = (x: RollModeCause) => ('condition' in x ? term('condition', x.condition, x.condition) : term('feature', x.effect, x.effect))
  const list = c.mode === 'advantage' ? c.adv : c.mode === 'disadvantage' ? c.dis : []
  return { own: c.mode, why: list.map(name).join(', ') }
}

export function RollModeSwitch({ character, mode, onChange }: { character: Pick<Character, 'state'>; mode: RollMode; onChange: (m: RollMode) => void }) {
  const { t } = useI18n()
  const { own, why } = useOwnAttackMode(character)
  const shown = effectiveMode(mode, own)
  return (
    <>
      <div className="segmented" role="group" aria-label={t('sheet.attacks.mode')}>
        {ROLL_MODES.map(m => (
          <button key={m} type="button" className={shown === m ? 'on' : ''} aria-pressed={shown === m} onClick={() => onChange(m)}>
            {t(m === 'advantage' ? 'dice.adv' : m === 'disadvantage' ? 'dice.dis' : 'dice.normal')}
          </button>
        ))}
      </div>
      {own !== 'normal' && (
        <p className="hint roll-mode-why">{t(own === 'advantage' ? 'sheet.attacks.ownAdv' : 'sheet.attacks.ownDis', { why })}</p>
      )}
    </>
  )
}
