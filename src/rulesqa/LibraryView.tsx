// Library results on the Rules page: one row per spell, item, monster, condition or feat; tapping a row opens it.
import { useEffect, useMemo, useState } from 'react'
import { BOOK_TITLES, loadKind, loadMonsters, sourceById, type Edition, type Equipment, type MagicItem } from '../content'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/locales/en'
import { StatBlock } from '../monsters/StatBlock'
import { SpellDetail } from '../spellbook/SpellDetail'
import { spellSourcesFor } from '../spellbook/access'
import { Markdown } from './Markdown'
import { hitKey, type AliasOf, type LibHit, type LibKind, type Library } from './library'

const EDITION_KEY = 'ff.library.edition.v1'
const readEdition = (): Edition => { try { return localStorage.getItem(EDITION_KEY) === '2014' ? '2014' : '2024' } catch { return '2024' } }

/** The rules edition the library shows, remembered on the device. */
export function useLibraryEdition(): [Edition, (e: Edition) => void] {
  const [edition, setEdition] = useState(readEdition)
  return [edition, e => { setEdition(e); try { localStorage.setItem(EDITION_KEY, e) } catch { /* private mode */ } }]
}

const srdFor = (e: Edition) => (e === '2024' ? 'srd-5.2' : 'srd-5.1')

/** Loads one edition's library once per edition; monsters only for a DM. */
export function useLibrary(edition: Edition, monsters: boolean): Library | 'error' | null {
  const [lib, setLib] = useState<{ key: string; data: Library | 'error' } | null>(null)
  const key = `${edition}:${monsters}`
  useEffect(() => {
    let live = true
    const own = { sources: [srdFor(edition)] }
    Promise.all([
      loadKind('spells', { sources: spellSourcesFor(edition) }),
      loadKind('equipment', own), loadKind('magic-items', own),
      monsters ? loadMonsters(edition) : Promise.resolve([]),
      loadKind('conditions', own), loadKind('feats', { edition }),
    ]).then(([spells, equipment, magic, mons, conditions, feats]) => {
      if (live) setLib({ key, data: { spells, items: [...equipment, ...magic], monsters: mons, conditions, feats } })
    }).catch(() => live && setLib({ key, data: 'error' }))
    return () => { live = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return lib?.key === key ? lib.data : null
}

/** A hit's name in the current language; the search also matches it. */
export function useAlias(): AliasOf {
  const { locale, spellName, item, monsterName, term } = useI18n()
  return useMemo(() => (h: LibHit) => {
    if (locale === 'en') return h.entry.name
    switch (h.kind) {
      case 'spells': return spellName(h.entry.name)
      case 'items': return item(h.entry.id, h.entry.name)
      case 'monsters': return monsterName(h.entry)
      case 'conditions': return term('condition', h.entry.id, h.entry.name)
      case 'feats': return term('feat', h.entry.id, h.entry.name)
    }
  }, [locale, spellName, item, monsterName, term])
}

export const KIND_LABEL: Record<LibKind, MessageKey> = {
  spells: 'library.kind.spells', items: 'library.kind.items', monsters: 'library.kind.monsters',
  conditions: 'library.kind.conditions', feats: 'library.kind.feats',
}

/** The list of hits; `showKind` adds the kind badge (the All search). `open` is the hit opened from outside. */
export function LibraryList({ hits, alias, showKind, openKey }: { hits: LibHit[]; alias: AliasOf; showKind?: boolean; openKey?: string }) {
  const [open, setOpen] = useState<string | null>(openKey ?? null)
  useEffect(() => { if (openKey) setOpen(openKey) }, [openKey])
  return (
    <ul className="glass glass-list lib-list">
      {hits.map(h => {
        const k = hitKey(h)
        return <LibraryRow key={k} hit={h} alias={alias} showKind={showKind} open={open === k} onToggle={() => setOpen(o => (o === k ? null : k))} />
      })}
    </ul>
  )
}

function LibraryRow({ hit: h, alias, showKind, open, onToggle }: { hit: LibHit; alias: AliasOf; showKind?: boolean; open: boolean; onToggle: () => void }) {
  const { t } = useI18n()
  const name = alias(h)
  return (
    <li className={open ? 'open' : undefined}>
      <button type="button" className="related-row lib-row" aria-expanded={open} onClick={onToggle}>
        <span className="lib-name">
          <bdi>{name}</bdi>
          {name !== h.entry.name && <small className="lib-en" lang="en" dir="ltr">{h.entry.name}</small>}
        </span>
        <small className="lib-meta">{showKind ? t(KIND_LABEL[h.kind]) : <Meta hit={h} />}</small>
        <svg className="chevron" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d={open ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} /></svg>
      </button>
      {open && <div className="lib-detail"><Detail hit={h} /></div>}
    </li>
  )
}

/** A short line after the name: spell level, item kind, monster CR, feat category. */
function Meta({ hit: h }: { hit: LibHit }) {
  const { t } = useI18n()
  switch (h.kind) {
    case 'spells': return <>{h.entry.level === 0 ? t('spells.cantrip') : t('library.spellLevel', { n: h.entry.level })}</>
    case 'items': return <>{'rarity' in h.entry ? t(`library.rarity.${h.entry.rarity.replace(' ', '-')}` as MessageKey) : null}</>
    case 'monsters': return <bdi>CR {crText(h.entry.challengeRating)}</bdi>
    default: return null
  }
}

const crText = (cr: number) => (cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : String(cr))

function Detail({ hit: h }: { hit: LibHit }) {
  switch (h.kind) {
    case 'spells': return <SpellDetail spell={h.entry} />
    case 'items': return <ItemDetail item={h.entry} />
    case 'monsters': return <StatBlock m={h.entry} legacy={h.entry.legacy} />
    case 'feats': return <Text text={h.entry.description} book={h.entry.source} />
    case 'conditions': return <Text text={h.entry.description} book={h.entry.source} />
  }
}

function Text({ text, book }: { text: string; book: string }) {
  const { t } = useI18n()
  const title = BOOK_TITLES[book]
  return (
    <>
      <div lang="en" dir="ltr"><Markdown text={text} /></div>
      {title && <p className="hint">{t('spells.bookNote', { book: title })}</p>}
    </>
  )
}

function ItemDetail({ item }: { item: Equipment | MagicItem }) {
  const { t } = useI18n()
  const facts: [MessageKey, string][] = []
  if ('rarity' in item) {
    facts.push(['library.rarity', item.rarityText ?? t(`library.rarity.${item.rarity.replace(' ', '-')}` as MessageKey)])
    if (item.attunement) facts.push(['library.attunement', typeof item.attunement === 'string' ? item.attunement : t('library.yes')])
  } else {
    if (item.cost) facts.push(['library.cost', `${item.cost.qty} ${item.cost.unit}`])
    if (item.weight) facts.push(['library.weight', `${item.weight} lb`])
    const w = item.weapon
    if (w?.damage) facts.push(['library.damage', `${w.damage.dice} ${w.damage.type}${w.versatileDamage ? ` (${w.versatileDamage})` : ''}`])
    if (w?.normalRange) facts.push(['library.range', `${w.normalRange}${w.longRange ? `/${w.longRange}` : ''} ft`])
    if (w?.properties.length) facts.push(['library.properties', w.properties.join(', ')])
    if (w?.mastery) facts.push(['library.mastery', w.mastery])
    const a = item.armor
    if (a) facts.push(['library.ac', a.category === 'shield' ? `+${a.baseAc}` : `${a.baseAc}${a.dexBonus ? ` + DEX${a.maxDexBonus != null ? ` (max ${a.maxDexBonus})` : ''}` : ''}`])
    if (a?.strMinimum) facts.push(['library.strength', String(a.strMinimum)])
    if (a?.stealthDisadvantage) facts.push(['library.stealth', t('library.disadvantage')])
  }
  return (
    <div className="sb-detail">
      {facts.length > 0 && <dl>{facts.map(([k, v]) => <div key={k}><dt>{t(k)}</dt><dd><bdi lang="en">{v}</bdi></dd></div>)}</dl>}
      {item.description && <div lang="en" dir="ltr"><Markdown text={item.description} /></div>}
    </div>
  )
}

/** CC-BY attribution of the edition's SRD: must stay visible wherever its text is shown. */
export const srdAttribution = (e: Edition) => sourceById(srdFor(e))?.attribution ?? ''
