// The NPC creator: the hero builder's shell (step bar, Back/Next, why? tips, Random button) over a monster stat
// block. Who → Stat block → Tweak → Spells → Review. Saving writes an NpcSheet through src/npc/store; the sheet
// screen reuses this wizard as its Edit mode (`editing`). Only the DM reaches it (#/npc/new, canOpen('npc')).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChoicePicker, Fold, matches, type PickItem } from '../../builder/Compact'
import { Why } from '../../builder/Why'
import { loadKind, monsterKey, monsterSourceNote, type Edition, type LoadedMonster, type MonsterSpellcasting, type Spell } from '../../content'
import { loadMonsters, BOOK_TITLES } from '../../content'
import { loadDm, saveDm } from '../../dm/store'
import { addMonster, npcPlanEntry, updatePlan } from '../../dm/logic'
import { readDmEdition } from '../../dm/edition'
import { randomName } from '../../dm/logic'
import { useDice } from '../../dice/ui'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n/locales/en'
import { crLabel, MonsterForm, sanitizeMonsterBlock, StatBlock, type Block } from '../../monsters'
import { SearchField } from '../../rulesqa/SearchField'
import { formatMod, type Ability } from '../../rules'
import { newNpc, normalize } from '../engine'
import { randomNpcPick } from '../random'
import { GROUP_PRESETS, parseSpellcasting, spellAttackBonus, spellSaveDc, spellcastingText, spellcastingTrait } from '../spellcasting'
import { getNpc, listNpcs, saveNpc } from '../store'
import type { NpcSheet } from '../types'
import { NpcSheet as NpcSheetScreen } from './NpcSheet'
import { takeNpcPrefill, type NpcPrefill } from './prefill'
import './npc-builder.css'

const STEPS = ['who', 'block', 'tweak', 'spells', 'review'] as const
type StepId = (typeof STEPS)[number]
const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const CRS = [0, 0.125, 0.25, 0.5, ...Array.from({ length: 30 }, (_, i) => i + 1)]
const newId = () => crypto.randomUUID()

/** A Medium humanoid with 10s across, CR 0: the "Start from scratch" block. */
export function blankBlock(edition: Edition): Block {
  return {
    id: `npc-${newId()}`, name: 'Commoner', source: 'npc', edition,
    sizes: ['Medium'], type: 'humanoid', alignment: 'any alignment',
    armorClass: [{ value: 10 }], hitPoints: 4, hitDice: '1d8', hitPointsRoll: '1d8',
    speed: { walk: '30 ft.' },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: {}, skills: {}, damageVulnerabilities: [], damageResistances: [], damageImmunities: [], conditionImmunities: [],
    senses: { passive_perception: 10 }, languages: 'Common', challengeRating: 0, xp: 10, proficiencyBonus: 2,
    traits: [], actions: [{ name: 'Club', description: 'Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 2 (1d4) bludgeoning damage.', attackBonus: 2, damage: [{ dice: '1d4', type: 'bludgeoning' }] }],
    bonusActions: [], reactions: [], legendaryActions: [], forms: [],
  }
}

/** Average of a hit dice expression ("9d8+18" → 58), for the Average HP choice on a changed block. */
export function averageHp(roll: string): number | undefined {
  const m = /^\s*(\d+)d(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i.exec(roll)
  if (!m) return undefined
  const n = Number(m[1]), d = Number(m[2]), bonus = m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0
  return Math.max(1, Math.floor(n * (d + 1) / 2) + bonus)
}

interface Draft {
  name: string
  role: string
  portrait?: string
  notes: string
  partyId?: string
  base?: NpcSheet['base']
  block: Block
  /** A block was chosen (from the library, from scratch or copied); the Stat block step is done. */
  picked: boolean
  hpMode: 'average' | 'roll' | 'type'
}

const copyBlock = (m: Block): Block => JSON.parse(JSON.stringify(m)) as Block
/** A library block as an NPC starts it: a copy, with the Spellcasting trait read into the structured field so the sheet counts slots. */
const fromLibrary = (m: Block): Block => {
  const b = copyBlock(m)
  const { legacy: _legacy, ...rest } = b as Block & { legacy?: boolean }
  const sc = parseSpellcasting(rest)
  return sc && sc.groups.length ? { ...rest, spellcasting: sc } : rest
}
const baseOf = (m: Block): NpcSheet['base'] => ({ source: m.source, id: m.id, name: m.name })

function draftFrom(npc: NpcSheet): Draft {
  return { name: npc.name, role: npc.role ?? '', portrait: npc.portrait, notes: npc.notes, partyId: npc.partyId, base: npc.base, block: copyBlock(npc.block), picked: true, hpMode: 'type' }
}

function emptyDraft(edition: Edition, partyId?: string): Draft {
  return { name: '', role: '', notes: '', partyId, block: blankBlock(edition), picked: false, hpMode: 'average' }
}

export function NpcBuilder({ ownerId, partyId, editing, onSaved, onCancel }: {
  ownerId: string
  /** The campaign being run; new NPCs belong to it unless the DM unticks that. */
  partyId?: string
  /** Edit mode: the sheet's own wizard over a saved NPC; play state is kept. */
  editing?: NpcSheet
  /** `back` is 'fights' when the creator was opened from a fight plan. */
  onSaved: (npc: NpcSheet, back?: 'fights') => void
  onCancel: (back?: 'fights') => void
}) {
  const { t, monsterName } = useI18n()
  const [edition, setEdition] = useState<Edition>(() => editing?.block.edition ?? readDmEdition())
  const [prefill] = useState<NpcPrefill | undefined>(() => (editing ? undefined : takeNpcPrefill()))
  const [draft, setDraft] = useState<Draft>(() => {
    if (editing) return draftFrom(editing)
    const d = emptyDraft(edition, prefill?.partyId ?? partyId)
    if (prefill?.text) return { ...d, name: prefill.text.name, role: prefill.text.role, notes: prefill.text.notes }
    return d
  })
  const [step, setStep] = useState(0)
  const [nudged, setNudged] = useState<number | null>(null)
  const [monsters, setMonsters] = useState<LoadedMonster[]>([])
  const [others, setOthers] = useState<NpcSheet[]>([])
  const [saving, setSaving] = useState(false)
  const update = (patch: Partial<Draft>) => setDraft(d => ({ ...d, ...patch }))
  const setBlock = (fn: (b: Block) => Block) => setDraft(d => ({ ...d, block: fn(d.block) }))

  useEffect(() => {
    let live = true
    loadMonsters(edition).then(list => { if (live) setMonsters(list) }).catch(() => {})
    return () => { live = false }
  }, [edition])
  useEffect(() => {
    let live = true
    listNpcs(ownerId).then(list => { if (live) setOthers(list.filter(n => n.id !== editing?.id)) })
    return () => { live = false }
  }, [ownerId, editing?.id])

  // Opened from a stat block ("Make an NPC"): the block is picked already; the DM lands on Who.
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !prefill?.monster || !monsters.length) return
    const m = monsters.find(x => x.source === prefill.monster!.source && x.id === prefill.monster!.id)
    if (!m) return
    prefilled.current = true
    setDraft(d => ({ ...d, block: fromLibrary(m), base: baseOf(m), picked: true, hpMode: 'average' }))
  }, [prefill, monsters])

  const issues: string[][] = useMemo(() => [
    draft.name.trim() ? [] : [t('npc.build.issue.name')],
    draft.picked ? [] : [t('npc.build.issue.block')],
    draft.block.hitPoints > 0 ? [] : [t('npc.build.issue.hp')],
    [],
    [],
  ], [draft, t])
  const firstBlocked = issues.findIndex(l => l.length)
  const isLast = step === STEPS.length - 1
  const next = () => {
    if (issues[step].length && nudged !== step) { setNudged(step); return }
    setNudged(null)
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }

  const pickMonster = (m: Block) => update({ block: fromLibrary(m), base: baseOf(m), picked: true, hpMode: 'average' })
  const pickScratch = () => update({ block: blankBlock(edition), base: undefined, picked: true, hpMode: 'average' })
  const pickOther = (n: NpcSheet) => update({ block: copyBlock(n.block), base: n.base, picked: true, hpMode: 'type' })

  const rollRandom = () => {
    const r = randomNpcPick(monsters)
    if (!r) return
    const role = t(`dm.npc.role.${r.idea.role}` as MessageKey)
    const notes = `${t(`dm.npc.quirk.${r.idea.quirk}` as MessageKey)} ${t('dm.npc.wants')} ${t(`dm.npc.want.${r.idea.want}` as MessageKey)}`
    update({ name: r.name, role, notes, block: fromLibrary(r.monster), base: baseOf(r.monster), picked: true, hpMode: 'average' })
    setNudged(null)
    setStep(STEPS.length - 1)
  }

  const result = (): NpcSheet => {
    // The form's sanitizer cleans every field it knows; fields it does not (book, nameHe, description) stay as copied.
    const raw = withSpellTrait(draft.block, t)
    const block: Block = { ...raw, ...sanitizeMonsterBlock(raw, raw.id), source: raw.source, edition: raw.edition }
    const common = { name: draft.name.trim(), role: draft.role.trim() || undefined, notes: draft.notes, portrait: draft.portrait, partyId: draft.partyId, base: draft.base, block }
    if (editing) {
      const { role, portrait, partyId: pid, base, ...rest } = common
      const npc: NpcSheet = { ...editing, ...rest }
      if (role) npc.role = role; else delete npc.role
      if (portrait) npc.portrait = portrait; else delete npc.portrait
      if (pid) npc.partyId = pid; else delete npc.partyId
      if (base) npc.base = base; else delete npc.base
      return normalize(npc)
    }
    return newNpc({ id: newId(), ownerId, ...common })
  }
  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const npc = await saveNpc(result())
      // A text NPC that got stats leaves the DM screen's plain list: the sheet holds it now.
      if (prefill?.text) {
        const id = prefill.text.id
        const dm = await loadDm(ownerId)
        if (dm.npcs.some(n => n.id === id)) await saveDm(ownerId, { ...dm, npcs: dm.npcs.filter(n => n.id !== id) })
      }
      // Made from a fight plan: it joins that plan, and the DM goes back to the Fights tab.
      const planId = prefill?.fightPlanId
      if (planId) {
        const dm = await loadDm(ownerId)
        if (dm.plans.some(p => p.id === planId)) await saveDm(ownerId, updatePlan(dm, planId, p => (p.monsters.some(m => m.npcId === npc.id) ? p : addMonster(p, npcPlanEntry(npc)))))
      }
      onSaved(npc, planId ? 'fights' : undefined)
    } finally {
      setSaving(false)
    }
  }

  const stepName = (id: StepId) => t(`npc.build.step.${id}`)
  const creature = draft.base?.name ?? draft.block.name
  const current: ReactNode = (() => {
    switch (STEPS[step]) {
      case 'who': return <WhoStep draft={draft} update={update} partyId={partyId} />
      case 'block': return (
        <BlockStep draft={draft} monsters={monsters} others={others} edition={edition} onEdition={setEdition}
          onPick={pickMonster} onScratch={pickScratch} onCopy={pickOther} />
      )
      case 'tweak': return <TweakStep draft={draft} update={update} setBlock={setBlock} monsters={monsters} />
      case 'spells': return <SpellsStep draft={draft} setBlock={setBlock} edition={edition} />
      case 'review': return <ReviewStep draft={draft} />
    }
  })()

  return (
    <div className="builder npc-builder">
      {editing && (
        <div className="edit-banner" role="note">
          <h2>{t('npc.build.editTitle', { name: editing.name })}</h2>
          <p className="small">{t('npc.build.editIntro')}</p>
        </div>
      )}
      {!editing && (
        <div className="random-bar">
          <button className="glass-btn" disabled={!monsters.length} onClick={rollRandom}>🎲 {t('npc.build.random')}</button>
          <span className="muted small">{t('npc.build.randomHint')}</span>
        </div>
      )}
      <nav className="steps" aria-label={t('builder.steps')}>
        {STEPS.map((s, i) => (
          <button key={s} className={`step ${i === step ? 'active' : ''} ${issues[i].length === 0 && (i < step || editing) ? 'done' : ''}`}
            aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>
            <span className="step-num">{i + 1}</span> {stepName(s)}
          </button>
        ))}
      </nav>
      <div className="builder-body">
        <section className="glass builder-step">
          <h2>{stepName(STEPS[step])}</h2>
          <p className="muted">
            {t(`npc.build.step.${STEPS[step]}.blurb`)}{' '}
            <Why title={t(`npc.why.${STEPS[step]}.title`)} text={t(`npc.why.${STEPS[step]}.text`)} />
          </p>
          {current}
          {issues[step].length > 0 && (
            <ul className={`issues ${nudged === step ? 'nudged' : ''}`} role={nudged === step ? 'alert' : undefined}>
              {issues[step].map(m => <li key={m}>{m}</li>)}
            </ul>
          )}
          {(editing || isLast) && firstBlocked !== -1 && firstBlocked !== step && (
            <p className="edit-blocked small">
              {t('builder.blocked', { step: stepName(STEPS[firstBlocked]) })}{' '}
              <button className="glass-btn small" onClick={() => setStep(firstBlocked)}>{t('builder.edit.goFix')}</button>
            </p>
          )}
          <div className="builder-nav">
            <button className="glass-btn" onClick={step === 0 ? () => onCancel(prefill?.fightPlanId ? 'fights' : undefined) : () => setStep(step - 1)}>
              {step === 0 ? t('common.cancel') : t('builder.back')}
            </button>
            <div className="row">
              {!isLast && (
                <button className={`glass-btn ${editing ? '' : 'prominent'}`} onClick={next}>
                  {t(nudged === step && issues[step].length ? 'builder.nextAnyway' : 'builder.next')}
                </button>
              )}
              {(isLast || editing) && (
                <button className="glass-btn prominent" disabled={firstBlocked !== -1 || saving} onClick={save}>
                  {t(editing ? 'npc.build.save' : 'npc.build.create')}
                </button>
              )}
            </div>
          </div>
        </section>
        <aside className="glass npc-summary" aria-label={t('npc.build.summary')}>
          <h3>{draft.name.trim() || t('npc.build.unnamed')}</h3>
          {draft.role && <p className="muted small">{draft.role}</p>}
          <p className="small">
            {draft.picked ? <>{monsterName(draft.block)}{draft.base && draft.base.name !== draft.block.name ? ` (${creature})` : ''} · {t('dm.cr', { cr: crLabel(draft.block.challengeRating) })}</> : t('npc.build.noBlock')}
          </p>
          {draft.picked && (
            <dl className="npc-summary-stats">
              <div><dt>{t('stat.ac')}</dt><dd>{draft.block.armorClass[0]?.value ?? 10}</dd></div>
              <div><dt>{t('stat.hp')}</dt><dd>{draft.block.hitPoints}</dd></div>
              <div><dt>{t('npc.build.pb')}</dt><dd>{formatMod(draft.block.proficiencyBonus)}</dd></div>
            </dl>
          )}
        </aside>
      </div>
    </div>
  )
}

/** Keeps the block's Spellcasting trait in step with the structured field, so the stat block text reads right. */
function withSpellTrait(block: Block, t: (k: MessageKey) => string): Block {
  const sc = block.spellcasting
  if (!sc || !sc.groups.some(g => g.spells.length)) return block
  const names = (id: string) => id.replace(/-/g, ' ')
  const text = spellcastingText(block, sc, names)
  const trait = spellcastingTrait(block)
  if (trait) {
    // A book trait whose parse matches what the DM kept stays as printed.
    const parsed = parseSpellcasting({ ...block, spellcasting: undefined })
    if (parsed && JSON.stringify(parsed.groups) === JSON.stringify(sc.groups) && parsed.ability === sc.ability) return block
    return { ...block, traits: block.traits.map(a => (a === trait ? { ...a, description: text } : a)), actions: block.actions.map(a => (a === trait ? { ...a, description: text } : a)) }
  }
  return { ...block, traits: [...block.traits, { name: t('npc.build.spellcastingTrait'), description: text, damage: [] }] }
}

// ---------- Who ----------

function resizeImage(file: File, size = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, size / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(img.src)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

function WhoStep({ draft, update, partyId }: { draft: Draft; update: (p: Partial<Draft>) => void; partyId?: string }) {
  const { t } = useI18n()
  return (
    <div className="details">
      <div className="portrait-pick">
        {draft.portrait ? <img src={draft.portrait} alt={t('builder.portrait')} /> : <div className="portrait-empty">{t('builder.noArt')}</div>}
        <label className="glass-btn small">
          {t('builder.uploadArt')}
          <input type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) update({ portrait: await resizeImage(f) }) }} />
        </label>
        {draft.portrait && <button className="glass-btn small" onClick={() => update({ portrait: undefined })}>{t('common.remove')}</button>}
      </div>
      <div>
        <div className="field">
          <label htmlFor="npc-name">{t('npc.build.name')} <Why title={t('npc.why.name.title')} text={t('npc.why.name.text')} /></label>
          <div className="name-row">
            <input id="npc-name" value={draft.name} onChange={e => update({ name: e.target.value })} placeholder={t('npc.build.namePlaceholder')} />
            <button type="button" className="glass-btn small" onClick={() => update({ name: randomName() })} aria-label={t('npc.build.randomName')}>🎲</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="npc-role">{t('npc.build.role')}</label>
          <input id="npc-role" value={draft.role} onChange={e => update({ role: e.target.value })} placeholder={t('npc.build.rolePlaceholder')} />
        </div>
        {partyId && (
          <label className="gear-swap small">
            <input type="checkbox" checked={draft.partyId === partyId} onChange={e => update({ partyId: e.target.checked ? partyId : undefined })} />
            <span>{t('npc.build.thisCampaign')}</span>
          </label>
        )}
        <div className="field">
          <label htmlFor="npc-notes">{t('npc.build.notes')} <Why title={t('npc.why.notes.title')} text={t('npc.why.notes.text')} /></label>
          <textarea id="npc-notes" rows={4} value={draft.notes} onChange={e => update({ notes: e.target.value })} placeholder={t('npc.build.notesPlaceholder')} />
        </div>
      </div>
    </div>
  )
}

// ---------- Stat block ----------

function BlockStep({ draft, monsters, others, edition, onEdition, onPick, onScratch, onCopy }: {
  draft: Draft
  monsters: LoadedMonster[]
  others: NpcSheet[]
  edition: Edition
  onEdition: (e: Edition) => void
  onPick: (m: Block) => void
  onScratch: () => void
  onCopy: (n: NpcSheet) => void
}) {
  const { t, monsterName } = useI18n()
  const [maxCr, setMaxCr] = useState<number | null>(null)
  const items: PickItem[] = useMemo(() => monsters
    .filter(m => maxCr == null || m.challengeRating <= maxCr)
    .map(m => ({
      id: monsterKey(m),
      name: monsterName(m),
      group: m.source.startsWith('srd-') ? undefined : m.book && BOOK_TITLES[m.book] ? `${BOOK_TITLES[m.book]}${m.legacy ? ` · ${t('dm.legacy')}` : ''}` : monsterSourceNote(m).title,
      meta: <span className="muted small">{t('dm.cr', { cr: crLabel(m.challengeRating) })} · {m.sizes.join('/')} {m.type}</span>,
      search: [m.name, m.type, `cr ${crLabel(m.challengeRating)}`],
    })), [monsters, maxCr, monsterName, t])
  const scratch = draft.picked && !draft.base
  const pickedKey = draft.base ? `${draft.base.source}:${draft.base.id}` : undefined
  const picked = monsters.find(m => monsterKey(m) === pickedKey)

  return (
    <div className="npc-block-step">
      <div className="row npc-block-tools">
        <div className="glass-segmented" role="group" aria-label={t('dm.rulesEdition')}>
          {(['2014', '2024'] as Edition[]).map(e => (
            <button key={e} type="button" aria-pressed={edition === e} onClick={() => onEdition(e)}>{t(e === '2024' ? 'dm.edition2024' : 'dm.edition2014')}</button>
          ))}
        </div>
        <label className="small npc-cr-filter">
          {t('npc.build.maxCr')} <Why title={t('npc.why.cr.title')} text={t('npc.why.cr.text')} />
          <select value={maxCr ?? ''} onChange={e => setMaxCr(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">{t('npc.build.anyCr')}</option>
            {CRS.map(cr => <option key={cr} value={cr}>{crLabel(cr)}</option>)}
          </select>
        </label>
      </div>
      {!monsters.length ? <p className="hint">{t('common.loading')}</p> : (
        <ChoicePicker
          items={items}
          value={pickedKey}
          onPick={id => { const m = monsters.find(x => monsterKey(x) === id); if (m) onPick(m) }}
          label={t('npc.build.step.block')}
          firstGroup={edition === '2024' ? t('npc.build.srd2024') : t('npc.build.srd2014')}
          extra={{ name: t('npc.build.scratch'), onPick: onScratch }}
          extraOn={scratch}
          after={picked ? (
            <div className="ff-sheet npc-preview">
              <StatBlock m={picked} legacy={picked.legacy} />
            </div>
          ) : scratch ? <p className="hint">{t('npc.build.scratchHint')}</p> : undefined}
        />
      )}
      {others.length > 0 && (
        <Fold title={t('npc.build.copyOther')} status={others.length}>
          <div className="row">
            {others.map(n => (
              <button key={n.id} type="button" className="glass-chip" onClick={() => onCopy(n)}>{n.name} <small className="muted">· {monsterName(n.block)}</small></button>
            ))}
          </div>
        </Fold>
      )}
      <p className="hint small">
        <Why title={t('npc.why.legendary.title')} text={t('npc.why.legendary.text')} label={t('npc.why.legendary.title')} />{' '}
        <Why title={t('npc.why.pb.title')} text={t('npc.why.pb.text')} label={t('npc.why.pb.title')} />
      </p>
    </div>
  )
}

// ---------- Tweak ----------

const int = (v: string, fallback = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback }

function TweakStep({ draft, update, setBlock, monsters }: {
  draft: Draft
  update: (p: Partial<Draft>) => void
  setBlock: (fn: (b: Block) => Block) => void
  monsters: LoadedMonster[]
}) {
  const { t } = useI18n()
  const { roll } = useDice()
  const b = draft.block
  const book = draft.base ? monsters.find(m => m.source === draft.base!.source && m.id === draft.base!.id) : undefined
  const average = (book?.hitPointsRoll === b.hitPointsRoll ? book?.hitPoints : undefined) ?? averageHp(b.hitPointsRoll) ?? b.hitPoints
  const setHp = (hp: number, mode: Draft['hpMode']) => update({ hpMode: mode, block: { ...b, hitPoints: Math.max(1, hp) } })
  const rollHp = () => {
    try {
      const r = roll(b.hitPointsRoll, { label: `${draft.name || b.name}: ${t('stat.hp')}` })
      setHp(r.total, 'roll')
    } catch { /* not dice notation: the DM types a number instead */ }
  }
  const resetToBook = () => { if (book) update({ block: fromLibrary(book), hpMode: 'average' }) }

  return (
    <div className="npc-tweak">
      <div className="field">
        <span className="small npc-label">{t('npc.build.hp')} <Why title={t('npc.why.hp.title')} text={t('npc.why.hp.text')} /></span>
        <div className="row npc-hp-row">
          <div className="glass-segmented" role="group" aria-label={t('npc.build.hp')}>
            <button type="button" aria-pressed={draft.hpMode === 'average'} onClick={() => setHp(average, 'average')}>{t('npc.build.hpAverage', { hp: average })}</button>
            <button type="button" aria-pressed={draft.hpMode === 'roll'} onClick={rollHp}>{t('npc.build.hpRoll', { dice: b.hitPointsRoll })}</button>
            <button type="button" aria-pressed={draft.hpMode === 'type'} onClick={() => update({ hpMode: 'type' })}>{t('npc.build.hpType')}</button>
          </div>
          <input type="number" min={1} value={b.hitPoints} aria-label={t('stat.hp')} className="npc-num" onChange={e => setHp(int(e.target.value, 1), 'type')} />
          {book && <button type="button" className="glass-btn small" onClick={resetToBook}>{t('npc.build.resetToBook')}</button>}
        </div>
      </div>
      <MonsterForm value={b} onChange={next => setBlock(x => ({ ...next, source: x.source, edition: x.edition }))} />
    </div>
  )
}

// ---------- Spells ----------

function SpellsStep({ draft, setBlock, edition }: { draft: Draft; setBlock: (fn: (b: Block) => Block) => void; edition: Edition }) {
  const { t, abilityShort, spellName } = useI18n()
  const b = draft.block
  const sc = b.spellcasting
  const [spells, setSpells] = useState<Spell[]>([])
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState(0)
  useEffect(() => {
    let live = true
    loadKind('spells', { sources: [edition === '2024' ? 'srd-5.2' : 'srd-5.1'] }).then(list => { if (live) setSpells(list) }).catch(() => {})
    return () => { live = false }
  }, [edition])
  const setSc = (next: MonsterSpellcasting | undefined) => setBlock(x => {
    const { spellcasting: _drop, ...rest } = x
    return next ? { ...rest, spellcasting: next } : rest
  })
  const turnOn = () => setSc(parseSpellcasting(b) ?? { ability: 'int', groups: [{ label: GROUP_PRESETS[0], spells: [] }] })
  const setGroups = (groups: MonsterSpellcasting['groups']) => sc && setSc({ ...sc, groups })
  const name = (id: string) => spellName(spells.find(s => s.id === id)?.name ?? id.replace(/-/g, ' '))
  const found = query ? spells.filter(s => matches(query, [s.name, spellName(s.name), `level ${s.level}`])).slice(0, 24) : []
  const add = (id: string) => sc && setGroups(sc.groups.map((g, i) => (i === group && !g.spells.includes(id) ? { ...g, spells: [...g.spells, id] } : g)))
  const current = sc?.groups[group]

  if (!sc) {
    return (
      <div className="npc-spells">
        <p className="muted">{t('npc.build.noSpells')}</p>
        <button type="button" className="glass-btn" onClick={turnOn}>{t('npc.build.addSpells')}</button>
      </div>
    )
  }
  return (
    <div className="npc-spells">
      <div className="block-grid">
        <label className="field"><span>{t('npc.build.castingAbility')}</span>
          <select value={sc.ability} onChange={e => setSc({ ...sc, ability: e.target.value as Ability, saveDc: undefined, attackBonus: undefined })}>
            {ABILITIES.map(a => <option key={a} value={a}>{abilityShort(a)}</option>)}
          </select>
        </label>
        <label className="field"><span>{t('npc.build.saveDc')}</span>
          <input type="number" value={sc.saveDc ?? spellSaveDc(b, sc.ability)} onChange={e => setSc({ ...sc, saveDc: int(e.target.value, spellSaveDc(b, sc.ability)) })} />
        </label>
        <label className="field"><span>{t('npc.build.spellAttack')}</span>
          <input type="number" value={sc.attackBonus ?? spellAttackBonus(b, sc.ability)} onChange={e => setSc({ ...sc, attackBonus: int(e.target.value, spellAttackBonus(b, sc.ability)) })} />
        </label>
        <label className="field"><span>{t('npc.build.spellNote')}</span><input value={sc.note ?? ''} onChange={e => setSc({ ...sc, note: e.target.value || undefined })} /></label>
      </div>
      <p className="hint small">{t('npc.build.slotsHint')} <Why title={t('npc.why.slots.title')} text={t('npc.why.slots.text')} /></p>
      <ul className="plain npc-spell-groups">
        {sc.groups.map((g, i) => (
          <li key={i} className={i === group ? 'on' : ''}>
            <div className="row npc-group-head">
              <input list="npc-group-presets" value={g.label} aria-label={t('npc.build.groupLabel')} onChange={e => setGroups(sc.groups.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} onFocus={() => setGroup(i)} />
              <button type="button" className={`glass-chip ${i === group ? 'on' : ''}`} aria-pressed={i === group} onClick={() => setGroup(i)}>{t('npc.build.addHere')}</button>
              <button type="button" className="glass-btn small" onClick={() => { setGroups(sc.groups.filter((_, j) => j !== i)); setGroup(0) }}>{t('common.remove')}</button>
            </div>
            <div className="row">
              {g.spells.map(id => (
                <button key={id} type="button" className="glass-chip on" onClick={() => setGroups(sc.groups.map((x, j) => (j === i ? { ...x, spells: x.spells.filter(s => s !== id) } : x)))} aria-label={`${t('common.remove')}: ${name(id)}`}>
                  {name(id)} ×
                </button>
              ))}
              {!g.spells.length && <span className="muted small">{t('npc.build.groupEmpty')}</span>}
            </div>
          </li>
        ))}
      </ul>
      <datalist id="npc-group-presets">{GROUP_PRESETS.map(p => <option key={p} value={p} />)}</datalist>
      <div className="row">
        <button type="button" className="glass-btn small" onClick={() => { setGroups([...sc.groups, { label: GROUP_PRESETS[Math.min(sc.groups.length + 1, GROUP_PRESETS.length - 1)], spells: [] }]); setGroup(sc.groups.length) }}>+ {t('npc.build.addGroup')}</button>
        <button type="button" className="glass-btn small" onClick={() => setSc(undefined)}>{t('npc.build.removeSpells')}</button>
      </div>
      {current && (
        <div className="npc-spell-search">
          <SearchField value={query} onChange={e => setQuery(e.target.value)} placeholder={t('npc.build.searchSpells', { group: current.label })} aria-label={t('npc.build.searchSpells', { group: current.label })} />
          {query && (
            <div className="row chip-scroll">
              {found.map(s => (
                <button key={s.id} type="button" className={`glass-chip ${current.spells.includes(s.id) ? 'on' : ''}`} onClick={() => add(s.id)}>
                  {spellName(s.name)} <small className="muted">{s.level ? s.level : t('npc.build.cantrip')}</small>
                </button>
              ))}
              {!found.length && <span className="muted small">{t('builder.compact.noMatch')}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- Review ----------

function ReviewStep({ draft }: { draft: Draft }) {
  const { t, monsterName } = useI18n()
  const b = draft.block
  return (
    <div className="ff-sheet npc-review">
      <article className="glass heroes-card npc-hero">
        <div className="heroes-id">
          {draft.portrait ? <img src={draft.portrait} alt="" /> : <div className="portrait-empty" aria-hidden="true">{(draft.name || '?').slice(0, 1)}</div>}
          <div>
            <h3>{draft.name || t('npc.build.unnamed')}</h3>
            {draft.role && <p className="muted small">{draft.role}</p>}
            <p className="small">{monsterName(b)} · {b.sizes.join('/')} {b.type} · {t('dm.cr', { cr: crLabel(b.challengeRating) })} · {b.xp} XP</p>
          </div>
        </div>
        {draft.notes && <p className="small npc-notes">{draft.notes}</p>}
        <p className="hint small">{t('npc.build.privacy')}</p>
      </article>
      <StatBlock m={b} title={draft.name || undefined} />
    </div>
  )
}

/** #/npc/<id>: the NPC sheet, and the creator in Edit mode when the sheet's Edit is tapped. */
export function NpcScreen({ npcId, ownerId, partyId, onBack, onOpenFight }: {
  npcId: string
  ownerId: string
  partyId?: string
  onBack: () => void
  onOpenFight?: (encounterId: string) => void
}) {
  const [editing, setEditing] = useState<NpcSheet | null>(null)
  if (editing) {
    return <NpcBuilder ownerId={ownerId} partyId={partyId} editing={editing} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} />
  }
  return <NpcSheetScreen npcId={npcId} ownerId={ownerId} onBack={onBack} onOpenFight={onOpenFight} onEdit={() => getNpc(npcId).then(n => { if (n) setEditing(n) })} />
}
