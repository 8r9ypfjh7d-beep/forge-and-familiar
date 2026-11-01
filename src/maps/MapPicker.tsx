// Picks a map for an encounter plan: one of the DM's saved maps, a copy of a starter map or a blank grid,
// or a new map drawn in the editor. The plan keeps only the map id.
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { mapName } from './names'
import { newMap } from './newMap'
import { listMaps, MapSpaceError, onMapsChanged, saveMap, syncMaps } from './store'
import { TEMPLATE_IDS, type TemplateId } from './templates'
import type { BattleMapDef } from './types'

const DRAW = '__draw'
const STARTER = 'new:'

export function MapPicker({ ownerId, value, onChange, onDraw }: {
  ownerId: string; value?: string; onChange: (mapId: string | undefined) => void
  /** Opens the editor on a new blank map (already picked for the plan). */
  onDraw?: (mapId: string) => void
}) {
  const { t } = useI18n()
  const [maps, setMaps] = useState<BattleMapDef[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    listMaps(ownerId).then(list => { if (live) setMaps(list) }).then(() => syncMaps(ownerId)).then(list => { if (live) setMaps(list) }).catch(() => {})
    const off = onMapsChanged(ownerId, list => { if (live) setMaps(list) })
    return () => { live = false; off() }
  }, [ownerId])

  // A starter or a blank grid becomes the DM's own copy, so it can be edited and is the same map at Start.
  const make = async (template: TemplateId | 'blank') => {
    try {
      const saved = await saveMap(newMap(template, ownerId, t))
      setMaps(prev => [saved, ...prev.filter(m => m.id !== saved.id)])
      setError('')
      return saved.id
    } catch (e) {
      setError(e instanceof MapSpaceError ? t('maps.noSpace') : t('maps.saveFailed'))
      return undefined
    }
  }

  const choose = async (v: string) => {
    if (v === DRAW) {
      const id = await make('blank')
      if (id) { onChange(id); onDraw?.(id) }
      return
    }
    if (v.startsWith(STARTER)) {
      const id = await make(v.slice(STARTER.length) as TemplateId | 'blank')
      if (id) onChange(id)
      return
    }
    onChange(v || undefined)
  }

  // A map deleted since it was picked reads as "no map" rather than a blank choice.
  const known = !!value && maps.some(m => m.id === value)
  return (
    <label className="dm-map-pick">
      <span>{t('maps.pick')}</span>
      <select value={known ? value : ''} onChange={e => void choose(e.target.value)}>
        <option value="">{t('maps.pickNone')}</option>
        {maps.length > 0 && (
          <optgroup label={t('combat.map.yourMaps')}>
            {maps.map(m => <option key={m.id} value={m.id}>{mapName(m.name, t)}</option>)}
          </optgroup>
        )}
        <optgroup label={t('combat.map.starters')}>
          {TEMPLATE_IDS.map(id => <option key={id} value={STARTER + id}>{t(`maps.tpl.${id}` as const)}</option>)}
          <option value={STARTER + 'blank'}>{t('combat.map.blank')}</option>
        </optgroup>
        {onDraw && <option value={DRAW}>{t('maps.pickDraw')}</option>}
      </select>
      {error && <span className="hint" role="alert">{error}</span>}
    </label>
  )
}
