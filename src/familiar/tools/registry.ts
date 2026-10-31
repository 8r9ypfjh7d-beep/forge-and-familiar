// Tools the model may call. They run in the browser over the app's own data, so the server never needs it.
import type { FamiliarContext, FunctionDeclaration } from '../types'
import type { DmToolData } from './dm'
import type { ApplyOutcome, Proposal } from '../changes'

/** What a tool may read: who is asking and what is on screen. Executors enforce access, not the model. */
export interface ToolEnv {
  userId: string
  context: FamiliarContext
  locale: string
  /** Rules edition of the thing on screen (character or campaign), when known. */
  edition?: '2014' | '2024'
  /** Data access injected by the app (characters, party); tests pass fakes. */
  data?: ToolData
}

/** App data the character and DM tools read; filled in by the UI layer (units C and D). */
export interface ToolData {
  /** Any of the asker's own characters by id (the app filters to what this user may open). */
  getCharacter?: (id: string) => Promise<unknown>
  /** DM screen data; the DM tools check access themselves (tools/dm.ts). */
  dm?: DmToolData
  /** The character on the open sheet, live (a `Character`). */
  character?: () => unknown
  /** Builder: the draft so far (a `CharacterDraft`) and the step on screen (a `StepId`). */
  draft?: () => unknown
  step?: () => string
  /** Makes a tapped Apply card's change through the screen's own update path (sheet apply(), builder update()). */
  applyChange?: (p: Proposal) => ApplyOutcome
  [key: string]: unknown
}

export interface ToolDef {
  declaration: FunctionDeclaration
  /** Whether the tool is offered in this context (DM tools only on the DM screen, etc.). */
  available?: (env: ToolEnv) => boolean
  /** Short label for the footnote chip: "Fireball", "Grappled". */
  label?: (args: Record<string, unknown>) => string
  run: (args: Record<string, unknown>, env: ToolEnv) => Promise<Record<string, unknown>>
}

const tools = new Map<string, ToolDef>()

export function registerTool(def: ToolDef): void {
  tools.set(def.declaration.name, def)
}

export const getTool = (name: string) => tools.get(name)

export const availableTools = (env: ToolEnv) => [...tools.values()].filter(t => !t.available || t.available(env))

export const declarations = (env: ToolEnv): FunctionDeclaration[] => availableTools(env).map(t => t.declaration)

/** Runs a call; unknown tools and thrown errors become an `error` result the model can read. */
export async function runTool(name: string, args: Record<string, unknown>, env: ToolEnv): Promise<{ result: Record<string, unknown>; ok: boolean; label: string }> {
  const def = tools.get(name)
  const label = def?.label?.(args) ?? name
  if (!def || (def.available && !def.available(env))) return { result: { error: `No tool named ${name} here.` }, ok: false, label }
  try {
    return { result: await def.run(args, env), ok: true, label }
  } catch (e) {
    return { result: { error: String((e as Error).message ?? e) }, ok: false, label }
  }
}

/** Strings from model args, defensively. */
export const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '')
export const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
