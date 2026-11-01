// Compact builder layout: every step keeps all its information, but long lists start small.
// - `Fold`: a section that opens and closes, with a status (picked count, chosen name) on its title line.
// - `ChoicePicker`: one pick from many (race, class, subclass). Once picked it shrinks to the chosen tile and
//   a Change button; while choosing it has a search field and one fold per book, the book of the pick open.
// - `useFilter`: a search field for long chip lists (invocations, maneuvers, metamagic).
// Explanation lists (`ExplainList` in Why.tsx) show one line per entry and open on tap.
import { useState, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { SearchField } from '../rulesqa/SearchField'

/** Lower case, no accents: "Faerûn" matches "faerun". */
export const foldText = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** True when every word of `query` is in one of `texts`. */
export function matches(query: string, texts: (string | undefined)[]): boolean {
  const words = foldText(query.trim()).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = foldText(texts.filter(Boolean).join(' '))
  return words.every(w => hay.includes(w))
}

/** A section that opens and closes. `status` sits on the title line, so a closed fold still says what is in it. */
export function Fold({ title, status, why, defaultOpen = false, className = '', children }: {
  title: ReactNode
  status?: ReactNode
  why?: ReactNode
  defaultOpen?: boolean
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details className={`fold ${className}`} open={open} onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <span className="fold-title">{title}</span>
        {status != null && status !== '' && status !== false && <span className="fold-status">{status}</span>}
        {why}
      </summary>
      {open && <div className="fold-body">{children}</div>}
    </details>
  )
}

export interface PickItem {
  id: string
  /** Shown name (translated). */
  name: string
  /** Book or group label; items without one go first, under `firstGroup`. */
  group?: string
  /** Extra lines on a card tile (bonuses, size, hit die). */
  meta?: ReactNode
  /** More text to search in: the English name, the book. */
  search?: string[]
}

// Book folds follow this order (core books first); other books keep their data order after these, homebrew last.
const BOOK_ORDER = [
  "Player's Handbook (2024)", "Player's Handbook", "Xanathar's Guide to Everything", "Tasha's Cauldron of Everything",
  "Dungeon Master's Guide", "Sword Coast Adventurer's Guide",
]

/** Sort key for a group: no group (SRD) first, then `BOOK_ORDER` (a "Player's Handbook · Legacy" label counts as its book), then the rest, homebrew last. */
export function bookRank(group: string, homebrew = false): number {
  if (homebrew) return 1000
  if (!group) return 0
  const i = BOOK_ORDER.findIndex(b => group === b || group.startsWith(`${b} `))
  return i < 0 ? 500 : i + 1
}

/**
 * One pick from many. `variant` 'card' shows tiles (race, class), 'chip' shows capsules (subclass).
 * `extra` adds a last tile/chip outside the groups (Custom subclass). `after` renders under the chosen tile
 * and is hidden while browsing, so the old pick's details don't stretch the open list.
 */
export function ChoicePicker({ items, value, onPick, variant = 'card', firstGroup, label, extra, extraOn, after, searchAt = 14 }: {
  items: PickItem[]
  value?: string
  onPick: (id: string) => void
  variant?: 'card' | 'chip'
  /** Label for items with no group (the SRD ones). */
  firstGroup?: string
  label: string
  extra?: { name: string; onPick: () => void }
  /** The extra option is the current pick. */
  extraOn?: boolean
  /** Details of the current pick (explanation, its own picks); shown only while not browsing. */
  after?: ReactNode
  /** Show the search field from this many items. */
  searchAt?: number
}) {
  const { t } = useI18n()
  const picked = items.find(i => i.id === value)
  const [browsing, setBrowsing] = useState(false)
  const [query, setQuery] = useState('')
  const pick = (id: string) => { setBrowsing(false); setQuery(''); onPick(id) }

  const tile = (it: PickItem, on: boolean, onClick: () => void) => (variant === 'card'
    ? (
      <button key={it.id} type="button" className={`choice ${on ? 'selected' : ''}`} aria-pressed={on} onClick={onClick}>
        <strong>{it.name}</strong>
        {it.meta}
      </button>
    )
    : <button key={it.id} type="button" className={`glass-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>{it.name}</button>)

  if ((picked || extraOn) && !browsing) {
    return (
      <>
        <div className={`picked-row ${variant}`}>
          {picked ? tile(picked, true, () => setBrowsing(true)) : <span className="glass-chip on">{extra?.name}</span>}
          <button type="button" className="glass-btn small" aria-label={t('builder.compact.changeLabel', { name: label })} onClick={() => setBrowsing(true)}>
            {t('builder.compact.change')}
          </button>
        </div>
        {after}
      </>
    )
  }

  const groups = new Map<string, PickItem[]>()
  for (const it of items) {
    const g = it.group ?? ''
    groups.set(g, [...(groups.get(g) ?? []), it])
  }
  const rank = ([g, its]: [string, PickItem[]]) => bookRank(g, its.every(it => it.id.startsWith('hb:')))
  const list = (its: PickItem[]) => (
    <div className={variant === 'card' ? 'card-grid compact-grid' : 'row'}>
      {its.map(it => tile(it, it.id === value, () => pick(it.id)))}
    </div>
  )
  const found = query ? items.filter(it => matches(query, [it.name, it.group, ...(it.search ?? [])])) : []
  return (
    <div className="choice-picker" role="group" aria-label={label}>
      {(items.length >= searchAt || (picked || extraOn)) && (
        <div className="picker-bar">
          {items.length >= searchAt && (
            <SearchField value={query} onChange={e => setQuery(e.target.value)} placeholder={t('builder.compact.search', { name: label })} aria-label={t('builder.compact.search', { name: label })} />
          )}
          {(picked || extraOn) && <button type="button" className="glass-btn small" onClick={() => { setBrowsing(false); setQuery('') }}>{t('builder.compact.keep')}</button>}
        </div>
      )}
      {query ? (
        found.length ? (
          <div className={variant === 'card' ? 'card-grid compact-grid' : 'row'}>
            {found.map(it => tile({ ...it, meta: <>{it.meta}{it.group && variant === 'card' && <span className="muted small">{it.group}</span>}</> }, it.id === value, () => pick(it.id)))}
          </div>
        ) : <p className="muted small">{t('builder.compact.noMatch')}</p>
      ) : groups.size <= 1 ? list(items) : (() => {
        const all = [...groups].sort((a, b) => rank(a) - rank(b))
        const fold = ([g, its]: [string, PickItem[]], open: boolean) => (
          <Fold key={g || '-'} className="picker-group" title={g || firstGroup || t('builder.compact.srd')} status={its.length}
            defaultOpen={open || its.some(it => it.id === value)}>
            {list(its)}
          </Fold>
        )
        // Many books: the first group, then one "More books" fold holding the rest, so the page starts short.
        if (all.length <= 4) return all.map((g, i) => fold(g, i === 0 || g[1].every(it => it.id.startsWith('hb:'))))
        // The group's own homebrew stays out of the fold, open, so it isn't buried among the books.
        const isHomebrew = (g: [string, PickItem[]]) => g[1].every(it => it.id.startsWith('hb:'))
        const homebrew = all.slice(1).filter(isHomebrew)
        const rest = all.slice(1).filter(g => !isHomebrew(g))
        // A first group of one or two (the 2014 SRD has only Acolyte) reads like "there is nothing else":
        // open the next book too, so a new player sees real choices.
        const thin = all[0][1].length < 3
        return (
          <>
            {fold(all[0], true)}
            {homebrew.map(g => fold(g, true))}
            <Fold className="picker-group" title={t('builder.compact.moreBooks', { count: rest.length })} status={rest.reduce((n, [, its]) => n + its.length, 0)}
              defaultOpen={thin || rest.some(([, its]) => its.some(it => it.id === value))}>
              <div className="picker-groups">{rest.map((g, i) => fold(g, thin && i === 0))}</div>
            </Fold>
          </>
        )
      })()}
      {extra && !query && (
        <div className="row picker-extra">
          <button type="button" className={`glass-chip ${extraOn ? 'on' : ''}`} aria-pressed={!!extraOn} onClick={() => { setBrowsing(false); extra.onPick() }}>{extra.name}</button>
        </div>
      )}
    </div>
  )
}

/** A search field for a long chip list; returns the field (or nothing for short lists) and the filter. */
export function useFilter(count: number, label: string, from = 16) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const field = count >= from
    ? <SearchField value={query} onChange={e => setQuery(e.target.value)} placeholder={t('builder.compact.search', { name: label })} aria-label={t('builder.compact.search', { name: label })} />
    : null
  return { field, keep: (texts: (string | undefined)[]) => matches(query, texts), query }
}
