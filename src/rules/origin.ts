// Tasha's "Customizing Your Origin" for 2014 races: the race's skill, language and weapon proficiencies,
// each one swappable for another of the same kind (Character.originSwaps). Ability bonuses move with
// racialBonusTargets (abilities.ts). Race tool picks already accept any tool.
import type { Character } from '../model/character'
import { raceById } from './data/races'
import { rulesEdition } from './edition'
import type { SkillId } from './types'

type OriginInput = Pick<Character, 'raceId' | 'subraceId'> & Partial<Pick<Character, 'rulesEdition' | 'originSwaps'>>

// SRD 5.1 race and subrace weapon training. 2024 species have none.
const RACIAL_WEAPONS: Record<string, string[]> = {
  dwarf: ['battleaxe', 'handaxe', 'warhammer'],
  'high-elf': ['longsword', 'shortsword', 'shortbow', 'longbow'],
}

const swap = <T extends string>(list: T[], to: Partial<Record<string, T>> | undefined): T[] =>
  [...new Set(list.map(x => to?.[x] || x))]

/** The race's own skills, languages and weapons, before any swap. 2024 species give no weapons. */
export function bookOrigin(c: OriginInput): { skills: SkillId[]; languages: string[]; weapons: string[] } {
  const edition = rulesEdition(c)
  const race = raceById(c.raceId, edition)
  return {
    skills: race?.skillProficiencies ?? [],
    languages: race?.languages ?? [],
    weapons: edition === '2024' ? [] : [...(RACIAL_WEAPONS[c.raceId] ?? []), ...(RACIAL_WEAPONS[c.subraceId ?? ''] ?? [])],
  }
}

/** True when the 2014 race has anything Tasha's lets you swap. */
export const canSwapOrigin = (c: OriginInput) => {
  if (rulesEdition(c) === '2024') return false
  const b = bookOrigin(c)
  return b.skills.length + b.languages.length + b.weapons.length > 0
}

/** Race skills after swaps. */
export function racialSkills(c: OriginInput): SkillId[] {
  const { skills } = bookOrigin(c)
  return rulesEdition(c) === '2024' ? skills : swap(skills, c.originSwaps?.skills)
}

/** Race languages after swaps. */
export function racialLanguages(c: OriginInput): string[] {
  const { languages } = bookOrigin(c)
  return rulesEdition(c) === '2024' ? languages : swap(languages, c.originSwaps?.languages)
}

/** Weapon ids the race trains, after swaps. */
export function racialWeapons(c: OriginInput): string[] {
  return swap(bookOrigin(c).weapons, c.originSwaps?.weapons)
}
