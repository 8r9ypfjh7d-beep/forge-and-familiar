// Offline backstory drafter: stitches story fragments together from the character's race, background,
// class and alignment. No AI service and no network; a seed picks the fragments, so the same seed
// always gives the same draft and "Another" just moves to the next seed.
import type { Character } from '../model/character'
import type { Locale } from '../i18n/translate'
import { PHRASES, type Axis } from './phrases'

/** Display names the caller already translated (useI18n's raceName, className, background term). */
export interface DraftNames {
  race: string
  cls: string
  bg: string
}

export interface Backstory {
  /** Story paragraphs, in reading order. */
  story: string[]
  personality: string
  ideal: string
  bond: string
  flaw: string
  hook: string
}

/** Small deterministic generator (mulberry32), so drafts are repeatable in tests. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The ideal table an alignment points at; the moral axis wins over the ethical one, "True Neutral" is neutral. */
export function alignmentAxis(alignment: string): Axis {
  const a = alignment.toLowerCase()
  if (a.includes('good')) return 'good'
  if (a.includes('evil')) return 'evil'
  if (a.includes('lawful')) return 'law'
  if (a.includes('chaotic')) return 'chaos'
  return 'neutral'
}

const withArticle = (noun: string) => `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`
const pickFrom = <T>(rand: () => number, list: T[]): T => list[Math.floor(rand() * list.length) % list.length]
const table = (t: Record<string, string[]>, id: string | undefined, fallback = '*') => (id && t[id]) || t[fallback]

/** Two-trait personality line, never the same trait twice. */
function twoTraits(rand: () => number, traits: string[]): string {
  const first = Math.floor(rand() * traits.length) % traits.length
  const second = (first + 1 + (Math.floor(rand() * (traits.length - 1)) % (traits.length - 1))) % traits.length
  return `${traits[first]} ${traits[second]}`
}

export function draftBackstory(c: Character, names: DraftNames, locale: Locale, seed: number): Backstory {
  const p = PHRASES[locale]
  const rand = seededRandom(seed)
  const name = c.name.trim() || names.race
  // "lived as a sailor": English needs an article and lower case; Hebrew reads fine with the name as is.
  const bg = locale === 'en' ? withArticle(names.bg.toLowerCase()) : names.bg
  const fill = (s: string) => s.replace(/\{name\}/g, name).replace(/\{race\}/g, names.race).replace(/\{cls\}/g, names.cls).replace(/\{bg\}/g, bg)
  // A subrace has no lines of its own (High Elf reads as Elf); homebrew races fall back to '*'.
  const raceLines = table(p.race, c.raceId)
  const bgLines = c.backgroundId === 'custom' ? p.background.custom : table(p.background, c.backgroundId)
  const mainClass = c.classes[0]?.classId
  return {
    story: [
      `${fill(pickFrom(rand, raceLines))} ${fill(pickFrom(rand, bgLines))}`,
      `${fill(pickFrom(rand, p.turn))} ${fill(pickFrom(rand, table(p.calling, mainClass)))}`,
    ],
    personality: fill(twoTraits(rand, p.traits)),
    ideal: fill(pickFrom(rand, p.ideals[alignmentAxis(c.alignment)])),
    bond: fill(pickFrom(rand, p.bonds)),
    flaw: fill(pickFrom(rand, p.flaws)),
    hook: fill(pickFrom(rand, p.hooks)),
  }
}

/** The draft as plain text for the character's notes. */
export function backstoryText(b: Backstory, locale: Locale): string {
  const l = PHRASES[locale].labels
  return [
    ...b.story,
    '',
    `${l.personality}: ${b.personality}`,
    `${l.ideal}: ${b.ideal}`,
    `${l.bond}: ${b.bond}`,
    `${l.flaw}: ${b.flaw}`,
    `${l.hook}: ${b.hook}`,
  ].join('\n')
}

/** Notes with the draft added: below what is there already, separated by a blank line. */
export function withBackstory(notes: string, text: string): string {
  const kept = notes.trimEnd()
  return kept ? `${kept}\n\n${text}` : text
}
