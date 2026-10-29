import { anyFilter } from '../rules'

/** One line of a kit option: the same item in a row shows once with a count ("Javelin ×10"). "Any …" slots never merge, since each gets its own dropdown. */
export interface KitPart { id: string; n: number }

export function groupKitItems(items: readonly string[]): KitPart[] {
  const parts: KitPart[] = []
  for (const id of items) {
    const last = parts[parts.length - 1]
    if (last && last.id === id && !anyFilter(id)) last.n++
    else parts.push({ id, n: 1 })
  }
  return parts
}
