// Picks one of the DM's saved maps (or none) for an encounter plan. The plan keeps only the map id.
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { mapName } from './names'
import { listMaps, onMapsChanged, syncMaps } from './store'
import type { BattleMapDef } from './types'

export function MapPicker({ ownerId, value, onChange }: { ownerId: string; value?: string; onChange: (mapId: string | undefined) => void }) {
  const { t } = useI18n()
  const [maps, setMaps] = useState<BattleMapDef[]>([])
  useEffect(() => {
    let live = true
    listMaps(ownerId).then(list => { if (live) setMaps(list) }).then(() => syncMaps(ownerId)).then(list => { if (live) setMaps(list) })
    const off = onMapsChanged(ownerId, list => { if (live) setMaps(list) })
    return () => { live = false; off() }
  }, [ownerId])
  // A map deleted since it was picked reads as "no map" rather than a blank choice.
  const known = !!value && maps.some(m => m.id === value)
  return (
    <label className="dm-map-pick">
      <span>{t('maps.pick')}</span>
      <select value={known ? value : ''} onChange={e => onChange(e.target.value || undefined)}>
        <option value="">{t('maps.pickNone')}</option>
        {maps.map(m => <option key={m.id} value={m.id}>{mapName(m.name, t)}</option>)}
      </select>
      {!maps.length && <span className="hint">{t('maps.pickEmpty')}</span>}
    </label>
  )
}
