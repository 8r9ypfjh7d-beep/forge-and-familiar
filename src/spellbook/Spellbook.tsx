// Combat's Spells tab: spell slots, the character's spells by level, and every spell their class can take from the library.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadKind, searchEntries, type CharacterClass, type Edition, type SourceInfo, type Spell, type Subclass, BUNDLED } from '../content'
import { useI18n, type MessageKey } from '../i18n'
import type { Character } from '../model/character'
import { removeEntry, type SpellEntry } from '../quickcast'
import { derive, formatMod } from '../rules'
import { Markdown } from '../rulesqa/Markdown'
import { SpellSlots, hasSlots } from '../sheet/components/SpellSlots'
import type { Apply } from '../sheet/types'
import { availableSpells, editionOf, sourceFor, spellAccess, type SpellAccess } from './access'
import { addSpell, isPinned, pinnedSpells, removeSpell, setEdition, spellsOf, toggleSpellPin } from './spellbook'
import './spellbook.css'

interface Library {
  spells: Spell[]
  classes: CharacterClass[]
  subclasses: Subclass[]
  source?: SourceInfo
}

/** Loads one edition's spells and class tables. Each file is fetched once per page load. */
function useLibrary(edition: Edition): Library | 'error' | null {
  const [lib, setLib] = useState<{ edition: Edition; data: Library | 'error' } | null>(null)
  useEffect(() => {
    let live = true
    const sources = [sourceFor(edition)]
    Promise.all([loadKind('spells', { sources }), loadKind('classes', { sources }), loadKind('subclasses', { sources })])
      .then(([spells, classes, subclasses]) => {
        if (live) setLib({ edition, data: { spells, classes, subclasses, source: BUNDLED.find(m => m.source.id === sources[0])?.source } })
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
  const access = lib && lib !== 'error' ? spellAccess(character, lib.classes, lib.subclasses, stats.abilities) : []
  const [classId, setClassId] = useState<string | null>(null)
  const [tab, setTab] = useState<'mine' | 'browse'>('mine')
  const current = access.find(a => a.classId === classId) ?? access[0]

  // Non-casters (and casters below their first spell level) get no card at all.
  if (lib && lib !== 'error' && access.length === 0) return null

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
      <SpellSlots character={character} apply={apply} />
      {lib === null && <p className="hint">{t('spells.loading')}</p>}
      {lib === 'error' && <p className="hint">{t('spells.failed')}</p>}
      {lib && lib !== 'error' && current && (
        <>
          {access.length > 1 && (
            <div className="sb-classes" role="group" aria-label={t('spells.class')}>
              {access.map(a => (
                <button key={a.classId} type="button" className={`chip${a === current ? ' on' : ''}`} aria-pressed={a === current} onClick={() => setClassId(a.classId)}>
                  {a.className}
                </button>
              ))}
            </div>
          )}
          <Summary character={character} access={current} prof={stats.proficiencyBonus} mod={stats.mods[current.ability]} spells={lib.spells} />
          <div className="segmented sb-tabs" role="tablist">
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
          {lib.source && (
            <details className="sb-source">
              <summary>{t('spells.source', { title: lib.source.title })}</summary>
              <p lang="en" dir="ltr">{lib.source.attribution}</p>
            </details>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Story mode's Spells card: spell slots on top, then the pinned spells (they also show in combat's
 * attacks table) with a picker over every spell their classes can take (their own spells first).
 */
export function SpellsCard({ character, apply }: { character: Character; apply: Apply }) {
  const { t } = useI18n()
  const lib = useLibrary(editionOf(character))
  const stats = derive(character)
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const access = lib && lib !== 'error' ? spellAccess(character, lib.classes, lib.subclasses, stats.abilities) : []
  const slots = hasSlots(character)
  const noSpells = !!lib && lib !== 'error' && access.length === 0
  if (noSpells && !slots) return null

  const spells = lib && lib !== 'error' ? lib.spells : []
  const byName = new Map(spells.map(s => [s.name.toLowerCase(), s]))
  const pinned = pinnedSpells(character)
  const toggle = (s: Spell, on: boolean) =>
    apply(t(on ? 'spells.story.log.unpin' : 'spells.story.log.pin', { name: s.name }), c => toggleSpellPin(c, s))
  const unpin = (e: SpellEntry) => apply(t('spells.story.log.unpin', { name: e.name }), c => removeEntry(c, e.id))
  const mine = new Set([...spellsOf(character).map(k => k.id), ...access.flatMap(a => a.alwaysPrepared)])
  const pool = [...new Map(access.flatMap(a => availableSpells(spells, a)).map(s => [s.id, s])).values()]
    .sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)) || a.level - b.level || a.name.localeCompare(b.name))
  const shown = searchEntries(pool, query).slice(0, 60)
  const isOn = (s: Spell) => isPinned(character, s.name)

  return (
    <section className="card spellbook spell-card" aria-labelledby="spell-card-title">
      <div className="card-head">
        <h2 id="spell-card-title">{t('spells.title')}</h2>
        {lib && lib !== 'error' && !noSpells && (
          <button type="button" className="btn small" aria-expanded={picking} onClick={() => setPicking(p => !p)}>
            {picking ? t('spells.story.done') : t('spells.story.pick')}
          </button>
        )}
      </div>
      <SpellSlots character={character} apply={apply} />
      {lib === null && <p className="hint">{t('spells.loading')}</p>}
      {lib === 'error' && <p className="hint">{t('spells.failed')}</p>}
      {lib && lib !== 'error' && !noSpells && (
        <div className="sb-pinned" role="group" aria-labelledby="pinned-title">
          {slots && <h3 id="pinned-title" className="sub-title">{t('spells.story.pinnedTitle')}</h3>}
          {pinned.length === 0 && !picking && <p className="hint">{t('spells.story.empty')}</p>}
          {pinned.length > 0 && (
            <ul className="sb-list">
              {pinned.map(e => {
                const s = byName.get(e.name.toLowerCase())
                const badge = e.level === 0 ? t('spells.cantrip') : t(`sheet.slot.${e.level}` as MessageKey)
                const remove = (
                  <button type="button" className="btn ghost small sb-remove" aria-label={t('spells.story.unpinName', { name: e.name })} onClick={() => unpin(e)}>✕</button>
                )
                // Spells typed into quick-cast by hand have no library text, so they show as a plain row.
                return s
                  ? <SpellRow key={e.id} spell={s} badge={badge}>{remove}</SpellRow>
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
              <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('spells.search')} aria-label={t('spells.search')} lang="en" />
              <ul className="sb-list">
                {shown.map(s => {
                  const on = isOn(s)
                  return (
                    <SpellRow key={s.id} spell={s} badge={mine.has(s.id) ? t('spells.story.yours') : undefined}>
                      <button type="button" className={`btn small${on ? '' : ' primary'}`} aria-pressed={on}
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
      <div className={leveled > access.limit ? 'over' : ''}>
        <dt>{t(access.kind === 'known' ? 'spells.known' : 'spells.prepared')}</dt><dd>{leveled}/{access.limit}</dd>
      </div>
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
  const levelName = useLevelName()
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
        <button type="button" className="btn primary" onClick={onBrowse}>{t('spells.browse')}</button>
      </div>
    )
  }
  const pin = (s: Spell, on: boolean) => apply(t(on ? 'spells.story.log.unpin' : 'spells.log.pin', { name: s.name }), c => toggleSpellPin(c, s))
  return (
    <div className="sb-groups">
      {groupByLevel(list).map(([level, group]) => (
        <section key={level} aria-label={levelName(level)}>
          <h3>{levelName(level)}</h3>
          <ul className="sb-list">
            {group.map(s => {
              const always = access.alwaysPrepared.includes(s.id)
              const pinned = isPinned(character, s.name)
              return (
                <SpellRow key={s.id} spell={s} badge={always ? t('spells.always') : undefined}>
                  <button type="button" className="btn small" aria-pressed={pinned} onClick={() => pin(s, pinned)}
                    aria-label={pinned ? t('spells.story.unpinName', { name: s.name }) : t('spells.pinName', { name: s.name })}>
                    {pinned ? t('spells.pinned') : t('spells.pin')}
                  </button>
                  {!always && (
                    <button type="button" className="btn ghost small sb-remove" aria-label={t('spells.removeName', { name: s.name })}
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
      <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('spells.search')} aria-label={t('spells.search')} lang="en" />
      <div className="sb-levels" role="group" aria-label={t('spells.levelFilter')}>
        <button type="button" className={`chip${level === 'all' ? ' on' : ''}`} aria-pressed={level === 'all'} onClick={() => setLevel('all')}>{t('spells.all')}</button>
        {levels.map(l => (
          <button key={l} type="button" className={`chip${level === l ? ' on' : ''}`} aria-pressed={level === l} onClick={() => setLevel(l)}>
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
                  <button type="button" className={`btn small${has ? '' : ' primary'}`} disabled={always} aria-pressed={has}
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

/** One spell: name and stat line; tapping the name opens the full text. Actions go in children. */
function SpellRow({ spell: s, badge, children }: { spell: Spell; badge?: string; children: ReactNode }) {
  const { t } = useI18n()
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
          <Markdown text={s.description} />
          {s.higherLevels && <><h4>{t('spells.higher')}</h4><Markdown text={s.higherLevels} /></>}
        </div>
      )}
    </li>
  )
}
