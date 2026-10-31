// The Familiar's data shapes. Messages follow Gemini's `contents` format so they go to the API unchanged.

/** One part of a Gemini message: text, a tool call from the model, or our tool's answer. Unknown fields (thoughtSignature) are kept. */
export interface Part {
  text?: string
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string }
  functionResponse?: { name: string; response: Record<string, unknown>; id?: string }
  thought?: boolean
  thoughtSignature?: string
}

export interface Content {
  role: 'user' | 'model'
  parts: Part[]
}

/** What the user is looking at when they ask: shapes the context card and which tools apply. */
export type FamiliarContext =
  | { kind: 'general' }
  | { kind: 'character'; characterId: string }
  | { kind: 'builder'; characterId?: string }
  | { kind: 'dm'; partyId?: string }

/** A tool call the model made this turn, kept so the UI can show "Looked up: Fireball". */
export interface ToolUse {
  name: string
  args: Record<string, unknown>
  /** Short human label for the footnote chip. */
  label: string
  ok: boolean
}

export interface Thread {
  id: string
  title: string
  context: FamiliarContext
  /** The full Gemini conversation, tool calls and responses included. */
  contents: Content[]
  /** Tool uses per model answer, by index into `contents` of the final model text. */
  tools: Record<number, ToolUse[]>
  createdAt: string
  updatedAt: string
}

/** `unreachable`: online but the request never got an answer (function not deployed, CORS, network drop). */
export type FamiliarErrorKind = 'offline' | 'signIn' | 'limit' | 'tooLarge' | 'server' | 'notConfigured' | 'unreachable'

export class FamiliarError extends Error {
  readonly kind: FamiliarErrorKind
  /** When the daily limit resets (ISO), for `limit`. */
  readonly resetAt?: string
  constructor(kind: FamiliarErrorKind, message: string = kind, resetAt?: string) {
    super(message)
    this.kind = kind
    this.resetAt = resetAt
  }
}

/** Gemini function declaration (OpenAPI subset). */
export interface FunctionDeclaration {
  name: string
  description: string
  parameters?: {
    type: 'object'
    properties: Record<string, { type: string; description?: string; enum?: string[]; items?: { type: string } }>
    required?: string[]
  }
}

/** The request body the `familiar` Edge Function accepts. */
export interface FamiliarRequest {
  contents: Content[]
  systemInstruction?: { parts: Part[] }
  tools?: { functionDeclarations: FunctionDeclaration[] }[]
  generationConfig?: Record<string, unknown>
  stream?: boolean
}

export interface FamiliarResponse {
  /** The model's parts for this round, unchanged (kept in the conversation as-is). */
  parts: Part[]
  usage?: { tokensIn: number; tokensOut: number }
  finishReason?: string
}

/** i18n key for an error kind (`familiar.error.*` in both locales). */
export const errorKey = (kind: FamiliarErrorKind) => `familiar.error.${kind}` as const
