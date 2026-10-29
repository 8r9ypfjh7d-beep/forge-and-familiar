import { describe, expect, it } from 'vitest'
import { groupKitItems } from './kit'

describe('groupKitItems', () => {
  it('shows repeated items once with a count', () => {
    expect(groupKitItems(['chain-mail', 'javelin', 'javelin', 'javelin', 'dungeoneers-pack'])).toEqual([
      { id: 'chain-mail', n: 1 }, { id: 'javelin', n: 3 }, { id: 'dungeoneers-pack', n: 1 },
    ])
  })
  it('keeps each "any" slot separate so each gets its own dropdown', () => {
    expect(groupKitItems(['any:simple-melee', 'any:simple-melee'])).toHaveLength(2)
  })
})
