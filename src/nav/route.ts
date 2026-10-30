// Hash routes for the app's screens, so back, forward, refresh and links keep your place. Pure, no React.

/** Every screen App can show. */
export type View =
  | { kind: 'campaigns' } | { kind: 'list' } | { kind: 'build' } | { kind: 'starters' }
  | { kind: 'edit'; id: string } | { kind: 'levelup'; id: string } | { kind: 'sheet'; id: string }
  | { kind: 'levels'; id: string } | { kind: 'plan'; id: string } | { kind: 'print'; id: string }
  /** A player's sheet opened by the DM, view only. */
  | { kind: 'watch'; id: string }
  | { kind: 'combat'; encounterId?: string } | { kind: 'dm'; tab?: 'requests' | 'rolls' } | { kind: 'requests' }
  | { kind: 'party'; partyId?: string; startWith?: 'start' | 'join' }
  | { kind: 'rules' } | { kind: 'homebrew' } | { kind: 'admin' }

const HOME: View = { kind: 'campaigns' }

/** Path names: the Characters screen reads as "heroes" in links. */
const NAME: Partial<Record<View['kind'], string>> = { campaigns: '', list: 'heroes' }
const PLAIN = ['build', 'starters', 'requests', 'rules', 'homebrew', 'admin'] as const
const WITH_ID = ['edit', 'levelup', 'sheet', 'levels', 'plan', 'print', 'watch'] as const

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
  if (name === 'heroes') return { kind: 'list' }
  if ((PLAIN as readonly string[]).includes(name)) return { kind: name as typeof PLAIN[number] }
  if ((WITH_ID as readonly string[]).includes(name)) return arg ? { kind: name as typeof WITH_ID[number], id: arg } : { kind: 'list' }
  if (name === 'combat') return arg ? { kind: 'combat', encounterId: arg } : { kind: 'combat' }
  if (name === 'dm') return arg === 'requests' || arg === 'rolls' ? { kind: 'dm', tab: arg } : { kind: 'dm' }
  if (name === 'party') return arg === 'start' || arg === 'join' ? { kind: 'party', startWith: arg } : arg ? { kind: 'party', partyId: arg } : { kind: 'party' }
  return HOME
}
