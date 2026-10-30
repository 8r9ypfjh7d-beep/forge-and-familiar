import { describe, expect, it } from 'vitest'
import { loadKind } from '../content'
import { createCharacter, type CharacterDraft } from '../rules'
import { STARTER_HEROES } from '../starters/heroes'
import { applyEdit, draftFrom, startingGearChanged } from './edit'
import { changePurchase, coinText, costCp, shopItem } from './shop'
import { stepWarnings } from './validate'

const en = (key: string, vars?: Record<string, unknown>) => (key.startsWith('inv.coin.') ? key.slice(-2).toUpperCase() : `${key}${vars ? JSON.stringify(vars) : ''}`)

describe('builder shop', () => {
  it('prices library items in copper and shows coins largest first', () => {
    expect(costCp({ qty: 5, unit: 'sp' })).toBe(50)
    expect(costCp({ qty: 2, unit: 'pp' })).toBe(2000)
    expect(coinText(1257, en as never)).toBe('12 GP 5 SP 7 CP')
    expect(coinText(0, en as never)).toBe('0 GP')
  })

  it('buys both editions\' items under the engine ids the sheet already knows', async () => {
    const old = await loadKind('equipment', { sources: ['srd-5.1'] })
    const arrow = old.find(e => e.id === 'arrow')!
    expect(shopItem(arrow)).toEqual({ itemId: 'arrows' })
    expect(shopItem(old.find(e => e.id === 'crossbow-light')!)).toEqual({ itemId: 'light-crossbow' })
    expect(shopItem(old.find(e => e.id === 'abacus')!).item?.name).toBe('Abacus')
    const fresh = await loadKind('equipment', { sources: ['srd-5.2'] })
    expect(shopItem(fresh.find(e => e.id === 'arrows')!)).toEqual({ itemId: 'arrows' })
    for (const e of [...old, ...fresh]) expect(costCp(e.cost), e.id).toBeGreaterThanOrEqual(0)
  })

  it('adds, stacks and removes cart lines with bundles and prices', async () => {
    const old = await loadKind('equipment', { sources: ['srd-5.1'] })
    const arrow = old.find(e => e.id === 'arrow')!
    let cart = changePurchase([], arrow, 1)
    expect(cart).toEqual([{ itemId: 'arrows', qty: 20, costCp: 100 }])
    cart = changePurchase(cart, arrow, 1)
    expect(cart).toEqual([{ itemId: 'arrows', qty: 40, costCp: 200 }])
    expect(changePurchase(changePurchase(cart, arrow, -1), arrow, -1)).toEqual([])
  })

  it('warns, never blocks, when the cart costs more than the coins', () => {
    const d = { ...STARTER_HEROES[0].draft, purchases: [{ itemId: 'plate', qty: 1, costCp: 150000 }] } as CharacterDraft
    expect(stepWarnings('equipment', d)).toHaveLength(1)
    expect(stepWarnings('equipment', { ...d, purchases: [] })).toEqual([])
  })

  it('editing purchases swaps the gear and moves the coins', () => {
    const c = createCharacter({ ...STARTER_HEROES[0].draft, ownerId: 'u1' } as CharacterDraft)
    const draft: CharacterDraft = { ...draftFrom(c), purchases: [{ itemId: 'dagger', qty: 2, costCp: 400 }] }
    expect(startingGearChanged(c, draft)).toBe(true)
    const edited = applyEdit(c, draft, { replaceGear: true })
    expect(edited.inventory.find(e => e.itemId === 'dagger')?.qty).toBeGreaterThanOrEqual(2)
    const cp = (x: typeof c.coins) => x.gp * 100 + x.sp * 10 + x.cp
    expect(cp(c.coins) - cp(edited.coins)).toBe(400)
    expect(applyEdit(c, draft).coins).toEqual(c.coins)
  })
})
