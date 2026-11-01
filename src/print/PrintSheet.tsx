import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { Spell } from '../content'
import { useI18n, type MessageKey } from '../i18n'
import type { Character } from '../model/character'
import { derive, formatMod } from '../rules'
import { Markdown } from '../rulesqa/Markdown'
import { useFeatureTexts, type DescribedLine } from '../sheet/combat/featureTexts'
import { EMPTY, useLibrary } from '../sheet/combat/library'
import { spellAttackRows } from '../sheet/combat/combat'
import { getCharacter, onCharactersChanged } from '../storage'
import { buildPrintSheet, type Pips, type PrintSheet as Sheet, type SlotRow } from './sheetData'
import { hasSpellPage, printSpells, type PrintSpellRow, type PrintSpells } from './spells'
import './print.css'

type T = ReturnType<typeof useI18n>

/** Paper-style character sheet. The browser's print dialog saves it as a PDF. */
export function PrintSheet({ characterId, onBack }: { characterId: string; onBack: () => void }) {
  const { t } = useI18n()
  const [character, setCharacter] = useState<Character | null | undefined>(undefined)
  const [withPlayState, setWithPlayState] = useState(false)
  const [withRules, setWithRules] = useState(true)

  useEffect(() => {
    const load = () => getCharacter(characterId).then(c => setCharacter(c ?? null))
    load()
    return onCharactersChanged(id => { if (!id || id === characterId) load() })
  }, [characterId])

  const name = character?.name
  useEffect(() => {
    if (name === undefined) return
    const title = document.title
    // Browsers use the page title as the default PDF file name.
    document.title = t('print.docTitle', { name })
    return () => { document.title = title }
  }, [name, t])

  if (character === undefined) return <p className="muted">{t('print.loading')}</p>
  if (character === null) {
    return (
      <section className="panel">
        <p>{t('print.notFound')}</p>
        <button type="button" className="btn" onClick={onBack}>{t('print.back')}</button>
      </section>
    )
  }

  return (
    <div className="ff-print-view">
      <div className="print-toolbar glass">
        <button type="button" className="glass-btn" onClick={onBack}>{t('common.backArrow')} {t('print.back')}</button>
        <label className="print-opt">
          <input type="checkbox" checked={withPlayState} onChange={e => setWithPlayState(e.target.checked)} />
          {t('print.fillPlay')}
        </label>
        <label className="print-opt">
          <input type="checkbox" checked={withRules} onChange={e => setWithRules(e.target.checked)} />
          {t('print.withRules')}
        </label>
        <button type="button" className="glass-btn prominent" onClick={() => window.print()}>{t('print.button')}</button>
        <p className="hint">{t('print.hint')}</p>
      </div>
      <PrintPages character={character} withPlayState={withPlayState} withRules={withRules} />
    </div>
  )
}

/**
 * The paper pages alone: the core sheet, gear and notes, spells (casters), and optionally the rules text.
 * Also used by the read-only share view, for a character that is not in storage.
 */
export function PrintPages({ character, withPlayState, withRules = false }: { character: Character; withPlayState: boolean; withRules?: boolean }) {
  const i = useI18n()
  const lib = useLibrary(character)
  const d = derive(character)
  const s = buildPrintSheet(character, { withPlayState }, d)
  const spells = printSpells(character, lib, d)
  const texts = useFeatureTexts(character, lib, d)
  const loading = lib === EMPTY

  const spellRows = spellAttackRows(character, d, lib.spells)
  return (
    <div className="ff-print" lang={i.locale} dir={i.dir}>
      {loading && <p className="hint print-loading">{i.t('print.libLoading')}</p>}
      <PageOne s={s} i={i} texts={texts} spellRows={spellRows} />
      <PageGear s={s} i={i} />
      {hasSpellPage(spells, s.spellSlots.length) && <PageSpells s={s} i={i} spells={spells} />}
      {withRules && <PageRules s={s} i={i} texts={texts} spells={spells.all} attribution={texts.attribution} />}
    </div>
  )
}

function Head({ s, i, small }: { s: Sheet; i: T; small?: boolean }) {
  if (small) {
    return (
      <header className="p-head small">
        <div className="p-name"><h1><bdi>{s.name}</bdi></h1></div>
        <p className="p-sub"><bdi>{i.classLine(s.classes)}</bdi> · <bdi>{i.raceName(s.raceId, s.subraceId, s.edition)}</bdi></p>
      </header>
    )
  }
  return (
    <header className="p-head">
      {s.portrait && <img className="p-portrait" src={s.portrait} alt="" />}
      <div className="p-name">
        <h1><bdi>{s.name}</bdi></h1>
        <span className="p-label">{i.t('print.characterName')}</span>
      </div>
      <dl className="p-facts">
        <Fact label={i.t('print.classLevel')} value={i.classLine(s.classes)} />
        <Fact label={i.t(s.edition === '2024' ? 'print.species' : 'print.race')} value={i.raceName(s.raceId, s.subraceId, s.edition)} />
        <Fact label={i.t('print.background')} value={i.term('background', s.background.id, s.background.name)} />
        <Fact label={i.t('print.alignment')} value={s.alignment ? i.term('alignment', s.alignment, s.alignment) : ''} />
        <Fact label={i.t('print.player')} value={s.playerName} />
        <Fact label={i.t('print.xp')} value={String(s.xp)} />
      </dl>
    </header>
  )
}

function Foot({ s, i }: { s: Sheet; i: T }) {
  return <footer className="p-foot"><bdi>{s.name}</bdi><span>{i.t('print.footer')}</span></footer>
}

function PageOne({ s, i, texts, spellRows }: { s: Sheet; i: T; texts: ReturnType<typeof useFeatureTexts>; spellRows: ReturnType<typeof spellAttackRows> }) {
  const { t } = i
  const defenses = [
    s.resistances.length ? t('print.resistant', { list: s.resistances.map(x => i.term('damage', x, x)).join(', ') }) : '',
    s.immunities.length ? t('print.immune', { list: s.immunities.map(x => i.term('damage', x, x)).join(', ') }) : '',
    s.conditionImmunities.length ? t('print.conditionImmune', { list: s.conditionImmunities.map(x => i.term('condition', x, cap(x))).join(', ') }) : '',
  ].filter(Boolean)
  return (
    <article className="paper">
      <Head s={s} i={i} />
      <div className="p-grid">
        <div className="p-col p-col-abilities">
          <div className="p-abilities">
            {s.abilities.map(a => (
              <div key={a.id} className="p-ability">
                <span className="p-label">{i.ability(a.id)}</span>
                <strong dir="ltr">{a.mod}</strong>
                <span className="p-score">{a.score}</span>
              </div>
            ))}
          </div>
          <div className="p-stack">
            <Stat label={t('print.profBonus')} value={s.proficiencyBonus} inline />
            <Stat label={t('print.passivePerception')} value={String(s.passivePerception)} inline />
            <Box title={t('print.saves')}>
              <ul className="p-checks">
                {s.saves.map(x => <Check key={x.id} on={x.proficient} bonus={x.bonus} name={i.ability(x.id)} />)}
              </ul>
            </Box>
            <Box title={t('print.skills')}>
              <ul className="p-checks">
                {s.skills.map(x => (
                  <Check key={x.id} on={x.proficient || x.expertise} double={x.expertise} bonus={x.bonus} name={i.skill(x.id)} extra={i.abilityShort(x.ability)}
                    label={x.expertise ? t('print.expertise') : undefined} />
                ))}
              </ul>
            </Box>
          </div>
        </div>

        <div className="p-col">
          <div className="p-trio">
            <Stat label={t('print.armorClass')} value={String(s.armorClass)} sub={i.locale === 'en' ? s.armorSource : undefined} />
            <Stat label={t('print.initiative')} value={s.initiative} />
            <Stat label={t('print.speed')} value={t('print.feet', { n: s.speed })} ltr={false} />
          </div>
          <Box title={t('print.hitPoints')}>
            <p className="p-max">{t('print.max')} <strong>{s.maxHp}</strong></p>
            <div className="p-write tall">{s.currentHp ?? ''}</div>
            <span className="p-label">{t('print.current')}</span>
            <div className="p-write">{s.tempHp ?? ''}</div>
            <span className="p-label">{t('print.temp')}</span>
          </Box>
          <div className="p-pair">
            <Box title={t('print.hitDice')}>
              {s.hitDice.map(h => (
                <p key={h.die} className="p-dice" dir="ltr"><strong>{h.total}{h.die}</strong>{h.total <= 10 && <Circles max={h.total} used={h.spent} />}</p>
              ))}
              <span className="p-label">{t('print.spent')}</span>
            </Box>
            <Box title={t('print.deathSaves')}>
              <p className="p-death">{t('print.successes')} <Circles max={3} used={s.deathSaves.successes} /></p>
              <p className="p-death">{t('print.failures')} <Circles max={3} used={s.deathSaves.failures} /></p>
            </Box>
          </div>
          <Box title={t('print.attacks')}>
            <table className="p-table">
              <thead><tr><th>{t('print.col.name')}</th><th>{t('print.col.hit')}</th><th>{t('print.col.damage')}</th></tr></thead>
              <tbody>
                {s.attacks.map(a => (
                  <tr key={a.name}>
                    <td>
                      <bdi>{i.attackName(a.name)}</bdi>
                      {(a.versatile || a.range) && (
                        <small>{[a.versatile && t('print.twoHanded', { damage: a.versatile }), a.range && t('print.rangeFt', { range: a.range })].filter(Boolean).join(' · ')}</small>
                      )}
                    </td>
                    <td><span dir="ltr">{a.bonus}</span></td>
                    <td><span dir="ltr">{a.damage}</span> {i.term('damage', a.damageType, a.damageType)}{a.extraDamage && <> + <bdi>{a.extraDamage}</bdi></>}</td>
                  </tr>
                ))}
                {spellRows.map(r => (
                  <tr key={`spell-${r.name}`}>
                    <td><bdi>{i.spellName(r.name)}</bdi>{r.range && <small>{i.spellMeasure(r.range)}</small>}</td>
                    <td>{r.kind === 'attack' ? <span dir="ltr">{formatMod(r.value)}</span> : r.kind === 'save' && r.save ? t('print.saveDcShort', { dc: r.value, ability: i.abilityShort(r.save) }) : t('print.autoHit')}</td>
                    <td>
                      {r.damage && <span dir="ltr">{r.beams ? t('print.beams', { n: r.beams, damage: r.damage }) : r.damage}</span>}
                      {r.damageType && <> {i.term('damage', r.damageType, r.damageType)}</>}
                    </td>
                  </tr>
                ))}
                {[0, 1].map(n => <tr key={`blank${n}`} className="blank"><td /><td /><td /></tr>)}
              </tbody>
            </table>
          </Box>
          <Box title={t('print.conditions')}>
            <div className="p-write">{s.conditions.map(c => i.term('condition', c, cap(c))).join(', ')}</div>
          </Box>
          {defenses.length > 0 && (
            <Box title={t('print.defenses')}>
              <List items={defenses} />
            </Box>
          )}
        </div>

        <div className="p-col">
          <Box title={t('print.features')}>
            <List items={texts.features.map(f => `${f.name} (${f.meta})`)} empty={t('print.none')} />
          </Box>
          <Box title={t('print.traits')}>
            <List items={texts.traits.map(f => f.name)} empty={t('print.none')} />
          </Box>
          {(texts.feats.length > 0 || texts.backgroundFeature) && (
            <Box title={t('print.feats')}>
              <List items={[...texts.feats.map(f => f.name), ...(texts.backgroundFeature ? [`${texts.backgroundFeature} (${t('print.bgFeature')})`] : [])]} />
            </Box>
          )}
          <Box title={t('print.languages')}>
            <p>{texts.languages.join(', ') || t('print.none')}</p>
          </Box>
          <Box title={t('print.tools')}>
            <p>{texts.tools.join(', ') || t('print.none')}</p>
          </Box>
        </div>
      </div>
      <Foot s={s} i={i} />
    </article>
  )
}

function PageGear({ s, i }: { s: Sheet; i: T }) {
  const { t } = i
  const rest = (r?: Pips['recharge']) => (r ? t(`rest.${r}` as MessageKey) : undefined)
  return (
    <article className="paper">
      <Head s={s} i={i} small />
      <div className="p-grid two">
        <div className="p-col">
          <Box title={t('print.equipment')}>
            <table className="p-table">
              <thead><tr><th>{t('print.col.item')}</th><th>{t('print.col.qty')}</th><th>{t('print.col.weight')}</th><th>{t('print.col.worn')}</th></tr></thead>
              <tbody>
                {s.equipment.map((e, n) => (
                  <tr key={n}><td><bdi>{i.item(e.itemId, e.name)}</bdi></td><td>{e.qty}</td><td>{e.weight || ''}</td><td>{e.equipped ? '✓' : ''}</td></tr>
                ))}
                {Array.from({ length: Math.max(4, 16 - s.equipment.length) }, (_, n) => <tr key={`blank${n}`} className="blank"><td /><td /><td /><td /></tr>)}
              </tbody>
            </table>
            <p className="p-muted">{t('print.carried', { weight: s.carriedWeight, capacity: s.carryingCapacity })}</p>
          </Box>
          <Box title={t('print.coins')}>
            <div className="p-trio">
              <Stat label={t('inv.coin.cp')} value={String(s.coins.cp)} />
              <Stat label={t('inv.coin.sp')} value={String(s.coins.sp)} />
              <Stat label={t('inv.coin.gp')} value={String(s.coins.gp)} />
            </div>
          </Box>
        </div>
        <div className="p-col">
          <Box title={t('print.resources')}>
            {s.resources.length > 0 ? (
              <table className="p-table">
                <thead><tr><th>{t('print.col.resource')}</th><th>{t('print.col.max')}</th><th>{t('print.col.used')}</th></tr></thead>
                <tbody>
                  {s.resources.map((r, n) => (
                    <tr key={n}>
                      <td><bdi>{r.id ? i.term('resource', r.id, r.label) : r.label}</bdi>{rest(r.recharge) && <small>{rest(r.recharge)}</small>}</td>
                      <td>{r.max}</td>
                      <td>{r.max <= 10 ? <Circles max={r.max} used={r.used} /> : r.used || ''}</td>
                    </tr>
                  ))}
                  {[0, 1].map(n => <tr key={`blank${n}`} className="blank"><td /><td /><td /></tr>)}
                </tbody>
              </table>
            ) : <div className="p-lines" style={{ '--lines': 3 } as CSSProperties} />}
          </Box>
          <Box title={t('print.notes')} grow>
            {s.notes && <p className="p-notes" dir="auto">{s.notes}</p>}
            <div className="p-lines" style={{ '--lines': s.notes ? 10 : 24 } as CSSProperties} />
          </Box>
        </div>
      </div>
      <Foot s={s} i={i} />
    </article>
  )
}

function PageSpells({ s, i, spells }: { s: Sheet; i: T; spells: PrintSpells }) {
  const { t } = i
  const ordinal = (level: number) => t(`sheet.slot.${level}` as MessageKey)
  return (
    <article className="paper p-flow">
      <Head s={s} i={i} small />
      <p className="p-legend">{t('print.legend')}</p>
      <div className="p-spell-top">
        {spells.classes.map(c => (
          <Box key={c.classId} title={`${t('print.spellcasting')} · ${i.className(c.classId)}`}>
            <div className="p-trio">
              <Stat label={t('print.spellAbility')} value={i.abilityShort(c.ability)} />
              <Stat label={t('print.saveDc')} value={String(c.saveDc)} />
              <Stat label={t('print.spellAttack')} value={formatMod(c.attack)} />
            </div>
            <p className="p-muted">
              {c.spellbook != null
                ? t('print.countBook', { cantrips: c.cantrips, book: c.spellbook, n: c.limit })
                : t(c.kind === 'known' ? 'print.countKnown' : 'print.countPrepared', { cantrips: c.cantrips, n: c.limit })}
            </p>
          </Box>
        ))}
        {s.spellSlots.length > 0 && (
          <Box title={t('print.slots')}>
            <table className="p-table">
              <thead><tr><th>{t('print.col.level')}</th><th>{t('print.col.max')}</th><th>{t('print.col.expended')}</th></tr></thead>
              <tbody>
                {s.spellSlots.map((r: SlotRow) => (
                  <tr key={`${r.pact ? 'p' : ''}${r.level}`}>
                    <td>{r.pact ? t('print.pact', { ordinal: ordinal(r.level) }) : ordinal(r.level)}{r.pact && <small>{t('print.pactNote')}</small>}</td>
                    <td>{r.max}</td>
                    <td><Circles max={r.max} used={r.used} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        )}
      </div>

      {spells.classes.map(c => (
        <Box key={c.classId} title={`${t('print.spells')} · ${i.className(c.classId)}`}>
          {c.rows.length ? <SpellTable rows={c.rows} i={i} /> : <p className="p-muted">{t('print.noSpells')}</p>}
        </Box>
      ))}
      {spells.feats.length > 0 && (
        <Box title={t('print.fromFeats')}>
          <SpellTable rows={spells.feats} i={i} />
        </Box>
      )}
      {spells.other.length > 0 && (
        <Box title={t('print.fromOther')}>
          <table className="p-table p-spells">
            <thead><tr><th>{t('print.col.spell')}</th><th>{t('print.col.source')}</th><th>{t('print.col.time')}</th><th>{t('print.col.range')}</th></tr></thead>
            <tbody>
              {spells.other.map((o, n) => (
                <tr key={n}>
                  <td><SpellLabel i={i} name={o.text} spell={o.spell} />{o.note && <small>{i.spellNote(o.note)}</small>}</td>
                  <td><bdi>{i.sourceName(o.source)}</bdi></td>
                  <td>{o.spell ? i.spellMeasure(o.spell.castingTime.split(',')[0]) : ''}</td>
                  <td>{o.spell ? i.spellMeasure(o.spell.range) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}
      <Foot s={s} i={i} />
    </article>
  )
}

function SpellLabel({ i, name, spell }: { i: T; name: string; spell?: Spell }) {
  const own = spell ? i.spellName(spell.id, spell.name) : i.spellName(name)
  const english = spell?.name ?? name
  return (
    <>
      <bdi className="p-spell-name">{own}</bdi>
      {spell?.concentration && <abbr className="p-tag" title={i.t('spells.concentration')}>{i.t('print.tagC')}</abbr>}
      {spell?.ritual && <abbr className="p-tag" title={i.t('spells.ritual')}>{i.t('print.tagR')}</abbr>}
      {i.locale !== 'en' && own !== english && <small lang="en" dir="ltr">{english}</small>}
    </>
  )
}

function SpellTable({ rows, i }: { rows: PrintSpellRow[]; i: T }) {
  const { t } = i
  const levels = [...new Set(rows.map(r => r.spell.level))]
  return (
    <table className="p-table p-spells">
      <thead>
        <tr>
          <th className="p-prep">{t('print.col.prep')}</th><th>{t('print.col.spell')}</th><th>{t('print.col.time')}</th>
          <th>{t('print.col.range')}</th><th>{t('print.col.duration')}</th><th>{t('print.col.comp')}</th>
        </tr>
      </thead>
      {levels.map(level => (
        <tbody key={level}>
          <tr className="p-level"><th colSpan={6}>{level === 0 ? t('spells.cantrips') : t('spells.level', { ordinal: t(`sheet.slot.${level}` as MessageKey) })}</th></tr>
          {rows.filter(r => r.spell.level === level).map(r => {
            const sp = r.spell
            const comps = [sp.components.v && 'V', sp.components.s && 'S', sp.components.m && 'M'].filter(Boolean).join(', ')
            return (
              <tr key={sp.id}>
                <td className="p-prep">{level > 0 && <span className={`p-dot${r.prepared ? ' on' : ''}`} />}</td>
                <td><SpellLabel i={i} name={sp.name} spell={sp} />{r.always && <small>{t('print.always')}</small>}</td>
                <td>{i.spellMeasure(sp.castingTime.split(',')[0])}</td>
                <td>{i.spellMeasure(sp.range)}</td>
                <td>{i.spellMeasure(sp.duration)}</td>
                <td dir="ltr">{comps}</td>
              </tr>
            )
          })}
        </tbody>
      ))}
      {/* Room to pencil in spells learned at the table. */}
      <tbody>{[0, 1, 2].map(n => <tr key={n} className="blank"><td /><td /><td /><td /><td /><td /></tr>)}</tbody>
    </table>
  )
}

function PageRules({ s, i, texts, spells, attribution }: { s: Sheet; i: T; texts: ReturnType<typeof useFeatureTexts>; spells: Spell[]; attribution?: string }) {
  const { t } = i
  const described = (title: string, lines: DescribedLine[]) =>
    lines.length > 0 && (
      <section className="p-rules-group">
        <h2>{title}</h2>
        {lines.map(l => (
          <div key={l.key} className="p-rule">
            <h3><bdi>{l.name}</bdi>{l.meta && <small>{l.meta}</small>}</h3>
            {l.text && <div className="p-rule-text" dir="auto"><Markdown text={l.text} /></div>}
          </div>
        ))}
      </section>
    )
  return (
    <article className="paper p-flow">
      <Head s={s} i={i} small />
      <h2 className="p-rules-title">{t('print.rules')}</h2>
      <div className="p-rules">
        {described(t('print.features'), texts.features)}
        {described(t('print.traits'), texts.traits)}
        {described(t('print.feats'), texts.feats)}
        {spells.length > 0 && (
          <section className="p-rules-group">
            <h2>{t('print.spellRules')}</h2>
            {spells.map(sp => <SpellRule key={sp.id} spell={sp} i={i} />)}
          </section>
        )}
      </div>
      {attribution && <p className="p-attribution" lang="en" dir="ltr">{attribution}</p>}
      <Foot s={s} i={i} />
    </article>
  )
}

function SpellRule({ spell: sp, i }: { spell: Spell; i: T }) {
  const { t } = i
  const he = i.locale === 'he' && !!sp.descriptionHe
  const comps = [sp.components.v && 'V', sp.components.s && 'S', sp.components.m && 'M'].filter(Boolean).join(', ')
  const level = sp.level === 0 ? t('spells.cantrip') : t('spells.level', { ordinal: t(`sheet.slot.${sp.level}` as MessageKey) })
  return (
    <div className="p-rule">
      <h3><SpellLabel i={i} name={sp.name} spell={sp} /><small>{level}{sp.book ? ` · ${sp.book}` : ''}</small></h3>
      <p className="p-rule-meta">
        {t('spells.castingTime')}: {i.spellMeasure(sp.castingTime)} · {t('spells.range')}: {i.spellMeasure(sp.range)} · {t('spells.components')}: <bdi lang="en">{comps}{sp.components.material ? ` (${sp.components.material})` : ''}</bdi> · {t('spells.duration')}: {sp.concentration ? `${t('spells.concentration')}, ` : ''}{i.spellMeasure(sp.duration)}
      </p>
      {he
        ? <p className="p-rule-text" lang="he" dir="rtl">{sp.descriptionHe}</p>
        : <div className="p-rule-text" lang="en" dir="ltr"><Markdown text={sp.description} />{sp.higherLevels && <><strong>{t('spells.higher')}. </strong><Markdown text={sp.higherLevels} /></>}</div>}
    </div>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dd><bdi>{value || ' '}</bdi></dd><dt className="p-label">{label}</dt></div>
}

function Box({ title, children, grow }: { title: string; children: ReactNode; grow?: boolean }) {
  return <section className={`p-box${grow ? ' grow' : ''}`}><h2>{title}</h2>{children}</section>
}

function Stat({ label, value, sub, inline, ltr = true }: { label: string; value: string; sub?: string; inline?: boolean; ltr?: boolean }) {
  return (
    <div className={`p-stat${inline ? ' inline' : ''}`}>
      <strong dir={ltr ? 'ltr' : undefined}>{value}</strong>
      <span className="p-label">{label}</span>
      {sub && <small>{sub}</small>}
    </div>
  )
}

function Check({ on, double, bonus, name, extra, label }: { on: boolean; double?: boolean; bonus: string; name: string; extra?: string; label?: string }) {
  return (
    <li>
      <span className={`p-dot${on ? ' on' : ''}${double ? ' double' : ''}`} title={label} />
      <span className="p-bonus" dir="ltr">{bonus}</span>
      <span>{name}{extra && <small> ({extra})</small>}</span>
    </li>
  )
}

function Circles({ max, used }: { max: number; used: number }) {
  return (
    <span className="p-circles" dir="ltr">
      {Array.from({ length: max }, (_, n) => <span key={n} className={`p-dot${n < used ? ' on' : ''}`} />)}
    </span>
  )
}

function List({ items, empty }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="p-muted">{empty ?? '—'}</p>
  return <ul className="p-list">{items.map((x, n) => <li key={n}><bdi>{x}</bdi></li>)}</ul>
}

