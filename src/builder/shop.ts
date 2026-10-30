// Builder shop: buy gear from the item library with the starting coins. Pure helpers; Shop.tsx is the UI.
import type { Equipment, Money } from '../content'
import type { Translate } from '../i18n/translate'
import { fromLibrary } from '../inventory/inventory'
import type { Purchase } from '../model/character'
import { coinsFromCp } from '../rules'

const CP_PER: Record<Money['unit'], number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }

/** A library price in copper pieces. */
export const costCp = (m: Money | undefined) => (m ? Math.round(m.qty * CP_PER[m.unit]) : 0)

/** SRD 5.1 library ids for gear the engine already has under its own id (so the sheet's ammo and rations counters see it). */
const ENGINE_ID: Record<string, string> = {
  arrow: 'arrows', 'crossbow-bolt': 'bolts', 'rations-1-day': 'rations', 'rope-hempen-50-feet': 'rope', crystal: 'arcane-focus',
}

/** The inventory fields a library item is bought as. */
export const shopItem = (e: Equipment): Pick<Purchase, 'itemId' | 'item'> => fromLibrary(ENGINE_ID[e.id] ? { ...e, id: ENGINE_ID[e.id] } : e)

/** Items one purchase of the entry gives (20 arrows). */
export const bundleOf = (e: Equipment) => Math.max(1, e.bundleSize ?? 1)

/** The cart with `units` more (or fewer) of the entry; a line at 0 is dropped. */
export function changePurchase(purchases: Purchase[], e: Equipment, units: number): Purchase[] {
  const fields = shopItem(e)
  const bundle = bundleOf(e)
  const price = costCp(e.cost)
  const at = purchases.findIndex(p => p.itemId === fields.itemId)
  if (at === -1) return units > 0 ? [...purchases, { ...fields, qty: units * bundle, costCp: units * price }] : purchases
  const old = purchases[at]
  const qty = old.qty + units * bundle
  if (qty <= 0) return purchases.filter((_, i) => i !== at)
  return purchases.map((p, i) => (i === at ? { ...p, qty, costCp: Math.max(0, p.costCp + units * price) } : p))
}

/** Coins as text in the current language: "12 GP 5 SP". */
export function coinText(cp: number, t: Translate): string {
  const c = coinsFromCp(cp)
  const parts = (['gp', 'sp', 'cp'] as const).filter(k => c[k]).map(k => `${c[k]} ${t(`inv.coin.${k}`)}`)
  return parts.length ? parts.join(' ') : `0 ${t('inv.coin.gp')}`
}
