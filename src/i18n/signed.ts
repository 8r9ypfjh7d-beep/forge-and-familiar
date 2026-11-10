import { formatMod } from '../rules'

/** Left-to-right mark: keeps a leading "+" or "-" before its number inside Hebrew (right-to-left) text. */
export const LRM = '‎'

/** A signed number for display ("+2", "-1") that keeps its sign in front in Hebrew too, even inside <option> text. */
export const fmtMod = (n: number) => LRM + formatMod(n)

/** Same as fmtMod but for an already-built string that starts with a sign, such as "+1d6". */
export const ltr = (s: string) => LRM + s
