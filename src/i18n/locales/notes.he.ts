// Hebrew for the short notes on spells a race, feat, invocation or item grants ("at will", "once per long rest"),
// shown beside the spell on the sheet. The notes are English data text; unknown parts stay English.

const parts: Record<string, string> = {
  'at will': 'כרצונכם',
  'cantrip': 'לחשון',
  'ritual': 'טקס',
  'always known': 'תמיד ידוע',
  'always prepared': 'תמיד מוכן',
  'without a slot': 'בלי משבצת',
  'without a spell slot': 'בלי משבצת לחש',
  'once per long rest': 'פעם במנוחה ארוכה',
  'once per short rest': 'פעם במנוחה קצרה',
  'once per long rest without a slot': 'פעם במנוחה ארוכה, בלי משבצת',
  'once per short rest without a slot': 'פעם במנוחה קצרה, בלי משבצת',
  'once per day': 'פעם ביום',
  'proficiency bonus times per long rest': 'מספר פעמים כבונוס המיומנות בכל מנוחה ארוכה',
  'at will on yourself': 'כרצונכם, על עצמכם',
  'snakes only': 'נחשים בלבד',
  'maximum temp hp': 'נק"פ זמניות מרביות',
  'deals cold damage': 'גורם נזק קור',
  '1 charge': 'מטען אחד',
}

/** "once per long rest, deals cold damage" → each comma part in Hebrew; "3 charges" too. */
export function spellNoteHe(text: string): string {
  return text.split(/,\s*/).map(p => {
    const k = p.trim().toLowerCase()
    if (parts[k]) return parts[k]
    const charges = /^(\d+) charges$/.exec(k)
    if (charges) return `${charges[1]} מטענים`
    const times = /^(\d+|twice|three times)(?: times)? per (long|short) rest$/.exec(k)
    if (times) {
      const n = times[1] === 'twice' ? '2' : times[1] === 'three times' ? '3' : times[1]
      return `${n} פעמים במנוחה ${times[2] === 'long' ? 'ארוכה' : 'קצרה'}`
    }
    return p
  }).join(', ')
}
