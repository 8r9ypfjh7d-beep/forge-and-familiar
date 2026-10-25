import { describe, expect, it } from 'vitest'
import {
  emptyJournal, journalToText, lootTotalGp, newLoot, newNote, newNpc, newObjective, newQuest, questProgress, removeById,
  searchJournal, sessionDates, setQuestStatus, sortQuests, timeline, today, upsert,
} from './journal'
import type { Journal } from './types'

const d1 = '2026-10-18'
const d2 = '2026-10-25'

function sample(): Journal {
  const j = emptyJournal('c1')
  const note = { ...newNote(d1), title: 'Goblin ambush', body: 'Cragmaw goblins on the Triboar Trail.' }
  const toblen = { ...newNpc(d2), name: 'Toblen Stonehill', role: 'Innkeeper', place: 'Phandalin', attitude: 'friendly' as const }
  const klarg = { ...newNpc(d1), name: 'Klarg', role: 'Bugbear boss', attitude: 'hostile' as const, alive: false }
  const caravan = setQuestStatus({ ...newQuest(d1), title: 'Deliver the wagon', giver: 'Gundren' }, 'done', d2)
  const glass = { ...newQuest(d2), title: 'Find Glasstaff', objectives: [{ ...newObjective('Search the manor'), done: true }, newObjective('Question the Redbrands')] }
  const loot = [{ ...newLoot(d1), name: 'Potion of healing', qty: 2, valueGp: 100 }, { ...newLoot(d2), name: 'Silver ring', source: 'Redbrand' }]
  return { ...j, notes: [note], npcs: [toblen, klarg], quests: [caravan, glass], loot }
}

describe('dates', () => {
  it('formats today as a local YYYY-MM-DD day', () => {
    expect(today(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})

describe('records', () => {
  it('upsert replaces by id and appends new ones', () => {
    const a = newNpc(d1)
    const list = upsert([a], { ...a, name: 'Sildar' })
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Sildar')
    expect(upsert(list, newNpc(d1))).toHaveLength(2)
    expect(removeById(list, a.id)).toEqual([])
  })

  it('stamps the close date once and clears it when reopened', () => {
    const q = setQuestStatus(newQuest(d1), 'done', d2)
    expect(q.closedOn).toBe(d2)
    expect(setQuestStatus(q, 'done', '2026-11-01').closedOn).toBe(d2)
    expect(setQuestStatus(q, 'failed', '2026-11-01').closedOn).toBe('2026-11-01')
    expect(setQuestStatus(q, 'active', d2).closedOn).toBeUndefined()
  })

  it('counts objectives and sorts open quests first', () => {
    const j = sample()
    expect(questProgress(j.quests[1])).toEqual({ done: 1, total: 2 })
    expect(sortQuests(j.quests).map(q => q.title)).toEqual(['Find Glasstaff', 'Deliver the wagon'])
  })

  it('totals known loot value only', () => {
    expect(lootTotalGp(sample().loot)).toBe(100)
  })
})

describe('timeline', () => {
  it('groups everything by session date, newest first', () => {
    const days = timeline(sample())
    expect(days.map(d => d.date)).toEqual([d2, d1])
    const [late, early] = days
    expect(early.notes.map(n => n.title)).toEqual(['Goblin ambush'])
    expect(early.npcsMet.map(n => n.name)).toEqual(['Klarg'])
    expect(early.questsStarted.map(q => q.title)).toEqual(['Deliver the wagon'])
    expect(late.questsClosed.map(q => q.title)).toEqual(['Deliver the wagon'])
    expect(late.loot.map(l => l.name)).toEqual(['Silver ring'])
    expect(sessionDates(sample())).toEqual([d2, d1])
  })

  it('is empty for a new journal', () => {
    expect(timeline(emptyJournal('c1'))).toEqual([])
  })
})

describe('search', () => {
  it('matches any text field, case-insensitive', () => {
    const r = searchJournal(sample(), 'REDBRAND')
    expect(r.quests.map(q => q.title)).toEqual(['Find Glasstaff'])
    expect(r.loot.map(l => l.name)).toEqual(['Silver ring'])
    expect(r.npcs).toEqual([])
    expect(searchJournal(sample(), 'phandalin').npcs.map(n => n.name)).toEqual(['Toblen Stonehill'])
  })

  it('keeps everything for a blank query', () => {
    const j = sample()
    expect(searchJournal(j, '  ')).toBe(j)
  })
})

describe('journalToText', () => {
  it('lists sessions, open quests and people', () => {
    const text = journalToText('Mira', sample())
    expect(text).toContain("Mira's journal")
    expect(text).toContain('Goblin ambush\nCragmaw goblins on the Triboar Trail.')
    expect(text).toContain('Quest completed: Deliver the wagon')
    expect(text).toContain('Loot: 2× Potion of healing')
    expect(text).toContain('- Find Glasstaff 1/2\n  [x] Search the manor\n  [ ] Question the Redbrands')
    expect(text).toContain('- Klarg: Bugbear boss, hostile, dead')
    expect(text.indexOf('2026')).toBeLessThan(text.indexOf('Goblin ambush'))
  })
})
