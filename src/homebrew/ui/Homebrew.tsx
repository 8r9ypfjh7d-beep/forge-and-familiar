// Homebrew screen: a library of packs, a pack editor, and sharing with friends by code or file.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChangeHistory, deleteHistory, historyForSharing, importHistory, recordRevision, type RestoreMeta } from '../../history'
import { useI18n, type Translate } from '../../i18n'
import type { Character, UserProfile } from '../../model/character'
import { raceById } from '../../rules'
import { listCharacters, saveCharacter } from '../../storage'
import { allEntries, decodePack, describeEffect, encodeShareCode, entryId, newPack, PackError, sanitizeEntry, slug } from '../pack'
import { deletePack, importPack, listPacks, onPacksChanged, savePack } from '../store'
import type { Ability } from '../../rules'
import type { ContentKind, HomebrewEntry, HomebrewFeat, HomebrewItem, HomebrewPack, HomebrewRace, HomebrewSpell, HomebrewSubclass } from '../types'
import { FeatForm, ItemForm, RaceForm, SpellForm, SubclassForm } from './forms'
import './homebrew.css'

const shortId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12)

const KINDS: ContentKind[] = ['spells', 'items', 'feats', 'races', 'subclasses']

/** "2 spells · 1 item", or "Empty". */
const packCounts = (t: Translate, p: HomebrewPack) =>
  KINDS.filter(k => p[k].length).map(k => t(`hb.count.${k}`, { count: p[k].length })).join(' · ') || t('hb.count.empty')

export function Homebrew({ profile }: { profile: UserProfile }) {
  const [packs, setPacks] = useState<HomebrewPack[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const { t } = useI18n()
  const refresh = useCallback(() => { listPacks().then(setPacks) }, [])
  useEffect(() => {
    refresh()
    return onPacksChanged(refresh)
  }, [refresh])

  if (!packs) return null
  const open = packs.find(p => p.id === openId)
  if (open) return <PackEditor key={open.id} pack={open} profile={profile} onBack={() => setOpenId(null)} onOpen={setOpenId} />

  return (
    <Library
      packs={packs}
      profile={profile}
      onOpen={setOpenId}
      onCreate={async () => {
        const p = await savePack(newPack(shortId(), profile, t('hb.defaultName', { name: profile.displayName })))
        setOpenId(p.id)
      }}
    />
  )
}

function Library({ packs, profile, onOpen, onCreate }: {
  packs: HomebrewPack[]
  profile: UserProfile
  onOpen: (id: string) => void
  onCreate: () => void
}) {
  const { t } = useI18n()
  const sorted = [...packs].sort((a, b) => Number(b.authorId === profile.id) - Number(a.authorId === profile.id) || a.name.localeCompare(b.name))
  return (
    <section className="hb">
      <div className="row spread hb-hero">
        <div>
          <h2 className="glass-title">{t('hb.title')}</h2>
          <p className="muted small">{t('hb.lead')}</p>
        </div>
        <button className="glass-btn prominent" onClick={onCreate}>{t('hb.newPack')}</button>
      </div>
      {sorted.length === 0 ? (
        <div className="glass thin empty">
          <p>{t('hb.empty')}</p>
        </div>
      ) : (
        <div className="hb-packs">
          {sorted.map(p => (
            <button key={p.id} className="glass hb-pack" onClick={() => onOpen(p.id)}>
              <strong>{p.name}</strong>
              <span className="muted small">{p.authorId === profile.id ? t('hb.byYou') : t('hb.from', { name: p.authorName })} · {packCounts(t, p)}</span>
              {p.description && <span className="small hb-clamp">{p.description}</span>}
            </button>
          ))}
        </div>
      )}
      <ImportBox onImported={onOpen} />
    </section>
  )
}

function ImportBox({ onImported }: { onImported: (id: string) => void }) {
  const { t } = useI18n()
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const run = async (text: string) => {
    try {
      const pack = decodePack(text)
      const result = await importPack(pack)
      if (result !== 'unchanged') {
        if (pack.history) await importHistory(pack.history)
        else {
          for (const kind of ['spells', 'items', 'feats', 'races', 'subclasses'] as const) {
            for (const entry of pack[kind]) await recordRevision({ kind, entry, authorId: pack.authorId, authorName: pack.authorName, source: 'import' })
          }
        }
      }
      setCode('')
      setMsg({
        ok: true,
        text: t(`hb.import.${result}`, { pack: pack.name, name: pack.authorName }),
      })
      if (result !== 'unchanged') onImported(pack.id)
    } catch (e) {
      setMsg({ ok: false, text: e instanceof PackError ? e.message : t('hb.import.unreadable') })
    }
  }

  return (
    <div className="glass hb-import">
      <h3>{t('hb.import.title')}</h3>
      <form className="hb-import-row" onSubmit={e => { e.preventDefault(); if (code.trim()) run(code) }}>
        <textarea className="glass-field" rows={2} value={code} onChange={e => setCode(e.target.value)} placeholder={t('hb.import.placeholder')} aria-label={t('hb.import.aria')} />
        <div className="row">
          <button className="glass-btn prominent" disabled={!code.trim()}>{t('hb.import.code')}</button>
          <button type="button" className="glass-btn" onClick={() => fileRef.current?.click()}>{t('hb.import.file')}</button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async e => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              if (file.size > 2_000_000) return setMsg({ ok: false, text: t('hb.import.tooBig') })
              run(await file.text())
            }}
          />
        </div>
      </form>
      {msg && <p className={`small ${msg.ok ? 'good' : 'bad'}`} role="status">{msg.text}</p>}
    </div>
  )
}

type Editing =
  | { kind: 'spells'; entry: HomebrewSpell }
  | { kind: 'items'; entry: HomebrewItem }
  | { kind: 'feats'; entry: HomebrewFeat }
  | { kind: 'races'; entry: HomebrewRace }
  | { kind: 'subclasses'; entry: HomebrewSubclass }

function blank(kind: ContentKind): Editing {
  if (kind === 'spells') {
    return {
      kind, entry: {
        id: '', name: '', level: 1, school: 'Evocation', castingTime: '1 action', range: '60 feet',
        components: { v: true, s: true, m: false }, duration: 'Instantaneous', concentration: false, ritual: false,
        classes: [], description: '',
      },
    }
  }
  if (kind === 'items') return { kind, entry: { kind: 'gear', id: '', name: '', weight: 1 } }
  if (kind === 'races') {
    return {
      kind, entry: {
        id: '', name: '', size: 'Medium', speed: 30, abilityBonuses: {}, freeAbilityBonuses: 0, skillProficiencies: [],
        freeSkillChoices: 0, languages: ['Common'], languageChoices: 0, traits: [], hpPerLevel: 0,
      },
    }
  }
  if (kind === 'subclasses') return { kind, entry: { id: '', name: '', classId: 'fighter', features: [], armor: [] } }
  return { kind, entry: { id: '', name: '', description: '', effects: [] } }
}

function PackEditor({ pack, profile, onBack, onOpen }: {
  pack: HomebrewPack
  profile: UserProfile
  onBack: () => void
  onOpen: (id: string) => void
}) {
  const { t } = useI18n()
  const mine = pack.authorId === profile.id
  const [tab, setTab] = useState<ContentKind>('spells')
  const [editing, setEditing] = useState<Editing | null>(null)

  const saveEntry = async (e: Editing, meta?: RestoreMeta) => {
    const withId = <T extends { id: string; name: string }>(x: T): T => (x.id ? x : { ...x, id: entryId(pack, x.name) })
    const upsert = <T extends { id: string }>(list: T[], x: T) => (list.some(y => y.id === x.id) ? list.map(y => (y.id === x.id ? x : y)) : [...list, x])
    const next = { ...pack }
    let entry: HomebrewEntry
    if (e.kind === 'spells') next.spells = upsert(pack.spells, (entry = withId(e.entry)))
    else if (e.kind === 'items') next.items = upsert(pack.items, (entry = withId(e.entry)))
    else if (e.kind === 'races') next.races = upsert(pack.races, (entry = withId(e.entry)))
    else if (e.kind === 'subclasses') next.subclasses = upsert(pack.subclasses, (entry = withId(e.entry)))
    else next.feats = upsert(pack.feats, (entry = withId(e.entry)))
    await savePack(next)
    await recordRevision({ kind: e.kind, entry, authorId: profile.id, authorName: profile.displayName, ...meta })
    setEditing(null)
  }

  /** History versions may come from a friend's file, so they are rebuilt like an import before saving. */
  const restore = async (kind: ContentKind, raw: unknown, meta: RestoreMeta) => {
    await saveEntry({ kind, entry: sanitizeEntry(kind, raw, pack.id) } as Editing, meta)
  }

  const removeEntry = async (kind: ContentKind, id: string, name: string) => {
    const warn = kind === 'items' ? t('hb.deleteWarnItem') : kind === 'races' || kind === 'subclasses' ? t('hb.deleteWarnBonus') : ''
    if (!confirm(t('hb.deleteConfirm', { name }) + warn)) return
    await savePack({ ...pack, [kind]: (pack[kind] as { id: string }[]).filter(x => x.id !== id) })
  }

  const duplicate = async () => {
    const id = shortId()
    const rename = <T extends { id: string }>(x: T): T => ({ ...x, id: x.id.replace(`hb:${pack.id}:`, `hb:${id}:`) })
    const copy = await savePack({
      ...newPack(id, profile, t('hb.copyName', { name: pack.name })),
      description: pack.description,
      spells: pack.spells.map(rename), items: pack.items.map(rename), feats: pack.feats.map(rename),
      races: pack.races.map(r => ({ ...rename(r), parentRaceId: r.parentRaceId?.replace(`hb:${pack.id}:`, `hb:${id}:`) })),
      subclasses: pack.subclasses.map(rename),
    })
    onOpen(copy.id)
  }

  return (
    <section className="hb">
      <div className="row hb-head">
        <button className="glass-btn icon" onClick={onBack} aria-label={t('hb.back')}>{t('common.backArrow')}</button>
        <div className="hb-title">
          {mine ? (
            <input
              className="hb-name glass-title"
              defaultValue={pack.name}
              aria-label={t('hb.packName')}
              onBlur={e => { const name = e.target.value.trim(); if (name && name !== pack.name) savePack({ ...pack, name }) }}
            />
          ) : <h2 className="hb-name glass-title">{pack.name}</h2>}
          <p className="muted small">{mine ? t('hb.yourPack') : t('hb.readOnly', { name: pack.authorName })} · {packCounts(t, pack)}</p>
        </div>
        {!mine && <button className="glass-btn" onClick={duplicate}>{t('hb.copy')}</button>}
        <button
          className="glass-btn hb-danger"
          onClick={async () => {
            if (confirm(t('hb.removeConfirm', { name: pack.name }))) {
              await deletePack(pack.id)
              await deleteHistory(`hb:${pack.id}:`)
              onBack()
            }
          }}
        >
          {mine ? t('hb.deletePack') : t('hb.removePack')}
        </button>
      </div>

      {mine ? (
        <textarea
          className="hb-desc glass-field"
          rows={2}
          defaultValue={pack.description}
          placeholder={t('hb.descPlaceholder')}
          aria-label={t('hb.descAria')}
          onBlur={e => { if (e.target.value !== pack.description) savePack({ ...pack, description: e.target.value }) }}
        />
      ) : pack.description && <p>{pack.description}</p>}

      <div className="hb-body">
        <div>
          <div className="row hb-toolbar">
            <div className="glass-segmented hb-tabs" role="tablist" aria-label={t('hb.kinds')}>
              {KINDS.map(k => (
                <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setEditing(null) }}>
                  {t(`hb.tab.${k}`)} ({pack[k].length})
                </button>
              ))}
            </div>
            {mine && !editing && <button className="glass-btn prominent small hb-add" onClick={() => setEditing(blank(tab))}>{t(`hb.new.${tab}`)}</button>}
          </div>

          {editing?.kind === 'spells' && <SpellForm key={editing.entry.id || 'new'} initial={editing.entry} onSave={entry => saveEntry({ kind: 'spells', entry })} onCancel={() => setEditing(null)} />}
          {editing?.kind === 'items' && <ItemForm key={editing.entry.id || 'new'} initial={editing.entry} onSave={entry => saveEntry({ kind: 'items', entry })} onCancel={() => setEditing(null)} />}
          {editing?.kind === 'feats' && <FeatForm key={editing.entry.id || 'new'} initial={editing.entry} onSave={entry => saveEntry({ kind: 'feats', entry })} onCancel={() => setEditing(null)} />}
          {editing?.kind === 'races' && <RaceForm key={editing.entry.id || 'new'} initial={editing.entry} pack={pack} onSave={entry => saveEntry({ kind: 'races', entry })} onCancel={() => setEditing(null)} />}
          {editing?.kind === 'subclasses' && <SubclassForm key={editing.entry.id || 'new'} initial={editing.entry} onSave={entry => saveEntry({ kind: 'subclasses', entry })} onCancel={() => setEditing(null)} />}

          {!editing && (
            <EntryList
              kind={tab}
              pack={pack}
              mine={mine}
              profile={profile}
              onEdit={(kind, entry) => setEditing({ kind, entry } as Editing)}
              onDelete={removeEntry}
              onRestore={mine ? restore : undefined}
            />
          )}
        </div>
        <SharePanel pack={pack} />
      </div>
    </section>
  )
}

function EntryList({ kind, pack, mine, profile, onEdit, onDelete, onRestore }: {
  kind: ContentKind
  pack: HomebrewPack
  mine: boolean
  profile: UserProfile
  onEdit: (kind: ContentKind, entry: HomebrewEntry) => void
  onDelete: (kind: ContentKind, id: string, name: string) => void
  onRestore?: (kind: ContentKind, entry: unknown, meta: RestoreMeta) => Promise<void>
}) {
  const i18n = useI18n()
  const { t } = i18n
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const entries = [...(pack[kind] as (HomebrewEntry)[])].sort((a, b) => a.name.localeCompare(b.name))
  if (entries.length === 0) {
    return <div className="glass thin empty"><p className="muted">{t(`hb.none.${kind}`)}</p></div>
  }
  return (
    <ul className="plain hb-entries">
      {entries.map(e => (
        <li key={e.id} className="glass hb-entry">
          <div className="row spread">
            <div>
              <h3 className="glass-title">{e.name}</h3>
              <p className="muted small">{subtitle(i18n, kind, e)}</p>
            </div>
            <div className="row hb-entry-actions">
              {kind === 'items' && <GiveToCharacter item={e as HomebrewItem} profile={profile} />}
              <button className={`glass-btn small hb-ghost ${historyFor === e.id ? 'glass-lens' : ''}`} aria-expanded={historyFor === e.id} onClick={() => setHistoryFor(historyFor === e.id ? null : e.id)}>{t('hb.history')}</button>
              {mine && <button className="glass-btn small" onClick={() => onEdit(kind, e)}>{t('hb.edit')}</button>}
              {mine && <button className="glass-btn small hb-ghost hb-danger" onClick={() => onDelete(kind, e.id, e.name)}>{t('hb.delete')}</button>}
            </div>
          </div>
          <EntryBody i18n={i18n} kind={kind} entry={e} />
          {historyFor === e.id && (
            <ChangeHistory
              entryId={e.id}
              userId={profile.id}
              packAuthorId={pack.authorId}
              onRestore={onRestore && (async (entry, meta) => onRestore(kind, entry, meta))}
            />
          )}
        </li>
      ))}
    </ul>
  )
}

type I18n = ReturnType<typeof useI18n>

function subtitle({ t, className }: I18n, kind: ContentKind, e: HomebrewEntry): string {
  if (kind === 'spells') {
    const s = e as HomebrewSpell
    const school = t(`hb.school.${s.school}`)
    const lvl = s.level === 0 ? t('hb.sub.cantrip', { school }) : t('hb.sub.level', { level: s.level, school })
    return [lvl, s.ritual && t('hb.sub.ritual'), s.concentration && t('hb.sub.concentration')].filter(Boolean).join(' · ')
  }
  if (kind === 'items') {
    const i = e as HomebrewItem
    const what = i.kind === 'weapon' ? `${t('hb.sub.weapon', { category: t(`hb.cat.${i.category}`) })} · ${i.damage} ${i.damageType}${i.versatile ? ` (${i.versatile})` : ''}`
      : i.kind === 'armor' ? (i.category === 'shield' ? t('hb.sub.shield', { ac: i.baseAc })
        : t('hb.sub.armor', { category: t(`hb.cat.${i.category}`), ac: i.baseAc }) + (i.dexCap === undefined ? t('hb.sub.dex') : i.dexCap > 0 ? t('hb.sub.dexMax', { max: i.dexCap }) : ''))
      : t('hb.sub.gear')
    return [i.rarity && t(`hb.rarity.${i.rarity}`), what, t('hb.sub.weight', { weight: i.weight })].filter(Boolean).join(' · ')
  }
  if (kind === 'races') {
    const r = e as HomebrewRace
    if (r.parentRaceId) return t('hb.sub.subraceOf', { race: raceById(r.parentRaceId)?.name ?? t('hb.sub.unknownRace') })
    return t('hb.sub.race', { size: t(r.size === 'Small' ? 'hb.f.small' : 'hb.f.medium'), speed: r.speed })
  }
  if (kind === 'subclasses') {
    const sc = e as HomebrewSubclass
    return t('hb.sub.subclass', { class: className(sc.classId) })
  }
  const f = e as HomebrewFeat
  return f.prerequisite ? t('hb.sub.prereq', { text: f.prerequisite }) : t('hb.sub.feat')
}

function EntryBody({ i18n, kind, entry }: { i18n: I18n; kind: ContentKind; entry: HomebrewEntry }) {
  const { t, className, ability, abilityShort, skill } = i18n
  const list = (xs: string[]) => xs.join(', ')
  if (kind === 'spells') {
    const s = entry as HomebrewSpell
    const comps = [s.components.v && 'V', s.components.s && 'S', s.components.m && `M (${s.components.material})`].filter(Boolean).join(', ')
    return (
      <>
        <dl className="hb-stats small">
          <div><dt>{t('hb.stat.castingTime')}</dt><dd>{s.castingTime}</dd></div>
          <div><dt>{t('hb.stat.range')}</dt><dd>{s.range}</dd></div>
          <div><dt>{t('hb.stat.components')}</dt><dd>{comps || t('hb.stat.none')}</dd></div>
          <div><dt>{t('hb.stat.duration')}</dt><dd>{s.concentration ? t('hb.stat.concentrationDur', { duration: s.duration }) : s.duration}</dd></div>
          {s.damage && <div><dt>{t('hb.stat.roll')}</dt><dd>{s.damage} {s.damageType}</dd></div>}
          {s.save && <div><dt>{t('hb.stat.save')}</dt><dd>{ability(s.save)}</dd></div>}
        </dl>
        <p className="hb-text">{s.description}</p>
        {s.higherLevels && <p className="hb-text"><em>{t('hb.higherLevels')}</em> {s.higherLevels}</p>}
        {s.classes.length > 0 && <p className="muted small">{t('hb.classes', { list: list(s.classes.map(className)) })}</p>}
      </>
    )
  }
  if (kind === 'items') {
    const i = entry as HomebrewItem
    return (
      <>
        {i.kind === 'weapon' && i.properties.length > 0 && <p className="small">{t('hb.properties', { list: list(i.properties.map(p => t(`hb.prop.${p}`))) })}{i.range ? t('hb.propRange', { range: i.range }) : ''}</p>}
        {i.kind === 'armor' && (i.strengthReq || i.stealthDisadvantage) && (
          <p className="small">{[i.strengthReq && t('hb.strength', { n: i.strengthReq }), i.stealthDisadvantage && t('hb.stealthDis')].filter(Boolean).join(' · ')}</p>
        )}
        {i.description && <p className="hb-text">{i.description}</p>}
      </>
    )
  }
  if (kind === 'races') {
    const r = entry as HomebrewRace
    const choice = (count: number) => (count ? [t('hb.race.choice', { count })] : [])
    const bonuses = Object.entries(r.abilityBonuses).map(([a, n]) => `${abilityShort(a as Ability)} ${n! >= 0 ? '+' : ''}${n}`)
    if (r.freeAbilityBonuses) bonuses.push(t('hb.race.freeBonus', { count: r.freeAbilityBonuses }))
    const lines = [
      bonuses.length > 0 && t('hb.race.scores', { list: list(bonuses) }),
      r.traits.length > 0 && t('hb.race.traits', { list: list(r.traits) }),
      !r.parentRaceId && t('hb.race.languages', { list: list([...r.languages, ...choice(r.languageChoices)]) || t('hb.race.none') }),
      (r.skillProficiencies.length > 0 || r.freeSkillChoices > 0) && t('hb.race.skills', { list: list([...r.skillProficiencies.map(skill), ...choice(r.freeSkillChoices)]) }),
      r.hpPerLevel > 0 && t('hb.race.hp', { n: r.hpPerLevel }),
    ].filter(Boolean)
    return (
      <>
        {lines.map(l => <p key={l as string} className="small">{l}</p>)}
        {r.description && <p className="hb-text">{r.description}</p>}
      </>
    )
  }
  if (kind === 'subclasses') {
    const sc = entry as HomebrewSubclass
    return (
      <>
        {sc.features.length > 0 && <p className="small">{[...sc.features].sort((a, b) => a.level - b.level).map(f => `${f.level}: ${f.name}`).join(' · ')}</p>}
        {sc.armor.length > 0 && <p className="small">{t('hb.armorList', { list: list(sc.armor.map(a => t(`hb.cat.${a}`))) })}</p>}
        {sc.description && <p className="hb-text">{sc.description}</p>}
      </>
    )
  }
  const f = entry as HomebrewFeat
  return (
    <>
      <p className="hb-text">{f.description}</p>
      {f.effects.length > 0 && <p className="small">{f.effects.map(describeEffect).join(' · ')}</p>}
    </>
  )
}

function GiveToCharacter({ item, profile }: { item: HomebrewItem; profile: UserProfile }) {
  const { t, className } = useI18n()
  const [chars, setChars] = useState<Character[] | null>(null)
  const [done, setDone] = useState('')
  if (done) return <span className="small good" role="status">{done}</span>
  if (!chars) {
    return <button className="glass-btn small" onClick={() => listCharacters(profile.id).then(setChars)}>{t('hb.give')}</button>
  }
  if (chars.length === 0) return <span className="small muted">{t('hb.give.none')}</span>
  return (
    <select
      className="glass-field"
      autoFocus
      aria-label={t('hb.give.aria', { item: item.name })}
      defaultValue=""
      onBlur={() => setChars(null)}
      onChange={async e => {
        const c = chars.find(x => x.id === e.target.value)
        if (!c) return
        const stack = c.inventory.find(x => x.itemId === item.id)
        const inventory = stack
          ? c.inventory.map(x => (x === stack ? { ...x, qty: x.qty + 1 } : x))
          : [...c.inventory, { uid: crypto.randomUUID(), itemId: item.id, qty: 1, equipped: false }]
        await saveCharacter({ ...c, inventory })
        setDone(t('hb.give.done', { name: c.name }))
      }}
    >
      <option value="" disabled>{t('hb.give.choose')}</option>
      {chars.map(c => <option key={c.id} value={c.id}>{c.name} ({c.classes.map(cl => className(cl.classId)).join('/')})</option>)}
    </select>
  )
}

function SharePanel({ pack }: { pack: HomebrewPack }) {
  const { t } = useI18n()
  const code = encodeShareCode(pack)
  const [copiedCode, setCopiedCode] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
    } catch {
      ref.current?.select()
    }
  }
  const download = async () => {
    const history = await historyForSharing(allEntries(pack).map(e => e.id))
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...pack, history }, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug(pack.name)}.ffhomebrew.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <aside className="glass thick hb-share">
      <h3>{t('hb.share.title')}</h3>
      <p className="muted small">{t('hb.share.lead')}</p>
      <textarea className="glass-field" ref={ref} readOnly rows={4} value={code} aria-label={t('hb.import.aria')} onFocus={e => e.target.select()} />
      <div className="row">
        <button className="glass-btn prominent small" onClick={copy}>{copiedCode === code ? t('hb.share.copied') : t('hb.share.copy')}</button>
        <button className="glass-btn small" onClick={download}>{t('hb.share.download')}</button>
      </div>
      <p className="muted small">{t('hb.share.size', { kb: Math.ceil(code.length / 1024) })}</p>
    </aside>
  )
}
