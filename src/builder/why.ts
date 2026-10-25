// Plain-language "why?" explanations for new players, shown by <Why>.
// Kept as data so wording can be edited (or translated) in one place.

export interface WhyTip {
  title: string
  text: string
}

export const WHY = {
  // Step overviews, shown next to each step's blurb.
  'step:race': {
    title: 'Why race matters',
    text: 'Your race is your character\'s ancestry. It gives a small boost to some ability scores, sets how fast you move, and adds traits like seeing in the dark. It nudges what you are good at but never locks you out of a class.',
  },
  'step:class': {
    title: 'Why class matters',
    text: 'Your class is the biggest choice: it decides how you fight, whether you cast spells, how many hit points you get (the bigger your hit die, the sturdier you are), and the special features you gain as you level up.',
  },
  'step:abilities': {
    title: 'Why abilities matter',
    text: 'Six scores describe your body and mind. Almost every roll in the game adds one of their modifiers, so a high score in your class\'s main ability makes you better at your job.',
  },
  'step:skills': {
    title: 'Why background and skills matter',
    text: 'Your background is your life before adventuring. Skills are what you trained in: when you try something tricky, like sneaking or persuading, you add a bonus if you are proficient.',
  },
  'step:equipment': {
    title: 'Why gear matters',
    text: 'Armor sets how hard you are to hit (AC) and weapons set your attacks. Your class gives you a sensible starting kit, so you can begin playing right away.',
  },
  'step:details': {
    title: 'Why details matter',
    text: 'Nothing here changes your numbers. A name, alignment and portrait help you and your group picture the character at the table.',
  },

  // Race step
  subrace: {
    title: 'Subrace',
    text: 'Some races split into subraces. Your subrace adds a second ability boost and one or two extra traits on top of the main race.',
  },
  traits: {
    title: 'Traits',
    text: 'Traits are always-on abilities from your race, like darkvision (seeing in dim light) or resistance to a damage type. The sheet applies the ones that change numbers for you.',
  },
  languages: {
    title: 'Languages',
    text: 'Languages you can speak, read and write. They matter when you meet creatures or find writing in the world; they never change your stats.',
  },

  // Class step
  level: {
    title: 'Starting level',
    text: 'Most campaigns start at level 1, where everything is easiest to learn. Only pick a higher level if your Dungeon Master asks you to.',
  },
  savingThrows: {
    title: 'Saving throws',
    text: 'When something tries to harm you and you resist it, like dodging a fireball or shrugging off poison, you roll a save with one ability. Your class makes you better (proficient) at two of them.',
  },
  proficiencies: {
    title: 'Armor and weapons',
    text: 'These are what your class is trained to use. With a proficient weapon you add your proficiency bonus to hit. Wearing armor you are not trained in causes penalties, so stick to the list.',
  },
  features: {
    title: 'Class features',
    text: 'Special abilities your class unlocks as you level up, like a Barbarian\'s Rage or a Rogue\'s Sneak Attack. Ones with limited uses show up as trackers on your sheet.',
  },

  // Abilities step
  'method:standard': {
    title: 'Standard array',
    text: 'Assign the fixed scores 15, 14, 13, 12, 10 and 8 to your six abilities. It is the quickest fair option and a great choice for a first character.',
  },
  'method:pointBuy': {
    title: 'Point buy',
    text: 'Spend 27 points to raise scores from 8 up to 15. Higher scores cost more points, so it lets you fine-tune while staying balanced with the rest of the party.',
  },
  'method:manual': {
    title: 'Manual or rolled',
    text: 'Type in scores you rolled at the table (traditionally 4d6, dropping the lowest die) or ones your DM gave you. Check with your DM before using this.',
  },
  suggest: {
    title: 'Suggest for my class',
    text: 'Puts your highest score in your class\'s main ability, then Constitution for hit points, then Dexterity for armor class and initiative. A safe start you can still tweak.',
  },
  racial: {
    title: 'Racial bonus',
    text: 'The boost from your race and subrace. It is added to your base score automatically, so you only choose the base.',
  },
  modifier: {
    title: 'Modifier',
    text: 'The number you actually add to rolls: (score - 10) / 2, rounded down. A 16 gives +3, a 10 gives +0 and an 8 gives -1.',
  },
  freeBonus: {
    title: 'Free +1s',
    text: 'Your race lets you add +1 to abilities of your choice. Put them into abilities your class uses, or round odd scores up to even ones, since modifiers only rise on even numbers.',
  },

  // Background & skills step
  background: {
    title: 'Background',
    text: 'Who you were before adventuring. It gives you two skill proficiencies, a story feature your DM can use, and sometimes languages or tools.',
  },
  skills: {
    title: 'Skill proficiencies',
    text: 'Proficient skills add your proficiency bonus (+2 at level 1) when you roll for them. Pick skills that use your best abilities and fit how you want to play. Skills marked "granted" come free from your race or background.',
  },

  // Equipment step
  kit: {
    title: 'Starting kit',
    text: 'Your armor sets your Armor Class, the number enemies must roll to hit you. Your weapons set your attack bonus (ability modifier plus proficiency) and damage. Gold buys extra gear between adventures.',
  },

  // Details step
  alignment: {
    title: 'Alignment',
    text: 'A rough guide to your character\'s outlook: lawful or chaotic, good or evil. It helps you roleplay and never changes your numbers. Neutral is a fine default if you are unsure.',
  },
} satisfies Record<string, WhyTip>

export type WhyId = keyof typeof WHY

/** Why a new player might pick each SRD race. */
export const RACE_WHY: Record<string, string> = {
  dwarf: 'Tough and steady: extra Constitution, resistance to poison and darkvision. Great for Clerics and Fighters.',
  elf: 'Quick and perceptive: extra Dexterity, keen senses and immunity to magical sleep. Great for Rogues, Rangers and (as a High Elf) Wizards.',
  halfling: 'Small and lucky: you reroll natural 1s and slip past larger creatures. Great for Rogues and Bards.',
  human: '+1 to every ability, so humans are good at anything. The simplest pick if you are undecided.',
  dragonborn: 'Strong and imposing, with a breath weapon and resistance to one damage type. Great for Paladins and Sorcerers.',
  gnome: 'Clever and hard to fool with magic: advantage on Intelligence, Wisdom and Charisma saves against spells. Great for Wizards.',
  'half-elf': 'Charming and flexible: +2 Charisma, two extra +1s and two extra skills. Great for Bards, Sorcerers and Warlocks.',
  'half-orc': 'Fierce and hard to kill: once per long rest you drop to 1 HP instead of 0, and your critical hits hit harder. Great for Barbarians and Fighters.',
  tiefling: 'Infernal heritage: extra Charisma, fire resistance and a few innate spells. Great for Warlocks and Sorcerers.',
}

/** Why a new player might pick each SRD class. */
export const CLASS_WHY: Record<string, string> = {
  barbarian: 'Pick this if you want to hit hard and soak up damage. Simple to play: rage, then swing.',
  bard: 'Pick this if you like talking your way through problems and helping friends. Spells, skills and inspiration.',
  cleric: 'Pick this if you want to heal and protect the party while still holding your own in a fight.',
  druid: 'Pick this if you like nature magic and turning into animals. Flexible, with lots of spell options.',
  fighter: 'Pick this for your first character if you are unsure. Sturdy, strong with any weapon, and easy to learn.',
  monk: 'Pick this if you want to be fast and fight unarmed with martial arts and ki powers.',
  paladin: 'Pick this if you want a holy knight: heavy armor, healing hands and huge smites.',
  ranger: 'Pick this if you like archery, tracking and the wilderness, with a little nature magic.',
  rogue: 'Pick this if you want to be sneaky and skillful. Sneak Attack deals big damage and you get the most skills.',
  sorcerer: 'Pick this if you want raw magical power you were born with, bending spells with sorcery points.',
  warlock: 'Pick this if you like a dark bargain: few spell slots that come back on a short rest, and a strong Eldritch Blast.',
  wizard: 'Pick this if you want the biggest spell list and like planning. Fragile, so stay behind your friends.',
}
