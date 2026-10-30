// Spells from the official books beyond the SRD. Names and game numbers only; every description is our own short summary.
import type { Edition, SourceInfo } from '../types.ts'

const NOTE = 'Spells from official Dungeons & Dragons books beyond the SRD. Names and game numbers only: each description is a short summary written for Forge & Familiar, not the book\'s text, so check the book for the full wording. Dungeons & Dragons and the book titles are trademarks of Wizards of the Coast LLC; this app is not affiliated with or endorsed by them.'

export const BOOK_SOURCES: SourceInfo[] = [
  { id: 'books-2014', title: 'Official books (2014 rules)', edition: '2014', license: 'summaries', attribution: NOTE },
  { id: 'books-2024', title: 'Official books (2024 rules)', edition: '2024', license: 'summaries', attribution: NOTE },
]

export const bookSourceFor = (edition: Edition) => (edition === '2024' ? 'books-2024' : 'books-2014')

/** Book codes on book spells (`Spell.book`) and their titles. */
export const BOOK_TITLES: Record<string, string> = {
  PHB: "Player's Handbook (2014)",
  XPHB: "Player's Handbook (2024)",
  XGE: "Xanathar's Guide to Everything",
  TCE: "Tasha's Cauldron of Everything",
  EGW: "Explorer's Guide to Wildemount",
  FTD: "Fizban's Treasury of Dragons",
  SCC: 'Strixhaven: A Curriculum of Chaos',
  AI: 'Acquisitions Incorporated',
  GGR: "Guildmasters' Guide to Ravnica",
  LLK: 'Lost Laboratory of Kwalish',
  IDRotF: 'Icewind Dale: Rime of the Frostmaiden',
  AAG: "Astral Adventurer's Guide",
  BMT: 'The Book of Many Things',
  SatO: 'Sigil and the Outlands',
  'AitFR-AVT': 'Adventures in the Forgotten Realms: A Verdant Tomb',
  FRHoF: 'Forgotten Realms: Heroes of Faerûn',
  EFA: 'Eberron: Forge of the Artificer',
  AU: 'Arcana Unleashed',
}
