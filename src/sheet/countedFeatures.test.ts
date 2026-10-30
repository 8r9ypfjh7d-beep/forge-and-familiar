// Feature buttons that only counted down (UX audit round 3, unit 17): Arcane Recovery, Channel Divinity, the monk's
// Focus actions, damage reactions (Uncanny Dodge, Deflect Attacks, Relentless Endurance), Rage at 0 HP, Reckless Attack.
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import { he } from '../i18n/locales/he'
import type { Character } from '../model/character'
import { CHANNEL_OPTIONS, channelOptions, derive, featureUseContext, getResources, getRollMode, planUse, recklessEffect, RECKLESS_ID } from '../rules'
import { effectToggles } from './combat/combat'
import { turnActions } from './combat/turn'
import { startEffect } from './effects'
import { damageToOne, hpSnapshot, retakeDamage, takeDamage } from './engine'
import { makeCharacter } from './fixtures'
import { applyUse, fitsBudget, recoverableSlots, spendResource } from './uses'

const make = (edition: '2014' | '2024', classes: Character['classes'], over: Partial<Character> = {}) =>
  makeCharacter({ rulesEdition: edition === '2024' ? '2024' : undefined, classes, baseAbilities: { str: 16, dex: 16, con: 14, int: 16, wis: 16, cha: 16 }, ...over })

describe('Arcane Recovery and Natural Recovery', () => {
  it('picks spent slots back within half the wizard level, none above 5th', () => {
    const c = make('2024', [{ classId: 'wizard', level: 5 }])
    const plan = planUse('arcane-recovery', 'Arcane Recovery', featureUseContext(c, 'arcane-recovery'))
    expect(plan.recover).toEqual({ budget: 3, maxLevel: 5 })
    const spent = { ...c, state: { ...c.state, spellSlotsUsed: [2, 1, 2] } }
    expect(recoverableSlots(spent, [4, 3, 2, 0, 0, 0, 0, 0, 0], 5)).toEqual([2, 1, 2, 0, 0])
    expect(fitsBudget([1, 2], 3)).toBe(true)
    expect(fitsBudget([3, 1], 3)).toBe(false)
    const after = spendResource(spent, 'arcane-recovery', plan, { slots: [1, 2] })
    expect(after.state.spellSlotsUsed.slice(0, 3)).toEqual([1, 0, 2])
    expect(after.state.resources['arcane-recovery'].used).toBe(1)
  })

  it('a Circle of the Land druid gets Natural Recovery once per long rest', () => {
    const c = make('2014', [{ classId: 'druid', level: 6, subclassId: 'land' }])
    const r = getResources(c).find(x => x.id === 'sub:land:natural-recovery')
    expect(r).toMatchObject({ max: 1, recharge: 'long' })
    expect(planUse(r!.id, r!.label, featureUseContext(c, r!.id)).recover).toEqual({ budget: 3, maxLevel: 5 })
  })
})

describe('Channel Divinity asks which option', () => {
  it('2014 Devotion paladin: Sacred Weapon adds CHA to attacks, Turn the Unholy shows its DC', () => {
    const c = make('2014', [{ classId: 'paladin', level: 5, subclassId: 'devotion' }])
    const plan = planUse('channel-divinity', 'Channel Divinity', featureUseContext(c, 'channel-divinity'))
    expect(plan.options?.map(o => o.name)).toEqual(['Sacred Weapon', 'Turn the Unholy'])
    const sacred = plan.options![0].plan
    expect(sacred.effect).toMatchObject({ name: 'Sacred Weapon', duration: '1 minute', stats: [{ kind: 'attack', value: 3 }] })
    // CHA 16 (+3), proficiency +3 at level 5: DC 14
    expect(plan.options![1].plan.save).toEqual({ dc: 14, ability: 'wis' })
    const used = spendResource(c, 'channel-divinity', sacred)
    expect(used.state.effects?.[0]).toMatchObject({ name: 'Sacred Weapon', on: true })
  })

  it('2024 Life cleric: Turn Undead, Divine Spark and Preserve Life', () => {
    const c = make('2024', [{ classId: 'cleric', level: 7, subclassId: 'life-domain' }])
    const names = channelOptions(c).map(o => o.name)
    expect(names).toEqual(['Turn Undead', 'Divine Spark', 'Preserve Life'])
    const plan = planUse('channel-divinity', 'Channel Divinity', featureUseContext(c, 'channel-divinity'))
    expect(plan.options![1].plan.hit).toEqual({ dice: '2d8+3' })
    expect(plan.options![2].plan.note).toEqual({ key: 'preserveLife', vars: { n: 35 } })
  })

  it('2024 paladin gets Divine Sense as an option', () => {
    const c = make('2024', [{ classId: 'paladin', level: 3, subclassId: 'oath-of-devotion' }])
    expect(channelOptions(c).map(o => o.name)).toEqual(['Divine Sense', 'Sacred Weapon'])
  })

  it('every option note has English and Hebrew text', () => {
    const ctx = { edition: '2024' as const, classLevel: 5, mods: { cha: 3 } }
    for (const [name, plan] of Object.entries(CHANNEL_OPTIONS)) {
      const key = plan({ name, classLevel: 5, dc: 13, mod: 3 }, ctx).note?.key
      if (!key) continue
      expect(en).toHaveProperty([`use.note.${key}`])
      expect(he.messages).toHaveProperty([`use.note.${key}`])
    }
  })
})

describe('the monk on the combat page', () => {
  it('2024: Martial Arts, Flurry of Blows (1 Focus, two strikes), Patient Defense free with a boost; Stunning Strike DC', () => {
    const c = make('2024', [{ classId: 'monk', level: 5 }])
    const rows = turnActions(c, derive(c), { spells: [] })
    const bonus = rows.bonus.flatMap(r => (r.type === 'feature' ? [r] : []))
    expect(bonus.map(r => r.name)).toEqual(['Martial Arts', 'Flurry of Blows', 'Patient Defense', 'Step of the Wind'])
    expect(bonus[1]).toMatchObject({ spend: { id: 'focus', n: 1 }, strikes: 2 })
    expect(bonus[2]).toMatchObject({ boost: { id: 'focus', n: 1 } })
    expect(bonus[2].spend).toBeUndefined()
    // 8 + WIS 3 + proficiency 3
    expect(rows.free.find(r => r.type === 'feature' && r.name === 'Stunning Strike')).toMatchObject({ save: { dc: 14, ability: 'con' } })
  })

  it('2014: Patient Defense and Step of the Wind cost a ki point', () => {
    const c = make('2014', [{ classId: 'monk', level: 5 }])
    const pd = turnActions(c, derive(c), { spells: [] }).bonus.find(r => r.type === 'feature' && r.name === 'Patient Defense')
    expect(pd).toMatchObject({ spend: { id: 'ki', n: 1 } })
  })

  it('Uncanny Metabolism refills Focus and heals a Martial Arts die plus the monk level', () => {
    const c = make('2024', [{ classId: 'monk', level: 5 }])
    const id = 'class:monk:uncanny-metabolism'
    const plan = planUse(id, 'Uncanny Metabolism', featureUseContext(c, id))
    expect(plan).toEqual({ heal: '1d8+5', refill: 'focus' })
    const spent = { ...c, state: { ...c.state, resources: { focus: { used: 4 } } } }
    expect(applyUse(spent, plan).state.resources.focus.used).toBe(0)
  })
})

describe('damage reactions and 0 HP', () => {
  const fighter = () => { const c = make('2014', [{ classId: 'barbarian', level: 5 }]); return { ...c, state: { ...c.state, currentHp: 20, tempHp: 0 } } }

  it('Rage ends at 0 HP', () => {
    const c = fighter()
    const raging = startEffect(c, { id: 'feature:rage', name: 'Rage', from: 'feature', ends: 'short' }).character
    expect(takeDamage(raging, 10).state.effects).toHaveLength(1)
    expect(takeDamage(raging, 25).state.effects).toHaveLength(0)
  })

  it('a hit taken again for less (Uncanny Dodge), or leaving 1 HP (Relentless Endurance), brings back what 0 HP ended', () => {
    const c = startEffect(fighter(), { id: 'feature:rage', name: 'Rage', from: 'feature', ends: 'short' }).character
    const before = hpSnapshot(c)
    const down = takeDamage(c, 24)
    expect(down.state.currentHp).toBe(0)
    expect(retakeDamage(down, before, 12).state).toMatchObject({ currentHp: 8 })
    const up = retakeDamage(down, before, Math.min(24, damageToOne(before)))
    expect(up.state.currentHp).toBe(1)
    expect(up.state.effects?.[0].name).toBe('Rage')
  })
})

describe('Reckless Attack', () => {
  it('is a switch for barbarians and gives advantage on Strength melee attacks only', () => {
    const c = make('2024', [{ classId: 'barbarian', level: 2 }])
    expect(effectToggles(c, derive(c)).some(e => e.id === RECKLESS_ID)).toBe(true)
    const on = startEffect(c, recklessEffect()).character
    expect(getRollMode(on, 'attack', 'str')).toBe('advantage')
    expect(getRollMode(on, 'attack')).toBe('normal')
  })
})

describe('Lay on Hands', () => {
  it('shows once on the 2014 combat page', () => {
    const c = make('2014', [{ classId: 'paladin', level: 5 }])
    const rows = Object.values(turnActions(c, derive(c), { spells: [] })).flat()
    expect(rows.filter(r => (r.type === 'feature' ? r.name : r.type === 'resource' ? r.resource.label : '').startsWith('Lay on Hands'))).toHaveLength(1)
  })
})
