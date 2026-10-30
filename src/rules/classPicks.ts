// Class multi-picks (Expertise, Primal Knowledge, class languages) and Weapon Mastery weapons.
// Pure helpers shared by the builder, derive() (through activeItemEffects) and the combat page.
import type { Character } from '../model/character'
import { CLASS_PICKS_2014 } from './data/classChoices2014'
import { classById } from './data/classes'
import { ITEMS } from './data/items'
import { WEAPON_MASTERY } from './data/masteries'
import { rulesEdition } from './edition'
import type { ClassPick, Item, ItemEffect, SkillId } from './types'

type WeaponItem = Extract<Item, { kind: 'weapon' }>

type Classes = Pick<Character, 'classes'> & Partial<Pick<Character, 'rulesEdition'>>
type Picks = Classes & Partial<Pick<Character, 'classPicks' | 'featureChoices'>>

/** Key of a class pick in Character.classPicks. */
export const pickKey = (classId: string, pickId: string) => `${classId}.${pickId}`

/** Picks the character's class levels have unlocked, with what was picked (at most `count`). */
export function classPickSlots(c: Picks): { classId: string; pick: ClassPick; picked: string[] }[] {
  const edition = rulesEdition(c)
  return (c.classes ?? []).flatMap(cl => {
    // 2014 picks (Bard and Rogue Expertise, Deft Explorer) live beside the 2014 class choices.
    const own = [...(classById(cl.classId, edition)?.picks ?? []), ...(edition === '2024' ? [] : (CLASS_PICKS_2014[cl.classId] ?? []))]
    const chosen = (id: string) => c.featureChoices?.[`${cl.classId}.${id}`]
    return own.filter(p => p.level <= cl.level && (!p.when || (chosen(p.when.choice) === p.when.option) !== !!p.when.not)).map(pick => ({
      classId: cl.classId,
      pick,
      picked: (c.classPicks?.[pickKey(cl.classId, pick.id)] ?? []).slice(0, pick.count),
    }))
  })
}

/** Extra languages the class levels let the player pick (Rogue's Thieves' Cant, Ranger's Deft Explorer). */
export const classLanguagePicks = (c: Classes) =>
  classPickSlots(c).reduce((n, s) => n + (s.pick.kind === 'language' ? s.pick.count : 0), 0)

/** What the skill picks do on the sheet: proficiency, and double proficiency for Expertise. */
export function classPickEffects(c: Partial<Picks>): { source: string; effect: ItemEffect }[] {
  if (!c.classes) return []
  return classPickSlots(c as Picks).flatMap(({ pick, picked }) => {
    if (pick.kind === 'language') return []
    return picked.map(skill => ({
      source: pick.name,
      effect: { kind: 'skillProficiency', skill: skill as SkillId, ...(pick.kind === 'expertise' ? { expertise: true } : {}) } as ItemEffect,
    }))
  })
}

/** Weapons that have a mastery property (SRD 5.2), in item-list order. */
export const MASTERY_WEAPONS: WeaponItem[] = ITEMS.filter((i): i is WeaponItem => i.kind === 'weapon' && i.id in WEAPON_MASTERY)

/** Mastery property of a weapon, by item id. */
export const weaponMastery = (itemId: string): string | undefined => WEAPON_MASTERY[itemId]
