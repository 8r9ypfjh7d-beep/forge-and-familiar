import { useMemo } from 'react'
import { useI18n } from '../i18n'
import type { Character } from '../model/character'
import {
  ABILITIES, classById, createCharacter, derive, formatMod, getSpellcastingByClass, raceById, type CharacterDraft,
} from '../rules'

/**
 * Live preview of derived stats while building. Unassigned scores count as 10.
 * When editing, `preview` is the edited character, so AC and attacks use its real gear.
 */
export function Summary({ draft, preview }: { draft: CharacterDraft; preview?: Character }) {
  const race = raceById(draft.raceId, draft.rulesEdition)
  const cls = classById(draft.classes[0]?.classId ?? '', draft.rulesEdition)
  const d = useMemo(() => {
    if (preview) return derive(preview)
    if (!race || !cls) return null
    const base = { ...draft.baseAbilities }
    for (const a of ABILITIES) if (!base[a]) base[a] = 10
    return derive(createCharacter({ ...draft, baseAbilities: base }))
  }, [draft, race, cls, preview])
  const scoresSet = ABILITIES.every(a => draft.baseAbilities[a] > 0)
  // Prerequisite warnings are noise until scores are assigned.
  const warnings = d?.warnings.filter(w => scoresSet || !w.startsWith('Multiclass prerequisite')) ?? []
  // d.abilities are final scores, so pass them with no race to avoid adding racial bonuses twice.
  const casters = d ? getSpellcastingByClass({ ...draft, baseAbilities: d.abilities, freeAbilityBonuses: [], raceId: '', improvements: [] }) : []
  const { t, term, raceName, abilityShort, attackName, classLine } = useI18n()

  return (
    <aside className="glass summary" aria-label={t('summary.label')}>
      {draft.portrait && <img className="summary-portrait" src={draft.portrait} alt="" />}
      <h3>{draft.name || t('summary.unnamed')}</h3>
      <p className="muted small">
        {[race && raceName(race.id, draft.subraceId, draft.rulesEdition), cls && classLine(draft.classes)]
          .filter(Boolean).join(' · ') || t('summary.choose')}
      </p>
      {d && (
        <>
          <div className="stat-row">
            <Stat label={t('stat.ac')} value={d.armorClass.value} title={d.armorClass.source} />
            <Stat label={t('stat.hp')} value={d.maxHp} />
            <Stat label={t('stat.init')} value={formatMod(d.initiative)} />
            <Stat label={t('stat.speed')} value={`${d.speed}`} />
            <Stat label={t('stat.prof')} value={formatMod(d.proficiencyBonus)} />
            <Stat label={t('stat.passivePerception')} value={d.passivePerception} />
          </div>
          <div className="ability-mini">
            {ABILITIES.map(a => (
              <div key={a} className={d.saves[a].proficient ? 'save-prof' : ''} title={d.saves[a].proficient ? t('summary.saveProf') : undefined}>
                <span className="muted small">{abilityShort(a)}</span>
                <strong>{d.abilities[a]}</strong>
                <span className="small">{formatMod(d.mods[a])}</span>
              </div>
            ))}
          </div>
          {d.attacks.length > 0 && (
            <>
              <h4>{t('summary.attacks')}</h4>
              <ul className="plain small">
                {d.attacks.map(a => (
                  <li key={a.name}><strong>{attackName(a.name)}</strong> {t('summary.attack', { bonus: formatMod(a.bonus), damage: a.damage, type: term('damage', a.damageType, a.damageType) })}</li>
                ))}
              </ul>
            </>
          )}
          {d.spellcasting && (
            <p className="small">
              <strong>{t('summary.spells')}</strong>{' '}
              {casters.length > 1
                ? casters.map(s => t('summary.multiCaster', { className: term('class', s.className.toLowerCase(), s.className), dc: s.saveDc, bonus: formatMod(s.attackBonus) })).join(', ')
                : t('summary.spellLine', { dc: d.spellcasting.saveDc, bonus: formatMod(d.spellcasting.attackBonus) })}
              {d.spellSlots.slots.some(Boolean) && <> · {t('summary.slots', { slots: d.spellSlots.slots.filter(Boolean).join('/') })}</>}
              {d.spellSlots.pact && <> · {t('summary.pact', { count: d.spellSlots.pact.count, level: d.spellSlots.pact.level })}</>}
            </p>
          )}
          {d.resources.length > 0 && (
            <p className="small"><strong>{t('summary.resources')}</strong> {d.resources.map(r => t('summary.resource', { label: term('resource', r.id, r.label), max: r.max, recharge: t(`rest.${r.recharge}`) })).join(', ')}</p>
          )}
          {d.languages.length > 0 && <p className="small"><strong>{t('summary.languages')}</strong> {d.languages.map(l => term('language', l, l)).join(', ')}</p>}
          {d.tools.length > 0 && <p className="small"><strong>{t('summary.tools')}</strong> {d.tools.map(x => term('tool', x, x)).join(', ')}</p>}
          {d.feats.length > 0 && <p className="small"><strong>{t('summary.feats')}</strong> {d.feats.join(', ')}</p>}
          <p className="small muted">{t('summary.carrying', { weight: d.carriedWeight, capacity: d.carryingCapacity })}</p>
          {warnings.map(w => <p key={w} className="small bad">{w}</p>)}
        </>
      )}
    </aside>
  )
}

function Stat({ label, value, title }: { label: string; value: string | number; title?: string }) {
  return (
    <div className="stat" title={title}>
      <strong>{value}</strong>
      <span className="muted small">{label}</span>
    </div>
  )
}
