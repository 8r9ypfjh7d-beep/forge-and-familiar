// Hash routes for the app's screens, so back, forward, refresh and links keep your place. Pure, no React.

/** Every screen App can show. */
export type View =
  | { kind: 'campaigns' } | { kind: 'list' } | { kind: 'build' } | { kind: 'starters' }
  | { kind: 'edit'; id: string } | { kind: 'levelup'; id: string } | { kind: 'sheet'; id: string }
  | { kind: 'levels'; id: string } | { kind: 'plan'; id: string } | { kind: 'print'; id: string }
  /** A player's sheet opened by the DM, view only. */
  | { kind: 'watch'; id: string }
  | { kind: 'combat'; encounterId?: string } | { kind: 'dm'; tab?: DmView } | { kind: 'requests' }
  | { kind: 'npc'; id: string }
  | { kind: 'party'; partyId?: string; startWith?: 'start' | 'join' }
  | { kind: 'rules' } | { kind: 'homebrew' } | { kind: 'admin' }
  /** The Familiar (AI assistant) full screen. */
  | { kind: 'familiar' }

/** Every DM screen view; each keeps its own address so refresh and Back return to it. */
export const DM_VIEWS = ['party', 'rolls', 'encounters', 'lore', 'sessions', 'maps', 'npcs', 'monsters', 'reference', 'requests'] as const
export type DmView = (typeof DM_VIEWS)[number]

const HOME: View = { kind: 'campaigns' }

/** Path names: the Characters screen is "characters" in links; old "heroes" links still open it. */
const NAME: Partial<Record<View['kind'], string>> = { campaigns: '', list: 'characters' }
const PLAIN = ['build', 'starters', 'requests', 'rules', 'homebrew', 'admin', 'familiar'] as const
const WITH_ID = ['edit', 'levelup', 'sheet', 'levels', 'plan', 'print', 'watch', 'npc'] as const

/** "#/sheet/abc", "#/party/start", "#/" for Home. */
export function viewToHash(v: View): string {
  const seg = (s?: string) => (s ? `/${encodeURIComponent(s)}` : '')
  switch (v.kind) {
    case 'campaigns': case 'list': return `#/${NAME[v.kind]}`
    case 'combat': return `#/combat${seg(v.encounterId)}`
    case 'dm': return `#/dm${seg(v.tab)}`
    case 'party': return `#/party${seg(v.startWith ?? v.partyId)}`
    default: return `#/${v.kind}${'id' in v ? seg(v.id) : ''}`
  }
}

/** The screen for a hash; anything unknown opens Home. */
export function hashToView(hash: string): View {
  const [name = '', raw] = hash.replace(/^#\/?/, '').split('/')
  let arg: string | undefined
  try { arg = raw ? decodeURIComponent(raw) : undefined } catch { return HOME }
  if (name === '') return HOME
  if (name === 'characters' || name === 'heroes') return { kind: 'list' }
  if ((PLAIN as readonly string[]).includes(name)) return { kind: name as typeof PLAIN[number] }
  // An NPC sheet is a DM page: without an id it opens the DM screen, which lists them.
  if (name === 'npc') return arg ? { kind: 'npc', id: arg } : { kind: 'dm' }
  if ((WITH_ID as readonly string[]).includes(name)) return arg ? { kind: name as typeof WITH_ID[number], id: arg } : { kind: 'list' }
  if (name === 'combat') return arg ? { kind: 'combat', encounterId: arg } : { kind: 'combat' }
  if (name === 'dm') return (DM_VIEWS as readonly string[]).includes(arg ?? '') ? { kind: 'dm', tab: arg as DmView } : { kind: 'dm' }
  if (name === 'party') return arg === 'start' || arg === 'join' ? { kind: 'party', startWith: arg } : arg ? { kind: 'party', partyId: arg } : { kind: 'party' }
  return HOME
}
