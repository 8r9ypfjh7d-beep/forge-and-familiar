// The sheet's Inventory card: coins, carried weight, every item with equip, quantity and edit,
// adding from the SRD library (gear and magic items) or a custom item, and the warlock's pact weapon.
import { useEffect, useState } from 'react'
import { BUNDLED, loadKind, searchEntries, type Edition, type Equipment, type MagicItem } from '../content'
import { useI18n, type MessageKey } from '../i18n'
import type { Character } from '../model/character'
import {
  ABILITIES, ABILITY_NAMES, ALL_SKILLS, CONDITIONS, derive, isUsefulEffect, ITEMS, isPotion, potionEffect, potionHealing, uses2024Spells, type AdvantageOn, type Ability, type InventoryEntry, type Item,
  type ItemEffect, type MoveMode, type Recharge, type Sense, type SkillId, type WeaponProperty,
} from '../rules'
import type { Apply } from '../sheet/types'
import { editionOf, sourceFor } from '../spellbook/access'
import { Why } from '../builder/Why'
import {
  addItem, COINS, fromLibrary, fromMagicItem, infusionStats, isWarlock, itemOf, knownInfusions, removeEntry, setCoins, setEquipped,
  setQty, updateEntry, withBase,
} from './inventory'
import { LastRoll, type Shown } from '../sheet/combat/LastRoll'
import { useSheetRolls } from '../sheet/dice'
import { drinkPotion } from '../sheet/uses'
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
  const rolls = useSheetRolls(character)
  const [drank, setDrank] = useState<{ key: number; name: string; rolls: Shown[]; note: string } | null>(null)

  /** One tap on a potion: roll its healing, start its effect (Giant Strength, Resistance), one fewer in the stack. */
  const drink = (e: InventoryEntry, name: string, dice?: string) => {
    const roll = dice ? rolls.spell(name, { damage: dice, damageType: 'healing' }).damage : undefined
    const healed = roll?.total ?? 0
    const effect = potionEffect(e.uid, name, e.effects)
    apply(t('use.log.drink', { name }), c => drinkPotion(c, e.uid, healed, effect))
    const note = [healed ? t('cast.healed', { n: healed }) : '', effect ? t('cast.inEffect') : ''].filter(Boolean).join(' · ')
    setDrank(d => ({ key: (d?.key ?? 0) + 1, name, rolls: roll ? [{ roll, what: t('cs.roll.healing') }] : [], note }))
  }

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
          <>
          {drank && (
            <div className="use-out" key={drank.key}>
              <strong>{drank.name}</strong>
              <LastRoll rolls={drank.rolls} note={drank.note} onDone={() => setDrank(null)} />
            </div>
          )}
          <ul className="inv-list">
            {character.inventory.map(e => editing === e.uid
              ? <li key={e.uid} className="inv-row editing"><ItemEditor character={character} entry={e} apply={apply} onDone={() => setEditing(null)} /></li>
              : <Row key={e.uid} entry={e} apply={apply} onEdit={() => setEditing(e.uid)} onDrink={drink} />)}
          </ul>
          </>
        )}

      {adding
        ? <AddPanel lib={lib} onAdd={add} onClose={() => setAdding(false)} source={BUNDLED.find(m => m.source.id === sourceFor(edition))?.source.title} />
        : <button type="button" className="btn primary inv-add" onClick={() => setAdding(true)}>{t('inv.add')}</button>}
    </section>
  )
}

type T = ReturnType<typeof useI18n>

/** "+1 AC", "STR becomes 19", "Resistant to fire"… Also used by custom actions on the combat page and DM requests. */
export function effectText({ t, term, skill }: T, f: ItemEffect): string {
  const n = 'value' in f ? f.value : 0
  const signed = `${n >= 0 ? '+' : '−'}${Math.abs(n)}`
  const ability = (a: Ability) => term('ability', a, ABILITY_NAMES[a])
  switch (f.kind) {
    case 'abilitySet': return t('inv.fx.text.abilitySet', { ability: ability(f.ability), n })
    case 'ability': return t(f.max ? 'inv.fx.text.abilityMax' : 'inv.fx.text.ability', { ability: ability(f.ability), n: signed, max: f.max ?? '' })
    case 'save': return t('inv.fx.text.save', { n: signed, ability: ability(f.ability) })
    case 'skill': return t('inv.fx.text.skill', { n: signed, skill: skill(f.skill) })
    case 'saveProficiency': return t('inv.fx.text.saveProficiency', { ability: ability(f.ability) })
    case 'skillProficiency': return t(f.expertise ? 'inv.fx.text.skillExpertise' : 'inv.fx.text.skillProficiency', { skill: skill(f.skill) })
    case 'advantage': return t(f.when?.trim() ? 'inv.fx.text.advantageWhen' : 'inv.fx.text.advantage', { on: advantageName({ t, term, skill } as T, f.on), when: f.when?.trim() ?? '' })
    case 'resistance':
    case 'immunity': return t(`inv.fx.text.${f.kind}`, { damage: term('damage', f.damage, f.damage) })
    case 'conditionImmunity': return t('inv.fx.text.conditionImmunity', { condition: term('condition', f.condition, f.condition) })
    case 'moveSpeed': return t(f.value ? 'inv.fx.text.moveSpeed' : 'inv.fx.text.moveSpeedWalk', { mode: t(`inv.move.${f.mode}`), n })
    case 'sense': return t('inv.fx.text.sense', { sense: t(`inv.sense.${f.sense}`), n })
    case 'spellSlot': return t('inv.fx.text.spellSlot', { n: signed, level: t(`sheet.slot.${f.level}` as MessageKey) })
    case 'pactSlot': return t('inv.fx.text.pactSlot', { n: signed })
    case 'charges': return t('inv.fx.text.charges', { n, recharge: t(RECHARGE_KEYS[f.recharge]) + (f.recharge === 'dawn' && f.regain ? ` +${f.regain}` : '') })
    case 'spell': return t(f.note?.trim() ? 'inv.fx.text.spellNote' : 'inv.fx.text.spell', { spell: f.spell, note: f.note?.trim() ?? '' })
    default: return t(`inv.fx.text.${f.kind}` as MessageKey, { n: signed })
      + (f.unarmored ? ` ${t('inv.fx.text.unarmored')}` : '') + (f.armored ? ` ${t('inv.fx.text.armored')}` : '') + (f.only ? ` ${t(`inv.fx.text.${f.only}`)}` : '')
  }
}

const RECHARGE_KEYS = { short: 'rest.short', long: 'rest.long', dawn: 'rest.dawn', none: 'rest.none' } as const

/** "Stealth", "DEX saves", "all saving throws"… */
export function advantageName({ t, term, skill }: T, on: AdvantageOn): string {
  if (on.startsWith('skill:')) return skill(on.slice(6) as SkillId)
  if (on.startsWith('save:')) return t('inv.adv.save', { ability: term('ability', on.slice(5), ABILITY_NAMES[on.slice(5) as Ability]) })
  return t(`inv.adv.${on as 'saves'}`)
}

function Row({ entry: e, apply, onEdit, onDrink }: { entry: InventoryEntry; apply: Apply; onEdit: () => void; onDrink: (e: InventoryEntry, name: string, dice?: string) => void }) {
  const i18n = useI18n()
  const { t, term } = i18n
  const [open, setOpen] = useState(false)
  const item = itemOf(e)
  const name = e.item || e.name ? item.name : term('item', item.id, item.name)
  const equippable = item.kind !== 'gear' || !!e.effects?.length
  const potion = potionHealing(e.itemId, item.name)
  const drinkable = !!potion || isPotion(item.name)
  const active = e.equipped
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
              {!active && <> · {t('inv.fx.needsEquip')}</>}
            </small>
          )}
        </button>
        <div className="inv-actions">
          {drinkable && (
            <button type="button" className="glass-btn small prominent" aria-label={t('use.drinkName', { name })} onClick={() => onDrink(e, name, potion)}>{t('use.drink')}</button>
          )}
          {equippable && (
            <button type="button" className={`btn small${e.equipped ? ' primary' : ''}`} aria-pressed={e.equipped}
              onClick={() => apply(t(e.equipped ? 'inv.log.unequip' : 'inv.log.equip', { name }), c => setEquipped(c, e.uid, !e.equipped))}>
              {t(e.equipped ? 'inv.equipped' : 'inv.equip')}
            </button>
          )}
          <div className="inv-stepper">
            <button type="button" aria-label={t('inv.less', { name })} onClick={() => (e.qty > 1 || confirm(t('sheet.confirmRemove', { name }))) && apply(t(e.qty > 1 ? 'inv.log.less' : 'inv.log.remove', { name }), c => setQty(c, e.uid, e.qty - 1))}>−</button>
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
  const infusions = knownInfusions(character)
  // Artificer: put a known infusion or plan on this item (its bonus and effects join the item's own).
  const infuse = (id: string) => {
    const o = infusions.find(x => x.id === id)
    if (!o) return
    const s = infusionStats(o)
    if (s.magicBonus) setMagic(m => Math.max(m, s.magicBonus))
    if (s.extraDamage && !extra) setExtra(s.extraDamage)
    setEffects(fx => [...fx, ...s.effects])
    const label = t('inv.infusedNote', { name: term('option', o.id, o.name) })
    setNotes(n => (n.includes(label) ? n : [n.trim(), label].filter(Boolean).join('\n')))
  }

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
      effects: effects.filter(isUsefulEffect),
    }), e.uid, qty))
    onDone()
  }
  const remove = () => {
    if (!confirm(t('sheet.confirmRemove', { name: item.name }))) return
    apply(t('inv.log.remove', { name: item.name }), c => removeEntry(c, e.uid))
    onDone()
  }

  return (
    <form className="inv-editor" onSubmit={save} aria-label={t('inv.editName', { name: item.name })}>
      <label className="wide"><span className="inv-label">{t('inv.f.name')} <Why title={t('inv.why.name.title')} text={t('inv.why.name.text')} /></span><input value={item.name} onChange={ev => patch({ name: ev.target.value })} required /></label>
      <label><span className="inv-label">{t('inv.f.kind')} <Why title={t('inv.why.kind.title')} text={t('inv.why.kind.text')} /></span>
        <select value={item.kind} onChange={ev => setKind(ev.target.value as Item['kind'])}>
          <option value="gear">{t('inv.kind.gear')}</option>
          <option value="weapon">{t('inv.kind.weapon')}</option>
          <option value="armor">{t('inv.kind.armor')}</option>
        </select>
      </label>
      <label><span className="inv-label">{t('inv.f.qty')} <Why title={t('inv.why.qty.title')} text={t('inv.why.qty.text')} /></span><input type="number" min={1} value={qty} onChange={ev => setQtyDraft(Math.max(1, Number(ev.target.value) || 1))} /></label>
      <label><span className="inv-label">{t('inv.f.weight')} <Why title={t('inv.why.weight.title')} text={t('inv.why.weight.text')} /></span><input type="number" min={0} step="0.25" value={item.weight} onChange={ev => patch({ weight: Math.max(0, Number(ev.target.value) || 0) })} /></label>

      {item.kind !== 'gear' && (
        <label><span className="inv-label">{t('inv.f.base')} <Why title={t('inv.why.base.title')} text={t('inv.why.base.text')} /></span>
          <select value="" onChange={ev => startFrom(ev.target.value)}>
            <option value="">{t('inv.f.basePick')}</option>
            {BASES.filter(b => b.kind === item.kind).map(b => <option key={b.id} value={b.id}>{term('item', b.id, b.name)}</option>)}
          </select>
        </label>
      )}

      {item.kind === 'weapon' && (
        <>
          <label><span className="inv-label">{t('inv.f.damage')} <Why title={t('inv.why.damage.title')} text={t('inv.why.damage.text')} /></span><input value={item.damage} onChange={ev => patch({ damage: ev.target.value })} dir="ltr" /></label>
          <label><span className="inv-label">{t('inv.f.damageType')} <Why title={t('inv.why.damageType.title')} text={t('inv.why.damageType.text')} /></span>
            <select value={item.damageType} onChange={ev => patch({ damageType: ev.target.value })}>
              {DAMAGE_TYPES.map(d => <option key={d} value={d}>{term('damage', d, d)}</option>)}
            </select>
          </label>
          <label><span className="inv-label">{t('inv.f.category')} <Why title={t('inv.why.category.title')} text={t('inv.why.category.text')} /></span>
            <select value={item.category} onChange={ev => patch({ category: ev.target.value as 'simple' | 'martial' })}>
              <option value="simple">{t('inv.simple')}</option>
              <option value="martial">{t('inv.martial')}</option>
            </select>
          </label>
          {item.properties.includes('versatile') && (
            <label><span className="inv-label">{t('inv.f.versatile')} <Why title={t('inv.why.versatile.title')} text={t('inv.why.versatile.text')} /></span><input value={item.versatile ?? ''} onChange={ev => patch({ versatile: ev.target.value || undefined })} dir="ltr" /></label>
          )}
          {(item.properties.includes('ranged') || item.properties.includes('thrown')) && (
            <label><span className="inv-label">{t('inv.f.range')} <Why title={t('inv.why.range.title')} text={t('inv.why.range.text')} /></span><input value={item.range ?? ''} placeholder="20/60" onChange={ev => patch({ range: ev.target.value || undefined })} dir="ltr" /></label>
          )}
          <fieldset className="wide inv-props">
            <legend className="why-legend">{t('inv.f.properties')} <Why title={t('inv.why.properties.title')} text={t('inv.why.properties.text')} /></legend>
            {PROPERTIES.map(p => (
              <label key={p} className="check">
                <input type="checkbox" checked={item.properties.includes(p)}
                  onChange={ev => patch({ properties: ev.target.checked ? [...item.properties, p] : item.properties.filter(x => x !== p) })} />
                {t(`inv.prop.${p}` as MessageKey)}
                <Why compact title={t(`inv.prop.${p}` as MessageKey)} text={t(`inv.why.prop.${p}` as MessageKey)} />
              </label>
            ))}
          </fieldset>
          <label><span className="inv-label">{t('inv.f.extra')} <Why title={t('inv.why.extra.title')} text={t('inv.why.extra.text')} /></span><input value={extra} placeholder="1d6 fire" onChange={ev => setExtra(ev.target.value)} dir="ltr" /></label>
        </>
      )}

      {item.kind === 'armor' && (
        <>
          <label><span className="inv-label">{t('inv.f.armorType')} <Why title={t('inv.why.armorType.title')} text={t('inv.why.armorType.text')} /></span>
            <select value={item.category} onChange={ev => patch({ category: ev.target.value as 'light' })}>
              {(['light', 'medium', 'heavy', 'shield'] as const).map(k => <option key={k} value={k}>{t(`inv.armor.${k}` as MessageKey)}</option>)}
            </select>
          </label>
          <label><span className="inv-label">{t('inv.f.ac')} <Why title={t('inv.why.ac.title')} text={t('inv.why.ac.text')} /></span><input type="number" value={item.baseAc} onChange={ev => patch({ baseAc: Number(ev.target.value) || 0 })} /></label>
          {item.category !== 'shield' && (
            <label><span className="inv-label">{t('inv.f.dexCap')} <Why title={t('inv.why.dexCap.title')} text={t('inv.why.dexCap.text')} /></span>
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
        <label><span className="inv-label">{t('inv.f.magic')} <Why title={t('inv.why.magic.title')} text={t('inv.why.magic.text')} /></span>
          <select value={magic} onChange={ev => setMagic(Number(ev.target.value))}>
            {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n ? `+${n}` : t('inv.none')}</option>)}
          </select>
        </label>
      )}
      {item.kind === 'weapon' && isWarlock(character) && (
        <label className="check wide inv-pact">
          <input type="checkbox" checked={pact} onChange={ev => setPact(ev.target.checked)} />
          <span><span className="inv-label">{t('inv.f.pact')} <Why title={t('inv.why.pact.title')} text={t('inv.why.pact.text')} /></span><small>{t(uses2024Spells(character) ? 'inv.pactHint2024' : 'inv.pactHint')}</small></span>
        </label>
      )}
      {infusions.length > 0 && (
        <label className="wide"><span className="inv-label">{t('inv.f.infuse')} <Why title={t('inv.why.infuse.title')} text={t('inv.why.infuse.text')} /></span>
          <select value="" onChange={ev => infuse(ev.target.value)}>
            <option value="">{t('inv.infusePick')}</option>
            {infusions.map(o => <option key={o.id} value={o.id}>{term('option', o.id, o.name)}</option>)}
          </select>
        </label>
      )}
      <EffectsEditor effects={effects} onChange={setEffects} />
      <label className="wide"><span className="inv-label">{t('inv.f.notes')} <Why title={t('inv.why.notes.title')} text={t('inv.why.notes.text')} /></span><textarea rows={4} value={notes} onChange={ev => setNotes(ev.target.value)} placeholder={t('inv.f.notesHint')} /></label>

      <div className="wide inv-editor-actions">
        <button type="submit" className="btn primary">{t('inv.save')}</button>
        <button type="button" className="btn" onClick={onDone}>{t('common.cancel')}</button>
        <button type="button" className="btn ghost inv-delete" onClick={remove}>{t('inv.delete')}</button>
      </div>
    </form>
  )
}

const EFFECT_GROUPS: { key: MessageKey; kinds: ItemEffect['kind'][] }[] = [
  { key: 'inv.fx.group.numbers', kinds: ['ac', 'saves', 'checks', 'attack', 'damage', 'initiative', 'spellAttack', 'spellDc', 'speed', 'hp', 'passivePerception'] },
  { key: 'inv.fx.group.abilities', kinds: ['abilitySet', 'ability'] },
  { key: 'inv.fx.group.rolls', kinds: ['save', 'skill', 'saveProficiency', 'skillProficiency', 'advantage'] },
  { key: 'inv.fx.group.defense', kinds: ['resistance', 'immunity', 'conditionImmunity', 'moveSpeed', 'sense'] },
  { key: 'inv.fx.group.magic', kinds: ['spellSlot', 'pactSlot', 'charges', 'spell'] },
]
const MOVES: MoveMode[] = ['fly', 'swim', 'climb', 'burrow']
const SENSES: Sense[] = ['darkvision', 'blindsight', 'tremorsense', 'truesight']
const RECHARGES: Recharge[] = ['long', 'short', 'dawn', 'none']
const ADVANTAGE_TARGETS: AdvantageOn[] = [
  'saves', 'checks', 'initiative', 'attacks', 'concentration', ...ABILITIES.map(a => `save:${a}` as const), ...ALL_SKILLS.map(s => `skill:${s}` as const),
]

function blankEffect(kind: ItemEffect['kind'], prev?: ItemEffect): ItemEffect {
  if (kind === prev?.kind) return prev
  switch (kind) {
    case 'abilitySet': return { kind, ability: 'str', value: 19 }
    case 'ability': return { kind, ability: 'str', value: 2, max: 20 }
    case 'save': return { kind, ability: 'wis', value: 1 }
    case 'skill': return { kind, skill: 'perception', value: 1 }
    case 'saveProficiency': return { kind, ability: 'wis' }
    case 'skillProficiency': return { kind, skill: 'perception' }
    case 'advantage': return { kind, on: 'skill:stealth' }
    case 'resistance': case 'immunity': return { kind, damage: 'fire' }
    case 'conditionImmunity': return { kind, condition: 'poisoned' }
    case 'moveSpeed': return { kind, mode: 'fly', value: 0 }
    case 'sense': return { kind, sense: 'darkvision', value: 60 }
    case 'spellSlot': return { kind, level: 1, value: 1 }
    case 'pactSlot': return { kind, value: 1 }
    case 'charges': return { kind, value: 3, recharge: 'long' }
    case 'spell': return { kind, spell: '' }
    default: return { kind, value: kind === 'speed' ? 10 : 1 }
  }
}

/** Stat effects of an item (or a custom action): pick what it changes and by how much. */
export function EffectsEditor({ effects, onChange, legend }: { effects: ItemEffect[]; onChange: (fx: ItemEffect[]) => void; legend?: string }) {
  const i18n = useI18n()
  const { t, term, skill } = i18n
  const put = (i: number, f: ItemEffect) => onChange(effects.map((x, j) => (j === i ? f : x)))
  const abilityPick = (i: number, f: ItemEffect & { ability: Ability }) => (
    <select aria-label={t('inv.fx.ability')} value={f.ability} onChange={ev => put(i, { ...f, ability: ev.target.value as Ability } as ItemEffect)}>
      {ABILITIES.map(a => <option key={a} value={a}>{term('ability', a, ABILITY_NAMES[a])}</option>)}
    </select>
  )
  const skillPick = (i: number, f: ItemEffect & { skill: SkillId }) => (
    <select aria-label={t('inv.fx.skill')} value={f.skill} onChange={ev => put(i, { ...f, skill: ev.target.value as SkillId } as ItemEffect)}>
      {ALL_SKILLS.map(s => <option key={s} value={s}>{skill(s)}</option>)}
    </select>
  )
  const number = (i: number, f: ItemEffect & { value: number }, label: string, opts: { min?: number; placeholder?: string } = {}) => (
    <input type="number" aria-label={label} title={label} min={opts.min} placeholder={opts.placeholder} value={f.value}
      onChange={ev => put(i, { ...f, value: Number(ev.target.value) || 0 } as ItemEffect)} />
  )
  return (
    <fieldset className="wide inv-effects-editor">
      <legend className="why-legend">{legend ?? t('inv.f.effects')} <Why title={t('inv.why.effects.title')} text={t('inv.why.effects.text')} /></legend>
      {effects.length === 0 && <p className="hint">{t('inv.fx.none')}</p>}
      {effects.map((f, i) => (
        <div key={i} className="inv-effect">
          <select aria-label={t('inv.fx.kind')} value={f.kind} onChange={ev => put(i, blankEffect(ev.target.value as ItemEffect['kind'], f))}>
            {EFFECT_GROUPS.map(g => (
              <optgroup key={g.key} label={t(g.key)}>
                {g.kinds.map(k => <option key={k} value={k}>{t(`inv.fx.kind.${k}` as MessageKey)}</option>)}
              </optgroup>
            ))}
          </select>
          <Why compact title={t(`inv.fx.kind.${f.kind}` as MessageKey)} text={t(`inv.whyfx.${f.kind}` as MessageKey)} />
          {(f.kind === 'abilitySet' || f.kind === 'ability' || f.kind === 'save' || f.kind === 'saveProficiency') && abilityPick(i, f)}
          {(f.kind === 'skill' || f.kind === 'skillProficiency') && skillPick(i, f)}
          {f.kind === 'advantage' && (
            <>
              <select aria-label={t('inv.fx.on')} value={f.on} onChange={ev => put(i, { ...f, on: ev.target.value as AdvantageOn })}>
                {ADVANTAGE_TARGETS.map(on => <option key={on} value={on}>{advantageName(i18n, on)}</option>)}
              </select>
              <input aria-label={t('inv.fx.when')} placeholder={t('inv.fx.whenHint')} value={f.when ?? ''}
                onChange={ev => put(i, { ...f, when: ev.target.value || undefined })} />
            </>
          )}
          {(f.kind === 'resistance' || f.kind === 'immunity') && (
            <select aria-label={t('inv.fx.damageType')} value={f.damage} onChange={ev => put(i, { ...f, damage: ev.target.value })}>
              {DAMAGE_TYPES.map(d => <option key={d} value={d}>{term('damage', d, d)}</option>)}
            </select>
          )}
          {f.kind === 'conditionImmunity' && (
            <select aria-label={t('inv.fx.condition')} value={f.condition} onChange={ev => put(i, { ...f, condition: ev.target.value as typeof f.condition })}>
              {CONDITIONS.map(c => <option key={c} value={c}>{term('condition', c, c)}</option>)}
            </select>
          )}
          {f.kind === 'moveSpeed' && (
            <>
              <select aria-label={t('inv.fx.mode')} value={f.mode} onChange={ev => put(i, { ...f, mode: ev.target.value as MoveMode })}>
                {MOVES.map(m => <option key={m} value={m}>{t(`inv.move.${m}`)}</option>)}
              </select>
              {number(i, f, t('inv.fx.feet'), { min: 0, placeholder: t('inv.fx.speedHint') })}
            </>
          )}
          {f.kind === 'sense' && (
            <>
              <select aria-label={t('inv.fx.sense')} value={f.sense} onChange={ev => put(i, { ...f, sense: ev.target.value as Sense })}>
                {SENSES.map(x => <option key={x} value={x}>{t(`inv.sense.${x}`)}</option>)}
              </select>
              {number(i, f, t('inv.fx.feet'), { min: 0 })}
            </>
          )}
          {f.kind === 'spellSlot' && (
            <>
              <select aria-label={t('inv.fx.level')} value={f.level} onChange={ev => put(i, { ...f, level: Number(ev.target.value) })}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => <option key={l} value={l}>{t(`sheet.slot.${l}` as MessageKey)}</option>)}
              </select>
              {number(i, f, t('inv.fx.count'))}
            </>
          )}
          {f.kind === 'charges' && (
            <>
              {number(i, f, t('inv.fx.count'), { min: 1 })}
              <select aria-label={t('inv.fx.recharge')} value={f.recharge} onChange={ev => put(i, { ...f, recharge: ev.target.value as Recharge })}>
                {RECHARGES.map(r => <option key={r} value={r}>{t(RECHARGE_KEYS[r])}</option>)}
              </select>
              {f.recharge === 'dawn' && (
                <input aria-label={t('inv.fx.regain')} placeholder={t('inv.fx.regainHint')} value={f.regain ?? ''} dir="ltr"
                  onChange={ev => put(i, { ...f, regain: ev.target.value || undefined })} />
              )}
            </>
          )}
          {f.kind === 'spell' && (
            <>
              <input aria-label={t('inv.fx.spell')} placeholder={t('inv.fx.spellHint')} value={f.spell} onChange={ev => put(i, { ...f, spell: ev.target.value })} />
              <input aria-label={t('inv.fx.spellNote')} placeholder={t('inv.fx.spellNoteHint')} value={f.note ?? ''}
                onChange={ev => put(i, { ...f, note: ev.target.value || undefined })} />
            </>
          )}
          {(f.kind === 'pactSlot' || f.kind === 'abilitySet' || f.kind === 'ability' || f.kind === 'save' || f.kind === 'skill' || isBonus(f)) && number(i, f, t('inv.fx.value'))}
          {f.kind === 'ability' && (
            <input type="number" aria-label={t('inv.fx.max')} placeholder={t('inv.fx.max')} value={f.max ?? ''}
              onChange={ev => put(i, { ...f, max: ev.target.value ? Number(ev.target.value) : undefined })} />
          )}
          {f.kind === 'skillProficiency' && (
            <label className="check">
              <input type="checkbox" checked={!!f.expertise} onChange={ev => put(i, { ...f, expertise: ev.target.checked || undefined })} />
              {t('inv.fx.expertise')}
            </label>
          )}
          {f.kind === 'ac' && (
            <select aria-label={t('inv.fx.wearing')} value={f.armored ? 'armored' : f.unarmored ? 'unarmored' : 'all'}
              onChange={ev => put(i, { ...f, unarmored: ev.target.value === 'unarmored' || undefined, armored: ev.target.value === 'armored' || undefined })}>
              <option value="all">{t('inv.fx.wearing.all')}</option>
              <option value="unarmored">{t('inv.fx.unarmored')}</option>
              <option value="armored">{t('inv.fx.armored')}</option>
            </select>
          )}
          {(f.kind === 'attack' || f.kind === 'damage') && (
            <select aria-label={t('inv.fx.only')} value={f.only ?? 'all'} onChange={ev => put(i, { ...f, only: ev.target.value === 'all' ? undefined : ev.target.value as 'melee' | 'ranged' })}>
              {(['all', 'melee', 'ranged'] as const).map(o => <option key={o} value={o}>{t(`inv.fx.only.${o}`)}</option>)}
            </select>
          )}
          <button type="button" className="btn ghost small inv-effect-remove" aria-label={t('inv.fx.remove')} onClick={() => onChange(effects.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="btn small" onClick={() => onChange([...effects, blankEffect('ac')])}>{t('inv.fx.add')}</button>
    </fieldset>
  )
}

const BONUS_KINDS = new Set<string>(EFFECT_GROUPS[0].kinds)
const isBonus = (f: ItemEffect): f is Extract<ItemEffect, { unarmored?: boolean }> => BONUS_KINDS.has(f.kind)

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
                  <span><bdi lang="en">{m.name}</bdi><small lang="en">{m.rarityText ?? m.rarity}</small></span>
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

