import { useState } from 'react'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import type { Party as Campaign } from '../../party'
import { updateStash } from '../../party/store'
import type { Encounter } from '../types'
import { fightPlayers, xpShare, type FightCreature } from '../xp'

/**
 * Shown after End combat in a campaign fight: the XP of the creatures the party beat (ticked), split evenly
 * between the players who fought. Giving it is a party award, as on the campaign page's Give XP card.
 */
export function FightXp({ enc, campaign, creatures, characters, onClose }: {
  enc: Encounter
  campaign: Campaign
  creatures: FightCreature[]
  characters: Record<string, Character | undefined>
  onClose: () => void
}) {
  const { t } = useI18n()
  const players = fightPlayers(campaign, enc)
  const [ticked, setTicked] = useState(() => new Set(creatures.filter(c => c.beaten).map(c => c.id)))
  const [off, setOff] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  if (!creatures.length || !players.length) return null

  const picked = players.filter(p => !off.has(p.userId))
  const total = creatures.filter(c => ticked.has(c.id)).reduce((n, c) => n + c.xp, 0)
  const each = xpShare(total, picked.length)
  const nameOf = (characterId: string) =>
    characters[characterId]?.name ?? enc.combatants.find(c => c.characterId === characterId)?.name ?? t('party.unknownPlayer')
  const flip = (set: (f: (s: Set<string>) => Set<string>) => void, id: string) => set(s => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const give = async () => {
    setBusy(true)
    const res = await updateStash(campaign.id, campaign.dmId, {
      type: 'award', xp: each, to: picked, names: picked.map(p => nameOf(p.characterId)),
    })
    setBusy(false)
    if (res.ok) {
      setNote(t('xp.give.done', { xp: each, count: picked.length }))
      setTicked(new Set())
    } else setNote(res.reason)
  }

  return (
    <section className="glass fight-xp" aria-labelledby="fight-xp-title">
      <h3 id="fight-xp-title" className="glass-eyebrow">{t('xp.fight.title')}</h3>
      <p className="muted small">{t('xp.fight.hint')}</p>
      <div className="row" role="group" aria-label={t('xp.fight.creatures')}>
        {creatures.map(c => (
          <button key={c.id} type="button" className={`glass-chip ${ticked.has(c.id) ? 'on' : ''}`} aria-pressed={ticked.has(c.id)} onClick={() => flip(setTicked, c.id)}>
            {t('xp.fight.creature', { name: c.name, xp: c.xp.toLocaleString() })}
          </button>
        ))}
      </div>
      <div className="row" role="group" aria-label={t('xp.give.who')}>
        {players.map(p => (
          <button key={p.userId} type="button" className={`glass-chip ${off.has(p.userId) ? '' : 'on'}`} aria-pressed={!off.has(p.userId)} onClick={() => flip(setOff, p.userId)}>
            {nameOf(p.characterId)}
          </button>
        ))}
      </div>
      <div className="row">
        <button type="button" className="glass-btn prominent" disabled={busy || !(each > 0)} onClick={give}>
          {t('xp.fight.give', { total: total.toLocaleString(), each: each.toLocaleString() })}
        </button>
        <button type="button" className="glass-btn plain" onClick={onClose}>{t('xp.fight.dismiss')}</button>
      </div>
      {!(total > 0) && !note && <p className="muted small">{t('xp.fight.noXp')}</p>}
      {note && <p className="muted small" role="status">{note}</p>}
    </section>
  )
}
