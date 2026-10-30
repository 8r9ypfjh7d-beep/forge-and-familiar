// Every official Metamagic option, 2014 (PHB + Tasha's) and 2024 (PHB). Names, costs and sources only:
// the explanations are our own words in i18n/locales/explain.metamagic.*.ts (why.metamagic.<id>, why.metamagic2024.<id>).
import type { ClassOption } from '../classOptions'
import type { RulesEdition } from '../types'
import { PHB, PHB24, TCE } from './books/helpers'

const mm = (edition: RulesEdition, source: string) =>
  (id: string, name: string, cost: number, extra: Partial<ClassOption> = {}): ClassOption =>
    ({ id, kind: 'metamagic', name, cost, source, edition, classIds: ['sorcerer'], ...extra })

const phb = mm('2014', PHB)
const tce = mm('2014', TCE)
export const METAMAGIC: ClassOption[] = [
  phb('careful', 'Careful Spell', 1),
  phb('distant', 'Distant Spell', 1),
  phb('empowered', 'Empowered Spell', 1),
  phb('extended', 'Extended Spell', 1),
  phb('heightened', 'Heightened Spell', 3),
  phb('quickened', 'Quickened Spell', 2),
  phb('subtle', 'Subtle Spell', 1),
  phb('twinned', 'Twinned Spell', 1, { costPerSpellLevel: true }),
  tce('seeking', 'Seeking Spell', 2),
  tce('transmuted', 'Transmuted Spell', 1),
]

const phb24 = mm('2024', PHB24)
export const METAMAGIC_2024: ClassOption[] = [
  phb24('careful', 'Careful Spell', 1),
  phb24('distant', 'Distant Spell', 1),
  phb24('empowered', 'Empowered Spell', 1),
  phb24('extended', 'Extended Spell', 1),
  phb24('heightened', 'Heightened Spell', 2),
  phb24('quickened', 'Quickened Spell', 2),
  phb24('seeking', 'Seeking Spell', 1),
  phb24('subtle', 'Subtle Spell', 1),
  phb24('transmuted', 'Transmuted Spell', 1),
  phb24('twinned', 'Twinned Spell', 1),
]

/** Options known by sorcerer level: [level, count] steps. 2014: 2 at 3rd, 3 at 10th, 4 at 17th. 2024: 2 at 2nd, 4 at 10th, 6 at 17th. */
export const METAMAGIC_COUNT: Record<RulesEdition, [number, number][]> = {
  '2014': [[3, 2], [10, 3], [17, 4]],
  '2024': [[2, 2], [10, 4], [17, 6]],
}
