// Random fantasy names, built from syllables so the same name rarely comes up twice.
// The syllables are our own, written for this app (no book name lists).

export type Rng = () => number

export const pick = <T,>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length) % list.length]

interface NameStyle {
  starts: string[]
  ends: string[]
  /** Family names, clan names or epithets. Empty means a single name. */
  family: string[]
}

const HUMAN: NameStyle = {
  starts: ['Al', 'Bran', 'Cor', 'Da', 'El', 'Gar', 'Hal', 'Is', 'Jor', 'Ka', 'Lio', 'Mar', 'Nes', 'Or', 'Per', 'Ro', 'Sa', 'Tam', 'Vel', 'Wyn'],
  ends: ['a', 'ric', 'en', 'wyn', 'ia', 'old', 'ra', 'mund', 'elle', 'an', 'is', 'ett', 'o', 'iel'],
  family: ['Ashford', 'Blackwood', 'Brightwater', 'Coldbrook', 'Dunmore', 'Fairwind', 'Greymantle', 'Hartley', 'Ironside', 'Marsh', 'Oakhart', 'Redfern', 'Stonebridge', 'Thorne', 'Wexley'],
}

const STYLES: Record<string, NameStyle> = {
  human: HUMAN,
  dwarf: {
    starts: ['Bar', 'Dor', 'Grun', 'Har', 'Kil', 'Mor', 'Thor', 'Brot', 'Dag', 'Ul', 'Vond', 'Ris', 'Gund', 'Ed'],
    ends: ['in', 'ak', 'grim', 'na', 'rik', 'dra', 'dur', 'ild', 'olf', 'ra', 'unn', 'ek'],
    family: ['Anvilborn', 'Coppervein', 'Deepdelver', 'Flintbeard', 'Granitehand', 'Hammerfall', 'Ironfoot', 'Stoneshield', 'Emberforge'],
  },
  elf: {
    starts: ['Ae', 'Cael', 'Ela', 'Fae', 'Ili', 'Lae', 'Mir', 'Nai', 'Quel', 'Sha', 'Thal', 'Va', 'Yse', 'Ery'],
    ends: ['rion', 'wen', 'thas', 'lia', 'ndil', 'riel', 'sar', 'thiel', 'vyn', 'lor', 'nara', 'ith'],
    family: ['Moonwhisper', 'Silverleaf', 'Starbloom', 'Dawnsong', 'Mistwillow', 'Nightbreeze', 'Sunpetal', 'Wintervale'],
  },
  halfling: {
    starts: ['Bil', 'Cora', 'Fen', 'Lid', 'Mer', 'Pip', 'Ros', 'Tob', 'Wil', 'Dim', 'Hol', 'Nel'],
    ends: ['bo', 'ry', 'da', 'wick', 'ie', 'lo', 'sy', 'mo', 'ett', 'kin'],
    family: ['Applebrook', 'Bramblefoot', 'Goodbarrel', 'Hilltopple', 'Quickstep', 'Tealeaf', 'Underbough', 'Warmhearth'],
  },
  gnome: {
    starts: ['Bim', 'Fiz', 'Gim', 'Nack', 'Orl', 'Pock', 'Quil', 'Tink', 'Wiz', 'Zan', 'Ell', 'Nyx'],
    ends: ['ble', 'wick', 'ix', 'ana', 'nock', 'ella', 'by', 'ret', 'o', 'izz'],
    family: ['Cogspinner', 'Fizzlebang', 'Gearwhistle', 'Sparkfuse', 'Tumbleclock', 'Widgetwright', 'Brasskettle'],
  },
  dragonborn: {
    starts: ['Ar', 'Bal', 'Drak', 'Ghe', 'Kri', 'Med', 'Nal', 'Rho', 'Sor', 'Tor', 'Vrae', 'Zar'],
    ends: ['ash', 'ex', 'inn', 'ora', 'than', 'vys', 'ux', 'aar', 'esh', 'ith'],
    family: ['Clan Kethrax', 'Clan Ophinar', 'Clan Vyrdesh', 'Clan Turmaak', 'Clan Zorrith', 'Clan Ilvaar'],
  },
  'half-elf': { starts: [...HUMAN.starts, 'Ela', 'Lae', 'Thal'], ends: [...HUMAN.ends, 'wen', 'riel'], family: [...HUMAN.family, 'Silverleaf', 'Dawnsong'] },
  'half-orc': {
    starts: ['Dur', 'Grok', 'Hru', 'Kar', 'Mog', 'Rag', 'Shu', 'Thok', 'Ush', 'Vol', 'Yev', 'Zug'],
    ends: ['ak', 'ga', 'esh', 'mar', 'ra', 'tha', 'uk', 'ka', 'ok', 'na'],
    family: ['the Unbowed', 'Tuskbreaker', 'of the Red Hill', 'Ironjaw', 'Stormhowl', 'the Patient'],
  },
  tiefling: {
    starts: ['Ak', 'Bel', 'Cri', 'Dam', 'Ka', 'Le', 'Mor', 'Nem', 'Ory', 'Ska', 'Vel', 'Zeph'],
    ends: ['ia', 'akos', 'eth', 'ira', 'ius', 'mon', 'riel', 'thea', 'yx', 'is'],
    family: ['Ashen', 'Cinder', 'Hollow', 'Lament', 'Quiet', 'Reverie', 'Torment', 'Vigil', 'Whisper'],
  },
  goliath: {
    starts: ['Au', 'Ga', 'Ke', 'Lo', 'Ma', 'Pa', 'Tha', 'Va', 'Ilik', 'Eglath'],
    ends: ['kan', 'thi', 'lo', 'gath', 'rak', 'vi', 'nu', 'ak'],
    family: ['Peakrunner', 'Skywatcher', 'Stoneclimber', 'Cloudstrider', 'Frostspeaker', 'Highcrag'],
  },
}
STYLES.orc = STYLES['half-orc']

/** A random name for a race or species id. Unknown and homebrew races get a human-style name. */
export function randomName(raceId: string, rng: Rng = Math.random): string {
  const style = STYLES[raceId] ?? HUMAN
  const first = pick(style.starts, rng) + pick(style.ends, rng)
  return style.family.length ? `${first} ${pick(style.family, rng)}` : first
}
