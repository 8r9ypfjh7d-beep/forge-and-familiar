import type { ReactNode } from 'react'
import { useI18n } from '../../i18n'
import { ringFraction, type Ring, type RingKind } from '../vitality'

const RADII = [50, 36, 22]
const LABEL = { hp: 'sheet.hp', slots: 'sheet.slots', hitDice: 'sheet.hitDiceShort' } as const satisfies Record<RingKind, string>

/** Concentric rings for hit points, spell slots and hit dice, with their numbers beside them. */
export function VitalityRings({ rings, hpValue }: { rings: Ring[]; hpValue: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="vitality">
      <svg className="vitality-rings" viewBox="0 0 112 112" aria-hidden="true">
        {rings.map((r, i) => {
          const len = 2 * Math.PI * RADII[i]
          return (
            <g key={r.kind} className={`ring ring-${r.kind}`}>
              <circle className="ring-track" cx="56" cy="56" r={RADII[i]} />
              <circle className="ring-fill" cx="56" cy="56" r={RADII[i]} strokeDasharray={`${len * ringFraction(r)} ${len}`} />
            </g>
          )
        })}
      </svg>
      <dl className="vitality-legend">
        {rings.map(r => (
          <div key={r.kind} className={`ring-${r.kind}`}>
            <dt>{t(LABEL[r.kind])}</dt>
            <dd>{r.kind === 'hp' ? hpValue : <span className="num">{r.value}/{r.max}</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
