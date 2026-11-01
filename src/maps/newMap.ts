// A fresh saved map: a blank grid or a copy of a starter map, named in the DM's language.
import type { MessageKey } from '../i18n/locales/en'
import { createMap } from './logic'
import { buildTemplate, type TemplateId } from './templates'
import type { BattleMapDef } from './types'

export function newMap(template: TemplateId | 'blank', ownerId: string, t: (key: MessageKey) => string, name?: string): BattleMapDef {
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  if (template === 'blank') return createMap(id, ownerId, name ?? t('maps.untitled'), now)
  return buildTemplate(template, id, ownerId, name ?? t(`maps.tpl.${template}` as MessageKey), now, slug => t(`maps.lbl.${slug}` as MessageKey))
}
