// The sheet's Inventory card: coins, carried weight, every item with equip, quantity and edit,
// adding from the SRD library (gear and magic items) or a custom item, and the warlock's pact weapon.
import { useEffect, useState } from 'react'
import { BUNDLED, loadKind, searchEntries, type Edition, type Equipment, type MagicItem } from '../content'
import { useI18n, type MessageKey } from '../i18n'
import type { Character } from '../model/character'
import {
  ABILITIES, ABILITY_NAMES, derive, effectsActive, isAttuned, ITEMS, type Ability, type InventoryEntry, type Item, type ItemEffect, type WeaponProperty,
} from '../rules'
import type { Apply } from '../sheet/types'
import { editionOf, sourceFor } from '../spellbook/access'
import {
  addItem, attunementFull, COINS, fromLibrary, fromMagicItem, isWarlock, itemOf, removeEntry, setAttuned, setCoins, setEquipped,
  setQty, updateEntry, withBase,
} from './inventory'
import './inventory.css'

interface Library { equipment: Equipment[]; magic: MagicItem[] }

function useItemLibrary(edition: Edition, wanted: boolean): Library | 'error' | null {
  const [lib, setLib] = useState<{ edition: Edition; data: Library | 'error' } | null>(null)
  useEffect(() => {
    if (!wanted) return
    let live = true
    const sources = [sourceFor(edition)]
    Promise.all([loadKind('equipment', { sources }), loadKind('magic-items', { sources })])
      .then(([equipment, magic]) => live && setLib({ edition, data: { equipment, magic } }))
      .catch(() => live && setLib({ edition, data: 'error' }))
    return () => { live = false }
  }, [edition, wanted])
  return lib?.edition === edition ? lib.data : null
}

export function Inventory({ character, apply }: { character: Character; apply: Apply }) {
  const { t } = useI18n()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const stats = derive(character)
  const edition = editionOf(character)
  const lib = useItemLibrary(edition, adding)

  const add = (fields: Omit<InventoryEntry, 'uid' | 'qty' | 'equipped'>, name: string, edit = false) => {
    let uid = ''
    apply(t('inv.log.add', { name }), c => {
      const out = addItem(c, fields)
      uid = out.uid
      return out.character
    })
    if (edit) { setAdding(false); setEditing(uid) }
  }

  return (
    <section className="card inventory" aria-labelledby="inv-title">
      <div className="card-head">
        <h2 id="inv-title">{t('inv.title')}</h2>
        <span className={`hint inv-weight${stats.carriedWeight > stats.carryingCapacity ? ' over' : ''}`}>
          {t('inv.weight', { carried: stats.carriedWeight, capacity: stats.carryingCapacity })}
        </span>
      </div>

      <div className="inv-coins" role="group" aria-label={t('inv.coins')}>
        {COINS.map(coin => (
          <label key={coin}>
            <span>{t(`inv.coin.${coin}` as MessageKey)}</span>
            <input type="number" inputMode="numeric" min={0} value={character.coins[coin]}
              onChange={e => apply(t('inv.log.coins'), c => setCoins(c, coin, Number(e.target.value)))} />
          </label>
        ))}
      </div>

      {character.inventory.length === 0
        ? <p className="hint">{t('inv.empty')}</p>
        : (
          <ul className="inv-list">
            {character.inventory.map(e => editing === e.uid
              ? <li key={e.uid} className="inv-row editing"><ItemEditor character={character} entry={e} apply={apply} onDone={() => setEditing(null)} /></li>
              : <Row key={e.uid} character={character} entry={e} apply={apply} onEdit={() => setEditing(e.uid)} />)}
          </ul>
        )}

      {adding
        ? <AddPanel lib={lib} onAdd={add} onClose={() => setAdding(false)} source={BUNDLED.find(m => m.source.id === sourceFor(edition))?.source.title} />
        : <button type="button" className="btn primary inv-add" onClick={() => setAdding(true)}>{t('inv.add')}</button>}
    </section>
  )
}

type T = ReturnType<typeof useI18n>

/** "+1 AC", "STR becomes 19", "+2 CON (max 20)"… */
function effectText({ t, term }: T, f: ItemEffect): string {
  const n = 'value' in f ? f.value : 0
  const signed = `${n >= 0 ? '+' : '−'}${Math.abs(n)}`
  const ability = (a: Ability) => term('ability', a, ABILITY_NAMES[a])
  switch (f.kind) {
    case 'abilitySet': return t('inv.fx.text.abilitySet', { ability: ability(f.ability), n })
    case 'ability': return t(f.max ? 'inv.fx.text.abilityMax' : 'inv.fx.text.ability', { ability: ability(f.ability), n: signed, max: f.max ?? '' })
    default: return t(`inv.fx.text.${f.kind}` as MessageKey, { n: signed }) + (f.unarmored ? ` ${t('inv.fx.text.unarmored')}` : '')
  }
}

function Row({ character, entry: e, apply, onEdit }: { character: Character; entry: InventoryEntry; apply: Apply; onEdit: () => void }) {
  const i18n = useI18n()
  const { t, term } = i18n
  const [open, setOpen] = useState(false)
  const item = itemOf(e)
  const name = e.item || e.name ? item.name : term('item', item.id, item.name)
  const equippable = item.kind !== 'gear' || !!e.effects?.length || !!e.attunement
  const attuned = isAttuned(character, e.uid)
  const active = effectsActive(character, e)
  const effects = (e.effects ?? []).map(f => effectText(i18n, f)).join(' · ')
  const stat = item.kind === 'weapon'
    ? <><bdi dir="ltr">{item.damage}{e.magicBonus ? `+${e.magicBonus}` : ''}</bdi> {term('damage', item.damageType, item.damageType)}{e.extraDamage && <> + <bdi dir="ltr">{e.extraDamage}</bdi></>}</>
    : item.kind === 'armor'
      ? t(item.category === 'shield' ? 'inv.shieldAc' : 'inv.ac', { ac: item.baseAc + (e.magicBonus ?? 0) })
      : ''
  const details = [item.kind === 'gear' ? item.description : undefined, e.notes].filter(Boolean).join('\n\n')
  return (
    <li className={`inv-row${e.equipped ? ' equipped' : ''}`}>
      <div className="inv-line">
        <button type="button" className="inv-name" aria-expanded={open} onClick={() => setOpen(o => !o)} disabled={!details && !stat}>
          <bdi>{name}</bdi>
          {e.qty > 1 && <span className="inv-qty">×{e.qty}</span>}
          {e.magicBonus ? <span className="inv-badge" dir="ltr">+{e.magicBonus}</span> : null}
          {e.pact && <span className="inv-badge">{t('inv.pactBadge')}</span>}
          <small>{stat}{stat && item.weight ? ' · ' : ''}{item.weight ? t('inv.lb', { n: Math.round(item.weight * e.qty * 100) / 100 }) : ''}</small>
          {effects && (
            <small className={`inv-effects${active ? ' on' : ''}`}>
              <bdi>{effects}</bdi>
              {!active && <> · {t(e.equipped ? 'inv.fx.needsAttune' : 'inv.fx.needsEquip')}</>}
            </small>
          )}
        </button>
        <div className="inv-actions">
          {e.attunement && (
            <button type="button" className={`btn small${attuned ? ' primary' : ''}`} aria-pressed={attuned}
              disabled={!attuned && attunementFull(character)} title={!attuned && attunementFull(character) ? t('inv.attuneFull') : undefined}
              onClick={() => apply(t(attuned ? 'inv.log.unattune' : 'inv.log.attune', { name }), c => setAttuned(c, e.uid, !attuned))}>
              {t(attuned ? 'inv.attuned' : 'inv.attuneBtn')}
            </button>
          )}
          {equippable && (
            <button type="button" className={`btn small${e.equipped ? ' primary' : ''}`} aria-pressed={e.equipped}
              onClick={() => apply(t(e.equipped ? 'inv.log.unequip' : 'inv.log.equip', { name }), c => setEquipped(c, e.uid, !e.equipped))}>
              {t(e.equipped ? 'inv.equipped' : 'inv.equip')}
            </button>
          )}
          <div className="inv-stepper">
            <button type="button" aria-label={t('inv.less', { name })} onClick={() => apply(t(e.qty > 1 ? 'inv.log.less' : 'inv.log.remove', { name }), c => setQty(c, e.uid, e.qty - 1))}>−</button>
            <button type="button" aria-label={t('inv.more', { name })} onClick={() => apply(t('inv.log.more', { name }), c => setQty(c, e.uid, e.qty + 1))}>+</button>
          </div>
          <button type="button" className="btn ghost small inv-edit" aria-label={t('inv.editName', { name })} onClick={onEdit}>✎</button>
        </div>
      </div>
      {open && details && <p className="inv-notes">{details}</p>}
    </li>
  )
}

const PROPERTIES: WeaponProperty[] = ['finesse', 'light', 'heavy', 'reach', 'thrown', 'two-handed', 'versatile', 'ammunition', 'loading', 'ranged']
const DAMAGE_TYPES = ['slashing', 'piercing', 'bludgeoning', 'acid', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'poison', 'psychic', 'radiant', 'thunder']
const BASES = ITEMS.filter(i => i.kind !== 'gear')

/** Edit anything about an item: name, kind, weapon or armor stats, magic bonus, extra damage, pact weapon, notes. */
function ItemEditor({ character, entry: e, apply, onDone }: { character: Character; entry: InventoryEntry; apply: Apply; onDone: () => void }) {
  const { t, term } = useI18n()
  const [item, setItem] = useState<Item>(() => ({ ...itemOf(e) }))
  const [qty, setQtyDraft] = useState(e.qty)
  const [notes, setNotes] = useState(e.notes ?? '')
  const [magic, setMagic] = useState(e.magicBonus ?? 0)
  const [extra, setExtra] = useState(e.extraDamage ?? '')
  const [pact, setPact] = useState(!!e.pact)
  const [effects, setEffects] = useState<ItemEffect[]>(() => (e.effects ?? []).map(f => ({ ...f })))
  const [needsAttune, setNeedsAttune] = useState(!!e.attunement)

  const setKind = (kind: Item['kind']) => {
    if (kind === item.kind) return
    const common = { id: item.id, name: item.name, weight: item.weight }
    setItem(kind === 'weapon'
      ? { ...common, kind, category: 'martial', damage: '1d8', damageType: 'slashing', properties: [] }
      : kind === 'armor' ? { ...common, kind, category: 'light', baseAc: 11 } : { ...common, kind })
  }
  const startFrom = (id: string) => {
    const base = BASES.find(b => b.id === id)
    if (base) setItem(withBase(base, item.name || base.name, item.id))
  }
  const patch = (p: Partial<Item>) => setItem(i => ({ ...i, ...p }) as Item)

  const save = (ev: React.FormEvent) => {
    ev.preventDefault()
    const name = item.name.trim() || itemOf(e).name
    apply(t('inv.log.edit', { name }), c => setQty(updateEntry(c, e.uid, {
      item: { ...item, name },
      name: undefined,
      notes: notes.trim() || undefined,
      magicBonus: item.kind === 'gear' ? undefined : magic,
      extraDamage: item.kind === 'weapon' ? extra.trim() || undefined : undefined,
      pact: item.kind === 'weapon' && pact,
      effects: effects.filter(f => f.value),
      attunement: needsAttune,
    }), e.uid, qty))
    onDone()
  }
  const remove = () => {
    apply(t('inv.log.remove', { name: item.name }), c => removeEntry(c, e.uid))
    onDone()
  }

  return (
    <form className="inv-editor" onSubmit={save} aria-label={t('inv.editName', { name: item.name })}>
      <label className="wide">{t('inv.f.name')}<input value={item.name} onChange={ev => patch({ name: ev.target.value })} required /></label>
      <label>{t('inv.f.kind')}
        <select value={item.kind} onChange={ev => setKind(ev.target.value as Item['kind'])}>
          <option value="gear">{t('inv.kind.gear')}</option>
          <option value="weapon">{t('inv.kind.weapon')}</option>
          <option value="armor">{t('inv.kind.armor')}</option>
        </select>
      </label>
      <label>{t('inv.f.qty')}<input type="number" min={1} value={qty} onChange={ev => setQtyDraft(Math.max(1, Number(ev.target.value) || 1))} /></label>
      <label>{t('inv.f.weight')}<input type="number" min={0} step="0.25" value={item.weight} onChange={ev => patch({ weight: Math.max(0, Number(ev.target.value) || 0) })} /></label>

      {item.kind !== 'gear' && (
        <label>{t('inv.f.base')}
          <select value="" onChange={ev => startFrom(ev.target.value)}>
            <option value="">{t('inv.f.basePick')}</option>
            {BASES.filter(b => b.kind === item.kind).map(b => <option key={b.id} value={b.id}>{term('item', b.id, b.name)}</option>)}
          </select>
        </label>
      )}

      {item.kind === 'weapon' && (
        <>
          <label>{t('inv.f.damage')}<input value={item.damage} onChange={ev => patch({ damage: ev.target.value })} dir="ltr" /></label>
          <label>{t('inv.f.damageType')}
            <select value={item.damageType} onChange={ev => patch({ damageType: ev.target.value })}>
              {DAMAGE_TYPES.map(d => <option key={d} value={d}>{term('damage', d, d)}</option>)}
            </select>
          </label>
          <label>{t('inv.f.category')}
            <select value={item.category} onChange={ev => patch({ category: ev.target.value as 'simple' | 'martial' })}>
              <option value="simple">{t('inv.simple')}</option>
              <option value="martial">{t('inv.martial')}</option>
            </select>
          </label>
          {item.properties.includes('versatile') && (
            <label>{t('inv.f.versatile')}<input value={item.versatile ?? ''} onChange={ev => patch({ versatile: ev.target.value || undefined })} dir="ltr" /></label>
          )}
          {(item.properties.includes('ranged') || item.properties.includes('thrown')) && (
            <label>{t('inv.f.range')}<input value={item.range ?? ''} placeholder="20/60" onChange={ev => patch({ range: ev.target.value || undefined })} dir="ltr" /></label>
          )}
          <fieldset className="wide inv-props">
            <legend>{t('inv.f.properties')}</legend>
            {PROPERTIES.map(p => (
              <label key={p} className="check">
                <input type="checkbox" checked={item.properties.includes(p)}
                  onChange={ev => patch({ properties: ev.target.checked ? [...item.properties, p] : item.properties.filter(x => x !== p) })} />
                {t(`inv.prop.${p}` as MessageKey)}
              </label>
            ))}
          </fieldset>
          <label>{t('inv.f.extra')}<input value={extra} placeholder="1d6 fire" onChange={ev => setExtra(ev.target.value)} dir="ltr" /></label>
        </>
      )}

      {item.kind === 'armor' && (
        <>
          <label>{t('inv.f.armorType')}
            <select value={item.category} onChange={ev => patch({ category: ev.target.value as 'light' })}>
              {(['light', 'medium', 'heavy', 'shield'] as const).map(k => <option key={k} value={k}>{t(`inv.armor.${k}` as MessageKey)}</option>)}
            </select>
          </label>
          <label>{t('inv.f.ac')}<input type="number" value={item.baseAc} onChange={ev => patch({ baseAc: Number(ev.target.value) || 0 })} /></label>
          {item.category !== 'shield' && (
            <label>{t('inv.f.dexCap')}
              <select value={item.dexCap ?? 'none'} onChange={ev => patch({ dexCap: ev.target.value === 'none' ? undefined : Number(ev.target.value) })}>
                <option value="none">{t('inv.dexFull')}</option>
                <option value="2">{t('inv.dexMax', { n: 2 })}</option>
                <option value="0">{t('inv.dexNone')}</option>
              </select>
            </label>
          )}
        </>
      )}

      {item.kind !== 'gear' && (
        <label>{t('inv.f.magic')}
          <select value={magic} onChange={ev => setMagic(Number(ev.target.value))}>
            {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n ? `+${n}` : t('inv.none')}</option>)}
          </select>
        </label>
      )}
      {item.kind === 'weapon' && isWarlock(character) && (
        <label className="check wide inv-pact">
          <input type="checkbox" checked={pact} onChange={ev => setPact(ev.target.checked)} />
          <span>{t('inv.f.pact')}<small>{t(character.spellEdition === '2024' ? 'inv.pactHint2024' : 'inv.pactHint')}</small></span>
        </label>
      )}
      <EffectsEditor effects={effects} onChange={setEffects} />
      <label className="check wide">
        <input type="checkbox" checked={needsAttune} onChange={ev => setNeedsAttune(ev.target.checked)} />
        {t('inv.f.attunement')}
      </label>
      <label className="wide">{t('inv.f.notes')}<textarea rows={4} value={notes} onChange={ev => setNotes(ev.target.value)} placeholder={t('inv.f.notesHint')} /></label>

      <div className="wide inv-editor-actions">
        <button type="submit" className="btn primary">{t('inv.save')}</button>
        <button type="button" className="btn" onClick={onDone}>{t('common.cancel')}</button>
        <button type="button" className="btn ghost inv-delete" onClick={remove}>{t('inv.delete')}</button>
      </div>
    </form>
  )
}

const EFFECT_KINDS = ['ac', 'saves', 'checks', 'spellAttack', 'spellDc', 'speed', 'abilitySet', 'ability'] as const

function blankEffect(kind: ItemEffect['kind'], prev?: ItemEffect): ItemEffect {
  if (kind === prev?.kind) return prev
  if (kind === 'abilitySet') return { kind, ability: 'str', value: 19 }
  if (kind === 'ability') return { kind, ability: 'str', value: 2, max: 20 }
  return { kind, value: kind === 'speed' ? 10 : 1 }
}

/** Stat effects of an item: pick what it changes and by how much. */
function EffectsEditor({ effects, onChange }: { effects: ItemEffect[]; onChange: (fx: ItemEffect[]) => void }) {
  const { t, term } = useI18n()
  const put = (i: number, f: ItemEffect) => onChange(effects.map((x, j) => (j === i ? f : x)))
  return (
    <fieldset className="wide inv-effects-editor">
      <legend>{t('inv.f.effects')}</legend>
      {effects.length === 0 && <p className="hint">{t('inv.fx.none')}</p>}
      {effects.map((f, i) => (
        <div key={i} className="inv-effect">
          <select aria-label={t('inv.fx.kind')} value={f.kind} onChange={ev => put(i, blankEffect(ev.target.value as ItemEffect['kind'], f))}>
            {EFFECT_KINDS.map(k => <option key={k} value={k}>{t(`inv.fx.kind.${k}` as MessageKey)}</option>)}
          </select>
          {(f.kind === 'abilitySet' || f.kind === 'ability') && (
            <select aria-label={t('inv.fx.ability')} value={f.ability} onChange={ev => put(i, { ...f, ability: ev.target.value as Ability })}>
              {ABILITIES.map(a => <option key={a} value={a}>{term('ability', a, ABILITY_NAMES[a])}</option>)}
            </select>
          )}
          <input type="number" aria-label={t('inv.fx.value')} value={f.value} onChange={ev => put(i, { ...f, value: Number(ev.target.value) || 0 })} />
          {f.kind === 'ability' && (
            <input type="number" aria-label={t('inv.fx.max')} placeholder={t('inv.fx.max')} value={f.max ?? ''}
              onChange={ev => put(i, { ...f, max: ev.target.value ? Number(ev.target.value) : undefined })} />
          )}
          {f.kind === 'ac' && (
            <label className="check">
              <input type="checkbox" checked={!!f.unarmored} onChange={ev => put(i, { ...f, unarmored: ev.target.checked || undefined })} />
              {t('inv.fx.unarmored')}
            </label>
          )}
          <button type="button" className="btn ghost small inv-effect-remove" aria-label={t('inv.fx.remove')} onClick={() => onChange(effects.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="btn small" onClick={() => onChange([...effects, blankEffect('ac')])}>{t('inv.fx.add')}</button>
    </fieldset>
  )
}

function AddPanel({ lib, onAdd, onClose, source }: {
  lib: Library | 'error' | null
  onAdd: (fields: Omit<InventoryEntry, 'uid' | 'qty' | 'equipped'>, name: string, edit?: boolean) => void
  onClose: () => void
  source?: string
}) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'gear' | 'magic'>('gear')
  const [query, setQuery] = useState('')
  const custom = () => onAdd({ itemId: `custom:${Date.now().toString(36)}`, item: { kind: 'gear', id: 'custom', name: t('inv.newItem'), weight: 0 } }, t('inv.newItem'), true)

  return (
    <div className="inv-panel">
      <div className="inv-panel-head">
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'gear'} className={tab === 'gear' ? 'on' : ''} onClick={() => setTab('gear')}>{t('inv.tab.gear')}</button>
          <button type="button" role="tab" aria-selected={tab === 'magic'} className={tab === 'magic' ? 'on' : ''} onClick={() => setTab('magic')}>{t('inv.tab.magic')}</button>
        </div>
        <button type="button" className="btn ghost small" onClick={onClose} aria-label={t('inv.close')}>✕</button>
      </div>
      <button type="button" className="btn inv-custom" onClick={custom}>{t('inv.custom')}</button>
      <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('inv.search')} aria-label={t('inv.search')} lang="en" />
      {lib === null && <p className="hint">{t('common.loading')}</p>}
      {lib === 'error' && <p className="hint">{t('inv.failed')}</p>}
      {lib && lib !== 'error' && (
        <ul className="inv-results">
          {tab === 'gear'
            ? searchEntries(lib.equipment.filter(e => e.type !== 'vehicle' && e.type !== 'mount'), query).slice(0, 80).map(e => (
              <li key={e.id}>
                <span><bdi lang="en">{e.name}</bdi><small>{t(`inv.kind.${e.type === 'tool' ? 'gear' : e.type}` as MessageKey)}{e.cost ? ` · ${e.cost.qty} ${e.cost.unit}` : ''}</small></span>
                <button type="button" className="btn small primary" aria-label={t('inv.addName', { name: e.name })} onClick={() => onAdd(fromLibrary(e), e.name)}>{t('inv.addShort')}</button>
              </li>
            ))
            : searchEntries(lib.magic, query).slice(0, 80).map(m => {
              const needsBase = m.category === 'weapon' || m.category === 'armor'
              return (
                <li key={m.id}>
                  <span><bdi lang="en">{m.name}</bdi><small lang="en">{m.rarityText ?? m.rarity}{m.attunement ? ` · ${t('inv.attune')}` : ''}</small></span>
                  <button type="button" className="btn small primary" aria-label={t('inv.addName', { name: m.name })}
                    onClick={() => onAdd(needsBase ? { ...fromMagicItem(m), item: placeholderBase(m) } : fromMagicItem(m), m.name, needsBase)}>
                    {t('inv.addShort')}
                  </button>
                </li>
              )
            })}
        </ul>
      )}
      {source && <p className="hint inv-source">{t('inv.source', { title: source })}</p>}
    </div>
  )
}

/** A magic weapon or armor starts as a longsword or chain shirt; the editor opens so the player picks the real base. */
function placeholderBase(m: MagicItem): Item {
  const base = BASES.find(b => b.id === (m.category === 'armor' ? (m.name.match(/shield/i) ? 'shield' : 'chain-shirt') : 'longsword'))!
  return withBase(base, m.name, m.id)
}

