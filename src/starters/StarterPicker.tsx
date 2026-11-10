import { fmtMod } from '../i18n/signed'
import { useMemo, useState } from 'react'
import type { Character } from '../model/character'
import { useI18n } from '../i18n'
import { derive } from '../rules'
import { STARTER_HEROES, createStarter, starterText, type StarterHero } from './heroes'
import { withStarterSpells } from './spells'
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
  const { t, locale } = useI18n()
  return (
    <section className="starters">
      <header className="starters-head">
        <div>
          <h2 className="glass-title">{t('starters.title')}</h2>
          <p className="muted">{t('starters.lead')}</p>
        </div>
        <div className="starters-nav">
          <button className="glass-btn" onClick={onCancel}>{t('common.cancel')}</button>
          <button className="glass-btn" onClick={onCustom}>{t('starters.custom')}</button>
        </div>
      </header>
      <div className="starter-grid">
        {STARTER_HEROES.map(h => (
          <HeroCard
            key={h.id}
            hero={h}
            expanded={open === h.id}
            onToggle={() => setOpen(open === h.id ? null : h.id)}
            onPick={() => { void withStarterSpells(createStarter(h, ownerId, playerName, new Date(), locale)).then(onCreate) }}
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
  const { t, term, attackName, className, raceName, locale } = useI18n()
  const text = starterText(hero, locale)
  const own = text.pitch !== hero.pitch
  const d = useMemo(() => derive(createStarter(hero, '', '')), [hero])
  const attack = d.attacks[0]
  const stats: [string, string | number][] = [
    [t('stat.ac'), d.armorClass.value],
    [t('stat.hp'), d.maxHp],
    [t('stat.init'), fmtMod(d.initiative)],
    [t('stat.speed'), d.speed],
  ]

  // Hero names stay English; pitch, story and tips come in the reader's language when it has them.
  return (
    <article className="glass starter-card">
      <div className="starter-head">
        <div className="portrait-empty starter-initial" aria-hidden="true">{hero.draft.name.slice(0, 1)}</div>
        <div>
          <h3 lang="en" dir="auto">{hero.draft.name}</h3>
          <p className="muted small">{raceName(hero.draft.raceId, hero.draft.subraceId)} {className(hero.draft.classes[0].classId)}</p>
        </div>
      </div>
      <div className="starter-tags">
        <span className="glass-chip on">{t(`starters.role.${hero.role}`)}</span>
        <span className="glass-chip">{t(`starters.difficulty.${hero.difficulty}`)}</span>
      </div>
      <p lang={own ? undefined : 'en'} dir="auto">{text.pitch}</p>
      <dl className="starter-stats">
        {stats.map(([label, value]) => (
          <div key={label}><dd dir="ltr">{value}</dd><dt className="muted">{label}</dt></div>
        ))}
      </dl>
      {attack && (
        <p className="small">
          <strong>{attackName(attack.name)}</strong> {t('starters.attack', { bonus: ltr(fmtMod(attack.bonus)), damage: ltr(attack.damage), type: term('damage', attack.damageType, attack.damageType) })}
        </p>
      )}
      {expanded && (
        <div className="small starter-more">
          <p className="muted" lang={own ? undefined : 'en'} dir="auto">{text.backstory}</p>
          <strong>{t('starters.more')}</strong>
          <ul lang={own ? undefined : 'en'} dir="auto">{text.tips.map(tip => <li key={tip}>{tip}</li>)}</ul>
          {text.spells && (
            <>
              <strong>{t('starters.spells')}</strong>
              <ul lang={own ? undefined : 'en'} dir="auto">{text.spells.map(sp => <li key={sp}>{sp}</li>)}</ul>
            </>
          )}
        </div>
      )}
      <div className="starter-actions">
        <button className="glass-btn small" onClick={onToggle} aria-expanded={expanded}>{expanded ? t('starters.less') : t('starters.more')}</button>
        <button className="glass-btn prominent small" onClick={onPick}>{t('starters.play', { name: ltr(hero.draft.name.split(' ')[0]) })}</button>
      </div>
    </article>
  )
}

/** Isolates a number or dice string so "+5" and "1d8+3" keep their order inside Hebrew text. */
const ltr = (s: string) => `\u2066${s}\u2069`
