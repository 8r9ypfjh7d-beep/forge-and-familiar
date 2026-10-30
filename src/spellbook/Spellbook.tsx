// Combat's Spells tab: spell slots, the character's spells by level, and every spell their class can take from the library.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BOOK_SOURCES, BOOK_TITLES, loadKind, searchEntries, type CharacterClass, type Edition, type SourceInfo, type Spell, type Subclass, BUNDLED } from '../content'
import { useI18n, type MessageKey } from '../i18n'
import type { Character } from '../model/character'
import { removeEntry, type SpellEntry } from '../quickcast'
import { derive, formatMod, itemSpellCast, spellEffectId } from '../rules'
import { Markdown } from '../rulesqa/Markdown'
import { SearchField } from '../rulesqa/SearchField'
import { SpellSlots, hasSlots, itemSpellsOf, type ItemSpellCaster } from '../sheet/components/SpellSlots'
import type { Apply } from '../sheet/types'
import { availableSpells, editionOf, spellAccess, spellSourcesFor, type SpellAccess } from './access'
import { grantedSpells, isExtraSpell } from './extra'
import { addSpell, isPinned, pinnedSpells, removeSpell, setEdition, spellsOf, toggleSpellPin } from './spellbook'
import { CastButton, CastResult, useCast } from './Cast'
import './spellbook.css'

interface Library {
  spells: Spell[]
  classes: CharacterClass[]
  subclasses: Subclass[]
  /** The SRD source, then the book spells' source. */
  sources: SourceInfo[]
}

/** Loads one edition's spells and class tables. Each file is fetched once per page load. */
function useLibrary(edition: Edition): Library | 'error' | null {
  const [lib, setLib] = useState<{ edition: Edition; data: Library | 'error' } | null>(null)
  useEffect(() => {
    let live = true
    const sources = spellSourcesFor(edition)
    const shown = [...BUNDLED.map(m => m.source), ...BOOK_SOURCES].filter(s => sources.includes(s.id))
    Promise.all([loadKind('spells', { sources }), loadKind('classes', { sources }), loadKind('subclasses', { sources })])
      .then(([spells, classes, subclasses]) => {
        if (live) setLib({ edition, data: { spells, classes, subclasses, sources: shown } })
      })
      .catch(() => live && setLib({ edition, data: 'error' }))
    return () => { live = false }
  }, [edition])
  return lib?.edition === edition ? lib.data : null
}

export function Spellbook({ character, apply }: { character: Character; apply: Apply }) {
  const { t } = useI18n()
  const edition = editionOf(character)
  const lib = useLibrary(edition)
  const stats = derive(character)
  const access = lib && lib !== 'error' ? spellAccess(character, lib.classes, lib.subclasses, stats.abilities, undefined, lib.spells) : []
  const [classId, setClassId] = useState<string | null>(null)
  const [tab, setTab] = useState<'mine' | 'browse'>('mine')
  const current = access.find(a => a.classId === classId) ?? access[0]
  const itemCasting = useCast(character, apply)

  // Non-casters (and casters below their first spell level) get no card at all.
  // Items can still give them slots or spells.
  if (lib && lib !== 'error' && access.length === 0 && !hasSlots(character) && !itemSpellsOf(character).length) return null

  return (
    <section className="card spellbook" aria-labelledby="spells-title">
      <div className="card-head">
        <h2 id="spells-title">{t('spells.title')}</h2>
        <label className="sb-edition">
          <span className="sr-only">{t('spells.rules')}</span>
          <select value={edition} onChange={e => apply(t('spells.log.rules', { rules: t(`spells.rules.${e.target.value as Edition}`) }), c => setEdition(c, e.target.value as Edition))}>
            <option value="2014">{t('spells.rules.2014')}</option>
            <option value="2024">{t('spells.rules.2024')}</option>
          </select>
        </label>
      </div>
      <SpellSlots character={character} apply={apply} onCastItemSpell={lib && lib !== 'error' ? itemSpellCaster(lib.spells, itemCasting.cast) : undefined} />
      <CastResult out={itemCasting.out} outKey={itemCasting.outKey} onDone={itemCasting.clear} character={character} apply={apply} />
      {lib === null && <p className="hint">{t('spells.loading')}</p>}
      {lib === 'error' && <p className="hint">{t('spells.failed')}</p>}
      {lib && lib !== 'error' && current && (
        <>
          {access.length > 1 && (
            <div className="sb-classes" role="group" aria-label={t('spells.class')}>
              {access.map(a => (
                <button key={a.classId} type="button" className={`glass-chip${a === current ? ' on' : ''}`} aria-pressed={a === current} onClick={() => setClassId(a.classId)}>
                  {a.className}
                </button>
              ))}
            </div>
          )}
          <Summary character={character} access={current} prof={stats.proficiencyBonus} mod={stats.mods[current.ability]} spells={lib.spells} />
          <div className="glass-segmented sb-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>
              {t('spells.mine')}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'browse'} className={tab === 'browse' ? 'on' : ''} onClick={() => setTab('browse')}>
              {t('spells.browse')}
            </button>
          </div>
          {tab === 'mine'
            ? <Mine character={character} apply={apply} access={current} spells={lib.spells} onBrowse={() => setTab('browse')} />
            : <Browse character={character} apply={apply} access={current} spells={lib.spells} />}
          {lib.sources.map(source => (
            <details key={source.id} className="sb-source">
              <summary>{t('spells.source', { title: source.title })}</summary>
              <p lang="en" dir="ltr">{source.attribution}</p>
            </details>
          ))}
        </>
      )}
    </section>
  )
}

/**
 * Story mode's Spells card: spell slots on top, then the pinned spells (they also show in combat's
 * attacks table) with a picker over every spell their classes can take (their own spells first).
 * With nothing pinned it lists the character's own spells, so a new character can cast right away.
 */
export function SpellsCard({ character, apply }: { character: Character; apply: Apply }) {
  const { t } = useI18n()
  const lib = useLibrary(editionOf(character))
  const stats = derive(character)
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const casting = useCast(character, apply)
  const access = lib && lib !== 'error' ? spellAccess(character, lib.classes, lib.subclasses, stats.abilities, undefined, lib.spells) : []
  const slots = hasSlots(character)
  const spells = lib && lib !== 'error' ? lib.spells : []
  // Race spells and picks from feats like Magic Initiate sit beside the class lists.
  const byId = new Map(spells.map(s => [s.id, s]))
  const other = [
    ...grantedSpells(character, spells).filter(g => g.unlocked).map(g => g.spell),
    ...spellsOf(character).filter(isExtraSpell).flatMap(k => byId.get(k.id) ?? []),
  ]
  const noSpells = !!lib && lib !== 'error' && access.length === 0 && other.length === 0
  if (noSpells && !slots && !itemSpellsOf(character).length) return null

  const byName = new Map(spells.map(s => [s.name.toLowerCase(), s]))
  const pinned = pinnedSpells(character)
  const toggle = (s: Spell, on: boolean) =>
    apply(t(on ? 'spells.story.log.unpin' : 'spells.story.log.pin', { name: s.name }), c => toggleSpellPin(c, s))
  const unpin = (e: SpellEntry) => apply(t('spells.story.log.unpin', { name: e.name }), c => removeEntry(c, e.id))
  const mine = new Set([...spellsOf(character).map(k => k.id), ...access.flatMap(a => a.alwaysPrepared), ...other.map(s => s.id)])
  const pool = [...new Map([...access.flatMap(a => availableSpells(spells, a)), ...other].map(s => [s.id, s])).values()]
    .sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)) || a.level - b.level || a.name.localeCompare(b.name))
  const shown = searchEntries(pool, query).slice(0, 60)
  const isOn = (s: Spell) => isPinned(character, s.name)
  // Race spells are left out: they cast from "From your items" without a slot.
  const own = pinned.length ? [] : [...new Set([...spellsOf(character).map(k => k.id), ...access.flatMap(a => a.alwaysPrepared)])]
    .flatMap(id => byId.get(id) ?? [])
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  const levelBadge = (level: number) => (level === 0 ? t('spells.cantrip') : t(`sheet.slot.${level}` as MessageKey))

  return (
    <section className="card spellbook spell-card" aria-labelledby="spell-card-title">
      <div className="card-head">
        <h2 id="spell-card-title">{t('spells.title')}</h2>
        {lib && lib !== 'error' && !noSpells && (
          <button type="button" className="glass-btn small" aria-expanded={picking} onClick={() => setPicking(p => !p)}>
            {picking ? t('spells.story.done') : t('spells.story.pick')}
          </button>
        )}
      </div>
      <SpellSlots character={character} apply={apply} onCastItemSpell={lib && lib !== 'error' ? itemSpellCaster(lib.spells, casting.cast) : undefined} />
      {lib === null && <p className="hint">{t('spells.loading')}</p>}
      {lib === 'error' && <p className="hint">{t('spells.failed')}</p>}
      {lib && lib !== 'error' && !noSpells && (
        <div className="sb-pinned" role="group" aria-labelledby="pinned-title">
          {slots && <h3 id="pinned-title" className="sub-title">{t(own.length ? 'spells.story.yourTitle' : 'spells.story.pinnedTitle')}</h3>}
          {pinned.length === 0 && !picking && <p className="hint">{t(own.length ? 'spells.story.ownHint' : 'spells.story.empty')}</p>}
          <CastResult out={casting.out} outKey={casting.outKey} onDone={casting.clear} character={character} apply={apply} />
          {own.length > 0 && !picking && (
            <ul className="sb-list">
              {own.map(s => (
                <SpellRow key={s.id} spell={s} badge={levelBadge(s.level)} running={isRunning(character, s.id)}>
                  <CastButton character={character} spell={s} onCast={casting.cast} />
                </SpellRow>
              ))}
            </ul>
          )}
          {pinned.length > 0 && (
            <ul className="sb-list">
              {pinned.map(e => {
                const s = byName.get(e.name.toLowerCase())
                const badge = levelBadge(e.level)
                // Unpinning is part of "+ Pin spells", so a mistap during play can't drop a spell.
                const remove = picking && (
                  <button type="button" className="glass-btn small icon sb-remove" aria-label={t('spells.story.unpinName', { name: e.name })} onClick={() => unpin(e)}>✕</button>
                )
                // Spells typed into quick-cast by hand have no library text, so they show as a plain row.
                return s
                  ? <SpellRow key={e.id} spell={s} badge={badge} running={isRunning(character, s.id)}><CastButton character={character} spell={s} onCast={casting.cast} />{remove}</SpellRow>
                  : (
                    <li key={e.id} className="sb-row">
                      <div className="sb-line">
                        <span className="sb-name"><bdi>{e.name}</bdi><span className="sb-badge">{badge}</span></span>
                        <div className="sb-actions">{remove}</div>
                      </div>
                    </li>
                  )
              })}
            </ul>
          )}
          {picking && (
            <div className="sb-browse">
              <SearchField value={query} onChange={e => setQuery(e.target.value)} placeholder={t('spells.search')} aria-label={t('spells.search')} lang="en" />
              <ul className="sb-list">
                {shown.map(s => {
                  const on = isOn(s)
                  return (
                    <SpellRow key={s.id} spell={s} badge={mine.has(s.id) ? t('spells.story.yours') : undefined}>
                      <button type="button" className={`glass-btn small${on ? '' : ' sb-add'}`} aria-pressed={on}
                        aria-label={t(on ? 'spells.story.unpinName' : 'spells.story.pinName', { name: s.name })} onClick={() => toggle(s, on)}>
                        {on ? t('spells.pinned') : t('spells.pin')}
                      </button>
                    </SpellRow>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function Summary({ character, access, prof, mod, spells }: { character: Character; access: SpellAccess; prof: number; mod: number; spells: Spell[] }) {
  const { t } = useI18n()
  const byId = new Map(spells.map(s => [s.id, s]))
  const mine = spellsOf(character, access.classId).map(k => byId.get(k.id)).filter((s): s is Spell => !!s)
  const cantrips = mine.filter(s => s.level === 0).length
  const leveled = mine.filter(s => s.level > 0 && !access.alwaysPrepared.includes(s.id)).length
  return (
    <dl className="sb-summary">
      <div><dt>{t('spells.dc')}</dt><dd>{8 + prof + mod}</dd></div>
      <div><dt>{t('spells.attack')}</dt><dd dir="ltr">{formatMod(prof + mod)}</dd></div>
      {access.cantrips > 0 && (
        <div className={cantrips > access.cantrips ? 'over' : ''}><dt>{t('spells.cantrips')}</dt><dd>{cantrips}/{access.cantrips}</dd></div>
      )}
      {access.spellbook != null ? (
        <>
          <div className={leveled > access.spellbook ? 'over' : ''}><dt>{t('spells.spellbook')}</dt><dd>{leveled}/{access.spellbook}</dd></div>
          <div><dt>{t('spells.prepared')}</dt><dd>{access.limit}</dd></div>
        </>
      ) : (
        <div className={leveled > access.limit ? 'over' : ''}>
          <dt>{t(access.kind === 'known' ? 'spells.known' : 'spells.prepared')}</dt><dd>{leveled}/{access.limit}</dd>
        </div>
      )}
    </dl>
  )
}

function useLevelName() {
  const { t } = useI18n()
  return (level: number) => (level === 0 ? t('spells.cantrips') : t('spells.level', { ordinal: t(`sheet.slot.${level}` as MessageKey) }))
}

function groupByLevel(spells: Spell[]) {
  const groups = new Map<number, Spell[]>()
  for (const s of spells) groups.set(s.level, [...(groups.get(s.level) ?? []), s])
  return [...groups.entries()].sort((a, b) => a[0] - b[0])
}

function Mine({ character, apply, access, spells, onBrowse }: { character: Character; apply: Apply; access: SpellAccess; spells: Spell[]; onBrowse: () => void }) {
  const { t } = useI18n()
  const casting = useCast(character, apply)
  const levelName = useLevelName()
  // Forgetting a spell sits behind Edit, away from Cast and Pin.
  const [editing, setEditing] = useState(false)
  const byId = new Map(spells.map(s => [s.id, s]))
  const chosen = new Set(spellsOf(character, access.classId).map(k => k.id))
  const list = [...new Set([...access.alwaysPrepared, ...chosen])]
    .map(id => byId.get(id))
    .filter((s): s is Spell => !!s)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  if (!list.length) {
    return (
      <div className="sb-empty">
        <p className="hint">{t('spells.empty', { className: access.className })}</p>
        <button type="button" className="glass-btn prominent" onClick={onBrowse}>{t('spells.browse')}</button>
      </div>
    )
  }
  const pin = (s: Spell, on: boolean) => apply(t(on ? 'spells.story.log.unpin' : 'spells.log.pin', { name: s.name }), c => toggleSpellPin(c, s))
  return (
    <div className="sb-groups">
      <div className="sb-edit">
        <button type="button" className="glass-btn small" aria-pressed={editing} onClick={() => setEditing(e => !e)}>
          {editing ? t('spells.story.done') : t('spells.edit')}
        </button>
      </div>
      <CastResult out={casting.out} outKey={casting.outKey} onDone={casting.clear} character={character} apply={apply} />
      {groupByLevel(list).map(([level, group]) => (
        <section key={level} aria-label={levelName(level)}>
          <h3>{levelName(level)}</h3>
          <ul className="sb-list">
            {group.map(s => {
              const always = access.alwaysPrepared.includes(s.id)
              const pinned = isPinned(character, s.name)
              return (
                <SpellRow key={s.id} spell={s} badge={always ? t('spells.always') : undefined} running={isRunning(character, s.id)}>
                  <CastButton character={character} spell={s} onCast={casting.cast} />
                  <button type="button" className={`glass-btn small${pinned ? '' : ' sb-add'}`} aria-pressed={pinned} onClick={() => pin(s, pinned)}
                    aria-label={pinned ? t('spells.story.unpinName', { name: s.name }) : t('spells.pinName', { name: s.name })}>
                    {pinned ? t('spells.pinned') : t('spells.pin')}
                  </button>
                  {editing && !always && (
                    <button type="button" className="glass-btn small icon sb-remove" aria-label={t('spells.removeName', { name: s.name })}
                      onClick={() => apply(t('spells.log.remove', { name: s.name }), c => removeSpell(c, access.classId, s.id))}>
                      ✕
                    </button>
                  )}
                </SpellRow>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Browse({ character, apply, access, spells }: { character: Character; apply: Apply; access: SpellAccess; spells: Spell[] }) {
  const { t } = useI18n()
  const levelName = useLevelName()
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<number | 'all'>('all')
  const available = useMemo(() => availableSpells(spells, access), [spells, access])
  const levels = [...new Set(available.map(s => s.level))]
  const shown = searchEntries(available.filter(s => level === 'all' || s.level === level), query)
  const chosen = new Set(spellsOf(character, access.classId).map(k => k.id))

  return (
    <div className="sb-browse">
      <p className="hint">{t('spells.available', { count: available.length, className: access.className, ordinal: levelName(access.maxLevel) })}</p>
      <SearchField value={query} onChange={e => setQuery(e.target.value)} placeholder={t('spells.search')} aria-label={t('spells.search')} lang="en" />
      <div className="sb-levels" role="group" aria-label={t('spells.levelFilter')}>
        <button type="button" className={`glass-chip${level === 'all' ? ' on' : ''}`} aria-pressed={level === 'all'} onClick={() => setLevel('all')}>{t('spells.all')}</button>
        {levels.map(l => (
          <button key={l} type="button" className={`glass-chip${level === l ? ' on' : ''}`} aria-pressed={level === l} onClick={() => setLevel(l)}>
            {l === 0 ? t('spells.cantrips') : t(`sheet.slot.${l}` as MessageKey)}
          </button>
        ))}
      </div>
      {shown.length === 0
        ? <p className="hint">{t('spells.noMatch')}</p>
        : (
          <ul className="sb-list">
            {shown.map(s => {
              const always = access.alwaysPrepared.includes(s.id)
              const has = always || chosen.has(s.id)
              return (
                <SpellRow key={s.id} spell={s} badge={always ? t('spells.always') : level === 'all' ? (s.level === 0 ? t('spells.cantrip') : levelName(s.level)) : undefined}>
                  <button type="button" className={`glass-btn small${has ? '' : ' sb-add'}`} disabled={always} aria-pressed={has}
                    aria-label={has ? t('spells.removeName', { name: s.name }) : t('spells.addName', { name: s.name })}
                    onClick={() => apply(
                      t(has ? 'spells.log.remove' : 'spells.log.add', { name: s.name }),
                      c => (has ? removeSpell(c, access.classId, s.id) : addSpell(c, access.classId, s.id)),
                    )}>
                    {has ? t('spells.added') : t('spells.add')}
                  </button>
                </SpellRow>
              )
            })}
          </ul>
        )}
    </div>
  )
}

/** Item and race spells ("Hellish Rebuke (as 2nd level)") cast from the library without a slot, spending their use or charges. */
export function itemSpellCaster(spells: Spell[], cast: (s: Spell, slot?: undefined, free?: { level?: number; spend?: { id: string; n: number } }) => unknown): ItemSpellCaster {
  const find = (text: string) => { const { name, level } = itemSpellCast(text); const s = spells.find(x => x.name.toLowerCase() === name.toLowerCase()); return s && { s, level } }
  return {
    can: s => !!find(s.spell),
    cast: s => {
      const f = find(s.spell)
      const spend = s.useId ? { id: s.useId, n: 1 } : s.charges ? { id: s.charges.id, n: s.charges.cost } : undefined
      if (f) cast(f.s, undefined, { level: f.level, ...(spend ? { spend } : {}) })
    },
  }
}

const isRunning = (c: Character, spellId: string) => (c.state.effects ?? []).some(e => e.id === spellEffectId(spellId))

/** One spell: name and stat line; tapping the name opens the full text. Actions go in children. */
export function SpellRow({ spell: s, badge, running, children }: { spell: Spell; badge?: string; running?: boolean; children: ReactNode }) {
  const { t, locale, dir } = useI18n()
  const he = locale === 'he' && !!s.descriptionHe
  const [open, setOpen] = useState(false)
  const comps = [s.components.v && 'V', s.components.s && 'S', s.components.m && 'M'].filter(Boolean).join(', ')
  return (
    <li className={`sb-row${open ? ' open' : ''}`}>
      <div className="sb-line">
        <button type="button" className="sb-name" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          <bdi lang="en">{s.name}</bdi>
          {s.concentration && <abbr className="sb-tag" title={t('spells.concentration')}>C</abbr>}
          {s.ritual && <abbr className="sb-tag" title={t('spells.ritual')}>R</abbr>}
          {badge && <span className="sb-badge">{badge}</span>}
          {running && <span className="sb-badge sb-running">{t('cast.running')}</span>}
          {s.book && <abbr className="sb-tag sb-book" title={BOOK_TITLES[s.book] ?? s.book} lang="en">{s.book}</abbr>}
          <small><bdi lang="en">{s.castingTime.split(',')[0]} · {s.range}</bdi></small>
        </button>
        <div className="sb-actions">{children}</div>
      </div>
      {open && (
        <div className="sb-detail" lang="en" dir="ltr">
          <dl>
            <div><dt>{t('spells.castingTime')}</dt><dd>{s.castingTime}</dd></div>
            <div><dt>{t('spells.range')}</dt><dd>{s.range}</dd></div>
            <div><dt>{t('spells.components')}</dt><dd>{comps}{s.components.material ? ` (${s.components.material})` : ''}</dd></div>
            <div><dt>{t('spells.duration')}</dt><dd>{s.concentration ? `${t('spells.concentration')}, ` : ''}{s.duration}</dd></div>
          </dl>
          {he
            ? <p className="sb-summary" lang="he" dir="rtl">{s.descriptionHe}</p>
            : <Markdown text={s.description} />}
          {s.book && <p className="hint sb-book-note" lang={locale} dir={dir}>{t('spells.bookNote', { book: BOOK_TITLES[s.book] ?? s.book })}</p>}
          {s.higherLevels && <><h4>{t('spells.higher')}</h4><Markdown text={s.higherLevels} /></>}
        </div>
      )}
    </li>
  )
}
