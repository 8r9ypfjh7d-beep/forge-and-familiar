import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import type { Translate } from '../../i18n/translate'
import { createEncounter, elapsedSeconds, endCombat, inCombat, nextTurn, startCombat, setInitiative } from '../engine'
import { deleteEncounter, listEncounters, saveEncounter } from '../storage'
import type { Encounter } from '../types'
import { AddCombatants } from './AddCombatants'
import { CombatantRow } from './CombatantRow'
import { Effects } from './Effects'
import { PendingChecks } from './PendingChecks'
import { useCombatRolls } from './rolls'
import { useEncounter } from './useEncounter'
import './combat.css'

const newId = () => crypto.randomUUID()

function elapsedText(seconds: number, t: Translate): string {
  return seconds < 60 ? t('combat.elapsedS', { s: seconds }) : t('combat.elapsedMin', { m: Math.floor(seconds / 60), s: seconds % 60 })
}

/** Encounter list, and the open encounter. Each player profile keeps its own encounters. */
export function CombatTracker({ ownerId, initialOpenId }: { ownerId: string; initialOpenId?: string }) {
  const [list, setList] = useState<Encounter[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null)
  const { t } = useI18n()
  const refresh = useCallback(() => { listEncounters(ownerId).then(setList) }, [ownerId])
  useEffect(refresh, [refresh])

  if (openId) return <EncounterView key={openId} encounterId={openId} onBack={() => { setOpenId(null); refresh() }} />

  const create = async () => {
    const e = await saveEncounter(createEncounter(newId(), ownerId, t('combat.defaultName', { n: (list?.length ?? 0) + 1 })))
    setOpenId(e.id)
  }
  return (
    <section className="ff-combat">
      <div className="row spread">
        <h2 className="glass-title">{t('combat.title')}</h2>
        <button className="glass-btn prominent" onClick={create}>{t('combat.new')}</button>
      </div>
      {list && list.length === 0 && (
        <div className="glass empty">
          <p>{t('combat.emptyIntro')}</p>
          <button className="glass-btn prominent" onClick={create}>{t('combat.startFirst')}</button>
        </div>
      )}
      <ul className="plain encounter-list">
        {list?.map(e => (
          <li key={e.id} className="glass">
            <div>
              <h3 className="encounter-name">{e.name}</h3>
              <p className="muted small">
                {t('combat.combatants', { count: e.combatants.length })} · {inCombat(e) ? t('combat.roundN', { round: e.round }) : t('combat.notStarted')}
              </p>
            </div>
            <div className="row">
              <button className="glass-btn small" onClick={() => setOpenId(e.id)}>{t('combat.open')}</button>
              <button className="glass-btn small plain" onClick={async () => {
                if (confirm(t('combat.deleteConfirm', { name: e.name }))) { await deleteEncounter(e.id); refresh() }
              }}>{t('common.delete')}</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function EncounterView({ encounterId, onBack }: { encounterId: string; onBack: () => void }) {
  const { encounter: enc, party, act, undo, canUndo } = useEncounter(encounterId)
  const rolls = useCombatRolls()
  const { t } = useI18n()
  const [editingName, setEditingName] = useState(false)

  if (enc === undefined) return <p className="muted">{t('common.loading')}</p>
  if (enc === null) return <p>{t('combat.notFound')} <button className="glass-btn" onClick={onBack}>{t('common.back')}</button></p>

  const fighting = inCombat(enc)
  const unrolled = enc.combatants.filter(c => c.initiative === null)
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
          {fighting ? <><strong>{t('combat.roundN', { round: enc.round })}</strong><span className="muted small">{elapsedText(elapsedSeconds(enc.round), t)}</span></> : <span className="muted">{t('combat.notStarted')}</span>}
        </div>
      </header>

      <div className="combat-actions row">
        {unrolled.length > 0 && <button className="glass-btn" onClick={rollMissing}>{t('combat.rollInit', { count: unrolled.length })}</button>}
        {fighting
          ? <button className="glass-btn prominent next" onClick={() => act(nextTurn)}>{t('combat.next')}</button>
          : <button className="glass-btn prominent next" disabled={!enc.combatants.length || unrolled.length > 0} onClick={() => act(startCombat)}
              title={unrolled.length ? t('combat.needInit') : undefined}>{t('combat.start')}</button>}
        {fighting && <button className="glass-btn" onClick={() => confirm(t('combat.endConfirm')) && act(endCombat)}>{t('combat.end')}</button>}
        <button className="glass-btn plain" disabled={!canUndo} onClick={undo}>{t('combat.undo')}</button>
      </div>

      <PendingChecks enc={enc} act={act} />

      <div className="combat-grid">
        <div>
          {enc.combatants.length === 0
            ? <div className="glass empty"><p>{t('combat.emptyOrder')}</p></div>
            : (
              <ol className="plain order" aria-label={t('combat.order')}>
                {enc.combatants.map((c, i) => (
                  <CombatantRow key={c.id} enc={enc} combatant={c} party={party} act={act}
                    first={i === 0} last={i === enc.combatants.length - 1} />
                ))}
              </ol>
            )}
          <AddCombatants enc={enc} act={act} />
        </div>
        <div>
          <Effects enc={enc} act={act} />
          <section className="glass thick">
            <h3 className="glass-eyebrow">{t('combat.log')}</h3>
            {enc.log.length === 0
              ? <p className="muted small">{t('combat.logEmpty')}</p>
              : <ol className="plain combat-log">{enc.log.map((l, i) => <li key={i}>{typeof l === 'string' ? l : t(l.key, l.vars)}</li>)}</ol>}
          </section>
        </div>
      </div>
    </section>
  )
}
