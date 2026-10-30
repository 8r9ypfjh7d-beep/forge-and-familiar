// The builder's Spells step: cantrips and known, prepared or spellbook spells per spellcasting class,
// race and lineage spells, and picks from spell feats (Magic Initiate). Counts guide, they never block.
import { useEffect, useMemo, useState } from 'react'
import { loadKind, searchEntries, type CharacterClass, type Edition, type Spell, type Subclass } from '../content'
import { SpellName, useI18n, type MessageKey } from '../i18n'
import type { KnownSpell } from '../model/character'
import { classById, featById, getAbilityScores, raceById } from '../rules'
import { SearchField } from '../rulesqa/SearchField'
import {
  SpellRow, availableSpells, canPickExtra, isSecret, editionOf, extraKey, extraList, extraSources, grantedSpells, keepValidSpells, spellAccess,
  type ExtraSource, type SpellAccess,
} from '../spellbook'
import '../spellbook/spellbook.css'
import type { StepProps } from './steps'
import { Fold } from './Compact'
import { Why } from './Why'
import type { WhyId } from './why'

interface Library { spells: Spell[]; classes: CharacterClass[]; subclasses: Subclass[] }

/** One entry per id, the first one winning: bundled SRD entries load first, so a pack never replaces them. */
function firstById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Map<string, T>()
  for (const x of list) if (!seen.has(x.id)) seen.set(x.id, x)
  return [...seen.values()]
}

/** The edition's spells and class tables, homebrew and imported packs included. */
function useSpellLibrary(edition: Edition): Library | 'error' | null {
  const [lib, setLib] = useState<{ edition: Edition; data: Library | 'error' } | null>(null)
  useEffect(() => {
    let live = true
    Promise.all([loadKind('spells', { edition }), loadKind('classes', { edition }), loadKind('subclasses', { edition })])
      .then(([spells, classes, subclasses]) => {
        if (live) setLib({ edition, data: { spells: firstById(spells), classes: firstById(classes), subclasses } })
      })
      .catch(() => live && setLib({ edition, data: 'error' }))
    return () => { live = false }
  }, [edition])
  return lib?.edition === edition ? lib.data : null
}

/** A counter: how many are picked of the usual number, with a gentle note when under or over. */
function Count({ label, picked, target, why }: { label: string; picked: number; target: number; why: WhyId }) {
  const { t } = useI18n()
  const state = picked > target ? 'over' : picked < target ? 'under' : 'done'
  return (
    <div className={`bs-count ${state}`}>
      <dt>{label} <Why id={why} /></dt>
      <dd>{picked}/{target}</dd>
      <p className="small">
        {state === 'under' ? t('builder.spells.left', { count: target - picked })
          : state === 'over' ? t('builder.spells.over', { count: picked - target })
          : t('builder.spells.done')}
      </p>
    </div>
  )
}

/** The picks as removable chips, then search, level chips and a list of spells with an add/remove button each. */
function SpellPicker({ pool, chosen, onToggle, label }: { pool: Spell[]; chosen: Set<string>; onToggle: (s: Spell) => void; label: string }) {
  const { t, spellName } = useI18n()
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<number | 'all'>('all')
  const levels = [...new Set(pool.map(s => s.level))].sort((a, b) => a - b)
  // A steady order (level, then name), so a row never jumps away from the finger that tapped it.
  const sorted = useMemo(() => [...pool].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)), [pool])
  const picked = sorted.filter(s => chosen.has(s.id))
  const matches = searchEntries(sorted.filter(s => level === 'all' || s.level === level), query, sp => spellName(sp.id, ''))
  const shown = matches.slice(0, 80)
  return (
    <div className="sb-browse" role="group" aria-label={label}>
      {picked.length > 0 && (
        <div className="bs-picked" role="group" aria-label={t('builder.spells.picked')}>
          {picked.map(s => (
            <button key={s.id} type="button" className="glass-chip on" aria-label={t('spells.removeName', { name: s.name })} onClick={() => onToggle(s)}>
              <bdi>{spellName(s.id, s.name)}</bdi> ✕
            </button>
          ))}
        </div>
      )}
      <SearchField value={query} onChange={e => setQuery(e.target.value)} placeholder={t('spells.search')} aria-label={t('spells.search')} />
      {levels.length > 1 && (
        <div className="sb-levels" role="group" aria-label={t('spells.levelFilter')}>
          <button type="button" className={`glass-chip${level === 'all' ? ' on' : ''}`} aria-pressed={level === 'all'} onClick={() => setLevel('all')}>{t('spells.all')}</button>
          {levels.map(l => (
            <button key={l} type="button" className={`glass-chip${level === l ? ' on' : ''}`} aria-pressed={level === l} onClick={() => setLevel(l)}>
              {l === 0 ? t('spells.cantrips') : t(`sheet.slot.${l}` as MessageKey)}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0
        ? <p className="hint">{t('spells.noMatch')}</p>
        : (
          <ul className="sb-list">
            {shown.map(s => {
              const has = chosen.has(s.id)
              return (
                <SpellRow key={s.id} spell={s} badge={level === 'all' ? (s.level === 0 ? t('spells.cantrip') : t(`sheet.slot.${s.level}` as MessageKey)) : undefined}>
                  <button type="button" className={`glass-btn small${has ? '' : ' sb-add'}`} aria-pressed={has}
                    aria-label={has ? t('spells.removeName', { name: s.name }) : t('spells.addName', { name: s.name })}
                    onClick={() => onToggle(s)}>
                    {has ? t('spells.added') : t('spells.add')}
                  </button>
                </SpellRow>
              )
            })}
          </ul>
        )}
      {matches.length > shown.length && <p className="hint small">{t('builder.spells.more', { count: matches.length - shown.length })}</p>}
    </div>
  )
}

export function SpellsStep({ draft, update }: StepProps) {
  const { t, term, spellName } = useI18n()
  const lib = useSpellLibrary(editionOf(draft))
  const [classId, setClassId] = useState<string | null>(null)
  const [lists, setLists] = useState<Record<string, string>>({})

  if (lib === null) return <p className="hint">{t('spells.loading')}</p>
  if (lib === 'error') return <p className="hint">{t('spells.failed')}</p>

  const access = spellAccess(draft, lib.classes, lib.subclasses, getAbilityScores(draft), undefined, lib.spells)
  const granted = grantedSpells(draft, lib.spells)
  const extras = extraSources(draft)
  const saved = draft.spells ?? []
  const byId = new Map(lib.spells.map(s => [s.id, s]))
  const setSpells = (spells: KnownSpell[]) => update({ spells: keepValidSpells({ ...draft, spells }) })
  const toggle = (key: string, id: string) =>
    setSpells(saved.some(k => k.classId === key && k.id === id) ? saved.filter(k => !(k.classId === key && k.id === id)) : [...saved, { id, classId: key }])
  const className = (id: string) => term('class', id, classById(id, draft.rulesEdition)?.name ?? lib.classes.find(c => c.id === id)?.name ?? id)

  if (!access.length && !granted.length && !extras.length) {
    return (
      <div className="builder-spells">
        <p className="hint">{t('builder.spells.none')}</p>
      </div>
    )
  }

  const current = access.find(a => a.classId === classId) ?? access[0]

  return (
    <div className="spellbook builder-spells">
      {access.length > 1 && (
        <div className="sb-classes" role="group" aria-label={t('spells.class')}>
          {access.map(a => (
            <button key={a.classId} type="button" className={`glass-chip${a === current ? ' on' : ''}`} aria-pressed={a === current} onClick={() => setClassId(a.classId)}>
              {className(a.classId)}
            </button>
          ))}
        </div>
      )}
      {current && <ClassSpells key={current.classId} access={current} spells={lib.spells} saved={saved} toggle={toggle} name={className(current.classId)} />}

      {granted.length > 0 && (
        <section className="bs-section">
          <h3 className="small">{t(editionOf(draft) === '2024' ? 'builder.spells.granted2024' : 'builder.spells.granted')} <Why id="grantedSpells" /></h3>
          <ul className="bs-granted">
            {granted.map(g => (
              <li key={g.spell.id} className={g.unlocked ? '' : 'locked'}>
                <SpellName name={g.spell.name} id={g.spell.id} />
                <span className="muted small">
                  {g.from !== g.spell.name ? `${term('trait', g.from, g.from)} · ` : ''}
                  {g.unlocked ? (g.spell.level === 0 ? t('spells.cantrip') : t('builder.spells.oncePerRest')) : t('builder.spells.atLevel', { level: g.atLevel })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {extras.map(source => (
        <ExtraSpells
          key={source.slot}
          source={source}
          spells={lib.spells}
          saved={saved}
          list={lists[source.slot] ?? extraList(source, saved)}
          setList={list => {
            setLists(l => ({ ...l, [source.slot]: list }))
            // Picks belong to one list; switching lists starts them over.
            setSpells(saved.filter(k => !k.classId.startsWith(`extra:${source.slot}:`)))
          }}
          toggle={toggle}
          className={className}
          title={source.kind === 'feat'
            ? term('feat', source.grantId, featById(source.grantId, draft.rulesEdition)?.name ?? source.grantId)
            : term('subrace', source.grantId, raceById(draft.raceId, draft.rulesEdition)?.subraces?.find(s => s.id === source.grantId)?.name ?? source.grantId)}
          fixedNames={(source.fixed ?? []).flatMap(id => { const n = byId.get(id)?.name; return n ? [spellName(id, n)] : [] })}
        />
      ))}
    </div>
  )
}

function ClassSpells({ access: a, spells, saved, toggle, name }: {
  access: SpellAccess
  spells: Spell[]
  saved: KnownSpell[]
  toggle: (key: string, id: string) => void
  name: string
}) {
  const { t, spellName } = useI18n()
  const pool = useMemo(() => availableSpells(spells, a).filter(s => !a.alwaysPrepared.includes(s.id)), [spells, a])
  const byId = new Map(spells.map(s => [s.id, s]))
  const mine = saved.filter(k => k.classId === a.classId).map(k => byId.get(k.id)).filter((s): s is Spell => !!s)
  const chosen = useMemo(() => new Set(saved.filter(k => k.classId === a.classId).map(k => k.id)), [saved, a.classId])
  const cantrips = mine.filter(s => s.level === 0).length
  const leveled = mine.filter(s => s.level > 0 && !a.alwaysPrepared.includes(s.id)).length
  const always = a.alwaysPrepared.map(id => byId.get(id)).filter((s): s is Spell => !!s)
  const hasLeveled = a.maxLevel > 0
  return (
    <section className="bs-section">
      <h3 className="small">{t('builder.spells.classTitle', { className: name, level: a.level })}</h3>
      <dl className="bs-counts">
        {a.cantrips > 0 && <Count label={t('spells.cantrips')} picked={cantrips} target={a.cantrips} why="cantrips" />}
        {hasLeveled && (a.spellbook != null
          ? <Count label={t('spells.spellbook')} picked={leveled} target={a.spellbook} why="spellbook" />
          : <Count label={t(a.kind === 'known' ? 'spells.known' : 'spells.prepared')} picked={leveled} target={a.limit} why={a.kind === 'known' ? 'spellsKnown' : 'spellsPrepared'} />)}
        {a.secrets?.count != null && <Count label={t('builder.spells.secrets')} picked={mine.filter(s => s.level > 0 && isSecret(s, a)).length} target={a.secrets.count} why="magicalSecrets" />}
      </dl>
      <p className="hint small">
        {!hasLeveled ? t('builder.spells.noSlotsYet')
          : a.spellbook != null ? t('builder.spells.hintSpellbook', { count: a.spellbook, prepared: a.limit })
          : a.kind === 'known' ? t('builder.spells.hintKnown', { count: a.limit })
          : t('builder.spells.hintPrepared', { count: a.limit })}
      </p>
      {a.secrets && (
        <p className="small">
          {a.secrets.lists ? t('builder.spells.secretsLists') : t('builder.spells.secretsAny', { count: a.secrets.count ?? 0 })} <Why id="magicalSecrets" />
        </p>
      )}
      {always.length > 0 && (
        <p className="small bs-always">
          {t('builder.spells.always')} <Why id="alwaysPrepared" />{' '}
          <bdi>{always.map(s => spellName(s.id, s.name)).join(', ')}</bdi>
        </p>
      )}
      <SpellPicker pool={pool} chosen={chosen} onToggle={s => toggle(a.classId, s.id)} label={t('builder.spells.pickFor', { name })} />
    </section>
  )
}

function ExtraSpells({ source, spells, saved, list, setList, toggle, className, title, fixedNames }: {
  source: ExtraSource
  spells: Spell[]
  saved: KnownSpell[]
  list: string
  setList: (list: string) => void
  toggle: (key: string, id: string) => void
  className: (id: string) => string
  title: string
  fixedNames: string[]
}) {
  const { t } = useI18n()
  const key = extraKey(source, list)
  const pool = useMemo(() => spells.filter(s => canPickExtra(s, source, list)), [spells, source, list])
  const byId = new Map(spells.map(s => [s.id, s]))
  const chosen = useMemo(() => new Set(saved.filter(k => k.classId === key).map(k => k.id)), [saved, key])
  const mine = [...chosen].map(id => byId.get(id)).filter((s): s is Spell => !!s)
  return (
    <Fold className="bs-section" defaultOpen={mine.length < source.cantrips + source.spells}
      title={t('builder.spells.fromSource', { name: title })} why={<Why id="extraSpells" />}
      status={source.cantrips + source.spells > 0 && t('builder.picks.count', { picked: mine.length, max: source.cantrips + source.spells })}>
      {!source.fixedList && source.lists.length > 1 && (
        <div className="sb-classes" role="group" aria-label={t('builder.spells.list')}>
          {source.lists.map(l => (
            <button key={l} type="button" className={`glass-chip${l === list ? ' on' : ''}`} aria-pressed={l === list} onClick={() => l !== list && setList(l)}>
              {className(l)}
            </button>
          ))}
        </div>
      )}
      {fixedNames.length > 0 && <p className="small">{t('builder.spells.alsoGives')} <bdi>{fixedNames.join(', ')}</bdi></p>}
      {(source.cantrips > 0 || source.spells > 0) && (
        <>
          <dl className="bs-counts">
            {source.cantrips > 0 && <Count label={t('spells.cantrips')} picked={mine.filter(s => s.level === 0).length} target={source.cantrips} why="cantrips" />}
            {source.spells > 0 && <Count label={t('builder.spells.level1')} picked={mine.filter(s => s.level > 0).length} target={source.spells} why="extraSpells" />}
          </dl>
          <SpellPicker pool={pool} chosen={chosen} onToggle={s => toggle(key, s.id)} label={t('builder.spells.pickFor', { name: title })} />
        </>
      )}
    </Fold>
  )
}
