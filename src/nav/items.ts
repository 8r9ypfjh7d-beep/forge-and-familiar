// Which screens the top bar offers, and which tab lights up for each view. Pure, no React.
import type { MessageKey } from '../i18n'

export type NavKey = 'list' | 'party' | 'combat' | 'requests' | 'dm' | 'homebrew' | 'rules'

export interface NavItem {
  key: NavKey
  /** i18n key for the label. */
  label: MessageKey
  /** Shorter label for the phone bar, where tabs are narrow. */
  short?: MessageKey
}

export interface NavContext {
  /** Runs the DM screen: the DM account, or anyone leading a party on this device. */
  isDm: boolean
  /** Signed in with the DM's activation code: the DM never asks the DM. */
  dmAccount: boolean
}

const ITEM: Record<NavKey, NavItem> = {
  list: { key: 'list', label: 'nav.characters', short: 'nav.charactersShort' },
  party: { key: 'party', label: 'app.party' },
  combat: { key: 'combat', label: 'app.combat' },
  requests: { key: 'requests', label: 'app.requests', short: 'nav.requestsShort' },
  dm: { key: 'dm', label: 'app.dm', short: 'nav.dmShort' },
  homebrew: { key: 'homebrew', label: 'app.homebrew' },
  rules: { key: 'rules', label: 'app.rules' },
}

/** Everyday screens get a tab; reference and bookkeeping screens sit under More. */
export function navItems({ isDm, dmAccount }: NavContext): { main: NavItem[]; more: NavItem[] } {
  const main: NavKey[] = ['list', 'party', 'combat']
  if (isDm) main.push('dm')
  if (!dmAccount) main.push('requests')
  const more: NavKey[] = ['rules', 'homebrew']
  return { main: main.map(k => ITEM[k]), more: more.map(k => ITEM[k]) }
}

/** The tab for a view: anything about one character belongs to Characters. */
export function navKeyFor(viewKind: string): NavKey {
  return viewKind in ITEM ? (viewKind as NavKey) : 'list'
}
