// The map pane of an open encounter in the DM's combat tracker: pick a map (starter, blank or saved),
// place tokens for every combatant, and play on BattleMap. Live sync to the party goes through useLiveBoard.
import { useEffect, useMemo } from 'react'
import { useI18n } from '../../i18n'
import type { Monster } from '../../content'
import { footprintOf } from '../../maps/logic'
import { TEMPLATE_IDS, type TemplateId } from '../../maps/templates'
import type { BattleMapDef } from '../../maps/types'
import { derive } from '../../rules'
import { statusOf, type Party } from '../engine'
import { EMPTY_BOARD } from '../liveLogic'
import type { Board, CellKey, Combatant, Encounter, Token } from '../types'
import type { Act } from '../ui/useEncounter'
import { BattleMap, type TokenInfo } from './BattleMap'
import { BLANK_ID, resolveMap, templateMapId } from './resolve'
import { syncTokens } from './tokens'
import { useLiveBoard } from './useLiveBoard'

/** Saved maps from the DM's map editor. Empty until src/maps has a store; starters and blank work without it. */
const SAVED: BattleMapDef[] = []

export interface EncounterMapProps {
  enc: Encounter
  act: Act
  party: Party
  partyId?: string
  monsterOf: (c: Combatant) => Monster | undefined
}

export function EncounterMap({ enc, act, party, partyId, monsterOf }: EncounterMapProps) {
  const { t, term } = useI18n()
  const tplName = (id: TemplateId) => t(`combat.map.tpl.${id}` as const)
  const mapId = enc.board?.mapId
  const map = useMemo(() => resolveMap(mapId, enc.ownerId, SAVED, tplName, t('combat.map.blank')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapId, enc.ownerId])
  const { live, push, changeBoard, move, changeMap } = useLiveBoard(enc, act, partyId, map)

  const sizeOf = (c: Combatant): 1 | 2 | 3 | 4 => footprintOf(monsterOf(c)?.sizes?.[0])
  const combatantKey = enc.combatants.map(c => c.id).join(',')
  // New or removed combatants get their tokens added or dropped.
  useEffect(() => {
    if (!map || !enc.board) return
    const have = enc.board.tokens.map(tk => tk.combatantId).join(',')
    const want = enc.combatants.map(c => c.id).join(',')
    if (have.split(',').sort().join(',') === want.split(',').sort().join(',')) return
    changeBoard(b => ({ ...b, tokens: syncTokens({ ...enc, board: b }, map, sizeOf) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combatantKey, map?.id])

  const pick = (id: string) => {
    if (!id) return
    const next = resolveMap(id, enc.ownerId, SAVED, tplName, t('combat.map.blank'))
    if (!next) return
    const prev = enc.board ?? EMPTY_BOARD
    // A new map keeps who is in the fight but places everyone afresh, with the map's own fog.
    const board: Board = { ...prev, mapId: id, fog: [...next.fog] as CellKey[], tokens: [] }
    changeMap(next, { ...board, tokens: syncTokens({ ...enc, board }, next, sizeOf) })
  }

  const infoFor = (tk: Token): TokenInfo | undefined => {
    const c = enc.combatants.find(x => x.id === tk.combatantId)
    if (!c) return undefined
    const s = statusOf(enc, c, party)
    if (c.kind === 'pc') {
      const ch = c.characterId ? party[c.characterId] : undefined
      const d = ch ? derive(ch) : undefined
      return { name: c.name, hp: d ? { current: s.hp, max: d.maxHp } : undefined, speed: d?.speed, conditions: s.conditions.map(x => term('condition', x, x)) }
    }
    const m = monsterOf(c)
    const walk = Number(/\d+/.exec(String(m?.speed?.walk ?? ''))?.[0])
    return { name: c.name, hp: c.hp ? { current: c.hp.current, max: c.hp.max } : undefined, speed: Number.isFinite(walk) ? walk : undefined, conditions: s.conditions.map(x => term('condition', x, x)) }
  }

  // Rows the DM hid from players look hidden on the map too.
  const board = useMemo<Board | null>(() => {
    if (!enc.board) return null
    const hiddenRows = new Set(enc.combatants.filter(c => c.hidden).map(c => c.id))
    return { ...enc.board, tokens: enc.board.tokens.map(tk => (hiddenRows.has(tk.combatantId) ? { ...tk, hidden: true } : tk)) }
  }, [enc.board, enc.combatants])

  const picker = (
    <select className="bm-picker" value="" onChange={e => pick(e.target.value)} aria-label={t('combat.map.pick')}>
      <option value="">{map ? t('combat.map.change') : t('combat.map.pick')}</option>
      <optgroup label={t('combat.map.starters')}>
        {TEMPLATE_IDS.map(id => <option key={id} value={templateMapId(id)}>{tplName(id)}</option>)}
        <option value={BLANK_ID}>{t('combat.map.blank')}</option>
      </optgroup>
      {SAVED.length > 0 && (
        <optgroup label={t('combat.map.yourMaps')}>
          {SAVED.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </optgroup>
      )}
    </select>
  )

  return (
    <section className="glass encounter-map" aria-label={t('combat.map.title')}>
      <div className="row spread encounter-map-head">
        <h3 className="glass-eyebrow">{map ? map.name : t('combat.map.title')}</h3>
        <div className="row">
          {partyId && (
            live === 'on'
              ? <span className="tag live">{t('combat.map.live')}</span>
              : <button type="button" className="glass-btn small" onClick={push} disabled={!enc.round}>{t('combat.map.share')}</button>
          )}
          {!partyId && <span className="tag">{t('combat.map.local')}</span>}
          {picker}
          {map && <button type="button" className="glass-btn small plain" onClick={() => changeMap(null, { ...(enc.board ?? EMPTY_BOARD), mapId: undefined })}>{t('combat.map.remove')}</button>}
        </div>
      </div>
      {map && board
        ? (
          <div className="encounter-map-stage">
            <BattleMap map={map} board={board} encounter={enc} viewer={{ role: 'dm' }} onMove={move} onBoard={changeBoard} infoFor={infoFor} />
          </div>
        )
        : <p className="muted">{t('combat.map.noMap')}</p>}
    </section>
  )
}
