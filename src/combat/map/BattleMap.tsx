// The battle map during play: a canvas for the board (src/combat/map/draw.ts) with tokens as focusable DOM
// elements on top. Pinch, wheel and buttons zoom; one finger or the mouse pans; tap a token then a cell to
// move it (desktop may drag). Reads only the props it is given, so the DM's tracker and a player's phone
// render the same component; the DM gets fog, hidden-token, size and lock controls through `onBoard`.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n/locales/en'
import { checkMove, createMap, distanceFeet, type MoveProblem } from '../../maps/logic'
import type { BattleMapDef, Cell } from '../../maps/types'
import type { HealthLook as Health } from '../playerView'
import type { Board, Token } from '../types'
import { budgetLeft, canMove, coverFog, isPlaced, revealFog, spend, tokenCovering, withToken, type Spent } from './board'
import { drawBoard, footprintInFog, type Palette } from './draw'
import { CELL_PX, cellAt, cellRect, centreOn, clampPan, fitViewport, pan, pinch, zoomAt, type Viewport } from './viewport'
import './battlemap.css'

export type Viewer = { role: 'dm' } | { role: 'player'; characterId: string }

/** What the parent knows about a token's combatant; everything is optional. */
export interface TokenInfo {
  name?: string
  hp?: { current: number; max: number }
  health?: Health
  /** Walking speed in feet, for the movement budget. */
  speed?: number
  conditions?: string[]
}

export interface BattleMapProps {
  /** The static map; null draws a blank grid. */
  map: BattleMapDef | null
  board: Board
  encounter: { round: number; activeId: string | null }
  viewer: Viewer
  /** A confirmed move. The parent writes it (locally or through the live row). */
  onMove: (tokenId: string, x: number, y: number) => void
  /** DM only: fog, lock, hidden, size changes. Players omit it. */
  onBoard?: (change: (b: Board) => Board) => void
  infoFor?: (token: Token) => TokenInfo | undefined
  className?: string
}

type Mode = 'move' | 'measure' | 'fog'
type Ptr = { x: number; y: number }

const BLANK = createMap('blank', '', '', '2026-01-01T00:00:00.000Z')
const DRAG_PX = 6
/** Below this many screen pixels per cell the map opens zoomed in, at START_CELL. */
const MIN_TAP_CELL = 28
const START_CELL = 36

const PROBLEM_KEY: Record<MoveProblem, MessageKey> = {
  outside: 'combat.map.outside', blocked: 'combat.map.blocked', occupied: 'combat.map.occupied', unreachable: 'combat.map.unreachable',
}

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el)
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  return {
    ink: v('--ink', '#222'), muted: v('--muted', '#666'), line: v('--line', '#ccc'), panel: v('--panel', '#f4efe6'),
    accent: v('--accent', '#8c2f1b'), good: v('--good', '#2f6b3a'), bad: v('--bad', '#a3271b'), warn: v('--warn', '#93600c'),
    water: v('--water', '#2d6fa8'), highContrast: document.documentElement.dataset.contrast === 'high',
  }
}

export function BattleMap({ map, board, encounter, viewer, onMove, onBoard, infoFor, className }: BattleMapProps) {
  const { t } = useI18n()
  const def = map ?? BLANK
  const isDm = viewer.role === 'dm'
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<Viewport | null>(null)
  const [mode, setMode] = useState<Mode>('move')
  const [fogBrush, setFogBrush] = useState<'cover' | 'reveal'>('cover')
  const [selected, setSelected] = useState<string | null>(null)
  const [dest, setDest] = useState<Cell | null>(null)
  const [measure, setMeasure] = useState<[Cell, Cell | null] | null>(null)
  const [fogDrag, setFogDrag] = useState<[Cell, Cell] | null>(null)
  const [dash, setDash] = useState(false)
  const [spent, setSpent] = useState<Spent>({})
  const [note, setNote] = useState<string | null>(null)
  const picture = usePicture(def.picture?.src)

  // Movement budgets reset when the turn changes.
  useEffect(() => { setSpent({}); setDash(false) }, [encounter.activeId, encounter.round])
  // A token that left the board drops the selection.
  useEffect(() => { if (selected && !board.tokens.some(tk => tk.id === selected)) { setSelected(null); setDest(null) } }, [board.tokens, selected])

  // Size follows the container; the first measurement fits the whole grid.
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setBox({ w: Math.round(r.width), h: Math.round(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // A whole grid squeezed onto a phone makes tokens too small to tap: start closer, on the viewer's token.
  useEffect(() => {
    if (!box.w || !box.h || view) return
    const fitted = fitViewport(def.width, def.height, box.w, box.h)
    if (fitted.scale * CELL_PX >= MIN_TAP_CELL) { setView(fitted); return }
    const focus = (viewer.role === 'player' ? board.tokens.find(tk => tk.characterId === viewer.characterId) : undefined)
      ?? board.tokens.find(tk => tk.combatantId === encounter.activeId)
    const at = focus && isPlaced(focus) ? focus : { x: def.width / 2, y: def.height / 2, size: 1 }
    const near = centreOn({ ...fitted, scale: START_CELL / CELL_PX }, at.x, at.y, at.size, at.size, box.w, box.h)
    setView(clampPan(near, def.width, def.height, box.w, box.h))
  }, [box, def.width, def.height, view, viewer, board.tokens, encounter.activeId])

  const selectedToken = selected ? board.tokens.find(tk => tk.id === selected) ?? null : null
  const selInfo = selectedToken ? infoFor?.(selectedToken) : undefined
  const budget = selectedToken ? budgetLeft(selInfo?.speed, spent[selectedToken.id] ?? 0, dash) : null
  const plan = useMemo(() => {
    if (!selectedToken || !dest || mode !== 'move') return null
    if (!isPlaced(selectedToken)) return { ok: true, cost: 0, path: [dest], overBudget: false, problem: undefined }
    return checkMove(def, board.tokens.map(tk => ({ ...tk, hidden: !!tk.hidden })), { ...selectedToken, hidden: !!selectedToken.hidden }, dest, budget ?? undefined)
  }, [selectedToken, dest, mode, def, board.tokens, budget])

  // Paint.
  useEffect(() => {
    const canvas = canvasRef.current, el = boxRef.current
    if (!canvas || !el || !view || !box.w) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = box.w * dpr; canvas.height = box.h * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const highlight = fogDrag ? rectCells(fogDrag[0], fogDrag[1]) : dest && !plan?.path.length ? [dest] : []
    drawBoard(ctx, box.w, box.h, {
      map: def, view, fog: board.fog ?? [], seeThroughFog: isDm, picture, palette: readPalette(el),
      path: plan?.ok ? plan.path : undefined, pathTone: plan?.overBudget ? 'warn' : 'ok',
      measure: mode === 'measure' ? measure ?? undefined : undefined, highlight,
    })
  }, [view, box, def, board.fog, isDm, picture, plan, measure, mode, fogDrag, dest])

  const screenToCell = (e: { clientX: number; clientY: number }): Cell | null => {
    const el = boxRef.current
    if (!el || !view) return null
    const r = el.getBoundingClientRect()
    return cellAt(view, e.clientX - r.left, e.clientY - r.top, def.width, def.height)
  }
  const localPt = (e: { clientX: number; clientY: number }): Ptr => {
    const r = boxRef.current?.getBoundingClientRect()
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) }
  }

  const commitMove = useCallback((tk: Token, to: Cell, cost: number) => {
    onMove(tk.id, to.x, to.y)
    if (isPlaced(tk)) setSpent(s => spend(s, tk.id, cost))
    setDest(null)
    setNote(null)
  }, [onMove])

  // Tap on a cell: destination (move), measure point, or nothing.
  const tapCell = (cell: Cell) => {
    if (mode === 'measure') {
      setMeasure(m => (!m || m[1] ? [cell, null] : [m[0], cell]))
      return
    }
    if (mode !== 'move') return
    const under = tokenCovering(board.tokens, cell.x, cell.y)
    if (under && (!selectedToken || under.id !== selectedToken.id) && (!isDm ? !under.hidden : true)) {
      pickToken(under)
      return
    }
    if (!selectedToken) return
    if (!canMove(selectedToken, viewer, board.locked)) {
      setNote(t(board.locked && !isDm ? 'combat.map.lockedHint' : 'combat.map.notYours'))
      return
    }
    if (dest && dest.x === cell.x && dest.y === cell.y && plan?.ok) { commitMove(selectedToken, cell, plan.cost); return }
    setDest(cell)
    setNote(null)
  }

  const pickToken = (tk: Token) => {
    setSelected(tk.id)
    setDest(null)
    setNote(null)
    if (mode === 'measure' && selectedToken && selectedToken.id !== tk.id) setMeasure([{ x: selectedToken.x, y: selectedToken.y }, { x: tk.x, y: tk.y }])
  }

  // Pointers: one pans or drags a token, two pinch. A short still tap selects or sets a destination.
  const pointers = useRef(new Map<number, Ptr>())
  const gesture = useRef<{ kind: 'pan' | 'drag' | 'fog' | 'tap'; start: Ptr; token?: Token; moved: boolean; last?: [Ptr, Ptr] } | null>(null)

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.bm-toolbar, .bm-status')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = localPt(e)
    pointers.current.set(e.pointerId, p)
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = { kind: 'pan', start: p, moved: true, last: [a, b] }
      return
    }
    const cell = screenToCell(e)
    const tk = cell ? tokenCovering(board.tokens, cell.x, cell.y) : undefined
    if (mode === 'fog' && isDm && cell) { gesture.current = { kind: 'fog', start: p, moved: false }; setFogDrag([cell, cell]); return }
    if (tk && mode === 'move' && e.pointerType === 'mouse' && canMove(tk, viewer, board.locked)) { gesture.current = { kind: 'drag', start: p, token: tk, moved: false }; return }
    gesture.current = { kind: 'tap', start: p, moved: false }
  }
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || !view) return
    const p = localPt(e)
    const prev = pointers.current.get(e.pointerId)
    pointers.current.set(e.pointerId, p)
    if (pointers.current.size === 2 && g.last) {
      const next = [...pointers.current.values()] as [Ptr, Ptr]
      setView(v => (v ? clampPan(pinch(v, g.last!, next), def.width, def.height, box.w, box.h) : v))
      g.last = next
      g.moved = true
      return
    }
    if (!prev) return
    const far = Math.hypot(p.x - g.start.x, p.y - g.start.y) > DRAG_PX
    if (g.kind === 'fog') {
      const cell = screenToCell(e)
      if (cell) setFogDrag(d => (d ? [d[0], cell] : d))
      return
    }
    if (g.kind === 'drag') {
      if (far) { g.moved = true; setSelected(g.token!.id); setDest(screenToCell(e)) }
      return
    }
    if (g.kind === 'tap' && !far && !g.moved) return
    g.moved = true
    setView(v => (v ? clampPan(pan(v, p.x - prev.x, p.y - prev.y), def.width, def.height, box.w, box.h) : v))
  }
  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    pointers.current.delete(e.pointerId)
    if (!g) return
    if (pointers.current.size > 0) { g.last = undefined; return }
    gesture.current = null
    if (g.kind === 'fog') {
      const drag = fogDrag
      setFogDrag(null)
      if (drag && onBoard) {
        const [a, b] = drag
        onBoard(bd => ({ ...bd, fog: fogBrush === 'cover' ? coverFog(bd.fog ?? [], a, b, def) : revealFog(bd.fog ?? [], a, b) }))
      }
      return
    }
    const cell = screenToCell(e)
    if (g.kind === 'drag') {
      if (!g.moved) { tapOrPick(cell); return }
      const tk = g.token!
      if (cell) {
        const check = checkMove(def, board.tokens.map(x => ({ ...x, hidden: !!x.hidden })), { ...tk, hidden: !!tk.hidden }, cell, budgetLeft(infoFor?.(tk)?.speed, spent[tk.id] ?? 0, dash) ?? undefined)
        if (check.ok || !isPlaced(tk)) commitMove(tk, cell, check.cost)
        else { setNote(t(PROBLEM_KEY[check.problem!])); setDest(null) }
      } else setDest(null)
      return
    }
    if (g.kind === 'tap' && !g.moved) tapOrPick(cell)
  }
  const tapOrPick = (cell: Cell | null) => {
    if (!cell) { setSelected(null); setDest(null); return }
    tapCell(cell)
  }
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!view) return
    const p = localPt(e)
    setView(clampPan(zoomAt(view, e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y), def.width, def.height, box.w, box.h))
  }

  const zoomBy = (f: number) => setView(v => (v ? clampPan(zoomAt(v, f, box.w / 2, box.h / 2), def.width, def.height, box.w, box.h) : v))
  const fit = () => setView(fitViewport(def.width, def.height, box.w, box.h))
  const centreMe = () => {
    const mine = viewer.role === 'player' ? board.tokens.find(tk => tk.characterId === viewer.characterId) : board.tokens.find(tk => tk.combatantId === encounter.activeId)
    if (!mine || !isPlaced(mine)) return
    setView(v => (v ? centreOn({ ...v, scale: Math.max(v.scale, 1) }, mine.x, mine.y, mine.size, mine.size, box.w, box.h) : v))
    setSelected(mine.id)
  }

  const visibleTokens = board.tokens.filter(tk => isDm || (!tk.hidden && !footprintInFog(tk.x, tk.y, tk.size, board.fog ?? [])))
  const unplaced = isDm ? board.tokens.filter(tk => !isPlaced(tk)) : []
  const measureFeet = measure && measure[1] ? distanceFeet(measure[0], measure[1], def.diagonals) : null

  const status = (() => {
    if (note) return { text: note, tone: 'bad' as const }
    if (mode === 'measure') return measureFeet !== null ? { text: t('combat.map.distance', { ft: measureFeet }), tone: 'ok' as const } : { text: t('combat.map.measureHint'), tone: 'muted' as const }
    if (mode === 'fog') return { text: t(fogBrush === 'cover' ? 'combat.map.fogCoverHint' : 'combat.map.fogRevealHint'), tone: 'muted' as const }
    if (selectedToken && dest && plan) {
      if (!plan.ok) return { text: t(PROBLEM_KEY[plan.problem!]), tone: 'bad' as const }
      return { text: plan.overBudget ? t('combat.map.overBudget', { ft: plan.cost, left: budget ?? 0 }) : t('combat.map.moveCost', { ft: plan.cost }), tone: plan.overBudget ? 'warn' as const : 'ok' as const }
    }
    if (selectedToken) {
      if (!isPlaced(selectedToken)) return { text: t('combat.map.placeHint'), tone: 'muted' as const }
      if (!canMove(selectedToken, viewer, board.locked)) return { text: t(board.locked && !isDm ? 'combat.map.lockedHint' : 'combat.map.notYours'), tone: 'muted' as const }
      return { text: budget !== null ? t('combat.map.budget', { ft: budget }) : t('combat.map.tapHint'), tone: 'muted' as const }
    }
    if (board.locked && !isDm) return { text: t('combat.map.lockedHint'), tone: 'muted' as const }
    return { text: t('combat.map.selectHint'), tone: 'muted' as const }
  })()

  return (
    <div className={`battle-map ${className ?? ''}`} style={{ '--bm-ratio': `${def.width} / ${def.height}` } as CSSProperties}>
      <div className="bm-toolbar" role="toolbar" aria-label={t('combat.map.title')}>
        <div className="glass-segmented" role="group">
          <button type="button" aria-pressed={mode === 'move'} onClick={() => { setMode('move'); setMeasure(null) }}>{t('combat.map.modeMove')}</button>
          <button type="button" aria-pressed={mode === 'measure'} onClick={() => { setMode('measure'); setDest(null) }}>{t('combat.map.modeMeasure')}</button>
          {isDm && onBoard && <button type="button" aria-pressed={mode === 'fog'} onClick={() => { setMode('fog'); setDest(null) }}>{t('combat.map.modeFog')}</button>}
        </div>
        {mode === 'fog' && (
          <div className="glass-segmented" role="group" aria-label={t('combat.map.modeFog')}>
            <button type="button" aria-pressed={fogBrush === 'cover'} onClick={() => setFogBrush('cover')}>{t('combat.map.fogCover')}</button>
            <button type="button" aria-pressed={fogBrush === 'reveal'} onClick={() => setFogBrush('reveal')}>{t('combat.map.fogReveal')}</button>
          </div>
        )}
        <span className="bm-spacer" />
        {selInfo?.speed !== undefined && selectedToken && canMove(selectedToken, viewer, board.locked) && (
          <button type="button" className={`glass-chip ${dash ? 'on' : ''}`} aria-pressed={dash} onClick={() => setDash(d => !d)}>{t('combat.map.dash')}</button>
        )}
        {isDm && onBoard && (
          <button type="button" className={`glass-chip ${board.locked ? 'on' : ''}`} aria-pressed={board.locked}
            onClick={() => onBoard(bd => ({ ...bd, locked: !bd.locked }))} title={t('combat.map.lockTitle')}>
            {board.locked ? t('combat.map.locked') : t('combat.map.lock')}
          </button>
        )}
        <button type="button" className="glass-btn small icon bm-zoom" onClick={() => zoomBy(1 / 1.3)} aria-label={t('combat.map.zoomOut')}>−</button>
        <button type="button" className="glass-btn small icon bm-zoom" onClick={() => zoomBy(1.3)} aria-label={t('combat.map.zoomIn')}>+</button>
        <button type="button" className="glass-btn small" onClick={fit}>{t('combat.map.fit')}</button>
        <button type="button" className="glass-btn small" onClick={centreMe}>{t(viewer.role === 'player' ? 'combat.map.centreMe' : 'combat.map.centreTurn')}</button>
      </div>

      <div ref={boxRef} dir="ltr" className={`bm-box mode-${mode}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} style={{ touchAction: 'none' }}>
        <canvas ref={canvasRef} className="bm-canvas" style={{ width: box.w, height: box.h }} aria-hidden="true" />
        {view && visibleTokens.filter(isPlaced).map(tk => (
          <TokenView key={tk.id} token={tk} view={view} info={infoFor?.(tk)} isDm={isDm}
            active={tk.combatantId === encounter.activeId} selected={tk.id === selected}
            movable={canMove(tk, viewer, board.locked)} mine={viewer.role === 'player' && tk.characterId === viewer.characterId}
            onPick={() => { if (mode === 'measure' || mode === 'move') pickToken(tk) }} t={t} />
        ))}
        {!view && <p className="muted small bm-loading">{t('common.loading')}</p>}
      </div>

      <div className={`bm-status tone-${status.tone}`} aria-live="polite">
        <span className="bm-status-text">{status.text}</span>
        {selectedToken && dest && plan?.ok && mode === 'move' && (
          <>
            <button type="button" className="glass-btn small prominent" onClick={() => commitMove(selectedToken, dest, plan.cost)}>{t('combat.map.confirmMove')}</button>
            <button type="button" className="glass-btn small plain" onClick={() => setDest(null)}>{t('common.cancel')}</button>
          </>
        )}
        {isDm && onBoard && selectedToken && mode === 'move' && !dest && (
          <span className="bm-dm-tools">
            <button type="button" className={`glass-chip ${selectedToken.hidden ? 'on' : ''}`} aria-pressed={!!selectedToken.hidden}
              onClick={() => onBoard(bd => withToken(bd, selectedToken.id, { hidden: !selectedToken.hidden }))}>
              {selectedToken.hidden ? t('combat.map.hiddenOn') : t('combat.map.hide')}
            </button>
            <span className="glass-segmented small" role="group" aria-label={t('combat.map.size')}>
              {([1, 2, 3, 4] as const).map(s => (
                <button key={s} type="button" aria-pressed={selectedToken.size === s} onClick={() => onBoard(bd => withToken(bd, selectedToken.id, { size: s }))}>{s}</button>
              ))}
            </span>
            {isPlaced(selectedToken) && (
              <button type="button" className="glass-chip" onClick={() => onBoard(bd => withToken(bd, selectedToken.id, { x: -1, y: -1 }))}>{t('combat.map.offBoard')}</button>
            )}
          </span>
        )}
      </div>

      {unplaced.length > 0 && (
        <div className="bm-bench">
          <span className="small muted">{t('combat.map.bench')}</span>
          {unplaced.map(tk => (
            <button key={tk.id} type="button" className={`bm-token bench kind-${tk.kind} ${tk.id === selected ? 'selected' : ''}`}
              onClick={() => { setMode('move'); pickToken(tk) }} aria-label={infoFor?.(tk)?.name ?? tk.label}>
              <span className="bm-label">{tk.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function rectCells(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = []
  for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) out.push({ x, y })
  return out
}

function usePicture(src: string | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!src) { setImg(null); return }
    let live = true
    const im = new Image()
    im.onload = () => { if (live) setImg(im) }
    im.src = src
    return () => { live = false }
  }, [src])
  return img
}

const HEALTH_KEY: Record<Health, MessageKey> = { healthy: 'combat.map.healthy', bloodied: 'combat.map.bloodied', down: 'combat.map.down' }

function TokenView({ token: tk, view, info, isDm, active, selected, movable, mine, onPick, t }: {
  token: Token; view: Viewport; info?: TokenInfo; isDm: boolean; active: boolean; selected: boolean; movable: boolean; mine: boolean
  onPick: () => void; t: (k: MessageKey, v?: Record<string, string | number>) => string
}) {
  const r = cellRect(view, tk.x, tk.y, tk.size, tk.size)
  const hp = info?.hp
  const pct = hp ? Math.max(0, Math.min(1, hp.current / Math.max(1, hp.max))) : null
  const health: Health | undefined = info?.health ?? (hp ? (hp.current <= 0 ? 'down' : hp.current * 2 <= hp.max ? 'bloodied' : 'healthy') : undefined)
  const name = info?.name ?? tk.label
  const parts = [name]
  if (hp) parts.push(`${hp.current}/${hp.max}`)
  else if (health) parts.push(t(HEALTH_KEY[health]))
  if (active) parts.push(t('combat.map.turnNow'))
  if (tk.hidden) parts.push(t('combat.map.hiddenOn'))
  if (info?.conditions?.length) parts.push(info.conditions.join(', '))
  const style: CSSProperties & Record<string, string | number> = {
    left: r.left, top: r.top, width: r.width, height: r.height, '--hp': pct ?? 1,
    fontSize: Math.max(9, Math.min(18, r.width * (tk.size > 1 ? 0.18 : 0.34))),
    ...(tk.color ? { '--token': tk.color } : {}),
  }
  return (
    <button type="button" className={`bm-token kind-${tk.kind} ${active ? 'active' : ''} ${selected ? 'selected' : ''} ${tk.hidden ? 'hidden-token' : ''} ${health ? `health-${health}` : ''} ${movable ? 'movable' : ''} ${mine ? 'mine' : ''}`}
      style={style} aria-label={parts.join(', ')} aria-pressed={selected} title={parts.join(' · ')}
      onClick={e => { if (e.detail === 0) onPick() }}>
      <span className="bm-ring" aria-hidden="true" />
      <span className="bm-label">{tk.label}</span>
      {isDm && tk.hidden && <span className="bm-badge eye" aria-hidden="true">◌</span>}
      {info?.conditions?.length ? <span className="bm-badge cond" aria-hidden="true">{info.conditions.length}</span> : null}
      {health === 'down' && <span className="bm-down" aria-hidden="true">✕</span>}
    </button>
  )
}
