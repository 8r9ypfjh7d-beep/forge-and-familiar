// Roll labels are saved in English ("DEX save", "Longsword slashing (crit)") because rolls are shared with the
// party, whose players may read another language. This rewords them for the reader. Pure, no React.
import { ABILITY_NAMES, SKILLS, type Ability, type SkillId } from '../rules'
import type { RollType } from '../dice/types'
import type { Translate } from './translate'

export interface RollLabelWords {
  t: Translate
  ability: (a: Ability) => string
  abilityShort: (a: Ability) => string
  skill: (s: SkillId) => string
  attackName: (englishName: string) => string
  /** A spell, feature or item that adds dice (Bless, Divine Smite). */
  name: (englishName: string) => string
  damageType: (type: string) => string
}

const DAMAGE = /^(.+) (acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder|healing)$/
const ABILITY_BY_NAME = new Map(Object.entries(ABILITY_NAMES).map(([a, name]) => [name, a as Ability]))
const SKILL_BY_NAME = new Map(Object.entries(SKILLS).map(([id, s]) => [s.name, id as SkillId]))

/** The label in the reader's language; anything not made by the dice module (custom labels) stays as written. */
export function rollLabel(label: string, type: RollType, w: RollLabelWords): string {
  let text = label
  const crit = text.endsWith(' (crit)')
  if (crit) text = text.slice(0, -' (crit)'.length)
  const [base, ...extras] = text.split(' + ')
  const own = baseLabel(base, type, w)
  if (own === undefined) return label
  const added = extras.length ? ` + ${extras.join(' + ').split(', ').map(w.name).join(', ')}` : ''
  return `${own}${added}${crit ? ` ${w.t('roll.crit')}` : ''}`
}

function baseLabel(base: string, type: RollType, w: RollLabelWords): string | undefined {
  if (base === 'Initiative') return w.t('math.initTitle')
  if (base === 'Death save') return w.t('combat.deathSave')
  const hitDie = /^Hit die \((d\d+)\)$/.exec(base)
  if (hitDie) return w.t('roll.hitDie', { die: hitDie[1] })
  const check = /^(\w+) check$/.exec(base)
  if (check && ABILITY_BY_NAME.has(check[1])) return w.t('cs.roll.check', { ability: w.ability(ABILITY_BY_NAME.get(check[1])!) })
  const save = /^(STR|DEX|CON|INT|WIS|CHA) save$/.exec(base)
  if (save) return w.t('math.saveTitle', { ability: w.abilityShort(save[1].toLowerCase() as Ability) })
  const skill = SKILL_BY_NAME.get(base)
  if (skill && (type === 'skill' || type === 'check')) return w.skill(skill)
  if (type === 'attack' && base.endsWith(' attack')) return w.t('roll.attack', { name: w.attackName(base.slice(0, -' attack'.length)) })
  const damage = type === 'damage' ? DAMAGE.exec(base) : null
  if (damage) return damage[2] === 'healing' ? `${w.name(damage[1])}: ${w.t('cs.roll.healing')}` : w.t('roll.damage', { name: w.attackName(damage[1]), type: w.damageType(damage[2]) })
  return undefined
}
