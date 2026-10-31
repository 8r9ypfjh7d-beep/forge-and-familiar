// Which map a combat is fought on. Board.mapId names a starter map ("tpl:<id>"), a blank grid ("blank"),
// or one of the DM's saved maps (src/maps, looked up through the `saved` list the caller passes).
import { createMap } from '../../maps/logic'
import { buildTemplate, TEMPLATE_IDS, type TemplateId } from '../../maps/templates'
import type { BattleMapDef } from '../../maps/types'

export const BLANK_ID = 'blank'
export const templateMapId = (id: TemplateId) => `tpl:${id}`
const FIXED_TIME = '2026-01-01T00:00:00.000Z'

/** The map for an id, or null when it is unknown (a saved map deleted since, or not synced to this device). */
export function resolveMap(mapId: string | undefined, ownerId: string, saved: BattleMapDef[], templateName: (id: TemplateId) => string, blankName: string): BattleMapDef | null {
  if (!mapId) return null
  if (mapId === BLANK_ID) return createMap(BLANK_ID, ownerId, blankName, FIXED_TIME)
  if (mapId.startsWith('tpl:')) {
    const id = mapId.slice(4) as TemplateId
    return TEMPLATE_IDS.includes(id) ? buildTemplate(id, mapId, ownerId, templateName(id), FIXED_TIME) : null
  }
  return saved.find(m => m.id === mapId) ?? null
}
