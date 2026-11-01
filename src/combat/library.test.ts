import { describe, expect, it } from 'vitest'
import { loadKind } from '../content'
import { addCombatant, createEncounter, setInitiative, startCombat } from './engine'
import { libraryRows } from './library'

describe('library monsters added to a fight', async () => {
  const goblin = (await loadKind('monsters', { sources: ['srd-5.1'] })).find(m => m.id === 'goblin')!
  const d20 = (bonus: number) => 10 + bonus
  let n = 0
  const id = () => `id${++n}`

  it('before combat: stat block and average HP, no initiative yet', () => {
    const rows = libraryRows(createEncounter('e', 'dm', 'Fight'), goblin, 2, id, { d20 })
    expect(rows.map(r => r.name)).toEqual(['Goblin 1', 'Goblin 2'])
    expect(rows[0]).toMatchObject({ monster: { source: 'srd-5.1', id: 'goblin' }, ac: 15, hp: { max: 7 }, initiative: null })
  })

  it('mid-fight: rolls one initiative for the group and numbers on from the goblins already there', () => {
    let enc = createEncounter('e', 'dm', 'Fight')
    for (const row of libraryRows(enc, goblin, 2, id, { d20 })) enc = addCombatant(enc, row)
    enc = enc.combatants.reduce((e, c) => setInitiative(e, c.id, 12), enc)
    enc = startCombat(enc)
    const rows = libraryRows(enc, goblin, 2, id, { d20, hp: () => 3 }, true)
    expect(rows.map(r => r.name)).toEqual(['Goblin 3', 'Goblin 4'])
    expect(rows.map(r => r.initiative)).toEqual([12, 12])
    expect(rows[0]).toMatchObject({ monster: { source: 'srd-5.1', id: 'goblin' }, hp: { max: 3 } })
  })
})
