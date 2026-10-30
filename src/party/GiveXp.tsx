import { useState } from 'react'
import { useI18n } from '../i18n'
import type { Character } from '../model/character'
import { updateStash } from './store'
import type { Party } from './types'

/** The DM's "Give XP" card on the party page: an amount or a milestone level for the players they tick (all by default). */
export function GiveXp({ party, userId, characters, nameOf }: {
  party: Party
  userId: string
  characters: Record<string, Character | undefined>
  nameOf: (id: string) => string
}) {
  const { t } = useI18n()
  const players = party.members.filter(m => m.characterId && m.userId !== party.dmId)
  const [off, setOff] = useState<Set<string>>(new Set())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  if (userId !== party.dmId || players.length === 0) return null
  const picked = players.filter(m => !off.has(m.userId))
  const xp = Math.floor(Number(amount))
  const charName = (id: string) => characters[id]?.name ?? t('party.unknownPlayer')
  const give = async (milestone: boolean) => {
    const res = await updateStash(party.id, userId, {
      type: 'award', ...(milestone ? { milestone: true } : { xp }),
      to: picked.map(m => ({ userId: m.userId, characterId: m.characterId! })),
      names: picked.map(m => charName(m.characterId!)),
    })
    if (res.ok) {
      setAmount('')
      setNote(t(milestone ? 'xp.give.doneMilestone' : 'xp.give.done', { xp, count: picked.length }))
    } else setNote(res.reason)
  }
  const toggle = (id: string) => setOff(s => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <section className="glass give-xp" aria-labelledby="give-xp-title">
      <div className="stash-head">
        <h3 id="give-xp-title">{t('xp.give.title')}</h3>
        <span className="muted small">{t('xp.give.hint')}</span>
      </div>
      <div className="row" role="group" aria-label={t('xp.give.who')}>
        {players.map(m => (
          <button key={m.userId} type="button" className={`glass-chip ${off.has(m.userId) ? '' : 'on'}`} aria-pressed={!off.has(m.userId)} onClick={() => toggle(m.userId)}>
            {charName(m.characterId!)} <span className="muted small">({nameOf(m.userId)})</span>
          </button>
        ))}
      </div>
      <form className="row" onSubmit={e => { e.preventDefault(); if (xp > 0 && picked.length) give(false) }}>
        <input className="glass-field amount" type="number" min={1} inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)}
          aria-label={t('xp.give.amount')} placeholder="XP" />
        <button className="glass-btn small prominent" disabled={!(xp > 0) || !picked.length}>{t('xp.give.xp')}</button>
        <button type="button" className="glass-btn small" disabled={!picked.length} onClick={() => give(true)}>{t('xp.give.milestone')}</button>
      </form>
      {note && <p className="muted small" role="status">{note}</p>}
    </section>
  )
}
