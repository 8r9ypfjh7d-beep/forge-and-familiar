// The Map tab of the sheet's combat mode: the party's live battle map (src/combat/live) as a player
// sees it. Shows the round and whose turn it is, lets the player move the token of the character they
// bring (checked here and again on the server), and opens the map full screen with the HP chip pinned.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { pullLiveCombat, moveToken, watchLiveCombat } from '../../combat/live'
import type { LiveCombat } from '../../combat/liveLogic'
import type { Token } from '../../combat/types'
import { useI18n } from '../../i18n'
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
      {live.map && <span className="cs-map-name">{live.map.name}</span>}
    </div>
  )
  const hint = refused
    ? <p className="cs-map-hint warn" role="alert">{t('cs.map.refused')}</p>
    : cantMoveText ? <p className="cs-map-hint">{cantMoveText}</p>
    : <p className="cs-map-hint">{t('cs.map.howToMove')}</p>

  const stage = <MapStage live={live} ownTokenId={status.cantMove ? undefined : status.ownTokenId} onMove={move} />
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

const CELL = 40

/**
 * The map as a player sees it: grid, fog, tokens. Tap your token, then tap a cell to move there.
 * Replaced by the shared BattleMap (src/combat/ui/BattleMap, unit C) once it is on main.
 */
function MapStage({ live, ownTokenId, onMove }: { live: LiveCombat; ownTokenId?: string; onMove: (tokenId: string, x: number, y: number) => void }) {
  const { t } = useI18n()
  const [picked, setPicked] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const w = live.map?.width ?? 24
  const h = live.map?.height ?? 16
  const fog = new Set(live.board.fog)
  const own = live.board.tokens.find(t => t.id === ownTokenId)
  const tap = (x: number, y: number) => {
    if (!own) return
    if (!picked) return
    setPicked(false)
    if (x !== own.x || y !== own.y) onMove(own.id, x, y)
  }
  // Centre on the player's own token when the map first shows.
  useEffect(() => {
    const el = box.current
    if (!el || !own) return
    el.scrollTo({ left: own.x * CELL - el.clientWidth / 2, top: own.y * CELL - el.clientHeight / 2 })
    // Only on the first paint and when the token changes identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [own?.id])
  const cells: ReactNode[] = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const key = `${x},${y}`
    cells.push(
      <rect key={key} x={x * CELL} y={y * CELL} width={CELL} height={CELL}
        className={`cs-map-cell${fog.has(key as `${number},${number}`) ? ' fog' : ''}${picked ? ' target' : ''}`}
        onClick={() => tap(x, y)} />,
    )
  }
  return (
    <div className={`cs-map-scroll${picked ? ' picking' : ''}`} ref={box}>
      <svg className="cs-map-svg" width={w * CELL} height={h * CELL} viewBox={`0 0 ${w * CELL} ${h * CELL}`} role="img" aria-label={t('cs.map.stageLabel', { w, h })}>
        {cells}
        {live.board.tokens.filter(tk => tk.x >= 0 && tk.y >= 0).map(tk => (
          <TokenMark key={tk.id} token={tk} live={live} own={tk.id === ownTokenId} picked={picked && tk.id === ownTokenId}
            active={live.encounter.activeId === tk.combatantId} onTap={() => { if (tk.id === ownTokenId) setPicked(p => !p) }} />
        ))}
      </svg>
    </div>
  )
}

const HEALTH_KEYS = { healthy: 'cs.map.health.healthy', bloodied: 'cs.map.health.bloodied', down: 'cs.map.health.down' } as const

function TokenMark({ token, live, own, picked, active, onTap }: { token: Token; live: LiveCombat; own: boolean; picked: boolean; active: boolean; onTap: () => void }) {
  const { t } = useI18n()
  const { hp, health } = tokenHealth(live, token)
  const name = live.encounter.combatants.find(c => c.id === token.combatantId)?.name ?? token.label
  const size = token.size * CELL
  const cx = token.x * CELL + size / 2
  const cy = token.y * CELL + size / 2
  const r = size / 2 - 3
  const healthText = hp ? t('cs.map.hp', { hp: hp.current, max: hp.max }) : health ? t(HEALTH_KEYS[health]) : ''
  const state = hp ? (hp.current <= 0 ? 'down' : hp.current * 2 <= hp.max ? 'bloodied' : 'healthy') : health
  return (
    <g className={`cs-map-token ${token.kind}${own ? ' own' : ''}${picked ? ' picked' : ''}${active ? ' active' : ''}${state ? ` ${state}` : ''}`}
      tabIndex={own ? 0 : -1} role={own ? 'button' : undefined} aria-pressed={own ? picked : undefined}
      aria-label={`${name}${healthText ? `, ${healthText}` : ''}${active ? `, ${t('cs.map.activeTurn')}` : ''}`}
      onClick={onTap} onKeyDown={e => { if (own && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onTap() } }}>
      <circle cx={cx} cy={cy} r={r} style={token.color ? { fill: token.color } : undefined} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(12, r * 0.8)}>{token.label}</text>
      {state === 'bloodied' && <circle className="cs-map-blood" cx={cx + r * 0.7} cy={cy - r * 0.7} r={Math.max(4, r / 4)} />}
      {state === 'down' && <text className="cs-map-down" x={cx} y={cy + r * 0.55} textAnchor="middle" fontSize={Math.max(10, r / 2)}>✕</text>}
    </g>
  )
}
