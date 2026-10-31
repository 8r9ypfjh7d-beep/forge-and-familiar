// Which screens the top bar offers, and which tab lights up for each view. Pure, no React.
import type { MessageKey } from '../i18n'

export type NavKey = 'campaigns' | 'list' | 'party' | 'combat' | 'requests' | 'dm' | 'familiar' | 'homebrew' | 'rules' | 'admin'

export interface NavItem {
  key: NavKey
  /** i18n key for the label. */
  label: MessageKey
  /** Shorter label for the phone bar, where tabs are narrow. */
  short?: MessageKey
}

export interface NavContext {
  /** May open the DM pages (DM screen, combat tracker): the DM of the party in play, or the admin. */
  isDm: boolean
  /** DM of the party picked on entering the app: gets the DM pages and Party as tabs. */
  partyDm: boolean
  /** The admin account (Ziv): Admin under More; opens the DM pages from the admin page even as a player. */
  admin?: boolean
}

const ITEM: Record<NavKey, NavItem> = {
  campaigns: { key: 'campaigns', label: 'nav.campaigns', short: 'nav.campaignsShort' },
  list: { key: 'list', label: 'nav.characters', short: 'nav.charactersShort' },
  party: { key: 'party', label: 'app.party' },
  combat: { key: 'combat', label: 'app.combat', short: 'nav.combatShort' },
  requests: { key: 'requests', label: 'app.requests', short: 'nav.requestsShort' },
  dm: { key: 'dm', label: 'app.dm', short: 'nav.dmShort' },
  homebrew: { key: 'homebrew', label: 'app.homebrew' },
  familiar: { key: 'familiar', label: 'familiar.nav' },
  rules: { key: 'rules', label: 'app.rules' },
  admin: { key: 'admin', label: 'app.admin' },
}

/** Screens only the DM and the admin may open; `watch` is a player's sheet opened by the DM, `npc` an NPC's sheet (src/npc): players never see it. */
const DM_ONLY: readonly string[] = ['dm', 'combat', 'watch', 'npc']

/** Everyday screens get a tab; reference and bookkeeping screens sit under More.
 *  Everyone starts with Home (campaigns) and Characters, since a DM often plays in another game too.
 *  Players then get Campaign and Ask the DM. The campaign's DM gets DM screen and Campaign, with the
 *  initiative tracker under More (the DM screen's Run button opens it too). The admin adds Admin. */
export function navItems({ partyDm, admin }: NavContext): { main: NavItem[]; more: NavItem[] } {
  const main: NavKey[] = ['campaigns', 'list', ...(partyDm ? ['dm', 'party'] as const : ['party', 'requests'] as const)]
  const more: NavKey[] = [...(partyDm ? ['combat'] as const : []), 'familiar', 'rules', 'homebrew']
  if (admin) more.unshift('admin')
  return { main: main.map(k => ITEM[k]), more: more.map(k => ITEM[k]) }
}

/** Whether this account may open a screen; the DM pages and the admin page are guarded, not just hidden. */
export function canOpen(viewKind: string, { isDm, admin }: NavContext): boolean {
  if (DM_ONLY.includes(viewKind)) return isDm
  if (viewKind === 'admin') return !!admin
  return true
}

/** The tab for a view: anything about one character belongs to Characters; an NPC's sheet to the DM screen. */
export function navKeyFor(viewKind: string): NavKey {
  if (viewKind === 'npc') return 'dm'
  return viewKind in ITEM ? (viewKind as NavKey) : 'list'
}
