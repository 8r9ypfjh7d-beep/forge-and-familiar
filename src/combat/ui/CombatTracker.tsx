import { useCallback, useEffect, useState } from 'react'
import { roll } from '../../dice'
import { ConfirmDialog } from '../../builder/ConfirmDialog'
import { useI18n } from '../../i18n'
import type { Translate } from '../../i18n/translate'
import type { Party as Campaign } from '../../party'
import { createEncounter, elapsedSeconds, endCombat, fightStatus, inCombat, isDefeated, nextTurn, rechargeAction, startCombat, setInitiative, waitingForInitiative } from '../engine'
import { deleteEncounter, listEncounters, saveEncounter } from '../storage'
import type { Encounter } from '../types'
import { EncounterMap } from '../map/EncounterMap'
import { fightCreatures } from '../xp'
import { rowName, shownVars } from '../names'
import { AddCombatants } from './AddCombatants'
import { CombatantRow } from './CombatantRow'
import { Effects } from './Effects'
import { FightXp } from './FightXp'
import { PendingChecks } from './PendingChecks'
import { useCombatRolls } from './rolls'
import { useEncounter, type Act } from './useEncounter'
import { useMonsterIndex } from './useMonsterIndex'
import './combat.css'

const newId = () => crypto.randomUUID()

/** "Round 3", "Ended after round 3" or "Not started". */
function statusText(enc: Encounter, t: Translate): string {
  const s = fightStatus(enc)
  return s === 'fighting' ? t('combat.roundN', { round: enc.round }) : s === 'ended' ? t('combat.endedAfter', { round: enc.endedRound ?? 1 }) : t('combat.notStarted')
}

function elapsedText(seconds: number, t: Translate): string {
  return seconds < 60 ? t('combat.elapsedS', { s: seconds }) : t('combat.elapsedMin', { m: Math.floor(seconds / 60), s: seconds % 60 })
}

/**
 * Encounter list, and the open encounter. Each player profile keeps its own encounters. `campaign` is the party in play (its members join in one tap).
 * `onOpenPlan` opens the DM screen plan a fight was started from.
 */
export function CombatTracker({ ownerId, initialOpenId, campaign, onOpenPlan }: { ownerId: string; initialOpenId?: string; campaign?: Campaign; onOpenPlan?: (planId: string) => void }) {
  const [list, setList] = useState<Encounter[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null)
  const { t } = useI18n()
  const [deleting, setDeleting] = useState<Encounter | null>(null)
  const refresh = useCallback(() => { listEncounters(ownerId).then(setList) }, [ownerId])
  useEffect(refresh, [refresh])

  if (openId) return <EncounterView key={openId} encounterId={openId} campaign={campaign} onOpenPlan={onOpenPlan} onBack={() => { setOpenId(null); refresh() }} />

  const create = async () => {
    const e = await saveEncounter(createEncounter(newId(), ownerId, t('combat.defaultName', { n: (list?.length ?? 0) + 1 })))
    setOpenId(e.id)
  }
  return (
    <section className="ff-combat">
      <div className="row spread">
        <h2 className="glass-title">{t('combat.title')}</h2>
        {!!list?.length && (
          <div className="row">
            <a className="glass-btn prominent" href="#/dm">{t('combat.planOnDm')}</a>
            <button className="glass-btn" onClick={create}>{t('combat.new')}</button>
          </div>
        )}
      </div>
      {list && list.length === 0 && (
        <div className="glass empty">
          <p>{t('combat.emptyIntro')}</p>
          <div className="row">
            <a className="glass-btn prominent" href="#/dm">{t('combat.planOnDm')}</a>
            <button className="glass-btn" onClick={create}>{t('combat.startFirst')}</button>
          </div>
        </div>
      )}
      <ul className="plain encounter-list">
        {list?.map(e => (
          <li key={e.id} className="glass">
            <div>
              <h3 className="encounter-name">{e.name}</h3>
              <p className="muted small">
                {t('combat.combatants', { count: e.combatants.length })} · {statusText(e, t)}
              </p>
            </div>
            <div className="row">
              <button className="glass-btn small" onClick={() => setOpenId(e.id)}>{t('combat.open')}</button>
              <button className="glass-btn small plain" onClick={() => setDeleting(e)}>{t('common.delete')}</button>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog open={!!deleting} title={t('combat.deleteConfirm', { name: deleting?.name ?? '' })} yes={t('common.delete')}
        onYes={async () => { if (deleting) { await deleteEncounter(deleting.id); refresh() } }} onClose={() => setDeleting(null)} />
    </section>
  )
}

function EncounterView({ encounterId, campaign, onBack, onOpenPlan }: { encounterId: string; campaign?: Campaign; onBack: () => void; onOpenPlan?: (planId: string) => void }) {
  const { encounter: enc, party, remote, npcs, act, undo, canUndo } = useEncounter(encounterId)
  const rolls = useCombatRolls()
  const monsters = useMonsterIndex()
  const { t, monsterName } = useI18n()
  const [editingName, setEditingName] = useState(false)
  const [ending, setEnding] = useState(false)
  // Phones show the order or the map; wider screens show both.
  const [pane, setPane] = useState<'order' | 'map'>('order')
  // After End combat in a campaign fight: offer the XP of the creatures the party beat.
  const [xpCard, setXpCard] = useState(false)
  // An NPC sheet row plays its own (edited) block; a library row the monster it came from.
  const monsterOf = (c: { npcId?: string; monster?: { source: string; id: string } }) =>
    (c.npcId ? npcs[c.npcId]?.block : undefined) ?? (c.monster ? monsters.get(`${c.monster.source}:${c.monster.id}`) : undefined)

  // Next turn, then the new active monster rolls to recharge its spent recharge actions (SRD: at the start of its turn).
  const next = () => act(e => {
    const turned = nextTurn(e)
    const c = turned.combatants.find(x => x.id === turned.activeId)
    const m = c && monsterOf(c)
    if (!c || !m) return turned
    return m.actions.filter(a => a.usage?.type === 'recharge' && c.spent?.[a.name]).reduce((acc, a) => {
      const u = a.usage as { dice: string; minimum: number }
      const r = rolls.record(roll(u.dice, { label: `${c.name}: ${a.name} recharge` }))
      return rechargeAction(acc, c.id, a.name, r.total, u.minimum)
    }, turned)
  })

  if (enc === undefined) return <p className="muted">{t('common.loading')}</p>
  if (enc === null) return <p>{t('combat.notFound')} <button className="glass-btn" onClick={onBack}>{t('common.back')}</button></p>

  const fighting = inCombat(enc)
  // Library monster rows read in the page's language ("Goblin 1" → "גובלין 1"); the log follows.
  const shown = new Map<string, string>()
  for (const c of enc.combatants) {
    const m = c.monster && !c.npcId ? monsters.get(`${c.monster.source}:${c.monster.id}`) : undefined
    const name = m ? rowName(c, m.name, monsterName(m)) : c.name
    if (name !== c.name) shown.set(c.name, name)
  }
  const waiting = waitingForInitiative(enc)
  const unrolled = waiting.rows
  const now = fighting ? enc.combatants.find(c => c.id === enc.activeId) : undefined
  // The hint's link: show the order and put the cursor in the first empty initiative box.
  const typeFirst = () => {
    setPane('order')
    requestAnimationFrame(() => document.getElementById(`init-${unrolled[0]?.id}`)?.focus())
  }
  const rollMissing = () => act((e, p) => {
    let next = e
    for (const c of e.combatants) {
      if (c.initiative !== null) continue
      const r = rolls.initiative(c, p)
      if (r) next = setInitiative(next, c.id, r.total)
    }
    return next
  })

  return (
    <section className="ff-combat">
      <header className="combat-head">
        <button className="glass-btn icon" onClick={onBack} aria-label={t('combat.backToList')}>{t('common.backArrow')}</button>
        {editingName ? (
          <input autoFocus defaultValue={enc.name} aria-label={t('combat.nameLabel')}
            onBlur={ev => { const name = ev.target.value.trim(); if (name) act(e => ({ ...e, name })); setEditingName(false) }}
            onKeyDown={ev => { if (ev.key === 'Enter') ev.currentTarget.blur() }} />
        ) : (
          <h2 className="glass-title"><button className="title-btn" onClick={() => setEditingName(true)} title={t('combat.rename')}>{enc.name}</button></h2>
        )}
        <div className="round" aria-live="polite">
          {fighting ? <><strong>{t('combat.roundN', { round: enc.round })}</strong><span className="muted small">{elapsedText(elapsedSeconds(enc.round), t)}</span></> : <span className="muted">{statusText(enc, t)}</span>}
          {enc.planId && onOpenPlan && <button className="glass-btn small plain plan-link" onClick={() => onOpenPlan(enc.planId!)}>{t('combat.openPlan')}</button>}
        </div>
      </header>

      <div className={`combat-bar${fighting ? ' fighting' : ''}`}>
      <div className="combat-actions row">
        {unrolled.length > 0 && <button className="glass-btn roll-init" onClick={rollMissing}>{t(waiting.players ? 'combat.rollPlayers' : 'combat.rollInit', { count: unrolled.length })}</button>}
        {fighting
          ? <button className="glass-btn prominent next" onClick={next}>{t('combat.next')}</button>
          : <button className="glass-btn prominent next" disabled={!enc.combatants.length || unrolled.length > 0} onClick={() => act(startCombat)}
              title={unrolled.length ? t('combat.needInit') : undefined}>{t(enc.endedAt ? 'combat.startAgain' : 'combat.start')}</button>}
        {fighting && <button className="glass-btn" onClick={() => setEnding(true)}>{t('combat.end')}</button>}
        <button className="glass-btn plain" disabled={!canUndo} onClick={undo}>{t('combat.undo')}</button>
      </div>
      {now && <p className="combat-now" aria-live="polite">{t('combat.now')} <strong><bdi>{shown.get(now.name) ?? now.name}</bdi></strong></p>}
      {!fighting && unrolled.length > 0 && (
        <p className="combat-wait">
          {t('combat.waitingInit', { names: unrolled.map(c => shown.get(c.name) ?? c.name).join(', ') })}{' '}
          <button type="button" className="link-btn" onClick={typeFirst}>{t('combat.typeInit')}</button>{' '}
          {t('combat.orRollThem')}
        </p>
      )}
      </div>

      <ConfirmDialog open={ending} title={t('combat.endConfirm')} yes={t('combat.end')} onYes={() => { act(e => endCombat(e)); setXpCard(!!campaign) }} onClose={() => setEnding(false)} />

      {xpCard && campaign && !fighting && (
        <FightXp enc={enc} campaign={campaign} characters={party} onClose={() => setXpCard(false)}
          creatures={fightCreatures(enc, c => monsterOf(c)?.xp, c => (c.npcId && npcs[c.npcId] ? npcs[c.npcId]!.state.currentHp <= 0 : isDefeated(c)))} />
      )}

      {(enc.planId || enc.notes) && <DmNotes enc={enc} act={act} fighting={fighting} />}

      <PendingChecks enc={enc} act={act} />

      <div className="glass-segmented combat-pane-switch" role="tablist">
        <button type="button" role="tab" aria-selected={pane === 'order'} onClick={() => setPane('order')}>{t('combat.map.order')}</button>
        <button type="button" role="tab" aria-selected={pane === 'map'} onClick={() => setPane('map')}>{t('combat.map.tab')}</button>
      </div>

      <div className={`combat-map-pane ${pane === 'map' ? 'on' : ''}`}>
        <EncounterMap enc={enc} act={act} party={party} partyId={campaign?.id} monsterOf={monsterOf} />
      </div>

      <div className={`combat-grid ${pane === 'order' ? 'on' : ''}`}>
        <div>
          {enc.combatants.length === 0
            ? <div className="glass empty"><p>{t('combat.emptyOrder')}</p></div>
            : (
              <ol className="plain order" aria-label={t('combat.order')}>
                {enc.combatants.map((c, i) => (
                  <CombatantRow key={c.id} enc={enc} combatant={c} party={party} remote={remote} npcs={npcs} monster={monsterOf(c)} monsterOf={monsterOf} act={act}
                    first={i === 0} last={i === enc.combatants.length - 1} />
                ))}
              </ol>
            )}
          <AddCombatants enc={enc} act={act} campaign={campaign} />
        </div>
        <div>
          <Effects enc={enc} act={act} />
          <section className="glass thick">
            <h3 className="glass-eyebrow">{t('combat.log')}</h3>
            {enc.log.length === 0
              ? <p className="muted small">{t('combat.logEmpty')}</p>
              : <ol className="plain combat-log">{enc.log.map((l, i) => <li key={i}>{typeof l === 'string' ? l : t(l.key, shownVars(l.vars, shown))}</li>)}</ol>}
          </section>
        </div>
      </div>
    </section>
  )
}

/** The plan's DM notes, carried into the fight. Open before combat starts, folded once it runs; edits stay on this fight. */
function DmNotes({ enc, act, fighting }: { enc: Encounter; act: Act; fighting: boolean }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(!fighting)
  useEffect(() => { setOpen(!fighting) }, [fighting])
  return (
    <details className="glass combat-notes" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
      <summary className="glass-eyebrow">{t('dm.notes')}</summary>
      <textarea key={enc.notes ?? ''} dir="auto" rows={4} defaultValue={enc.notes ?? ''} placeholder={t('dm.notesPh')} aria-label={t('dm.notes')}
        onBlur={e => { const notes = e.target.value; if (notes !== (enc.notes ?? '')) act(x => ({ ...x, notes })) }} />
    </details>
  )
}
