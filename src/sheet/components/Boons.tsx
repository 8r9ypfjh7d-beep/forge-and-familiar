// The Rewards card: charms (a few uses, gone when spent) and blessings (they stay) from the DM,
// or written down by the player. A charm's Use rolls its die, heals or gives temporary hit points.
import { useState } from 'react'
import { ConfirmDialog } from '../../builder/ConfirmDialog'
import { useI18n } from '../../i18n'
import type { Boon, Character } from '../../model/character'
import { effectText } from '../../inventory'
import { addBoon, boonDice, boonLeft, boonRollText, boonUses, removeBoon, spendBoon } from '../boons'
import { useSheetRolls } from '../dice'
import { LastRoll, type Shown } from '../combat/LastRoll'
import type { Apply } from '../types'

/** `always` shows the card with its empty note and Add form even without rewards (the combat Features tab). */
export function Boons({ character, apply, always }: { character: Character; apply: Apply; always?: boolean }) {
  const i18n = useI18n()
  const { t } = i18n
  const rolls = useSheetRolls(character)
  const [last, setLast] = useState<Shown | null>(null)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<Boon | null>(null)
  const [form, setForm] = useState({ name: '', text: '', uses: '1' })
  const boons = character.state.boons ?? []
  if (!boons.length && !always) return null

  const use = (b: Boon) => {
    const dice = boonDice(b)
    const roll = dice ? rolls.any(dice, b.name) : undefined
    if (roll) setLast({ roll, what: b.name })
    apply(t('boons.log.use', { name: b.name }), c => spendBoon(c, b.id, roll?.total ?? 0))
  }
  const add = () => {
    const name = form.name.trim()
    if (!name) return
    const uses = Math.min(20, Math.max(1, Math.floor(Number(form.uses) || 1)))
    const boon: Boon = { id: crypto.randomUUID(), name, kind: 'charm', uses, at: new Date().toISOString(), ...(form.text.trim() ? { text: form.text.trim() } : {}) }
    apply(t('boons.log.add', { name }), c => addBoon(c, boon))
    setForm({ name: '', text: '', uses: '1' })
    setAdding(false)
  }

  return (
    <section className="card boons" aria-labelledby={`boons-title-${character.id}`}>
      <div className="card-head">
        <h2 id={`boons-title-${character.id}`}>{t('boons.title')}</h2>
      </div>
      <p className="hint">{boons.length ? t('boons.hint') : t('boons.empty')}</p>
      {boons.length > 0 && (
        <ul className="boon-list">
          {boons.map(b => {
            const left = boonLeft(b)
            const roll = boonRollText(t, b)
            return (
              <li key={b.id} className={`boon boon--${b.kind}`}>
                <div className="boon-head">
                  <span className="boon-icon" aria-hidden="true">{b.kind === 'charm' ? '✦' : '✺'}</span>
                  <strong className="boon-name"><bdi>{b.name}</bdi></strong>
                  <span className="boon-kind">{t(b.kind === 'charm' ? 'boons.charm' : 'boons.blessing')}</span>
                  {b.from && <span className="hint">{t('boons.from', { name: b.from })}</span>}
                </div>
                {b.text && <p className="boon-text"><bdi>{b.text}</bdi></p>}
                {roll && <p className="boon-text hint">{roll}</p>}
                {b.kind === 'blessing' && (b.stats ?? []).length > 0 && (
                  <ul className="cs-perks">{(b.stats ?? []).map((f, i) => <li key={i}><bdi>{effectText(i18n, f)}</bdi></li>)}</ul>
                )}
                <div className="boon-actions">
                  {b.kind === 'charm' && (
                    <>
                      <span className="hint">{t('boons.left', { n: left, total: boonUses(b) })}</span>
                      <button type="button" className="btn small primary" disabled={left <= 0} onClick={() => use(b)}>{t('boons.use')}</button>
                    </>
                  )}
                  <button type="button" className="btn ghost small" onClick={() => setRemoving(b)}>{t('boons.remove')}</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {last && <LastRoll key={last.roll.id} rolls={[last]} onDone={() => setLast(null)} />}
      {adding
        ? (
          <form className="boon-add" onSubmit={e => { e.preventDefault(); add() }}>
            <input value={form.name} autoFocus onChange={e => setForm({ ...form, name: e.target.value })} aria-label={t('boons.addName')} placeholder={t('boons.addName')} />
            <input value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} aria-label={t('boons.addText')} placeholder={t('boons.addText')} />
            <label className="boon-uses">{t('boons.addUses')}
              <input type="number" min={1} max={20} inputMode="numeric" value={form.uses} onChange={e => setForm({ ...form, uses: e.target.value })} />
            </label>
            <button className="btn small primary" disabled={!form.name.trim()}>{t('boons.addButton')}</button>
            <button type="button" className="btn ghost small" onClick={() => setAdding(false)}>{t('boons.cancel')}</button>
          </form>
        )
        : <button type="button" className="btn ghost small" onClick={() => setAdding(true)}>{t('boons.add')}</button>}
      <ConfirmDialog open={!!removing} title={removing ? t('boons.removeTitle', { name: removing.name }) : ''} yes={t('boons.remove')}
        onYes={() => { if (removing) apply(t('boons.log.remove', { name: removing.name }), c => removeBoon(c, removing.id)); setRemoving(null) }}
        onClose={() => setRemoving(null)} />
    </section>
  )
}
