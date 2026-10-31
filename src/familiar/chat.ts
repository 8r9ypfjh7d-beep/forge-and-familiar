// One user turn: send the conversation, run the tools the model asks for, repeat until it answers in text.
import { systemInstruction, type PromptInput } from './prompt'
import { declarations, runTool, type ToolEnv } from './tools/registry'
import type { Content, FamiliarRequest, Part, ToolUse } from './types'
import type { FamiliarTransport } from './api'

export const MAX_TOOL_ROUNDS = 6
/** Messages sent per request; older ones drop off (the context card is rebuilt every turn anyway). */
export const MAX_HISTORY = 30

export interface TurnEvents {
  onText?: (delta: string) => void
  onTool?: (use: ToolUse) => void
}

export interface TurnResult {
  contents: Content[]
  /** The final answer text. */
  text: string
  tools: ToolUse[]
  usage: { tokensIn: number; tokensOut: number }
}

/** The last `max` messages, never starting on a model message or an orphaned tool response. */
export function trimHistory(contents: Content[], max = MAX_HISTORY): Content[] {
  if (contents.length <= max) return contents.slice()
  let start = contents.length - max
  while (start < contents.length && (contents[start].role !== 'user' || contents[start].parts.some(p => p.functionResponse))) start++
  return contents.slice(start)
}

export const textOf = (parts: Part[]) => parts.filter(p => p.text && !p.thought).map(p => p.text).join('')

export async function runTurn(
  history: Content[],
  userText: string,
  prompt: PromptInput,
  env: ToolEnv,
  transport: FamiliarTransport,
  events: TurnEvents = {},
  signal?: AbortSignal,
): Promise<TurnResult> {
  const contents: Content[] = [...history, { role: 'user', parts: [{ text: userText }] }]
  const tools: ToolUse[] = []
  const usage = { tokensIn: 0, tokensOut: 0 }
  const decls = declarations(env)
  const system = { parts: [{ text: systemInstruction(prompt) }] }

  for (let round = 0; ; round++) {
    const lastRound = round >= MAX_TOOL_ROUNDS
    const body: FamiliarRequest = {
      contents: trimHistory(contents),
      systemInstruction: system,
      // On the last round the model gets no tools, so it has to answer with what it found.
      tools: decls.length && !lastRound ? [{ functionDeclarations: decls }] : undefined,
    }
    const res = await transport(body, { signal, onText: events.onText })
    if (res.usage) { usage.tokensIn += res.usage.tokensIn; usage.tokensOut += res.usage.tokensOut }
    const parts = res.parts.length ? res.parts : [{ text: '' }]
    contents.push({ role: 'model', parts })
    const calls = parts.filter(p => p.functionCall)
    if (!calls.length || lastRound) return { contents, text: textOf(parts), tools, usage }

    const responses: Part[] = []
    for (const p of calls) {
      const { name, args = {}, id } = p.functionCall!
      const { result, ok, label } = await runTool(name, args, env)
      const use = { name, args, label, ok }
      tools.push(use)
      events.onTool?.(use)
      responses.push({ functionResponse: { name, response: result, ...(id ? { id } : {}) } })
    }
    contents.push({ role: 'user', parts: responses })
  }
}
