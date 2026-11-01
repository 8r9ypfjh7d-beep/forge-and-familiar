import { useEffect, useRef, useState } from 'react'
import type { Monster } from '../../content'
import { rollDeathSave as rollDeathSaveDice } from '../../dice'
import { useDice } from '../../dice/ui'
import { ConfirmDialog } from '../../builder/ConfirmDialog'
import { useI18n } from '../../i18n'
import { derive } from '../../rules'
import { setCondition } from '../../npc'
import { DAMAGE_TYPES } from '../../rules/damage'
import type { ConditionId } from '../../rules/types'
import { effectiveMaxHp, rollDeathSave, vitals } from '../../sheet/engine'
import {
  addLog, concentrationOf, dropConcentration, effectConditions, isBloodied, isDefeated, moveCombatant,
  removeCombatant, setInitiative, statusOf, updateCombatant, type Party,
} from '../engine'
import { CONDITIONS, type Combatant, type Encounter } from '../types'
import type { NpcSheets } from '../npcRows'
import { applyDamage, applyHeal, applyNpcConditions } from './apply'
import { MonsterActions } from './MonsterActions'
import { rowName } from '../names'
import type { Act } from './useEncounter'

const newId = () => crypto.randomUUID()

export function CombatantRow({ enc, combatant: c, party, remote, npcs = {}, monster, monsterOf, act, first, last }: {
  enc: Encounter
  combatant: Combatant
  party: Party
  /** Character ids that live on players' phones (read-only here). */
  remote: ReadonlySet<string>
  /** NPC sheets (src/npc) by id, for rows with `npcId`. */
  npcs?: NpcSheets
  /** The row's stat block: the NPC sheet's own block, or the library monster it came from. */
  monster?: Monster
  /** Any row's stat block, so an attack from this row meets the target's defenses. */
  monsterOf?: (c: Combatant) => Monster | undefined
  act: Act
  first: boolean
  last: boolean
}) {
  const { record } = useDice()
  const { t, term, monsterName } = useI18n()
  const name = rowName(c, monster?.name, monster && monsterName(monster))
  const rounds = (n: number | null) => (n === null ? '∞' : t('combat.rounds', { count: n }))
  const cond = (x: ConditionId) => term('condition', x, x)
  const [amount, setAmount] = useState('')
  const [damageType, setDamageType] = useState('')
  const [removing, setRemoving] = useState(false)
  // Initiative being typed: the row re-sorts on blur or Enter, so it never moves under the finger.
  const [initDraft, setInitDraft] = useState<string | null>(null)
  const rowRef = useRef<HTMLLIElement>(null)
  const sheet = c.npcId ? npcs[c.npcId] : undefined
  const [block, setBlock] = useState<boolean | null>(null)
  const n = Math.max(0, Math.floor(Number(amount) || 0))
  const isRemote = !!c.characterId && remote.has(c.characterId)
  const ch = c.characterId ? party[c.characterId] : undefined
  const status = statusOf(enc, c, party)
  const fromEffects = effectConditions(enc, c.id)
  const held = concentrationOf(enc, c.id)
  const on = enc.effects.filter(e => e.targetIds.includes(c.id))
  const active = enc.activeId === c.id
  const life = ch ? vitals(ch) : isDefeated(c) ? 'dead' : 'healthy'

  const hp = ch
    ? { current: ch.state.currentHp, max: effectiveMaxHp(ch), temp: ch.state.tempHp }
    : c.hp ?? { current: 0, max: 0, temp: 0 }
  const ac = ch ? derive(ch).armorClass.value : c.ac
  const pct = hp.max ? (hp.current / hp.max) * 100 : 0

  // Next turn brings the new active row into view (smoothly, unless the device asks for reduced motion).
  const wasActive = useRef(active)
  useEffect(() => {
    if (active && !wasActive.current) {
      const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      rowRef.current?.scrollIntoView?.({ block: 'nearest', behavior: still ? 'auto' : 'smooth' })
    }
    wasActive.current = active
  }, [active])
  const commitInit = () => {
    if (initDraft === null) return
    const v = initDraft === '-' ? '' : initDraft
    setInitDraft(null)
    const next = v === '' ? null : Number(v)
    if (next !== c.initiative) act(e => setInitiative(e, c.id, next))
  }

  const idx = enc.combatants.findIndex(x => x.id === c.id)
  const tiedAbove = !first && enc.combatants[idx - 1].initiative === c.initiative
  const tiedBelow = !last && enc.combatants[idx + 1].initiative === c.initiative

  const damage = () => act((e, p, r, sheets) => applyDamage(e, p, r, c.id, [{ amount: n, type: damageType || undefined }], newId(), sheets, sheet ? undefined : monster))
  const healUp = () => act((e, p, r, sheets) => applyHeal(e, p, r, c.id, n, sheets))
  const deathSave = () => act((e, p) => {
    const pc = c.characterId ? p[c.characterId] : undefined
    if (!pc) return e
    const r = record(rollDeathSaveDice({ character: pc }))
    return { encounter: addLog(e, 'combat.log.deathSave', { name: c.name, total: r.total }), characters: [rollDeathSave(pc, r.d20?.natural ?? 10)] }
  })

  const setConditions = (next: ConditionId[]) => act((e, p, _r, sheets) => {
    const pc = c.characterId ? p[c.characterId] : undefined
    const npc = c.npcId ? sheets[c.npcId] : undefined
    if (npc) return applyNpcConditions(e, npc, next)
    if (c.kind === 'npc') return updateCombatant(e, c.id, { conditions: next })
    if (!pc) return e
    return { encounter: e, characters: [{ ...pc, state: { ...pc.state, conditions: next } }] }
  })
  const own = c.kind === 'pc' ? status.conditions : c.conditions
  // The stat block unfolds by itself on the monster's turn; the DM can open or close it any time.
  const showBlock = !!monster && c.kind === 'npc' && life !== 'dead' && (block ?? active)

  return (
    <li ref={rowRef} className={`combatant glass${active ? ' active' : ''}${life === 'dead' ? ' out' : ''}${showBlock ? ' unfolded' : ''}`} aria-current={active ? 'true' : undefined}>
      <div className="init">
        <label className="sr-only" htmlFor={`init-${c.id}`}>{t('combat.initFor', { name })}</label>
        <input id={`init-${c.id}`} inputMode="numeric" value={initDraft ?? c.initiative ?? ''} placeholder="–"
          onChange={ev => setInitDraft(ev.target.value.replace(/[^\d-]/g, ''))}
          onBlur={commitInit}
          onKeyDown={ev => { if (ev.key === 'Enter') ev.currentTarget.blur() }} />
        {(tiedAbove || tiedBelow) && (
          <span className="tie">
            <button className="icon" disabled={!tiedAbove} onClick={() => act(e => moveCombatant(e, c.id, -1))} aria-label={t('combat.moveUp', { name })}>▲</button>
            <button className="icon" disabled={!tiedBelow} onClick={() => act(e => moveCombatant(e, c.id, 1))} aria-label={t('combat.moveDown', { name })}>▼</button>
          </span>
        )}
      </div>

      <div className="who">
        <div className="name-line">
          {sheet
            ? <strong><a className="npc-link" href={`#/npc/${encodeURIComponent(sheet.id)}`} title={t('combat.openNpc', { name })}>{name}</a></strong>
            : <strong>{name}</strong>}
          {c.kind === 'pc' && <span className="tag">{t('combat.partyTag')}</span>}
          {sheet && <span className="tag">{t('combat.npcTag')}</span>}
          {ac !== undefined && <span className="tag" title={t('combat.acTitle')}>{t('stat.ac')} {ac}</span>}
          {life === 'dying' && <span className="tag bad">{t('combat.dying')}</span>}
          {life === 'stable' && <span className="tag">{t('combat.stable')}</span>}
          {life === 'dead' && <span className="tag bad">{c.kind === 'pc' ? t('combat.dead') : t('combat.down')}</span>}
          {c.kind === 'npc' && isBloodied(c.hp) && <span className="tag bad">{t('combat.bloodied')}</span>}
          {isRemote && <span className="tag" title={t('combat.remoteHint', { name })}>{t('combat.remoteTag')}</span>}
          {monster && c.kind === 'npc' && (
            <button type="button" className="tag tag-btn" aria-expanded={showBlock} onClick={() => setBlock(!showBlock)}>{showBlock ? t('combat.hideBlock') : t('combat.statBlock')}</button>
          )}
        </div>
        <div className="hp-line">
          <div className="hpbar" aria-hidden="true"><div className={pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''} style={{ width: `${pct}%` }} /></div>
          <span className="small"><span dir="ltr">{hp.current}/{hp.max}{hp.temp ? ` +${hp.temp}` : ''}</span> {t('stat.hp')}</span>
        </div>
        {(held || on.length > 0 || status.conditions.length > 0) && (
          <div className="chips">
            {held && (
              <button className="glass-chip conc" onClick={() => act(e => dropConcentration(e, c.id))}
                title={t('combat.concTitle')}>◎ <bdi>{held.name}</bdi> · <bdi>{rounds(held.remaining)}</bdi> ✕</button>
            )}
            {on.map(e => <span key={e.id} className="glass-chip fx" title={e.sourceId ? t('combat.from', { name: enc.combatants.find(x => x.id === e.sourceId)?.name ?? '' }) : undefined}><bdi>{e.name}</bdi> · <bdi>{rounds(e.remaining)}</bdi></span>)}
            {status.conditions.filter(x => !(c.kind === 'npc' && !c.conditions.includes(x))).map(x => (
              <button key={x} className="glass-chip cond" onClick={() => setConditions(own.filter(y => y !== x))} title={t('common.remove')}>{cond(x)} ✕</button>
            ))}
            {c.kind === 'npc' && fromEffects.filter(x => !c.conditions.includes(x)).map(x => (
              <span key={x} className="glass-chip cond" title={t('combat.fromEffect')}>{cond(x)}</span>
            ))}
          </div>
        )}
      </div>

      <div className="controls">
        <input aria-label={t('combat.amountFor', { name })} inputMode="numeric" placeholder="0" value={amount}
          onChange={ev => setAmount(ev.target.value.replace(/\D/g, ''))}
          onKeyDown={ev => { if (ev.key === 'Enter' && n) { damage(); setAmount('') } }} />
        {c.kind === 'npc' && (n > 0 || damageType) && (
          <select className="dmg-type" aria-label={t('combat.damageType')} value={damageType} onChange={ev => setDamageType(ev.target.value)}>
            <option value="">{t('combat.anyType')}</option>
            {DAMAGE_TYPES.map(x => <option key={x} value={x}>{term('damage', x, x)}</option>)}
          </select>
        )}
        <button className="glass-btn small danger" disabled={!n || life === 'dead'} onClick={() => { damage(); setAmount('') }}>{t('combat.dmg')}</button>
        <button className="glass-btn small heal" disabled={!n || (c.kind === 'pc' && life === 'dead')} onClick={() => { healUp(); setAmount('') }}>{t('combat.heal')}</button>
        <select className="add-cond" aria-label={t('combat.addConditionTo', { name })} value="" onChange={ev => setConditions([...own, ev.target.value as ConditionId])}>
          <option value="">{t('combat.addCondition')}</option>
          {CONDITIONS.filter(x => !own.includes(x) && (!sheet || setCondition(sheet, x, true) !== sheet)).map(x => <option key={x} value={x}>{cond(x)}</option>)}
        </select>
        {active && life === 'dying' && <button className="glass-btn small prominent" onClick={deathSave}>{t('combat.deathSave')}</button>}
        <button className="icon" onClick={() => setRemoving(true)} aria-label={t('combat.removeName', { name })}>✕</button>
      </div>
      {showBlock && monster && (
        <div className="block-slot">
          <MonsterActions enc={enc} combatant={c} monster={monster} monsterOf={monsterOf} party={party} act={act} onClose={() => setBlock(false)} />
        </div>
      )}
      <ConfirmDialog open={removing} title={t('combat.removeConfirm', { name })} yes={t('common.remove')}
        onYes={() => act(e => removeCombatant(e, c.id))} onClose={() => setRemoving(false)} />
    </li>
  )
}
