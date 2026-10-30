// SRD 5.2 Weapon Mastery properties, by weapon item id. The 2014 rules have none.
export const WEAPON_MASTERY: Record<string, string> = {
  club: 'slow', dagger: 'nick', greatclub: 'push', handaxe: 'vex', javelin: 'slow', 'light-hammer': 'nick', mace: 'sap',
  quarterstaff: 'topple', sickle: 'nick', spear: 'sap', dart: 'vex', 'light-crossbow': 'slow', shortbow: 'vex', sling: 'slow',
  battleaxe: 'topple', flail: 'sap', glaive: 'graze', greataxe: 'cleave', greatsword: 'graze', halberd: 'cleave', lance: 'topple',
  longsword: 'sap', maul: 'topple', morningstar: 'sap', pike: 'push', rapier: 'vex', scimitar: 'nick', shortsword: 'vex',
  trident: 'topple', 'war-pick': 'sap', warhammer: 'push', whip: 'slow', blowgun: 'vex', 'hand-crossbow': 'vex',
  'heavy-crossbow': 'push', longbow: 'slow', musket: 'slow', pistol: 'vex',
}

export const MASTERY_PROPERTIES = ['cleave', 'graze', 'nick', 'push', 'sap', 'slow', 'topple', 'vex'] as const
