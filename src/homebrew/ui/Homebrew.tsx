// Homebrew screen: a library of packs, a pack editor, and sharing with friends by code or file.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChangeHistory, deleteHistory, historyForSharing, importHistory, recordRevision, type RestoreMeta } from '../../history'
import type { Character, UserProfile } from '../../model/character'
import { classById, raceById } from '../../rules'
import { listCharacters, saveCharacter } from '../../storage'
import { allEntries, decodePack, describeEffect, encodeShareCode, entryId, newPack, packCounts, PackError, sanitizeEntry, slug } from '../pack'
import { deletePack, importPack, listPacks, onPacksChanged, savePack } from '../store'
import type { ContentKind, HomebrewEntry, HomebrewFeat, HomebrewItem, HomebrewPack, HomebrewRace, HomebrewSpell, HomebrewSubclass } from '../types'
import { FeatForm, ItemForm, RaceForm, SpellForm, SubclassForm } from './forms'
import './homebrew.css'

const shortId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12)

export function Homebrew({ profile }: { profile: UserProfile }) {
  const [packs, setPacks] = useState<HomebrewPack[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
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
        const p = await savePack(newPack(shortId(), profile, `${profile.displayName}'s homebrew`))
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
  const sorted = [...packs].sort((a, b) => Number(b.authorId === profile.id) - Number(a.authorId === profile.id) || a.name.localeCompare(b.name))
  return (
    <section className="hb">
      <div className="row spread hb-hero">
        <div>
          <h2 className="glass-title">Homebrew</h2>
          <p className="muted small">Your group's own spells, items, feats, races and subclasses. Share a pack with friends by code or file; nothing is public.</p>
        </div>
        <button className="glass-btn prominent" onClick={onCreate}>+ New pack</button>
      </div>
      {sorted.length === 0 ? (
        <div className="glass thin empty">
          <p>No homebrew yet. Start a pack, or import one a friend sent you.</p>
        </div>
      ) : (
        <div className="hb-packs">
          {sorted.map(p => (
            <button key={p.id} className="glass hb-pack" onClick={() => onOpen(p.id)}>
              <strong>{p.name}</strong>
              <span className="muted small">{p.authorId === profile.id ? 'By you' : `From ${p.authorName}`} · {packCounts(p)}</span>
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
        text: result === 'added' ? `Added "${pack.name}" from ${pack.authorName}.`
          : result === 'updated' ? `Updated "${pack.name}" to ${pack.authorName}'s latest version.`
          : `You already have the latest "${pack.name}".`,
      })
      if (result !== 'unchanged') onImported(pack.id)
    } catch (e) {
      setMsg({ ok: false, text: e instanceof PackError ? e.message : "That pack couldn't be read." })
    }
  }

  return (
    <div className="glass hb-import">
      <h3>Import a friend's pack</h3>
      <form className="hb-import-row" onSubmit={e => { e.preventDefault(); if (code.trim()) run(code) }}>
        <textarea className="glass-field" rows={2} value={code} onChange={e => setCode(e.target.value)} placeholder="Paste a share code (FFHB1.…)" aria-label="Share code" />
        <div className="row">
          <button className="glass-btn prominent" disabled={!code.trim()}>Import code</button>
          <button type="button" className="glass-btn" onClick={() => fileRef.current?.click()}>Open file…</button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async e => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              if (file.size > 2_000_000) return setMsg({ ok: false, text: 'That file is too big to be a homebrew pack.' })
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

const TAB_LABEL: Record<ContentKind, string> = { spells: 'Spells', items: 'Items', feats: 'Feats', races: 'Races', subclasses: 'Subclasses' }
const SINGULAR: Record<ContentKind, string> = { spells: 'spell', items: 'item', feats: 'feat', races: 'race', subclasses: 'subclass' }

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
    const warn = kind === 'items' ? ' Characters carrying it will show it as an unknown item.'
      : kind === 'races' || kind === 'subclasses' ? ' Characters using it lose its bonuses until it is added back.' : ''
    if (!confirm(`Delete ${name}?${warn}`)) return
    await savePack({ ...pack, [kind]: (pack[kind] as { id: string }[]).filter(x => x.id !== id) })
  }

  const duplicate = async () => {
    const id = shortId()
    const rename = <T extends { id: string }>(x: T): T => ({ ...x, id: x.id.replace(`hb:${pack.id}:`, `hb:${id}:`) })
    const copy = await savePack({
      ...newPack(id, profile, `${pack.name} (my copy)`),
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
        <button className="glass-btn icon" onClick={onBack} aria-label="Back to homebrew">←</button>
        <div className="hb-title">
          {mine ? (
            <input
              className="hb-name glass-title"
              defaultValue={pack.name}
              aria-label="Pack name"
              onBlur={e => { const name = e.target.value.trim(); if (name && name !== pack.name) savePack({ ...pack, name }) }}
            />
          ) : <h2 className="hb-name glass-title">{pack.name}</h2>}
          <p className="muted small">{mine ? 'Your pack' : `From ${pack.authorName}, read-only`} · {packCounts(pack)}</p>
        </div>
        {!mine && <button className="glass-btn" onClick={duplicate}>Make my own copy</button>}
        <button
          className="glass-btn hb-danger"
          onClick={async () => {
            if (confirm(`Remove "${pack.name}" from this device? Characters carrying its items will show them as unknown.`)) {
              await deletePack(pack.id)
              await deleteHistory(`hb:${pack.id}:`)
              onBack()
            }
          }}
        >
          {mine ? 'Delete pack' : 'Remove'}
        </button>
      </div>

      {mine ? (
        <textarea
          className="hb-desc glass-field"
          rows={2}
          defaultValue={pack.description}
          placeholder="What is this pack for? (campaign, setting, house rules)"
          aria-label="Pack description"
          onBlur={e => { if (e.target.value !== pack.description) savePack({ ...pack, description: e.target.value }) }}
        />
      ) : pack.description && <p>{pack.description}</p>}

      <div className="hb-body">
        <div>
          <div className="row hb-toolbar">
            <div className="glass-segmented hb-tabs" role="tablist">
              {(Object.keys(TAB_LABEL) as ContentKind[]).map(k => (
                <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setEditing(null) }}>
                  {TAB_LABEL[k]} ({pack[k].length})
                </button>
              ))}
            </div>
            {mine && !editing && <button className="glass-btn prominent small hb-add" onClick={() => setEditing(blank(tab))}>+ New {SINGULAR[tab]}</button>}
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
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const entries = [...(pack[kind] as (HomebrewEntry)[])].sort((a, b) => a.name.localeCompare(b.name))
  if (entries.length === 0) {
    return <div className="glass thin empty"><p className="muted">No {TAB_LABEL[kind].toLowerCase()} in this pack yet.</p></div>
  }
  return (
    <ul className="plain hb-entries">
      {entries.map(e => (
        <li key={e.id} className="glass hb-entry">
          <div className="row spread">
            <div>
              <h3 className="glass-title">{e.name}</h3>
              <p className="muted small">{subtitle(kind, e)}</p>
            </div>
            <div className="row hb-entry-actions">
              {kind === 'items' && <GiveToCharacter item={e as HomebrewItem} profile={profile} />}
              <button className={`glass-btn small hb-ghost ${historyFor === e.id ? 'glass-lens' : ''}`} aria-expanded={historyFor === e.id} onClick={() => setHistoryFor(historyFor === e.id ? null : e.id)}>History</button>
              {mine && <button className="glass-btn small" onClick={() => onEdit(kind, e)}>Edit</button>}
              {mine && <button className="glass-btn small hb-ghost hb-danger" onClick={() => onDelete(kind, e.id, e.name)}>Delete</button>}
            </div>
          </div>
          <EntryBody kind={kind} entry={e} />
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

function subtitle(kind: ContentKind, e: HomebrewEntry): string {
  if (kind === 'spells') {
    const s = e as HomebrewSpell
    const lvl = s.level === 0 ? `${s.school} cantrip` : `Level ${s.level} ${s.school.toLowerCase()}`
    return [lvl, s.ritual && 'ritual', s.concentration && 'concentration'].filter(Boolean).join(' · ')
  }
  if (kind === 'items') {
    const i = e as HomebrewItem
    const what = i.kind === 'weapon' ? `${i.category} weapon · ${i.damage} ${i.damageType}${i.versatile ? ` (${i.versatile})` : ''}`
      : i.kind === 'armor' ? (i.category === 'shield' ? `shield · +${i.baseAc} AC` : `${i.category} armor · AC ${i.baseAc}${i.dexCap === undefined ? ' + DEX' : i.dexCap > 0 ? ` + DEX (max ${i.dexCap})` : ''}`)
      : 'gear'
    return [i.rarity, what, `${i.weight} lb`].filter(Boolean).join(' · ')
  }
  if (kind === 'races') {
    const r = e as HomebrewRace
    if (r.parentRaceId) return `Subrace of ${raceById(r.parentRaceId)?.name ?? 'a race not on this device'}`
    return `${r.size} · speed ${r.speed} ft.`
  }
  if (kind === 'subclasses') {
    const sc = e as HomebrewSubclass
    return `${classById(sc.classId)?.name ?? sc.classId} subclass`
  }
  const f = e as HomebrewFeat
  return f.prerequisite ? `Prerequisite: ${f.prerequisite}` : 'Feat'
}

function EntryBody({ kind, entry }: { kind: ContentKind; entry: HomebrewEntry }) {
  if (kind === 'spells') {
    const s = entry as HomebrewSpell
    const comps = [s.components.v && 'V', s.components.s && 'S', s.components.m && `M (${s.components.material})`].filter(Boolean).join(', ')
    return (
      <>
        <dl className="hb-stats small">
          <div><dt>Casting time</dt><dd>{s.castingTime}</dd></div>
          <div><dt>Range</dt><dd>{s.range}</dd></div>
          <div><dt>Components</dt><dd>{comps || 'None'}</dd></div>
          <div><dt>Duration</dt><dd>{s.concentration ? `Concentration, ${s.duration}` : s.duration}</dd></div>
          {s.damage && <div><dt>Roll</dt><dd>{s.damage} {s.damageType}</dd></div>}
          {s.save && <div><dt>Save</dt><dd>{s.save.toUpperCase()}</dd></div>}
        </dl>
        <p className="hb-text">{s.description}</p>
        {s.higherLevels && <p className="hb-text"><em>At higher levels.</em> {s.higherLevels}</p>}
        {s.classes.length > 0 && <p className="muted small">Classes: {s.classes.map(id => classById(id)?.name ?? id).join(', ')}</p>}
      </>
    )
  }
  if (kind === 'items') {
    const i = entry as HomebrewItem
    return (
      <>
        {i.kind === 'weapon' && i.properties.length > 0 && <p className="small">Properties: {i.properties.join(', ')}{i.range ? ` (range ${i.range})` : ''}</p>}
        {i.kind === 'armor' && (i.strengthReq || i.stealthDisadvantage) && (
          <p className="small">{[i.strengthReq && `Strength ${i.strengthReq}`, i.stealthDisadvantage && 'Stealth disadvantage'].filter(Boolean).join(' · ')}</p>
        )}
        {i.description && <p className="hb-text">{i.description}</p>}
      </>
    )
  }
  if (kind === 'races') {
    const r = entry as HomebrewRace
    const bonuses = Object.entries(r.abilityBonuses).map(([a, n]) => `${a.toUpperCase()} ${n! >= 0 ? '+' : ''}${n}`)
    if (r.freeAbilityBonuses) bonuses.push(`+1 to ${r.freeAbilityBonuses} of your choice`)
    const lines = [
      bonuses.length > 0 && `Ability scores: ${bonuses.join(', ')}`,
      r.traits.length > 0 && `Traits: ${r.traits.join(', ')}`,
      !r.parentRaceId && `Languages: ${[...r.languages, ...(r.languageChoices ? [`${r.languageChoices} of your choice`] : [])].join(', ') || 'none'}`,
      (r.skillProficiencies.length > 0 || r.freeSkillChoices > 0) && `Skills: ${[...r.skillProficiencies, ...(r.freeSkillChoices ? [`${r.freeSkillChoices} of your choice`] : [])].join(', ')}`,
      r.hpPerLevel > 0 && `+${r.hpPerLevel} HP per level`,
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
        {sc.armor.length > 0 && <p className="small">Armor: {sc.armor.join(', ')}</p>}
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
  const [chars, setChars] = useState<Character[] | null>(null)
  const [done, setDone] = useState('')
  if (done) return <span className="small good" role="status">{done}</span>
  if (!chars) {
    return <button className="glass-btn small" onClick={() => listCharacters(profile.id).then(setChars)}>Give to…</button>
  }
  if (chars.length === 0) return <span className="small muted">No characters yet</span>
  return (
    <select
      className="glass-field"
      autoFocus
      aria-label={`Give ${item.name} to a character`}
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
        setDone(`Given to ${c.name}`)
      }}
    >
      <option value="" disabled>Choose character</option>
      {chars.map(c => <option key={c.id} value={c.id}>{c.name} ({c.classes.map(cl => classById(cl.classId)?.name ?? cl.classId).join('/')})</option>)}
    </select>
  )
}

function SharePanel({ pack }: { pack: HomebrewPack }) {
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
      <h3>Share with friends</h3>
      <p className="muted small">Send this code or file to your group. When you update the pack, share again and their import updates their copy.</p>
      <textarea className="glass-field" ref={ref} readOnly rows={4} value={code} aria-label="Share code" onFocus={e => e.target.select()} />
      <div className="row">
        <button className="glass-btn prominent small" onClick={copy}>{copiedCode === code ? 'Copied' : 'Copy code'}</button>
        <button className="glass-btn small" onClick={download}>Download file</button>
      </div>
      <p className="muted small">{Math.ceil(code.length / 1024)} KB · long packs share better as a file.</p>
    </aside>
  )
}
