// SRD 5.1 magic items whose charges come back "daily at dawn".
// Used as presets for the live sheet's dawn trackers; `regain` is dice notation, absent means all charges.

export interface DawnItem {
  id: string
  name: string
  charges: number
  regain?: string
}

export const DAWN_ITEMS: DawnItem[] = [
  { id: 'wand-of-magic-missiles', name: 'Wand of Magic Missiles', charges: 7, regain: '1d6+1' },
  { id: 'wand-of-fireballs', name: 'Wand of Fireballs', charges: 7, regain: '1d6+1' },
  { id: 'wand-of-lightning-bolts', name: 'Wand of Lightning Bolts', charges: 7, regain: '1d6+1' },
  { id: 'wand-of-web', name: 'Wand of Web', charges: 7, regain: '1d6+1' },
  { id: 'wand-of-binding', name: 'Wand of Binding', charges: 7, regain: '1d6+1' },
  { id: 'wand-of-fear', name: 'Wand of Fear', charges: 7, regain: '1d6+1' },
  { id: 'wand-of-paralysis', name: 'Wand of Paralysis', charges: 7, regain: '1d6+1' },
  { id: 'wand-of-polymorph', name: 'Wand of Polymorph', charges: 7, regain: '1d6+1' },
  { id: 'wand-of-enemy-detection', name: 'Wand of Enemy Detection', charges: 7, regain: '1d6+1' },
  { id: 'wand-of-wonder', name: 'Wand of Wonder', charges: 7, regain: '1d6+1' },
  { id: 'wand-of-magic-detection', name: 'Wand of Magic Detection', charges: 3, regain: '1d3' },
  { id: 'wand-of-secrets', name: 'Wand of Secrets', charges: 3, regain: '1d3' },
  { id: 'staff-of-healing', name: 'Staff of Healing', charges: 10, regain: '1d6+4' },
  { id: 'staff-of-fire', name: 'Staff of Fire', charges: 10, regain: '1d6+4' },
  { id: 'staff-of-frost', name: 'Staff of Frost', charges: 10, regain: '1d6+4' },
  { id: 'staff-of-the-woodlands', name: 'Staff of the Woodlands', charges: 10, regain: '1d6+4' },
  { id: 'staff-of-swarming-insects', name: 'Staff of Swarming Insects', charges: 10, regain: '1d6+4' },
  { id: 'staff-of-striking', name: 'Staff of Striking', charges: 10, regain: '1d6+4' },
  { id: 'staff-of-charming', name: 'Staff of Charming', charges: 10, regain: '1d8+2' },
  { id: 'staff-of-power', name: 'Staff of Power', charges: 20, regain: '2d8+4' },
  { id: 'staff-of-the-magi', name: 'Staff of the Magi', charges: 50, regain: '4d6+2' },
  { id: 'ring-of-the-ram', name: 'Ring of the Ram', charges: 3, regain: '1d3' },
  { id: 'ring-of-animal-influence', name: 'Ring of Animal Influence', charges: 3, regain: '1d3' },
  { id: 'medallion-of-thoughts', name: 'Medallion of Thoughts', charges: 3, regain: '1d3' },
  { id: 'mace-of-terror', name: 'Mace of Terror', charges: 3, regain: '1d3' },
  { id: 'trident-of-fish-command', name: 'Trident of Fish Command', charges: 3, regain: '1d3' },
  { id: 'pipes-of-haunting', name: 'Pipes of Haunting', charges: 3, regain: '1d3' },
  { id: 'cube-of-force', name: 'Cube of Force', charges: 36, regain: '1d20' },
  { id: 'cape-of-the-mountebank', name: 'Cape of the Mountebank', charges: 1 },
  { id: 'javelin-of-lightning', name: 'Javelin of Lightning', charges: 1 },
]
