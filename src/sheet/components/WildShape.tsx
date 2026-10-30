// Wild Shape on the sheet: the beast picker that opens on Use (within the druid's limits, with
// "show all" to go past them: warn, don't block), and the running form's AC, HP, speed and attacks.
import { useEffect, useState } from 'react'
import { loadKind, type Monster } from '../../content'
import { useI18n } from '../../i18n'
import type { BeastForm, Character } from '../../model/character'
import type { WildShapeLimit } from '../../rules'
import { editionOf } from '../../spellbook/access'
import { LastRoll, type Shown } from '../combat/LastRoll'
import { useSheetRolls } from '../dice'
import { beastAllowed, beastForm, crText } from '../wildShape'

function useBeasts(character: Character): Monster[] {
  const edition = editionOf(character)
  const [beasts, setBeasts] = useState<{ edition: string; list: Monster[] }>({ edition, list: [] })
  useEffect(() => {
    let live = true
    loadKind('monsters', { edition }).then(list => {
      if (live) setBeasts({ edition, list: list.filter(m => m.type.toLowerCase() === 'beast').sort((a, b) => b.challengeRating - a.challengeRating || a.name.localeCompare(b.name)) })
    }).catch(() => {})
    return () => { live = false }
  }, [edition])
  return beasts.edition === edition ? beasts.list : []
}

/** Which beast to become: the allowed ones first, a search box, and every beast behind "Show all". */
export function FormPicker({ character, limit, label, onPick }: { character: Character; limit: WildShapeLimit; label: string; onPick: (form: BeastForm) => void }) {
  const { t } = useI18n()
  const beasts = useBeasts(character)
  const [all, setAll] = useState(false)
  const [q, setQ] = useState('')
  const shown = beasts.filter(m => (all || beastAllowed(m, limit)) && m.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40)
  return (
    <div className="pool-form ws-pick" role="group" aria-label={t('ws.pickName', { label })}>
      <span className="hint">{t('ws.limit', { cr: crText(limit.maxCr) })}{!limit.fly ? ` · ${t('ws.noFly')}` : ''}{!limit.swim ? ` · ${t('ws.noSwim')}` : ''}</span>
      <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('ws.search')} aria-label={t('ws.search')} />
      <label className="check"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> {t('ws.showAll')}</label>
      <div className="cs-pact-chips">
        {shown.map(m => {
          const over = !beastAllowed(m, limit)
          return (
            <button key={m.id} type="button" className="glass-chip" title={over ? t('ws.over') : undefined} onClick={() => onPick(beastForm(m))}>
              <bdi>{m.name}</bdi> <small dir="ltr">CR {crText(m.challengeRating)}</small>{over ? ' ⚠' : ''}
            </button>
          )
        })}
        {!shown.length && <span className="hint">{beasts.length ? t('ws.none') : t('ws.loading')}</span>}
      </div>
    </div>
  )
}

/** The running beast form under Effects: its numbers and one tap per attack. */
export function FormCard({ character, form }: { character: Character; form: BeastForm }) {
  const { t, term } = useI18n()
  const rolls = useSheetRolls(character)
  const [out, setOut] = useState<{ key: number; name: string; rolls: Shown[] } | null>(null)
  const attack = (a: BeastForm['attacks'][number]) => {
    const r = rolls.spell(`${form.name}: ${a.name}`, { attackBonus: a.bonus, damage: a.damage, damageType: a.type })
    const shown: Shown[] = []
    if ('attack' in r && r.attack) shown.push({ roll: r.attack, what: t('cs.roll.toHit') })
    if (r.damage) shown.push({ roll: r.damage, what: a.type ? t('cs.roll.damage', { type: term('damage', a.type, a.type) }) : t('cs.roll.damagePlain', { type: '' }) })
    setOut(o => ({ key: (o?.key ?? 0) + 1, name: a.name, rolls: shown }))
  }
  return (
    <div className="ws-form">
      <span className="hint"><bdi>{form.name}</bdi> · {t('ws.stats', { ac: form.ac, hp: form.hp })} · <span dir="ltr">{form.speed}</span></span>
      <span className="cs-pact-chips">
        {form.attacks.map(a => (
          <button key={a.name} type="button" className="glass-chip" onClick={() => attack(a)} aria-label={t('ws.attackName', { name: a.name })}>
            <bdi>{a.name}</bdi> <small dir="ltr">{a.bonus !== undefined ? `+${a.bonus} ` : ''}{a.damage ?? ''}</small>
          </button>
        ))}
      </span>
      {out && <div key={out.key}><strong>{out.name}</strong><LastRoll rolls={out.rolls} onDone={() => setOut(null)} /></div>}
    </div>
  )
}
