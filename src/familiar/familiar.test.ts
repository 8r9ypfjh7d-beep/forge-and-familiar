import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeCharacter } from '../sheet/fixtures'
import {
  MAX_TOOL_ROUNDS, characterCard, declarations, listThreads, mergeChunks, newThread, parseSse, registerTool, runTool, runTurn,
  saveTurn, sourceNote, systemInstruction, titleFor, trimHistory, type Content, type FamiliarRequest, type FamiliarTransport, type ToolEnv,
} from './index'

const env: ToolEnv = { userId: 'acct-roy', context: { kind: 'general' }, locale: 'en' }
const prompt = { context: { kind: 'general' } as const, locale: 'en', role: 'player' as const }

describe('content tools', () => {
  it('offers the content tools everywhere', () => {
    const names = declarations(env).map(d => d.name)
    expect(names).toEqual(expect.arrayContaining(['search_content', 'get_entry', 'rules_lookup']))
  })

  it('searches spells by edition and filters', async () => {
    const { result, ok } = await runTool('search_content', { kind: 'spells', query: 'fireball', edition: '2014' }, env)
    expect(ok).toBe(true)
    const hits = result.hits as { id: string; source: string; level: number }[]
    expect(hits[0]).toMatchObject({ id: 'fireball', source: 'srd-5.1', level: 3 })
    const third = await runTool('search_content', { kind: 'spells', query: '', spellLevel: 3, spellClass: 'wizard', edition: '2024', limit: 50 }, env)
    expect((third.result.hits as unknown[]).length).toBe(25)
    expect((third.result.hits as { level: number }[]).every(h => h.level === 3)).toBe(true)
  })

  it('returns a full entry with its usage note', async () => {
    const { result } = await runTool('get_entry', { kind: 'spells', id: 'fireball', source: 'srd-5.2' }, env)
    expect(result.text).toMatch(/fire/i)
    expect(result.usage).toMatch(/CC-BY/)
    expect((result.entry as { level: number }).level).toBe(3)
  })

  it('marks book spells as our summaries, in Hebrew when asked', async () => {
    const hits = (await runTool('search_content', { kind: 'spells', query: 'toll the dead', edition: '2014' }, env)).result.hits as { id: string; source: string }[]
    const hit = hits.find(h => h.source.startsWith('books-'))!
    expect(hit).toBeTruthy()
    const { result } = await runTool('get_entry', { kind: 'spells', id: hit.id, source: hit.source }, { ...env, locale: 'he' })
    expect(result.usage).toMatch(/summary/)
    expect(result.text).toMatch(/[֐-׿]/)
  })

  it('looks up SRD rules text', async () => {
    const { result } = await runTool('rules_lookup', { question: 'opportunity attack' }, env)
    const passages = result.passages as { section: string }[]
    expect(passages[0].section).toMatch(/Opportunity Attacks/)
    expect(result.usage).toMatch(/Quote at most two sentences/)
  })

  it('turns bad input into an error the model can read', async () => {
    expect((await runTool('search_content', { kind: 'dragons' }, env)).ok).toBe(false)
    expect((await runTool('nope', {}, env)).result.error).toMatch(/No tool/)
    expect((await runTool('get_entry', { kind: 'spells', id: 'not-a-spell' }, env)).result.error).toMatch(/No spells/)
  })

  it('tells sources apart', () => {
    expect(sourceNote('srd-5.1')).toMatch(/CC-BY/)
    expect(sourceNote('books-2024')).toMatch(/summary/)
    expect(sourceNote('hb:abc')).toMatch(/Homebrew/)
  })
})

describe('prompt and context', () => {
  it('sets language, role and copyright rules', () => {
    const he = systemInstruction({ ...prompt, locale: 'he', role: 'dm', edition: '2024' })
    expect(he).toMatch(/Answer in Hebrew/)
    expect(he).toMatch(/Dungeon Master/)
    expect(he).toMatch(/SRD 5.2/)
    expect(he).toMatch(/never the book's text/)
    expect(systemInstruction(prompt)).toMatch(/Answer in English/)
  })

  it('summarizes a character in a compact card', () => {
    const card = characterCard(makeCharacter())
    expect(card).toMatch(/Brannoc Ashvale/)
    expect(card).toMatch(/Fighter 5 \/ Wizard 2/)
    expect(card).toMatch(/AC \d+/)
    expect(card).toMatch(/Spellcasting: INT/)
    expect(card.length).toBeLessThan(6000)
  })
})

describe('streaming helpers', () => {
  it('splits SSE events and keeps the unfinished rest', () => {
    const { events, rest } = parseSse('data: {"a":1}\n\ndata: {"b":2}\n\ndata: {"c"')
    expect(events).toEqual(['{"a":1}', '{"b":2}'])
    expect(rest).toBe('data: {"c"')
  })

  it('joins streamed text and keeps tool calls', () => {
    const r = mergeChunks([
      { candidates: [{ content: { parts: [{ text: 'Hel' }] } }] },
      { candidates: [{ content: { parts: [{ text: 'lo' }, { functionCall: { name: 'x', args: {} } }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3 } },
    ])
    expect(r.parts).toEqual([{ text: 'Hello' }, { functionCall: { name: 'x', args: {} } }])
    expect(r.usage).toEqual({ tokensIn: 10, tokensOut: 3 })
  })
})

describe('tool loop', () => {
  registerTool({
    declaration: { name: 'test_echo', description: 'echo', parameters: { type: 'object', properties: { v: { type: 'string' } } } },
    label: a => `echo ${a.v}`,
    run: async a => ({ echoed: a.v }),
  })

  it('runs tools until the model answers', async () => {
    const seen: FamiliarRequest[] = []
    const transport: FamiliarTransport = async body => {
      seen.push(body)
      if (seen.length === 1) return { parts: [{ functionCall: { name: 'test_echo', args: { v: 'hi' } }, thoughtSignature: 'sig' }], usage: { tokensIn: 5, tokensOut: 1 } }
      return { parts: [{ text: 'Done: hi' }], usage: { tokensIn: 7, tokensOut: 2 } }
    }
    const r = await runTurn([], 'echo hi', prompt, env, transport)
    expect(r.text).toBe('Done: hi')
    expect(r.tools).toEqual([{ name: 'test_echo', args: { v: 'hi' }, label: 'echo hi', ok: true }])
    expect(r.usage).toEqual({ tokensIn: 12, tokensOut: 3 })
    // The model's own part (with its signature) goes back unchanged, then our response.
    expect(seen[1].contents.at(-2)).toEqual({ role: 'model', parts: [{ functionCall: { name: 'test_echo', args: { v: 'hi' } }, thoughtSignature: 'sig' }] })
    expect(seen[1].contents.at(-1)!.parts[0].functionResponse).toEqual({ name: 'test_echo', response: { echoed: 'hi' } })
    expect(seen[0].systemInstruction!.parts[0].text).toMatch(/Familiar/)
  })

  it('stops offering tools after the last round', async () => {
    const seen: FamiliarRequest[] = []
    const transport: FamiliarTransport = async body => {
      seen.push(body)
      return { parts: [{ functionCall: { name: 'test_echo', args: { v: 'again' } } }] }
    }
    await runTurn([], 'loop', prompt, env, transport)
    expect(seen).toHaveLength(MAX_TOOL_ROUNDS + 1)
    expect(seen.at(-1)!.tools).toBeUndefined()
  })

  it('trims history to start on a user question', () => {
    const msgs: Content[] = []
    for (let i = 0; i < 20; i++) {
      msgs.push({ role: 'user', parts: [{ text: `q${i}` }] })
      msgs.push({ role: 'model', parts: [{ functionCall: { name: 'x' } }] })
      msgs.push({ role: 'user', parts: [{ functionResponse: { name: 'x', response: {} } }] })
    }
    const t = trimHistory(msgs, 10)
    expect(t.length).toBeLessThanOrEqual(10)
    expect(t[0].role).toBe('user')
    expect(t[0].parts[0].text).toMatch(/^q/)
  })
})

describe('device store', () => {
  beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v) } })
  })

  it('keeps threads per user, newest first, titled by the first question', () => {
    const t = newThread({ kind: 'general' })
    const saved = saveTurn('acct-roy', t, [{ role: 'user', parts: [{ text: 'hi' }] }, { role: 'model', parts: [{ text: 'hello' }] }], [], 'What does Hex do?')
    expect(saved.title).toBe('What does Hex do?')
    expect(listThreads('acct-roy')).toHaveLength(1)
    expect(listThreads('acct-tamir')).toHaveLength(0)
    expect(titleFor('x'.repeat(100))).toHaveLength(58)
  })
})
