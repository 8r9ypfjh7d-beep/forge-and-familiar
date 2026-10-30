// Equipment step shop: spend the starting coins on gear from the SRD item library of the character's rules edition.
import { useEffect, useMemo, useState } from 'react'
import { BUNDLED, loadKind, searchEntries, type Equipment, type EquipmentType } from '../content'
import { useI18n, type MessageKey } from '../i18n'
import { itemById, purchasesCp, rulesEdition, startingGold } from '../rules'
import { sourceFor } from '../spellbook/access'
import type { StepProps } from './steps'
import { bundleOf, changePurchase, coinText, costCp, shopItem } from './shop'
import { Fold } from './Compact'
import { Why } from './Why'

const SHELVES = ['all', 'weapon', 'armor', 'gear', 'tool', 'mount'] as const
type Shelf = (typeof SHELVES)[number]
const shelfOf = (type: EquipmentType): Shelf => (type === 'vehicle' ? 'mount' : type)

function useEquipment(source: string): Equipment[] | 'error' | null {
  const [lib, setLib] = useState<{ source: string; data: Equipment[] | 'error' } | null>(null)
  useEffect(() => {
    let live = true
    loadKind('equipment', { sources: [source] })
      .then(data => live && setLib({ source, data }))
      .catch(() => live && setLib({ source, data: 'error' }))
    return () => { live = false }
  }, [source])
  return lib?.source === source ? lib.data : null
}

export function Shop({ draft, update }: StepProps) {
  const { t, term } = useI18n()
  const source = sourceFor(rulesEdition(draft))
  const lib = useEquipment(source)
  const [query, setQuery] = useState('')
  const [shelf, setShelf] = useState<Shelf>('all')
  const purchases = draft.purchases ?? []
  const budget = startingGold(draft) * 100
  const spent = purchasesCp(purchases)
  const byItem = useMemo(() => new Map((lib && lib !== 'error' ? lib : []).map(e => [shopItem(e).itemId, e])), [lib])
  const name = (e: Equipment) => term('item', shopItem(e).itemId, e.name)
  const change = (e: Equipment, units: number) => update({ purchases: changePurchase(purchases, e, units) })
  const title = BUNDLED.find(m => m.source.id === source)?.source.title

  return (
    <Fold className="shop-fold" defaultOpen={purchases.length > 0} title={t('builder.shop.title')} why={<Why id="shop" />}
      status={t('builder.compact.shopLeft', { left: coinText(Math.max(0, budget - spent), t) })}>
    <section className="shop" aria-label={t('builder.shop.title')}>
      <p className="muted small">{t('builder.shop.intro')}</p>
      <p className={`small shop-budget${spent > budget ? ' over' : ''}`} aria-live="polite">
        {t('builder.shop.budget', { budget: coinText(budget, t), spent: coinText(spent, t), left: coinText(Math.max(0, budget - spent), t) })}
      </p>

      {purchases.length > 0 && (
        <ul className="kit shop-cart" aria-label={t('builder.shop.cart')}>
          {purchases.map(p => {
            const e = byItem.get(p.itemId)
            const label = term('item', p.itemId, p.item?.name ?? itemById(p.itemId)?.name ?? e?.name ?? p.itemId)
            return (
              <li key={p.itemId}>
                <span>{label}{p.qty > 1 ? ` ×${p.qty}` : ''}</span>
                <span className="shop-line">
                  <span className="muted small">{coinText(p.costCp, t)}</span>
                  {e && <button type="button" className="glass-btn small" aria-label={t('builder.shop.less', { name: label })} onClick={() => change(e, -1)}>−</button>}
                  {e && <button type="button" className="glass-btn small" aria-label={t('builder.shop.more', { name: label })} onClick={() => change(e, 1)}>+</button>}
                  <button type="button" className="glass-btn small" aria-label={t('builder.shop.remove', { name: label })}
                    onClick={() => update({ purchases: purchases.filter(x => x !== p) })}>✕</button>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="shop-filters">
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('builder.shop.search')} aria-label={t('builder.shop.search')} />
        <div className="glass-segmented shop-shelves" role="radiogroup" aria-label={t('builder.shop.shelf')}>
          {SHELVES.map(s => (
            <button key={s} type="button" role="radio" aria-checked={shelf === s} onClick={() => setShelf(s)}>{t(`builder.shop.shelf.${s}` as MessageKey)}</button>
          ))}
        </div>
      </div>
      {lib === null && <p className="muted small">{t('common.loading')}</p>}
      {lib === 'error' && <p className="muted small">{t('inv.failed')}</p>}
      {lib && lib !== 'error' && (
        <ul className="kit shop-items">
          {searchEntries(lib.filter(e => costCp(e.cost) > 0 && (shelf === 'all' || shelfOf(e.type) === shelf)), query).map(e => {
            const price = costCp(e.cost)
            const bundle = bundleOf(e)
            return (
              <li key={e.id}>
                <span>
                  {name(e)}{bundle > 1 ? ` ×${bundle}` : ''}
                  <span className="muted small"> · {coinText(price, t)}</span>
                </span>
                <button type="button" className={`glass-btn small${budget - spent < price ? ' shop-dear' : ''}`}
                  aria-label={t('builder.shop.buyName', { name: name(e) })} onClick={() => change(e, 1)}>
                  {t('builder.shop.buy')}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {title && <p className="muted small">{t('inv.source', { title })}</p>}
    </section>
    </Fold>
  )
}
