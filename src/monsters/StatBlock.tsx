// A monster stat block with roll buttons: ability checks, saves, skills, attacks and damage go through
// src/dice under the creature's name. Shared by the DM screen's Monsters tab and the NPC sheet.
import { useState, type ReactNode } from 'react'
import { monsterSourceNote, type MonsterAction } from '../content'
import { rollD20 } from '../dice'
import { RollView, useDice } from '../dice/ui'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/locales/en'
import { formatMod, type Ability } from '../rules'
import { legendaryCount, legendaryResistance, monsterMod, type Block } from './block'
import { crLabel, sensesText, speedText, typeLine, usageText } from './format'
import './monsters.css'

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export interface StatBlockProps {
  m: Block
  /** Shown instead of the block's name (an NPC's own name); the block's name then goes in the type line. */
  title?: string
  /** Buttons in the heading row (Add to fight, Edit). */
  actions?: ReactNode
  /** Rolls are labelled "<name>: <what>"; defaults to the title or the block's name. */
  rollAs?: string
  /** Between the core lines and the abilities (an NPC's HP block). */
  children?: ReactNode
  /** Hides the HP line (the host shows live HP instead). */
  hideHp?: boolean
  /** Uses spent per action name, drawn as pips next to the action; tapping a pip spends or returns one. */
  uses?: Record<string, number>
  onUse?: (action: MonsterAction, spent: number) => void
  /** An older-edition book monster shown to a newer-edition campaign (loadMonsters marks it). */
  legacy?: boolean
}

export function StatBlock({ m, title, actions, rollAs, children, hideHp, uses, onUse, legacy }: StatBlockProps) {
  const { t, abilityShort, locale, monsterName } = useI18n()
  const he = locale === 'he'
  const shown = title ?? monsterName(m)
  const lore = he && m.descriptionHe ? m.descriptionHe : m.description
  const note = monsterSourceNote(m)
  const { record, roll } = useDice()
  const [last, setLast] = useState<ReturnType<typeof record> | null>(null)
  const who = rollAs ?? title ?? m.name
  const say = (r: ReturnType<typeof record>) => setLast(r)
  const d20 = (bonus: number, label: string, type: 'check' | 'save' | 'attack') => say(record(rollD20(bonus, { label: `${who}: ${label}` }, type), { quiet: true }))
  const dmg = (dice: string, label: string) => {
    try { say(roll(dice, { label: `${who}: ${label}` })) } catch { /* not dice notation */ }
  }
  const list = (k: MessageKey, items: string[]) => items.length ? <p><b>{t(k)}</b> {items.join(', ')}</p> : null
  const saves = Object.entries(m.savingThrows) as [Ability, number][]
  const skills = Object.entries(m.skills)
  const legendary = legendaryCount(m)
  const resistance = legendaryResistance(m)
  const sc = m.spellcasting
  const actionProps = { onD20: d20, onDmg: dmg, uses, onUse }

  return (
    <section className="card mon-statblock" aria-labelledby="mon-sb-name" lang="en" dir="ltr">
      <div className="card-head">
        <div>
          <h3 id="mon-sb-name">{shown}{shown !== m.name && <small className="mon-sb-en" lang="en" dir="ltr"> {m.name}</small>}</h3>
          <p className="hint">{title ? `${m.name} · ` : ''}{typeLine(m)}{legacy ? ` · ${t('dm.legacy')}` : ''}</p>
        </div>
        {actions}
      </div>
      <dl className="mon-sb-core">
        <div><dt>{t('stat.ac')}</dt><dd>{m.armorClass.map(a => `${a.value}${a.type ? ` (${a.type})` : ''}`).join(', ')}</dd></div>
        {!hideHp && <div><dt>{t('stat.hp')}</dt><dd>{m.hitPoints} <button className="chip-roll" onClick={() => dmg(m.hitPointsRoll, t('stat.hp'))}>{m.hitPointsRoll}</button></dd></div>}
        <div><dt>{t('stat.speed')}</dt><dd>{speedText(m.speed)}</dd></div>
        <div><dt>{t('dm.crLabel')}</dt><dd>{crLabel(m.challengeRating)} ({m.xp.toLocaleString()} XP) · {t('stat.prof')} {formatMod(m.proficiencyBonus)}</dd></div>
      </dl>
      {children}
      <div className="mon-sb-abilities" role="group" aria-label={t('dm.abilityChecks')}>
        {ABILITIES.map(a => {
          const mod = monsterMod(m.abilities[a])
          return (
            <button key={a} onClick={() => d20(mod, abilityShort(a), 'check')}>
              <span>{abilityShort(a)}</span><b>{m.abilities[a]}</b><small>{formatMod(mod)}</small>
            </button>
          )
        })}
      </div>
      <div className="mon-sb-lines">
        {saves.length > 0 && (
          <p><b>{t('dm.saves')}</b> {saves.map(([a, v]) => (
            <button key={a} className="chip-roll" onClick={() => d20(v, `${abilityShort(a)} save`, 'save')}>{abilityShort(a)} {formatMod(v)}</button>
          ))}</p>
        )}
        {skills.length > 0 && (
          <p><b>{t('dm.skills')}</b> {skills.map(([s, v]) => (
            <button key={s} className="chip-roll" onClick={() => d20(v, s, 'check')}>{s} {formatMod(v)}</button>
          ))}</p>
        )}
        {list('dm.vulnerable', m.damageVulnerabilities)}
        {list('dm.resist', m.damageResistances)}
        {list('dm.immune', m.damageImmunities)}
        {list('dm.condImmune', m.conditionImmunities)}
        {list('dm.senses', sensesText(m))}
        {m.languages && <p><b>{t('dm.languages')}</b> {m.languages}</p>}
        {resistance > 0 && <p><b>{t('dm.legendaryResistance')}</b> {resistance}/Day</p>}
        {list('dm.gear', m.gear ?? [])}
        {list('dm.habitat', m.habitat ?? [])}
        {list('dm.treasure', m.treasure ?? [])}
        {lore && <p className="mon-sb-lore">{lore}</p>}
      </div>
      {last && <div className="mon-roll" aria-live="polite"><RollView roll={last} compact /></div>}
      <Actions title={t('dm.traits')} list={m.traits} {...actionProps} />
      {sc && (
        <>
          <h2 className="sub-title">{t('dm.spellcasting')}</h2>
          <p className="mon-spellcasting">
            <b>{abilityShort(sc.ability)}</b>
            {sc.saveDc != null && <> · {t('dm.spellDc', { dc: sc.saveDc })}</>}
            {sc.attackBonus != null && <> · {t('dm.spellAttack', { bonus: formatMod(sc.attackBonus) })}</>}
            {sc.attackBonus != null && <button className="chip-roll" onClick={() => d20(sc.attackBonus!, t('dm.spellcasting'), 'attack')}>{formatMod(sc.attackBonus)}</button>}
          </p>
          <ul className="plain mon-spells">
            {sc.groups.map(g => <li key={g.label}><b>{g.label}:</b> {g.spells.join(', ')}</li>)}
          </ul>
          {sc.note && <p className="hint">{sc.note}</p>}
        </>
      )}
      <Actions title={t('dm.actions')} list={m.actions} {...actionProps} />
      <Actions title={t('dm.bonusActions')} list={m.bonusActions} {...actionProps} />
      <Actions title={t('dm.reactions')} list={m.reactions} {...actionProps} />
      <Actions title={t('dm.legendary')} note={legendary ? t('dm.legendaryPerRound', { count: legendary }) : undefined} list={m.legendaryActions} {...actionProps} />
      <Actions title={t('dm.lairActions')} list={m.lairActions ?? []} {...actionProps} />
      {m.regionalEffects && <><h2 className="sub-title">{t('dm.regionalEffects')}</h2><p>{m.regionalEffects}</p></>}
      <p className="hint mon-sb-source"><b>{note.title}</b>{note.note ? ` · ${note.note}` : ''}</p>
    </section>
  )
}

function Actions({ title, note, list, onD20, onDmg, uses, onUse }: {
  title: string
  note?: string
  list: MonsterAction[]
  onD20: (bonus: number, label: string, type: 'attack') => void
  onDmg: (dice: string, label: string) => void
  uses?: Record<string, number>
  onUse?: (action: MonsterAction, spent: number) => void
}) {
  const { t, locale } = useI18n()
  if (!list.length) return null
  return (
    <>
      <h2 className="sub-title">{title}{note ? <small> · {note}</small> : null}</h2>
      <ul className="plain mon-actions">
        {list.map((a, i) => (
          <li key={i}>
            <p><b>{a.name}{usageText(a)}.</b> {locale === 'he' && a.descriptionHe ? a.descriptionHe : a.description}</p>
            {onUse && a.usage && <UsePips action={a} spent={uses?.[a.name] ?? 0} onUse={onUse} />}
            {(a.attackBonus != null || a.damage.length > 0 || a.damageChoice?.length) && (
              <div className="mon-action-rolls">
                {a.attackBonus != null && (
                  <button className="btn small" onClick={() => onD20(a.attackBonus!, a.name, 'attack')}>{t('dm.toHit', { bonus: formatMod(a.attackBonus) })}</button>
                )}
                {[...a.damage, ...(a.damageChoice ?? [])].map((d, j) => (
                  <button key={j} className="btn small" onClick={() => onDmg(d.dice, `${a.name} (${d.type})`)}>{d.dice} {d.type}</button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

/** Pips for a limited action: filled = still available. Tap the next empty pip to return a use. */
function UsePips({ action, spent, onUse }: { action: MonsterAction; spent: number; onUse: (a: MonsterAction, spent: number) => void }) {
  const total = action.usage?.type === 'per day' ? action.usage.times : 1
  return (
    <div className="mon-pips" role="group" aria-label={action.name}>
      {Array.from({ length: total }, (_, i) => {
        const used = i < spent
        return (
          <button key={i} type="button" className={`mon-pip${used ? ' used' : ''}`} aria-pressed={used}
            onClick={() => onUse(action, used ? i : i + 1)} aria-label={`${action.name} ${i + 1}/${total}`} />
        )
      })}
    </div>
  )
}
