// The Map tab of the sheet's combat mode: the party's live battle map (src/combat/live) as a player
// sees it. Shows the round and whose turn it is, lets the player move the token of the character they
// bring (checked here and again on the server), and opens the map full screen with the HP chip pinned.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { pullLiveCombat, moveToken, watchLiveCombat } from '../../combat/live'
import type { LiveCombat } from '../../combat/liveLogic'
import { BattleMap, type TokenInfo } from '../../combat/map/BattleMap'
import type { Token } from '../../combat/types'
import { useI18n } from '../../i18n'
import { normalizeMap } from '../../maps/logic'
import { mapName } from '../../maps/names'
import { derive } from '../../rules'
import type { Character } from '../../model/character'
import { HpChip } from './CombatPage'
import { canMoveTo, mapStatus, tokenHealth } from './liveMap'

/** The party's live combat, or null while there is none (or the party is local). Keyed by party. */
export function useLiveCombat(partyId: string | undefined): LiveCombat | null {
  const [live, setLive] = useState<{ partyId: string; live: LiveCombat | null } | null>(null)
  useEffect(() => {
    if (!partyId) return
    const stop = watchLiveCombat(partyId, false, l => setLive({ partyId, live: l }))
    return stop
  }, [partyId])
  return live && live.partyId === partyId ? live.live : null
}

/** Glass strip when a combat starts while the player is elsewhere on the sheet; tapping opens the Map tab. */
export function CombatStartedNotice({ onOpen, onClose }: { onOpen: () => void; onClose: () => void }) {
  const { t } = useI18n()
  useEffect(() => {
    const id = setTimeout(onClose, 8000)
    return () => clearTimeout(id)
  }, [onClose])
  return (
    <div className="cs-map-notice glass thick" role="status" aria-live="polite">
      <span aria-hidden="true">🗺️</span>
      <span>{t('cs.map.started')}</span>
      <button type="button" className="glass-btn prominent small" onClick={onOpen}>{t('cs.map.open')}</button>
      <button type="button" className="glass-btn small" aria-label={t('common.cancel')} onClick={onClose}>✕</button>
    </div>
  )
}

export function LiveMapTab({ live, character, brings }: { live: LiveCombat; character: Character; brings: boolean }) {
  const { t } = useI18n()
  const [full, setFull] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  const status = mapStatus(live, character.id, brings)
  const cantMoveText = status.cantMove === 'locked' ? t('cs.map.locked') : status.cantMove === 'not-yours' ? t('cs.map.notYours') : status.cantMove === 'no-token' ? t('cs.map.noToken') : null

  const move = useCallback(async (tokenId: string, x: number, y: number) => {
    const problem = canMoveTo(live, character.id, tokenId, x, y)
    if (problem) { setRefused(problem); return }
    const res = await moveToken(live.partyId, tokenId, x, y)
    if (!res.ok) {
      setRefused(res.reason)
      // The server knows better: show the board as it really is.
      void pullLiveCombat(live.partyId, false)
    } else setRefused(null)
  }, [live, character.id])

  // Escape leaves the full-screen map; the page behind stays put.
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [full])

  const strip = (
    <div className="cs-map-status">
      <span className="cs-map-round">{live.encounter.round > 0 ? t('cs.map.round', { n: live.encounter.round }) : t('cs.map.notStarted')}</span>
      {status.active && (
        <span className={`cs-map-turn${status.yourTurn ? ' yours' : ''}`} aria-live="polite">
          {status.yourTurn ? t('cs.map.yourTurn') : t('cs.map.turnOf', { name: status.active.name })}
        </span>
      )}
      {live.map && <span className="cs-map-name">{mapName(live.map.name, t)}</span>}
    </div>
  )
  const hint = refused
    ? <p className="cs-map-hint warn" role="alert">{t('cs.map.refused')}</p>
    : cantMoveText ? <p className="cs-map-hint">{cantMoveText}</p>
    : null

  const stage = <MapStage live={live} character={character} onMove={move} />
  if (full) {
    return (
      <div className="cs-map-full" role="dialog" aria-modal="true" aria-label={t('cs.tab.map')}>
        <div className="cs-map-full-bar">
          {strip}
          <HpChip character={character} />
          <button type="button" className="glass-btn" onClick={() => setFull(false)}>{t('cs.map.exitFull')}</button>
        </div>
        <div className="cs-map-full-stage">{stage}</div>
        {hint}
      </div>
    )
  }
  return (
    <section className="card cs-map" aria-labelledby="cs-map-title">
      <div className="card-head">
        <h2 id="cs-map-title">{t('cs.tab.map')}</h2>
        <button type="button" className="glass-btn small" onClick={() => setFull(true)}>⛶ {t('cs.map.full')}</button>
      </div>
      {strip}
      <div className="cs-map-stage">{stage}</div>
      {hint}
    </section>
  )
}

/** The map as a player sees it: the shared BattleMap with the live row's map, board and turn. */
function MapStage({ live, character, onMove }: { live: LiveCombat; character: Character; onMove: (tokenId: string, x: number, y: number) => void }) {
  const map = useMemo(() => (live.map ? normalizeMap(live.map) : null), [live.map])
  const speed = useMemo(() => derive(character).speed, [character])
  const infoFor = (tk: Token): TokenInfo => {
    const c = live.encounter.combatants.find(x => x.id === tk.combatantId)
    const { hp, health } = tokenHealth(live, tk)
    return { name: c?.name ?? tk.label, hp, health, conditions: c?.conditions, ...(tk.characterId === character.id ? { speed } : {}) }
  }
  return <BattleMap map={map} board={live.board} encounter={live.encounter} viewer={{ role: 'player', characterId: character.id }} onMove={onMove} infoFor={infoFor} />
}
