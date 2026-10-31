import { useI18n } from '../i18n'
import { METAMAGIC_COUNT, getMetamagic, metamagicCount, metamagicIds, metamagicOptions, rulesEdition, toggleMetamagic, type ClassOption } from '../rules'
import type { StepProps } from './steps'
import { Fold } from './Compact'
import { ExplainList, Why } from './Why'
import { metamagicKey } from './why'

/** Metamagic picks (sorcerers, and anyone with Metamagic Adept): every option for the edition, with costs and why? lines. More than allowed only warns. */
export function MetamagicPicker({ draft, update, classId }: StepProps & { classId: string }) {
  const { t, term } = useI18n()
  const edition = rulesEdition(draft)
  const count = metamagicCount(draft)
  const ids = metamagicIds(draft)
  const sorcerer = draft.classes.some(cl => cl.classId === 'sorcerer')
  // A sorcerer picks on the sorcerer row; anyone else with Metamagic Adept picks on their first class.
  if (sorcerer ? classId !== 'sorcerer' : classId !== draft.classes[0]?.classId || (count === 0 && ids.length === 0)) return null
  if (count === 0 && ids.length === 0) {
    return <p className="muted small">{t('builder.metamagicLater', { level: METAMAGIC_COUNT[edition][0][0] })}</p>
  }
  const cost = (o: ClassOption) => (o.costPerSpellLevel ? t('mm.perLevel') : t('mm.cost', { count: o.cost ?? 0 }))
  const name = (o: ClassOption) => term('metamagic', o.id, o.name)
  return (
    <Fold defaultOpen={ids.length < count} title={term('feature', 'Metamagic', 'Metamagic')}
      status={<span className={ids.length < count ? 'todo' : ''}>{t('builder.picks.count', { picked: ids.length, max: count })}</span>}
      why={<Why id="choice.metamagic" />}>
      <div className="row">
        {metamagicOptions(draft).map(o => (
          <button key={o.id} type="button" className={`glass-chip ${ids.includes(o.id) ? 'on' : ''}`} aria-pressed={ids.includes(o.id)} title={cost(o)}
            onClick={() => update({ classOptions: toggleMetamagic(draft, o.id) })}>
            {name(o)}
          </button>
        ))}
      </div>
      {ids.length > count && <p className="small bad">{t('builder.metamagicOver', { count })}</p>}
      <ExplainList items={getMetamagic(draft).map(o => ({ name: name(o), note: cost(o), key: metamagicKey(o, edition), text: o.text }))} />
    </Fold>
  )
}
