import { useMemo, useState } from 'react'
import type { Character } from '../model/character'
import { classById, derive, formatMod, raceById } from '../rules'
import { STARTER_HEROES, createStarter, type StarterHero } from './heroes'
import './starters.css'

/** Grid of ready-to-play level 1 heroes. Picking one saves a copy owned by the player. */
export function StarterPicker({ ownerId, playerName, onCreate, onCustom, onCancel }: {
  ownerId: string
  playerName: string
  onCreate: (c: Character) => void
  onCustom: () => void
  onCancel: () => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <section className="starters">
      <div className="row spread">
        <div>
          <h2>Pick a starter hero</h2>
          <p className="muted">Ready-to-play level 1 characters with gear, skills and tips for your first session.</p>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={onCustom}>Build my own instead</button>
        </div>
      </div>
      <div className="starter-grid">
        {STARTER_HEROES.map(h => (
          <HeroCard
            key={h.id}
            hero={h}
            expanded={open === h.id}
            onToggle={() => setOpen(open === h.id ? null : h.id)}
            onPick={() => onCreate(createStarter(h, ownerId, playerName))}
          />
        ))}
      </div>
    </section>
  )
}

function HeroCard({ hero, expanded, onToggle, onPick }: {
  hero: StarterHero
  expanded: boolean
  onToggle: () => void
  onPick: () => void
}) {
  const d = useMemo(() => derive(createStarter(hero, '', '')), [hero])
  const race = raceById(hero.draft.raceId)
  const raceName = race?.subraces?.find(s => s.id === hero.draft.subraceId)?.name ?? race?.name
  const cls = classById(hero.draft.classes[0].classId)
  const attack = d.attacks[0]

  return (
    <article className="panel starter-card">
      <div className="row starter-head">
        <div className="portrait-empty starter-initial" aria-hidden="true">{hero.draft.name.slice(0, 1)}</div>
        <div>
          <h3>{hero.draft.name}</h3>
          <p className="muted small">{raceName} {cls?.name}</p>
        </div>
      </div>
      <div className="row">
        <span className="chip on">{hero.role}</span>
        <span className="chip">{hero.difficulty}</span>
      </div>
      <p>{hero.pitch}</p>
      <div className="starter-stats">
        <div><strong>{d.armorClass.value}</strong><span className="muted small">AC</span></div>
        <div><strong>{d.maxHp}</strong><span className="muted small">HP</span></div>
        <div><strong>{formatMod(d.initiative)}</strong><span className="muted small">Init</span></div>
        <div><strong>{d.speed}</strong><span className="muted small">Speed</span></div>
      </div>
      {attack && <p className="small"><strong>{attack.name}</strong> {formatMod(attack.bonus)} to hit, {attack.damage} {attack.damageType}</p>}
      {expanded && (
        <div className="small starter-more">
          <p className="muted">{hero.backstory}</p>
          <strong>How to play</strong>
          <ul>{hero.tips.map(t => <li key={t}>{t}</li>)}</ul>
          {hero.spells && (
            <>
              <strong>Suggested spells</strong>
              <ul>{hero.spells.map(s => <li key={s}>{s}</li>)}</ul>
            </>
          )}
        </div>
      )}
      <div className="row starter-actions">
        <button className="btn ghost small" onClick={onToggle} aria-expanded={expanded}>{expanded ? 'Less' : 'How to play'}</button>
        <button className="btn primary small" onClick={onPick}>Play {hero.draft.name.split(' ')[0]}</button>
      </div>
    </article>
  )
}
