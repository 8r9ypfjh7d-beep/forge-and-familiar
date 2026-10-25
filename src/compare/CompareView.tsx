import { useEffect, useState } from 'react'
import type { Character } from '../model/character'
import { listSnapshots, type Snapshot } from '../portability'
import { ABILITIES, ABILITY_NAMES, CLASSES, formatMod, totalLevel, type Ability } from '../rules'
import { listCharacters } from '../storage'
import { applyTweak, classLine, compareBuilds, featureDiff, type BuildTweak, type CompareRow } from './compare'
import './compare.css'

/** One side of the comparison: a saved character or one of its level snapshots, plus a what-if tweak. */
interface Side {
  /** `char:<id>` or `snap:<snapshotId>`. */
  source: string
  tweak: BuildTweak
}

const sideFor = (c: Character | undefined, levelUp: boolean): Side => ({
  source: c ? `char:${c.id}` : '',
  tweak: { levelClassId: levelUp ? c?.classes[0]?.classId : undefined, asi: [] },
})

/** Pick two builds (characters, snapshots, or level-up options) and see them stat by stat. */
export function CompareView({ ownerId, characterId, onBack }: {
  ownerId: string
  /** Character to start from: A is as it is now, B is it with one more level in its first class. */
  characterId?: string
  onBack: () => void
}) {
  const [characters, setCharacters] = useState<Character[] | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [sides, setSides] = useState<[Side, Side]>([sideFor(undefined, false), sideFor(undefined, true)])
  const [targetAc, setTargetAc] = useState(15)
  const [onlyChanges, setOnlyChanges] = useState(false)

  useEffect(() => {
    listCharacters(ownerId).then(async list => {
      setCharacters(list)
      setSnapshots((await Promise.all(list.map(c => listSnapshots(c.id)))).flat())
      const start = list.find(c => c.id === characterId) ?? list[0]
      setSides([sideFor(start, false), sideFor(start, true)])
    })
  }, [ownerId, characterId])

  const resolve = (s: Side): Character | undefined => {
    if (s.source.startsWith('char:')) return characters?.find(c => `char:${c.id}` === s.source)
    return snapshots.find(x => `snap:${x.id}` === s.source)?.character
  }
  const builds = sides.map(s => {
    const base = resolve(s)
    return base && applyTweak(base, s.tweak)
  })
  const [a, b] = builds

  const sections = a && b ? compareBuilds(a, b, targetAc) : []
  const features = a && b ? featureDiff(a, b) : null

  if (characters === null) return null
  if (characters.length === 0) {
    return (
      <section className="compare">
        <BackRow onBack={onBack} />
        <div className="panel empty"><p>Build a character first, then compare its level-up options here.</p></div>
      </section>
    )
  }

  const update = (i: 0 | 1, s: Side) => setSides(prev => (i === 0 ? [s, prev[1]] : [prev[0], s]))

  return (
    <section className="compare">
      <BackRow onBack={onBack} />
      <p className="muted">
        Pick two builds. Each side can be a saved character or a level snapshot, with an optional extra level
        and ability score increase on top, so you can weigh two level-up choices before you commit.
      </p>

      <div className="compare-pickers">
        {sides.map((s, i) => (
          <SidePicker
            key={i}
            letter={i === 0 ? 'A' : 'B'}
            side={s}
            base={resolve(s)}
            result={builds[i]}
            characters={characters}
            snapshots={snapshots}
            onChange={next => update(i as 0 | 1, next)}
          />
        ))}
      </div>

      <div className="row compare-options">
        <label className="row small">
          Target AC
          <input
            type="number" min={5} max={30} value={targetAc} className="compare-ac"
            onChange={e => setTargetAc(Math.min(30, Math.max(5, Number(e.target.value) || 15)))}
          />
        </label>
        <label className="row small">
          <input type="checkbox" checked={onlyChanges} onChange={e => setOnlyChanges(e.target.checked)} />
          Only show differences
        </label>
      </div>

      {a && b && (
        <div className="panel compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr><th scope="col">Stat</th><th scope="col">A</th><th scope="col">B</th><th scope="col">B vs A</th></tr>
            </thead>
            {sections.map(sec => {
              const rows = onlyChanges ? sec.rows.filter(r => r.a !== r.b) : sec.rows
              if (rows.length === 0) return null
              return (
                <tbody key={sec.title}>
                  <tr className="compare-section"><th colSpan={4} scope="colgroup">{sec.title}</th></tr>
                  {rows.map(r => <Row key={r.label} row={r} />)}
                </tbody>
              )
            })}
          </table>
          {features && (features.onlyA.length > 0 || features.onlyB.length > 0) && (
            <div className="compare-features">
              <FeatureList title="Only A has" items={features.onlyA} />
              <FeatureList title="Only B has" items={features.onlyB} />
            </div>
          )}
          <p className="muted small">
            Damage per round uses the best equipped attack for every swing, with 5% critical hits. It leaves out
            spells, Action Surge, Rage, Smite and fighting styles. Max HP uses the fixed average per level.
          </p>
        </div>
      )}
    </section>
  )
}

function BackRow({ onBack }: { onBack: () => void }) {
  return (
    <div className="row spread">
      <h2>Compare builds</h2>
      <button className="btn ghost small" onClick={onBack}>← Characters</button>
    </div>
  )
}

function SidePicker({ letter, side, base, result, characters, snapshots, onChange }: {
  letter: string
  side: Side
  base?: Character
  result?: Character
  characters: Character[]
  snapshots: Snapshot[]
  onChange: (s: Side) => void
}) {
  const id = `compare-${letter}`
  const atCap = base ? totalLevel(base) >= 20 : true
  const setAsi = (i: number, v: string) => {
    const asi = [...(side.tweak.asi ?? [])]
    asi[i] = (v || undefined) as Ability | undefined
    onChange({ ...side, tweak: { ...side.tweak, asi } })
  }
  return (
    <div className="panel compare-side">
      <h3><span className="compare-letter">{letter}</span> {result?.name ?? 'Pick a build'}</h3>
      <div className="field">
        <label htmlFor={`${id}-source`}>Start from</label>
        <select
          id={`${id}-source`}
          value={side.source}
          onChange={e => onChange({ ...side, source: e.target.value })}
        >
          <optgroup label="Characters">
            {characters.map(c => <option key={c.id} value={`char:${c.id}`}>{c.name} · {classLine(c)}</option>)}
          </optgroup>
          {characters.map(c => {
            const snaps = snapshots.filter(s => s.characterId === c.id)
            return snaps.length > 0 && (
              <optgroup key={c.id} label={`${c.name} snapshots`}>
                {snaps.map(s => <option key={s.id} value={`snap:${s.id}`}>{s.label} · {classLine(s.character)}</option>)}
              </optgroup>
            )
          })}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-level`}>Level up</label>
        <select
          id={`${id}-level`}
          value={side.tweak.levelClassId ?? ''}
          disabled={atCap}
          onChange={e => onChange({ ...side, tweak: { ...side.tweak, levelClassId: e.target.value || undefined } })}
        >
          <option value="">{atCap ? 'Already level 20' : 'No extra level'}</option>
          {CLASSES.map(cl => {
            const has = base?.classes.find(x => x.classId === cl.id)
            return (
              <option key={cl.id} value={cl.id}>
                {has ? `${cl.name} ${has.level} → ${has.level + 1}` : `${cl.name} 1 (multiclass)`}
              </option>
            )
          })}
        </select>
      </div>
      <fieldset className="field compare-asi">
        <legend>Ability score increase</legend>
        <div className="row">
          {[0, 1].map(i => (
            <select
              key={i}
              aria-label={`Ability increase ${i + 1} for ${letter}`}
              value={side.tweak.asi?.[i] ?? ''}
              onChange={e => setAsi(i, e.target.value)}
            >
              <option value="">+1 to…</option>
              {ABILITIES.map(x => <option key={x} value={x}>+1 {ABILITY_NAMES[x]}</option>)}
            </select>
          ))}
        </div>
      </fieldset>
      {result && <p className="muted small">{classLine(result)} · level {totalLevel(result)}</p>}
    </div>
  )
}

function Row({ row }: { row: CompareRow }) {
  const cls = (side: 'a' | 'b') => (row.better === side ? 'compare-win' : '')
  return (
    <tr>
      <th scope="row">{row.label}</th>
      <td className={cls('a')}>{row.a}{row.detailA && <span className="muted small">{row.detailA}</span>}</td>
      <td className={cls('b')}>{row.b}{row.detailB && <span className="muted small">{row.detailB}</span>}</td>
      <td className={`num ${row.better === 'b' ? 'good' : row.better === 'a' ? 'bad' : 'muted'}`}>
        {row.delta !== null ? (row.delta === 0 ? '=' : formatMod(row.delta))
          : row.a === row.b ? '' : row.better === 'b' ? 'B only' : row.better === 'a' ? 'A only' : 'differs'}
      </td>
    </tr>
  )
}

function FeatureList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4>{title}</h4>
      {items.length ? <ul className="plain small">{items.map(f => <li key={f}>{f}</li>)}</ul> : <p className="muted small">Nothing extra</p>}
    </div>
  )
}
