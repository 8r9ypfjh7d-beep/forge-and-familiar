// Feat picker shared by Ability Score Improvements and the 2024 Human's Origin feat: every feat of the rules
// edition grouped by kind, plus "Make your own". Below it, what the feat does, its book and its prerequisites;
// unmet prerequisites warn but never block (tables bend them all the time).
import { useI18n } from '../i18n'
import {
  CUSTOM_FEAT, allRaces, featById, featPrereqs, rulesEdition, unmetFeatPrereqs,
  type CharacterDraft, type Feat, type FeatCategory, type FeatPrereq,
} from '../rules'
import { featExplainKey } from './why'

type Group = FeatCategory | 'homebrew'
const GROUPS: Group[] = ['origin', 'general', 'fighting-style', 'epic-boon', 'racial', 'homebrew']
const groupOf = (f: Feat): Group => (f.id.startsWith('hb:') ? 'homebrew' : f.category ?? 'general')

/** `level`: the character level of the slot; feats that need more are marked "(level 19+)". */
export function FeatSelect({ feats, value, onChange, id, label, level }: { feats: Feat[]; value: string; onChange: (id: string) => void; id?: string; label?: string; level?: number }) {
  const { t, term } = useI18n()
  const name = (f: Feat) => term('feat', f.id, f.name)
  return (
    <select id={id} aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{t('builder.asi.pickFeat')}</option>
      {GROUPS.map(g => {
        const list = feats.filter(f => groupOf(f) === g).sort((a, b) => name(a).localeCompare(name(b)))
        return list.length > 0 && (
          <optgroup key={g} label={t(`feats.group.${g}`)}>
            {list.map(f => <option key={f.id} value={f.id}>{level !== undefined && (f.minLevel ?? 0) > level ? t('builder.asi.featLevel', { feat: name(f), level: f.minLevel! }) : name(f)}</option>)}
          </optgroup>
        )
      })}
      <optgroup label={t('feats.group.custom')}>
        <option value={CUSTOM_FEAT}>{t('feats.custom.option')}</option>
      </optgroup>
    </select>
  )
}

/** English name of a race or subrace id from either edition ("half-elf" → "Half-Elf"); unknown ids are title-cased. */
function raceName(id: string): string {
  for (const r of [...allRaces('2014'), ...allRaces('2024')]) {
    if (r.id === id) return r.name
    const sub = r.subraces?.find(s => s.id === id)
    if (sub) return sub.name
  }
  return id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

/** One prerequisite in the reader's language. */
function usePrereqText() {
  const { t, term, ability } = useI18n()
  return (p: FeatPrereq): string => {
    switch (p.kind) {
      case 'level': return t('feats.req.level', { level: p.level })
      case 'ability': {
        const entries = Object.entries(p.abilities)
        return t('feats.req.ability', { abilities: entries.map(([a]) => ability(a as never)).join(t('feats.req.or')), score: entries[0]?.[1] ?? 13 })
      }
      case 'race': return t('feats.req.race', { races: p.races.map(r => term('race', r, raceName(r))).join(t('feats.req.or')) })
      case 'spellcasting': return t('feats.req.spellcasting')
      case 'armor': return t('feats.req.armor', { armor: t(`builder.cs.armor.${p.armor}`) })
      case 'feat': return t('feats.req.feat', { feats: p.feats.map(f => term('feat', f, featById(f)?.name ?? featById(f, '2024')?.name ?? f)).join(t('feats.req.or')) })
      case 'feature': return t('feats.req.feature', { feature: term('feature', p.feature, p.feature) })
    }
  }
}

/** What a picked feat does, where it is from, and any prerequisite the character misses. */
export function FeatDetails({ feat, draft, level }: { feat: Feat; draft: CharacterDraft; level: number }) {
  const { t } = useI18n()
  const prereqText = usePrereqText()
  const key = featExplainKey(feat.id, rulesEdition(draft))
  const text = key ? t(key) : feat.description || t('why.homebrew')
  const prereqs = featPrereqs(feat)
  const unmet = unmetFeatPrereqs(draft, feat, level)
  const prereqLine = prereqs.length ? prereqs.map(prereqText).join(', ') : feat.prerequisite
  return (
    <div className="feat-details small">
      <p className="muted asi-feat" dir="auto">
        {prereqLine && <>{t('builder.asi.prereq', { prereq: prereqLine })} </>}
        {text}
      </p>
      {feat.source && <p className="muted">{t('feats.source', { source: feat.source })}</p>}
      {unmet.length > 0 && <p className="feat-warning" role="note">⚠ {t('feats.unmet', { list: unmet.map(prereqText).join(', ') })}</p>}
    </div>
  )
}
