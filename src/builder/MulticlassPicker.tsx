import { useState } from 'react'
import {
  ABILITIES, MAX_CHARACTER_LEVEL, MULTICLASS_PROFICIENCIES, MULTICLASS_PROFICIENCIES_2024, addClassIssues, classById, classesFor,
  getCasterLevel, prereqLabel, rulesEdition, type CharacterDraft, type RulesEdition,
} from '../rules'
import type { StepProps } from './steps'

const scoresAssigned = (d: CharacterDraft) => ABILITIES.every(a => d.baseAbilities[a] > 0)

const grantText = (classId: string, edition: RulesEdition) => {
  const g = (edition === '2024' ? MULTICLASS_PROFICIENCIES_2024 : MULTICLASS_PROFICIENCIES)[classId]
  if (!g) return ''
  const parts = [...g.armor.map(a => (a === 'shield' ? 'shields' : `${a} armor`)), ...g.weapons.map(w => `${w} weapons`), ...(g.weaponIds ?? [])]
  if (g.skills) parts.push(`${g.skills} skill`)
  parts.push(...(g.other ?? []))
  return parts.length ? parts.join(', ') : 'no new proficiencies'
}

/** Optional extra classes after the first, with SRD prerequisites and caster-level math. */
export function MulticlassPicker({ draft, update }: StepProps) {
  const [open, setOpen] = useState(draft.classes.length > 1)
  const [first, ...extras] = draft.classes
  if (!first) return null
  const total = draft.classes.reduce((n, cl) => n + cl.level, 0)
  const edition = rulesEdition(draft)
  const known = scoresAssigned(draft)
  const caster = getCasterLevel(draft)
  const setExtras = (next: typeof extras) => update({ classes: [first, ...next] })

  if (!open) {
    return <button className="btn ghost multiclass-open" onClick={() => setOpen(true)}>+ Multiclass (optional)</button>
  }

  const candidates = classesFor(edition).filter(c => !draft.classes.some(cl => cl.classId === c.id))

  return (
    <section className="multiclass" aria-label="Multiclass">
      <h3>Multiclass</h3>
      <p className="muted small">
        Each class needs its ability minimums, and so does {classById(first.classId, edition)?.name} ({prereqLabel(first.classId)}).
        {!known && ' Scores come in the next step; the builder checks them there.'}
      </p>
      {extras.map((cl, i) => {
        const def = classById(cl.classId, edition)
        const others = total - cl.level
        return (
          <div key={cl.classId} className="multiclass-row">
            <strong>{def?.name}</strong>
            <select
              aria-label={`${def?.name} level`}
              value={cl.level}
              onChange={e => setExtras(extras.map((x, j) => (j === i ? { ...x, level: Number(e.target.value) } : x)))}
            >
              {Array.from({ length: Math.max(1, MAX_CHARACTER_LEVEL - others) }, (_, l) => l + 1).map(l => <option key={l} value={l}>Level {l}</option>)}
            </select>
            <span className="muted small">Gains {grantText(cl.classId, edition)}</span>
            <button className="btn ghost" onClick={() => setExtras(extras.filter((_, j) => j !== i))} aria-label={`Remove ${def?.name}`}>✕</button>
          </div>
        )
      })}
      {total < MAX_CHARACTER_LEVEL && (
        <div className="multiclass-add">
          {candidates.map(c => {
            const issues = known ? addClassIssues(draft, c.id) : []
            return (
              <button
                key={c.id}
                className="chip"
                disabled={issues.length > 0}
                title={issues.length ? issues.join(' ') : `Needs ${prereqLabel(c.id)}. Gains ${grantText(c.id, edition)}.`}
                onClick={() => setExtras([...extras, { classId: c.id, level: 1 }])}
              >
                + {c.name} <span className="muted small">{prereqLabel(c.id)}</span>
              </button>
            )
          })}
        </div>
      )}
      <p className="small">
        <strong>Total level:</strong> {total} / {MAX_CHARACTER_LEVEL}
        {caster.parts.length > 0 && <><br /><strong>Spell slots:</strong> {caster.explanation}</>}
      </p>
      <p className="muted small">Saving throws and starting gear come from {classById(first.classId, edition)?.name} only.</p>
    </section>
  )
}
