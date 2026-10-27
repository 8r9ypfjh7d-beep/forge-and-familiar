// Which screens the top bar offers, and which tab lights up for each view. Pure, no React.
import type { MessageKey } from '../i18n'

export type NavKey = 'list' | 'party' | 'combat' | 'requests' | 'dm' | 'homebrew' | 'rules' | 'admin'

export interface NavItem {
  key: NavKey
  /** i18n key for the label. */
  label: MessageKey
  /** Shorter label for the phone bar, where tabs are narrow. */
  short?: MessageKey
}

export interface NavContext {
  /** May open the DM pages (DM screen, combat tracker): the DM account or the admin. */
  isDm: boolean
  /** Signed in with the DM's activation code: the DM gets only the DM pages and Party. */
  dmAccount: boolean
  /** The admin account (Ziv): everything a player and the DM see, plus the admin page. */
  admin?: boolean
}

const ITEM: Record<NavKey, NavItem> = {
  list: { key: 'list', label: 'nav.characters', short: 'nav.charactersShort' },
  party: { key: 'party', label: 'app.party' },
  combat: { key: 'combat', label: 'app.combat' },
  requests: { key: 'requests', label: 'app.requests', short: 'nav.requestsShort' },
  dm: { key: 'dm', label: 'app.dm', short: 'nav.dmShort' },
  homebrew: { key: 'homebrew', label: 'app.homebrew' },
  rules: { key: 'rules', label: 'app.rules' },
  admin: { key: 'admin', label: 'app.admin' },
}

/** Screens only the DM and the admin may open. */
const DM_ONLY: readonly string[] = ['dm', 'combat']

/** Everyday screens get a tab; reference and bookkeeping screens sit under More.
 *  Players: Characters, Party, Ask the DM. The DM: DM screen, Combat, Party. The admin: all of them. */
export function navItems({ isDm, dmAccount, admin }: NavContext): { main: NavItem[]; more: NavItem[] } {
  const main: NavKey[] = dmAccount && !admin ? ['dm', 'combat', 'party'] : isDm ? ['list', 'party', 'combat', 'dm', 'requests'] : ['list', 'party', 'requests']
  const more: NavKey[] = ['rules', 'homebrew']
  if (admin) more.unshift('admin')
  return { main: main.map(k => ITEM[k]), more: more.map(k => ITEM[k]) }
}

/** Whether this account may open a screen; the DM pages and the admin page are guarded, not just hidden. */
export function canOpen(viewKind: string, { isDm, admin }: NavContext): boolean {
  if (DM_ONLY.includes(viewKind)) return isDm
  if (viewKind === 'admin') return !!admin
  return true
}

/** The tab for a view: anything about one character belongs to Characters. */
export function navKeyFor(viewKind: string): NavKey {
  return viewKind in ITEM ? (viewKind as NavKey) : 'list'
}
