// Pure helpers for the Familiar panel: what to show for a conversation, which chips to offer, why sending is blocked.
import type { MessageKey } from '../../i18n'
import { textOf } from '../chat'
import { DM_CHIPS } from '../dm'
import { errorKey, type Content, type FamiliarContext, type FamiliarErrorKind, type ToolUse } from '../types'

export interface Bubble {
  /** Index into `contents`, stable across renders. */
  index: number
  role: 'user' | 'model'
  text: string
  tools: ToolUse[]
}

/** The readable part of a conversation: the user's questions and the model's final answers, with the tools each answer used.
 *  Tool calls, tool responses and text said alongside a tool call stay in `contents` for the model but are not shown. */
export function bubbles(contents: Content[], tools: Record<number, ToolUse[]> = {}): Bubble[] {
  const out: Bubble[] = []
  contents.forEach((c, index) => {
    if (c.role === 'user') {
      if (c.parts.some(p => p.functionResponse)) return
      const text = textOf(c.parts)
      if (text.trim()) out.push({ index, role: 'user', text, tools: [] })
      return
    }
    // "Let me check" before a tool call is not the answer; the answer comes after the tools.
    // (Kept when no tool answer follows: the last round's reply is the answer even if it asked for more.)
    if (c.parts.some(p => p.functionCall) && contents[index + 1]?.parts.some(p => p.functionResponse)) return
    const text = textOf(c.parts)
    if (text.trim()) out.push({ index, role: 'model', text, tools: tools[index] ?? [] })
  })
  return out
}

/** Starter questions per screen (i18n keys; the chip sends its translated text). */
const CHIPS: Record<FamiliarContext['kind'] | 'dmGeneral', MessageKey[]> = {
  general: ['familiar.chip.whatCanYouDo', 'familiar.chip.explainGrapple', 'familiar.chip.newPlayerBuild'],
  character: ['familiar.chip.explainFeatures', 'familiar.chip.combat', 'familiar.chip.nextLevel'],
  builder: ['familiar.chip.fits', 'familiar.chip.subclasses', 'familiar.chip.feat'],
  dm: [...DM_CHIPS],
  dmGeneral: ['familiar.dm.chip.ruling', 'familiar.dm.chip.npc', 'familiar.dm.chip.monsters'],
}

export function chipKeys(context: FamiliarContext, role: 'player' | 'dm'): MessageKey[] {
  if (context.kind === 'general' && role === 'dm') return CHIPS.dmGeneral
  return CHIPS[context.kind]
}

/** Why the panel cannot send right now, before trying: no cloud build, a local-only profile, or no connection. */
export function blockedReason(s: { cloud: boolean; signedIn: boolean; online: boolean }): FamiliarErrorKind | null {
  if (!s.cloud) return 'notConfigured'
  if (!s.signedIn) return 'signIn'
  if (!s.online) return 'offline'
  return null
}

/** Errors the user can fix by trying again (vs. ones that need sign-in, setup or a new chat). */
export const canRetry = (kind: FamiliarErrorKind) => kind === 'server' || kind === 'unreachable' || kind === 'offline'

export const errorMessageKey = (kind: FamiliarErrorKind) => errorKey(kind) as MessageKey

/** "tomorrow at 03:00" style reset time for the limit message, in the reader's locale. */
export function resetText(resetAt: string | undefined, locale: string, now = new Date()): string {
  const at = resetAt ? new Date(resetAt) : null
  if (!at || Number.isNaN(at.getTime())) return ''
  const time = at.toLocaleTimeString(locale === 'he' ? 'he-IL' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
  const sameDay = at.toDateString() === now.toDateString()
  return sameDay ? time : `${at.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB', { weekday: 'short' })} ${time}`
}

/** Thread age for the history list: "10:42" today, else a short date. */
export function whenText(iso: string, locale: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const loc = locale === 'he' ? 'he-IL' : 'en-GB'
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(loc, { day: 'numeric', month: 'short' })
}
