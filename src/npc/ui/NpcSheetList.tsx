// The DM's NPC sheets for the campaign in play, as a card on the DM screen's NPCs tab. Tapping one opens its sheet.
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { crLabel } from '../../monsters'
import { maxHp } from '../engine'
import { listNpcs, onNpcsChanged } from '../store'
import type { NpcSheet } from '../types'
import './npc.css'

export function NpcSheetList({ ownerId, partyId, onOpen }: { ownerId: string; partyId?: string; onOpen: (id: string) => void }) {
  const { t, monsterName } = useI18n()
  const [list, setList] = useState<NpcSheet[] | null>(null)
  useEffect(() => {
    let live = true
    const load = () => listNpcs(ownerId, partyId).then(l => { if (live) setList(l) })
    load()
    const off = onNpcsChanged(load)
    return () => { live = false; off() }
  }, [ownerId, partyId])
  if (!list?.length) return null
  return (
    <section className="card" aria-labelledby="npc-list-title">
      <h2 id="npc-list-title">{t('npc.list', { count: list.length })}</h2>
      <ul className="plain npc-list">
        {list.map(n => (
          <li key={n.id}>
            <button type="button" className="npc-list-row" onClick={() => onOpen(n.id)}>
              <b>{n.name}</b>
              <span>{[n.role, monsterName(n.block), t('npc.cr', { cr: crLabel(n.block.challengeRating), xp: n.block.xp.toLocaleString() })].filter(Boolean).join(' · ')}</span>
              <small>{n.state.currentHp}/{maxHp(n)}</small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
