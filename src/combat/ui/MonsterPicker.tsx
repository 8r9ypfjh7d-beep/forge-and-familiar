import { useEffect, useMemo, useState } from 'react'
import { roll, rollD20 } from '../../dice'
import { useDice } from '../../dice/ui'
import { useI18n } from '../../i18n'
import { loadMonsters, monsterKey, onContentChanged, type LoadedMonster } from '../../content'
import { crLabel, findMonsters } from '../../dm/logic'
import { readDmEdition } from '../../dm/edition'
import { addCombatant, inCombat } from '../engine'
import { libraryRows } from '../library'
import type { Encounter } from '../types'
import type { Act } from './useEncounter'

const newId = () => crypto.randomUUID()

/** "Add a monster": search the library (the DM screen's edition), pick one, how many, Add. Rows keep their stat block. */
export function MonsterPicker({ enc, act }: { enc: Encounter; act: Act }) {
  const { t, monsterName } = useI18n()
  const { record } = useDice()
  const [monsters, setMonsters] = useState<LoadedMonster[]>([])
  useEffect(() => {
    let live = true
    const load = () => loadMonsters(readDmEdition()).then(list => { if (live) setMonsters(list) }).catch(() => {})
    load()
    const off = onContentChanged(load)
    return () => { live = false; off() }
  }, [])
  const [text, setText] = useState('')
  const [picked, setPicked] = useState<LoadedMonster | null>(null)
  const [count, setCount] = useState('1')
  const [rollHp, setRollHp] = useState(false)
  const found = useMemo(() => (text.trim() ? findMonsters(monsters, { text, minCr: null, maxCr: null, type: '' }, 8, monsterName) as LoadedMonster[] : []),
    [monsters, text, monsterName])

  const add = () => {
    if (!picked) return
    const rows = libraryRows(enc, picked, Number(count), newId, {
      d20: (bonus, label) => record(rollD20(bonus, { label: `${label}: Initiative` }, 'initiative')).total,
      hp: dice => roll(dice).total,
    }, rollHp)
    act(e => rows.reduce((next, row) => addCombatant(next, row), e))
    setPicked(null); setText(''); setCount('1')
  }

  const stats = (m: LoadedMonster) => t('combat.lib.stats', { cr: crLabel(m.challengeRating), ac: m.armorClass[0]?.value ?? '?', hp: m.hitPoints })
  return (
    <div className="monster-picker">
      {picked ? (
        <div className="picked">
          <p><b>{monsterName(picked)}</b> <span className="muted small">{stats(picked)}</span></p>
          <div className="row">
            <label className="count">{t('combat.count')}<input inputMode="numeric" value={count} onChange={e => setCount(e.target.value)} /></label>
            {picked.hitPointsRoll && <label className="check"><input type="checkbox" checked={rollHp} onChange={e => setRollHp(e.target.checked)} /> {t('combat.lib.rollHp', { dice: picked.hitPointsRoll })}</label>}
          </div>
          <p className="muted small">{inCombat(enc) ? t('combat.lib.rollsInit') : t('combat.lib.noInit')}</p>
          <div className="row">
            <button className="glass-btn prominent" onClick={add}>{t('combat.lib.add', { count: Math.min(20, Math.max(1, Math.floor(Number(count)) || 1)) })}</button>
            <button className="glass-btn plain" onClick={() => setPicked(null)}>{t('common.cancel')}</button>
          </div>
        </div>
      ) : (
        <>
          <label className="search">{t('combat.lib.label')}
            <input type="search" value={text} onChange={e => setText(e.target.value)} placeholder={t('combat.lib.placeholder')} />
          </label>
          {text.trim() && (found.length
            ? <ul className="plain lib-results">
                {found.map(m => (
                  <li key={monsterKey(m)}>
                    <button type="button" className="glass-btn plain" onClick={() => { setPicked(m); setRollHp(false) }}>
                      <span>{monsterName(m)}</span> <span className="muted small">{stats(m)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            : <p className="muted small">{t('combat.lib.none')}</p>)}
        </>
      )}
    </div>
  )
}
