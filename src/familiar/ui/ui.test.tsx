import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { setLocale } from '../../i18n'
import { makeCharacter } from '../../sheet/fixtures'
import { hashToView, viewToHash } from '../../nav/route'
import { navItems } from '../../nav/items'
import type { Content, Thread } from '../types'
import { FamiliarChat } from './FamiliarChat'
import { parseMarkdown } from './markdown'
import { screenFor } from './onScreen'
import type { FamiliarChatState } from './useFamiliarChat'
import { blockedReason, bubbles, canRetry, chipKeys, resetText } from './view'

const convo: Content[] = [
  { role: 'user', parts: [{ text: 'How does Fireball work?' }] },
  { role: 'model', parts: [{ text: 'Let me check.' }, { functionCall: { name: 'get_entry', args: { kind: 'spells', id: 'fireball' } } }] },
  { role: 'user', parts: [{ functionResponse: { name: 'get_entry', response: { text: '...' } } }] },
  { role: 'model', parts: [{ text: 'thinking', thought: true }, { text: '**Fireball** is a 3rd-level evocation.' }] },
]
const tools = { 3: [{ name: 'get_entry', args: {}, label: 'Fireball', ok: true }] }

const chat = (over: Partial<FamiliarChatState> = {}): FamiliarChatState => ({
  thread: null, threads: [], pending: null, error: null, busy: false,
  send: async () => true, stop: () => {}, startNew: () => {}, open: () => {}, remove: () => {}, dismissError: () => {},
  ...over,
})
const thread = (contents: Content[]): Thread => ({ id: 'th-1', title: 'Fireball', context: { kind: 'general' }, contents, tools, createdAt: '2026-10-31T10:00:00Z', updatedAt: '2026-10-31T10:00:00Z' })
const render = (props: Partial<Parameters<typeof FamiliarChat>[0]> = {}) =>
  renderToStaticMarkup(createElement(FamiliarChat, { chat: chat(), chips: chipKeys({ kind: 'general' }, 'player'), blocked: null, variant: 'sheet', ...props }))

describe('conversation view', () => {
  it('shows questions and final answers, never tool traffic or thoughts', () => {
    const b = bubbles(convo, tools)
    expect(b.map(x => [x.role, x.text])).toEqual([
      ['user', 'How does Fireball work?'],
      ['model', '**Fireball** is a 3rd-level evocation.'],
    ])
    expect(b[1].tools.map(t => t.label)).toEqual(['Fireball'])
  })

  it('offers chips per screen and role', () => {
    expect(chipKeys({ kind: 'character', characterId: 'x' }, 'player')).toContain('familiar.chip.explainFeatures')
    expect(chipKeys({ kind: 'dm' }, 'dm')).toContain('familiar.dm.chip.fair')
    expect(chipKeys({ kind: 'general' }, 'dm')).not.toContain('familiar.chip.newPlayerBuild')
  })

  it('blocks sending before trying when it cannot work', () => {
    expect(blockedReason({ cloud: false, signedIn: true, online: true })).toBe('notConfigured')
    expect(blockedReason({ cloud: true, signedIn: false, online: true })).toBe('signIn')
    expect(blockedReason({ cloud: true, signedIn: true, online: false })).toBe('offline')
    expect(blockedReason({ cloud: true, signedIn: true, online: true })).toBeNull()
    expect(canRetry('unreachable')).toBe(true)
    expect(canRetry('signIn')).toBe(false)
  })

  it('says when the daily limit resets', () => {
    const now = new Date('2026-10-31T10:00:00')
    expect(resetText(new Date('2026-10-31T23:00:00').toISOString(), 'en', now)).toMatch(/23:00/)
    expect(resetText(new Date('2026-11-01T02:00:00').toISOString(), 'en', now)).toMatch(/02:00/)
    expect(resetText(undefined, 'en', now)).toBe('')
  })
})

describe('markdown', () => {
  it('finds lists right under a sentence, headings and tables', () => {
    const blocks = parseMarkdown('### Options\nYou can:\n- Attack\n- Dash\n  twice\n\n1. One\n2. Two\n\n| A | B |\n|---|---|\n| 1 | 2 |')
    expect(blocks).toEqual([
      { type: 'h', text: 'Options' },
      { type: 'p', text: 'You can:' },
      { type: 'ul', items: ['Attack', 'Dash twice'] },
      { type: 'ol', items: ['One', 'Two'] },
      { type: 'table', head: ['A', 'B'], rows: [['1', '2']] },
    ])
  })
})

describe('panel', () => {
  it('starts with the intro, starter chips and the SRD credit', () => {
    setLocale('en')
    const html = render()
    expect(html).toContain('I&#x27;m your Familiar')
    expect(html).toContain('How does grappling work?')
    expect(html).toContain('Creative Commons Attribution 4.0')
    expect(html).toContain('the DM&#x27;s ruling wins')
  })

  it('shows the not-set-up state cleanly, with the box disabled and no chips', () => {
    setLocale('en')
    const html = render({ blocked: 'notConfigured' })
    expect(html).toContain('set up on the server yet')
    expect(html).not.toContain('How does grappling work?')
    expect(html).toMatch(/<textarea[^>]*disabled/)
  })

  it('asks a local profile for the activation code', () => {
    setLocale('en')
    expect(render({ blocked: 'signIn' })).toContain('Sign in with your activation code')
  })

  it('renders answers with what they looked up, and the stream in progress', () => {
    setLocale('en')
    const html = render({ chat: chat({ thread: thread(convo), busy: true, pending: { question: 'And Shield?', text: '', tools: [{ name: 'get_entry', args: {}, label: 'Shield', ok: true }] } }) })
    expect(html).toContain('<strong>Fireball</strong> is a 3rd-level evocation.')
    expect(html).toContain('Looked up:')
    expect(html).toContain('>Shield<')
    expect(html).toContain('Reading what it found')
    expect(html).toContain('>Stop<')
    expect(html).not.toContain('get_entry"')
  })

  it('offers Try again for a dropped connection and a reset time for the limit', () => {
    setLocale('en')
    expect(render({ chat: chat({ error: { kind: 'unreachable', question: 'q' } }) })).toContain('Try again')
    const limited = render({ chat: chat({ error: { kind: 'limit', question: 'q' } }) })
    expect(limited).toContain('again tomorrow')
    expect(limited).not.toContain('Try again')
  })

  it('speaks Hebrew', () => {
    setLocale('he')
    const html = render({ blocked: 'notConfigured' })
    expect(html).toContain('הפמיליאר')
    expect(html).toContain('dir="auto"')
    setLocale('en')
  })
})

describe('screen and route', () => {
  it('knows the character on its sheet, the builder, and DM pages', () => {
    const c = makeCharacter({ name: 'Vex' })
    const sheet = screenFor({ kind: 'sheet' }, { character: c, isDm: false, partyDm: false })
    expect(sheet.context).toEqual({ kind: 'character', characterId: c.id })
    expect(sheet.card).toContain('Vex')
    expect(sheet.subject?.vars?.name).toBe('Vex')
    expect(screenFor({ kind: 'build' }, { isDm: false, partyDm: false }).context.kind).toBe('builder')
    expect(screenFor({ kind: 'dm' }, { isDm: true, partyDm: true, campaign: { id: 'g1', name: 'Garden Gang' } })).toMatchObject({ context: { kind: 'dm', partyId: 'g1' }, role: 'dm' })
    // A player who somehow lands on a DM page gets no DM help.
    expect(screenFor({ kind: 'dm' }, { isDm: false, partyDm: false }).role).toBe('player')
    expect(screenFor({ kind: 'campaigns' }, { isDm: true, partyDm: true }).role).toBe('dm')
  })

  it('has a #/familiar page under More for everyone', () => {
    expect(viewToHash({ kind: 'familiar' })).toBe('#/familiar')
    expect(hashToView('#/familiar')).toEqual({ kind: 'familiar' })
    expect(navItems({ isDm: false, partyDm: false }).more.map(i => i.key)).toContain('familiar')
    expect(navItems({ isDm: true, partyDm: true }).more.map(i => i.key)).toContain('familiar')
  })
})
