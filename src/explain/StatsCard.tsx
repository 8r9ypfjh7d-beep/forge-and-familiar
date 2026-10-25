import type { Character } from '../model/character'
import { ABILITIES, ALL_SKILLS, SKILLS, derive, formatMod } from '../rules'
import { ShowMath } from './ShowMath'

/** Abilities, saves, skills, attacks and spellcasting. Every number opens its breakdown. */
export function StatsCard({ character }: { character: Character }) {
  const d = derive(character)
  const m = (stat: Parameters<typeof ShowMath>[0]['stat'], text: string | number) =>
    <ShowMath character={character} stat={stat}>{text}</ShowMath>

  return (
    <section className="card stats-card" aria-labelledby="stats-title">
      <div className="card-head">
        <h2 id="stats-title">Stats</h2>
        <span className="hint">Tap a number to see the math</span>
      </div>

      <div className="ability-grid">
        {ABILITIES.map(a => (
          <div key={a} className="ability">
            <span className="abbr">{a.toUpperCase()}</span>
            <span className="score">{m(`ability:${a}`, d.abilities[a])}</span>
            <span className="mod">{m(`mod:${a}`, formatMod(d.mods[a]))}</span>
            <span className={d.saves[a].proficient ? 'save prof' : 'save'}>
              save {m(`save:${a}`, formatMod(d.saves[a].bonus))}
            </span>
          </div>
        ))}
      </div>

      <dl className="stat-list">
        <div><dt>Passive Perception</dt><dd>{m('passivePerception', d.passivePerception)}</dd></div>
        {d.spellcasting && <>
          <div><dt>Spell save DC</dt><dd>{m('spellDc', d.spellcasting.saveDc)}</dd></div>
          <div><dt>Spell attack</dt><dd>{m('spellAttack', formatMod(d.spellcasting.attackBonus))}</dd></div>
        </>}
        <div><dt>Carrying</dt><dd>{d.carriedWeight} / {m('carryingCapacity', d.carryingCapacity)} lb</dd></div>
      </dl>

      {d.attacks.length > 0 && (
        <>
          <h3 className="sub">Attacks</h3>
          <ul className="attack-list">
            {d.attacks.map((atk, i) => (
              <li key={atk.name}>
                <span className="name">{atk.name}</span>
                <span>{m(`attack:${i}`, formatMod(atk.bonus))} to hit</span>
                <span className="dmg">{atk.damage} {atk.damageType}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <details className="skills">
        <summary>Skills</summary>
        <ul className="skill-list">
          {ALL_SKILLS.map(s => (
            <li key={s} className={d.skills[s].proficient ? 'prof' : ''}>
              <span>{SKILLS[s].name} <span className="hint">{SKILLS[s].ability.toUpperCase()}</span></span>
              {m(`skill:${s}`, formatMod(d.skills[s].bonus))}
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
