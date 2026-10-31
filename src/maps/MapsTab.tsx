// The Maps tab on the DM screen: the DM's saved battle maps, new ones from a template or a blank grid, and the editor.
import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '../builder/ConfirmDialog'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/locales/en'
import { createMap, mapSummary } from './logic'
import { mapName } from './names'
import { MapEditor, MapThumb } from './MapEditor'
import { deleteMap, listMaps, MapSpaceError, onMapsChanged, saveMap, syncMaps } from './store'
import { buildTemplate, TEMPLATE_IDS, type TemplateId } from './templates'
import type { BattleMapDef } from './types'
import './maps.css'

const SAVE_DELAY = 400

export function MapsTab({ ownerId, initialOpenId }: { ownerId: string; initialOpenId?: string }) {
  const { t } = useI18n()
  const [maps, setMaps] = useState<BattleMapDef[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null)
  const [askDelete, setAskDelete] = useState<BattleMapDef | null>(null)
  const [status, setStatus] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // Edits made here win over a server copy that arrives while typing.
  const dirty = useRef(new Set<string>())

  useEffect(() => {
    let live = true
    listMaps(ownerId).then(list => { if (live) setMaps(list) }).then(() => syncMaps(ownerId)).then(list => { if (live) setMaps(list) })
    const off = onMapsChanged(ownerId, list => {
      if (!live) return
      setMaps(prev => list.map(m => (dirty.current.has(m.id) && prev?.find(p => p.id === m.id)) || m))
    })
    return () => { live = false; off() }
  }, [ownerId])

  const persist = (map: BattleMapDef) => {
    clearTimeout(timer.current)
    dirty.current.add(map.id)
    timer.current = setTimeout(() => {
      saveMap(map).then(saved => {
        dirty.current.delete(map.id)
        setMaps(prev => prev?.map(m => m.id === saved.id ? { ...m, updatedAt: saved.updatedAt } : m) ?? prev)
        setStatus(t('maps.saved'))
      }).catch(e => setStatus(e instanceof MapSpaceError ? t('maps.noSpace') : t('maps.saveFailed')))
    }, SAVE_DELAY)
  }

  const change = (map: BattleMapDef) => {
    setMaps(prev => prev?.map(m => m.id === map.id ? map : m) ?? [map])
    setStatus('')
    persist(map)
  }

  const create = async (template: TemplateId | 'blank') => {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const name = template === 'blank' ? t('maps.untitled') : t(`maps.tpl.${template}` as MessageKey)
    const map = template === 'blank' ? createMap(id, ownerId, name, now) : buildTemplate(template, id, ownerId, name, now, slug => t(`maps.lbl.${slug}` as MessageKey))
    try {
      const saved = await saveMap(map)
      setMaps(prev => [saved, ...(prev ?? [])])
      setOpenId(saved.id)
    } catch (e) {
      setStatus(e instanceof MapSpaceError ? t('maps.noSpace') : t('maps.saveFailed'))
    }
  }

  const remove = async (map: BattleMapDef) => {
    await deleteMap(ownerId, map.id)
    setMaps(prev => prev?.filter(m => m.id !== map.id) ?? null)
    if (openId === map.id) setOpenId(null)
  }

  if (!maps) return null
  const open = openId ? maps.find(m => m.id === openId) : undefined
  if (open) return <MapEditor map={open} onChange={change} onBack={() => setOpenId(null)} status={status} />

  return (
    <div className="ff-maps">
      <section className="card">
        <h2>{t('maps.new')}</h2>
        <p className="hint">{t('maps.intro')}</p>
        <div className="maps-templates">
          <button type="button" className="glass-chip" onClick={() => void create('blank')}>{t('maps.blank')}</button>
          {TEMPLATE_IDS.map(id => (
            <button key={id} type="button" className="glass-chip" onClick={() => void create(id)}>{t(`maps.tpl.${id}` as MessageKey)}</button>
          ))}
        </div>
        {status && <p className="hint maps-error" role="alert">{status}</p>}
      </section>
      <section className="card">
        <h2>{t('maps.title')}</h2>
        {maps.length === 0 && <p className="hint">{t('maps.empty')}</p>}
        <ul className="plain maps-list">
          {maps.map(m => (
            <li key={m.id} className="maps-row">
              <MapThumb map={m} />
              <div className="maps-row-text">
                <button type="button" className="link-btn" onClick={() => setOpenId(m.id)}>{mapName(m.name, t)}</button>
                <span className="hint">{mapSummary(m)}{m.picture ? ` · ${t('maps.withPicture')}` : ''}{m.fog.length ? ` · ${t('maps.fog')}` : ''}</span>
              </div>
              <div className="maps-row-actions">
                <button type="button" className="glass-btn" onClick={() => setOpenId(m.id)}>{t('maps.edit')}</button>
                <button type="button" className="glass-btn" onClick={() => setAskDelete(m)}>{t('common.delete')}</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <ConfirmDialog open={!!askDelete} title={t('maps.deleteAsk', { name: mapName(askDelete?.name, t) })} yes={t('common.delete')}
        onYes={() => { if (askDelete) void remove(askDelete) }} onClose={() => setAskDelete(null)} />
    </div>
  )
}
