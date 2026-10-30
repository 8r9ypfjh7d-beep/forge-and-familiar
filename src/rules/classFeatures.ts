// Class features a character has now, with the class level they count from (homebrew feature uses read this).
import type { Character } from '../model/character'
import { classById } from './data/classes'
import { rulesEdition } from './edition'
import type { ClassDef, ClassFeature } from './types'

type Owner = Partial<Pick<Character, 'classes' | 'rulesEdition'>>

/** Each class's features up to its level, with that class level. */
export const classFeatures = (c: Owner): { level: number; def: ClassDef; feature: ClassFeature }[] =>
  (c.classes ?? []).flatMap(cl => {
    const def = classById(cl.classId, rulesEdition(c))
    return def ? def.features.filter(f => f.level <= cl.level).map(feature => ({ level: cl.level, def, feature })) : []
  })
