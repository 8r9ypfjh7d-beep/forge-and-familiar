// Combatant names in the reader's language. Saved rows keep the English name (players may read another language).
import type { Combatant } from './types'

/**
 * The name to show for a row: a library monster row named after its stat block ("Goblin", "Goblin 2")
 * shows the translated name with the same number ("גובלין 2"). Renamed rows, NPC sheets and characters keep their name.
 */
export function rowName(c: Pick<Combatant, 'name' | 'monster' | 'npcId'>, english?: string, local?: string): string {
  if (!c.monster || c.npcId || !english || !local || local === english) return c.name
  if (c.name === english) return local
  const rest = c.name.startsWith(`${english} `) ? c.name.slice(english.length + 1) : ''
  return /^\d+$/.test(rest) ? `${local} ${rest}` : c.name
}

/** Log line variables with combatant names swapped for their shown names (`name`, and each name in `targets`). */
export function shownVars(vars: Record<string, string | number> | undefined, shown: ReadonlyMap<string, string>) {
  if (!vars || !shown.size) return vars
  const one = (v: string | number) => typeof v === 'string' ? shown.get(v) ?? v : v
  const out = { ...vars }
  if (out.name !== undefined) out.name = one(out.name)
  if (typeof out.targets === 'string') out.targets = out.targets.split(', ').map(one).join(', ')
  return out
}
