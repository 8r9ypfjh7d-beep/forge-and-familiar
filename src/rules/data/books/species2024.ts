// 2024-rules species from official books outside SRD 5.2: names and mechanics only.
// What each trait does is our own short summary in i18n/locales/explain.species.*.ts, never rulebook text.
// Like the SRD species they carry no ability bonuses or languages (those come from the background).
import type { ItemEffect, Race, RaceEffect, Size, SkillId, TraitChoice } from '../../types'
import { TOOLS } from '../proficiencies'
import { PHB24, dark, resist, skillProf } from './helpers'

export const EFOTA = 'Eberron: Forge of the Artificer'
export const LFL = 'Lorwyn: First Light'
export const RTHW = 'Ravenloft: The Horrors Within'

const EITHER: Size[] = ['Medium', 'Small']
const spell = (name: string, note: string, level?: number): RaceEffect => ({ kind: 'spell', spell: name, note, ...(level ? { level } : {}) })
const SKILL_NAMES: Partial<Record<SkillId, string>> = {
  acrobatics: 'Acrobatics', athletics: 'Athletics', deception: 'Deception', insight: 'Insight', intimidation: 'Intimidation',
  perception: 'Perception', performance: 'Performance', persuasion: 'Persuasion', stealth: 'Stealth', survival: 'Survival',
}
/** A trait that teaches `count` skills from a short list. */
const skillPick = (id: string, name: string, skills: SkillId[], count = 1): TraitChoice => ({
  id, name, ...(count > 1 ? { count } : {}),
  options: skills.map(k => ({ id: k, name: SKILL_NAMES[k] ?? k, effects: [skillProf(k)] })),
})
const adv = (on: Extract<ItemEffect, { kind: 'advantage' }>['on'], when: string): ItemEffect => ({ kind: 'advantage', on, when })

const species = (r: Omit<Race, 'abilityBonuses' | 'languages' | 'speed' | 'size'> & Partial<Pick<Race, 'speed' | 'size'>>): Race => ({
  size: 'Medium', speed: 30, abilityBonuses: {}, languages: [], ...r,
})

export const BOOK_SPECIES_2024: Race[] = [
  species({
    id: 'aasimar', name: 'Aasimar', source: PHB24, sizeOptions: EITHER,
    traits: ['Celestial Resistance', 'Darkvision', 'Healing Hands', 'Light Bearer', 'Celestial Revelation'],
    effects: [resist('necrotic'), resist('radiant'), dark(60), spell('Light', 'cantrip, Charisma')],
    uses: [
      { trait: 'Healing Hands', count: 1, recharge: 'long' },
      { trait: 'Celestial Revelation', count: 1, recharge: 'long', level: 3 },
    ],
  }),
  species({
    id: 'changeling', name: 'Changeling', source: EFOTA, sizeOptions: EITHER,
    choices: [skillPick('changelingInstincts', 'Changeling Instincts', ['deception', 'insight', 'intimidation', 'performance', 'persuasion'], 2)],
    traits: ['Changeling Instincts', 'Shape-Shifter'],
    effects: [adv('checks', 'Charisma checks while shape-shifted')],
  }),
  species({
    id: 'kalashtar', name: 'Kalashtar', source: EFOTA, freeSkillChoices: 1,
    traits: ['Dual Mind', 'Mental Discipline', 'Mind Link', 'Severed from Dreams'],
    effects: [resist('psychic'), adv('save:wis', 'Dual Mind (see the trait)')],
  }),
  species({
    id: 'khoravar', name: 'Khoravar', source: EFOTA, sizeOptions: EITHER, freeSkillChoices: 1,
    traits: ['Darkvision', 'Fey Ancestry', 'Fey Gift', 'Lethargy Resilience', 'Skill Versatility'],
    effects: [dark(60), adv('saves', 'to avoid or end Charmed'), spell('Friends', 'cantrip; swap for a Cleric, Druid or Wizard cantrip after a long rest')],
    uses: [{ trait: 'Lethargy Resilience', count: 1, recharge: 'long' }],
  }),
  species({
    id: 'shifter', name: 'Shifter', source: EFOTA, sizeOptions: EITHER,
    choices: [skillPick('bestialInstincts', 'Bestial Instincts', ['acrobatics', 'athletics', 'intimidation', 'survival'])],
    traits: ['Bestial Instincts', 'Darkvision', 'Shifting', 'Beasthide', 'Longtooth', 'Swiftstride', 'Wildhunt'],
    effects: [dark(60)],
    uses: [{ trait: 'Shifting', count: 'pb', recharge: 'long' }],
  }),
  species({
    id: 'warforged', name: 'Warforged', source: EFOTA, sizeOptions: EITHER, freeSkillChoices: 1,
    toolChoices: { count: 1, from: TOOLS },
    traits: ['Constructed Resilience', 'Integrated Protection', "Sentry's Rest", 'Specialized Design', 'Tireless'],
    effects: [resist('poison'), adv('saves', 'to avoid or end Poisoned'), { kind: 'ac', value: 1 }],
  }),
  species({
    id: 'lorwyn-changeling', name: 'Changeling (Lorwyn)', source: LFL, sizeOptions: EITHER, skillProficiencies: ['performance'],
    traits: ['Darkvision (120 ft.)', 'Delightful Imitator', 'Shape Self', 'Unpredictable Movement'],
    effects: [dark(120)],
  }),
  species({
    id: 'rimekin', name: 'Rimekin', source: LFL, sizeOptions: EITHER,
    traits: ['Cold Resistance', 'Darkvision', 'Cold Fire Magic'],
    effects: [
      resist('cold'), dark(60), spell('Ray of Frost', 'cantrip'), spell('Ice Knife', 'once per long rest', 3),
      spell('Flame Blade', 'once per long rest, deals cold damage', 5),
    ],
  }),
  species({
    id: 'dhampir', name: 'Dhampir', source: RTHW, sizeOptions: EITHER, speed: 35,
    traits: ['Darkvision', 'Spider Climb', 'Trace of Undeath', 'Vampiric Bite'],
    effects: [dark(60), resist('necrotic'), { kind: 'moveSpeed', mode: 'climb', value: 0 }],
    uses: [{ trait: 'Vampiric Bite', count: 'pb', recharge: 'long' }],
  }),
  species({
    id: 'hexblood', name: 'Hexblood', source: RTHW, sizeOptions: EITHER,
    traits: ['Darkvision', 'Eerie Token', 'Hex Magic'],
    effects: [dark(60), spell('Disguise Self', 'once per long rest'), spell('Hex', 'once per long rest')],
  }),
  species({
    id: 'reborn', name: 'Reborn', source: RTHW, sizeOptions: EITHER, freeSkillChoices: 1,
    traits: ['Escaped Death', 'Everlasting', 'Knowledge from a Past Life', 'Strange Endurance'],
    effects: [adv('saves', 'death saving throws')],
    traitChoice: {
      id: 'strangeEndurance', name: 'Strange Endurance',
      options: [
        { id: 'cold', name: 'Cold', detail: 'Resistance to cold damage', effects: [resist('cold')] },
        { id: 'necrotic', name: 'Necrotic', detail: 'Resistance to necrotic damage', effects: [resist('necrotic')] },
        { id: 'poison', name: 'Poison', detail: 'Resistance to poison damage', effects: [resist('poison')] },
      ],
    },
    uses: [{ trait: 'Knowledge from a Past Life', count: 'pb', recharge: 'long' }],
  }),
  species({
    id: 'lupin', name: 'Lupin', source: RTHW, sizeOptions: EITHER,
    choices: [skillPick('werewolfInstinct', 'Werewolf Instinct', ['perception', 'stealth', 'survival'])],
    traits: ['Darkvision', 'Feral Pounce', 'Howl', 'Werewolf Instinct'],
    effects: [dark(60)],
    uses: [{ trait: 'Howl', count: 'pb', recharge: 'long' }],
  }),
]
