import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { Character } from '../model/character'
import { getCharacter, onCharactersChanged } from '../storage'
import { buildPrintSheet, type Pips, type PrintSheet as Sheet } from './sheetData'
import './print.css'

/** Paper-style character sheet. The browser's print dialog saves it as a PDF. */
export function PrintSheet({ characterId, onBack }: { characterId: string; onBack: () => void }) {
  const [character, setCharacter] = useState<Character | null | undefined>(undefined)
  const [withPlayState, setWithPlayState] = useState(false)

  useEffect(() => {
    const load = () => getCharacter(characterId).then(c => setCharacter(c ?? null))
    load()
    return onCharactersChanged(id => { if (!id || id === characterId) load() })
  }, [characterId])

  useEffect(() => {
    if (!character) return
    const title = document.title
    // Browsers use the page title as the default PDF file name.
    document.title = `${character.name} - character sheet`
    return () => { document.title = title }
  }, [character])

  if (character === undefined) return <p className="muted">Loading…</p>
  if (character === null) {
    return (
      <section className="panel">
        <p>This character could not be found.</p>
        <button type="button" className="btn" onClick={onBack}>Back</button>
      </section>
    )
  }

  const s = buildPrintSheet(character, { withPlayState })
  return (
    <div className="ff-print">
      <div className="print-toolbar panel">
        <button type="button" className="btn ghost" onClick={onBack}>← Back</button>
        <label className="row small">
          <input type="checkbox" checked={withPlayState} onChange={e => setWithPlayState(e.target.checked)} />
          Fill in current HP, used slots and conditions
        </label>
        <button type="button" className="btn primary" onClick={() => window.print()}>Print or save as PDF</button>
        <p className="muted small">In the print dialog, choose “Save as PDF” as the printer to get a file.</p>
      </div>
      <PageOne s={s} />
      <PageTwo s={s} />
    </div>
  )
}

function PageOne({ s }: { s: Sheet }) {
  return (
    <article className="paper">
      <header className="p-head">
        {s.portrait && <img className="p-portrait" src={s.portrait} alt="" />}
        <div className="p-name">
          <h1>{s.name}</h1>
          <span className="p-label">Character name</span>
        </div>
        <dl className="p-facts">
          <Fact label="Class & level" value={s.classLine} />
          <Fact label="Race" value={s.race} />
          <Fact label="Background" value={s.background} />
          <Fact label="Alignment" value={s.alignment} />
          <Fact label="Player" value={s.playerName} />
          <Fact label="Experience" value={String(s.xp)} />
        </dl>
      </header>

      <div className="p-grid">
        <div className="p-col">
          <div className="p-abilities">
            {s.abilities.map(a => (
              <div key={a.id} className="p-ability">
                <span className="p-label">{a.name}</span>
                <strong>{a.mod}</strong>
                <span className="p-score">{a.score}</span>
              </div>
            ))}
          </div>
          <div className="p-stack">
            <Stat label="Proficiency bonus" value={s.proficiencyBonus} inline />
            <Stat label="Passive Perception" value={String(s.passivePerception)} inline />
            <Box title="Saving throws">
              <ul className="p-checks">
                {s.saves.map(x => <Check key={x.name} on={x.proficient} bonus={x.bonus} name={x.name} />)}
              </ul>
            </Box>
            <Box title="Skills">
              <ul className="p-checks">
                {s.skills.map(x => <Check key={x.name} on={x.proficient} bonus={x.bonus} name={x.name} extra={x.ability} />)}
              </ul>
            </Box>
          </div>
        </div>

        <div className="p-col">
          <div className="p-trio">
            <Stat label="Armor class" value={String(s.armorClass)} sub={s.armorSource} />
            <Stat label="Initiative" value={s.initiative} />
            <Stat label="Speed" value={`${s.speed} ft`} />
          </div>
          <Box title="Hit points">
            <p className="p-max">Max <strong>{s.maxHp}</strong></p>
            <div className="p-write tall">{s.currentHp ?? ''}</div>
            <span className="p-label">Current</span>
            <div className="p-write">{s.tempHp ?? ''}</div>
            <span className="p-label">Temporary</span>
          </Box>
          <div className="p-pair">
            <Box title="Hit dice">
              <p className="p-center"><strong>{s.hitDice}</strong></p>
              <div className="p-write" />
              <span className="p-label">Spent</span>
            </Box>
            <Box title="Death saves">
              <p className="p-death">Successes <Circles max={3} used={0} /></p>
              <p className="p-death">Failures <Circles max={3} used={0} /></p>
            </Box>
          </div>
          <Box title="Attacks">
            <table className="p-table">
              <thead><tr><th>Name</th><th>Hit</th><th>Damage</th></tr></thead>
              <tbody>
                {s.attacks.map(a => (
                  <tr key={a.name}>
                    <td>{a.name}{a.notes && <small>{a.notes}</small>}</td>
                    <td>{a.bonus}</td>
                    <td>{a.damage}</td>
                  </tr>
                ))}
                {[0, 1].map(i => <tr key={`blank${i}`} className="blank"><td /><td /><td /></tr>)}
              </tbody>
            </table>
          </Box>
          <Box title="Conditions">
            <div className="p-write">{s.conditions.join(', ')}</div>
            <p className="p-death">Exhaustion <Circles max={6} used={s.exhaustion} /></p>
          </Box>
        </div>

        <div className="p-col">
          <Box title="Features">
            <List items={s.features} empty="None yet" />
          </Box>
          <Box title="Racial traits">
            <List items={s.traits} empty="None" />
          </Box>
          <Box title="Languages and tools">
            <p>{s.languages.join(', ') || '—'}</p>
          </Box>
          {s.warnings.length > 0 && (
            <Box title="Warnings">
              <List items={s.warnings} />
            </Box>
          )}
        </div>
      </div>
      <footer className="p-foot">Forge &amp; Familiar · SRD 5.1</footer>
    </article>
  )
}

function PageTwo({ s }: { s: Sheet }) {
  return (
    <article className="paper">
      <header className="p-head small">
        <div className="p-name"><h1>{s.name}</h1></div>
        <p className="p-sub">{s.classLine} · {s.race}</p>
      </header>
      <div className="p-grid two">
        <div className="p-col">
          <Box title="Spellcasting">
            {s.spellcasting ? (
              <div className="p-trio">
                <Stat label="Ability" value={s.spellcasting.ability.slice(0, 3).toUpperCase()} />
                <Stat label="Save DC" value={String(s.spellcasting.saveDc)} />
                <Stat label="Attack" value={s.spellcasting.attackBonus} />
              </div>
            ) : <p className="p-muted">No spellcasting.</p>}
            {s.spellSlots.length > 0 && <PipTable rows={s.spellSlots} head="Slots" />}
          </Box>
          <Box title="Class resources & trackers">
            {s.resources.length > 0 ? <PipTable rows={s.resources} head="Uses" /> : <p className="p-muted">None.</p>}
          </Box>
          <Box title="Spells known & prepared">
            <div className="p-lines" style={{ '--lines': 26 } as CSSProperties} />
          </Box>
        </div>
        <div className="p-col">
          <Box title="Equipment">
            <table className="p-table">
              <thead><tr><th>Item</th><th>Qty</th><th>Worn</th></tr></thead>
              <tbody>
                {s.equipment.map((e, i) => (
                  <tr key={i}><td>{e.name}</td><td>{e.qty}</td><td>{e.equipped ? '✓' : ''}</td></tr>
                ))}
                {[0, 1, 2, 3].map(i => <tr key={`blank${i}`} className="blank"><td /><td /><td /></tr>)}
              </tbody>
            </table>
            <p className="p-muted">Carried {s.carried}</p>
          </Box>
          <Box title="Coins">
            <div className="p-trio">
              <Stat label="CP" value={String(s.coins.cp)} />
              <Stat label="SP" value={String(s.coins.sp)} />
              <Stat label="GP" value={String(s.coins.gp)} />
            </div>
          </Box>
          <Box title="Notes">
            {s.notes && <p className="p-notes">{s.notes}</p>}
            <div className="p-lines" style={{ '--lines': s.notes ? 18 : 20 } as CSSProperties} />
          </Box>
        </div>
      </div>
      <footer className="p-foot">Forge &amp; Familiar · SRD 5.1</footer>
    </article>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dd>{value || ' '}</dd><dt className="p-label">{label}</dt></div>
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return <section className="p-box"><h2>{title}</h2>{children}</section>
}

function Stat({ label, value, sub, inline }: { label: string; value: string; sub?: string; inline?: boolean }) {
  return (
    <div className={`p-stat${inline ? ' inline' : ''}`}>
      <strong>{value}</strong>
      <span className="p-label">{label}</span>
      {sub && <small>{sub}</small>}
    </div>
  )
}

function Check({ on, bonus, name, extra }: { on: boolean; bonus: string; name: string; extra?: string }) {
  return (
    <li>
      <span className={`p-dot${on ? ' on' : ''}`} aria-label={on ? 'proficient' : undefined} />
      <span className="p-bonus">{bonus}</span>
      {name}
      {extra && <small> ({extra})</small>}
    </li>
  )
}

function Circles({ max, used }: { max: number; used: number }) {
  return (
    <span className="p-circles">
      {Array.from({ length: max }, (_, i) => <span key={i} className={`p-dot${i < used ? ' on' : ''}`} />)}
    </span>
  )
}

function PipTable({ rows, head }: { rows: Pips[]; head: string }) {
  return (
    <table className="p-table">
      <thead><tr><th>{head === 'Slots' ? 'Level' : 'Resource'}</th><th>Max</th><th>{head === 'Slots' ? 'Expended' : 'Used'}</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.label}>
            <td>{r.label}{r.note && <small>{r.note}</small>}</td>
            <td>{r.max}</td>
            <td>{r.max <= 10 ? <Circles max={r.max} used={r.used} /> : r.used || ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function List({ items, empty }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="p-muted">{empty ?? '—'}</p>
  return <ul className="p-list">{items.map(i => <li key={i}>{i}</li>)}</ul>
}
