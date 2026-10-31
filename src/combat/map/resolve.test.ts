import { describe, expect, it } from 'vitest'
import { createMap } from '../../maps/logic'
import { BLANK_ID, resolveMap, templateMapId } from './resolve'

const name = (id: string) => `T ${id}`

describe('resolveMap', () => {
  it('builds starter maps and a blank grid by id, and finds saved maps', () => {
    expect(resolveMap(undefined, 'u', [], name, 'Blank')).toBeNull()
    const blank = resolveMap(BLANK_ID, 'u', [], name, 'Blank')!
    expect([blank.width, blank.height, blank.name]).toEqual([24, 16, 'Blank'])
    const tavern = resolveMap(templateMapId('tavern'), 'u', [], name, 'Blank')!
    expect(tavern.id).toBe('tpl:tavern')
    expect(tavern.name).toBe('T tavern')
    expect(Object.keys(tavern.terrain).length).toBeGreaterThan(0)
    const mine = createMap('m1', 'u', 'Crypt', '2026-10-31T00:00:00Z')
    expect(resolveMap('m1', 'u', [mine], name, 'Blank')).toBe(mine)
    expect(resolveMap('gone', 'u', [mine], name, 'Blank')).toBeNull()
    expect(resolveMap('tpl:nope', 'u', [], name, 'Blank')).toBeNull()
  })
})
