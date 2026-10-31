// An Apply card's line in the reader's language; names go through the app's own translations (spells, items, classes...).
import type { useI18n } from '../../i18n'
import type { Ability, SkillId } from '../../rules'
import type { Proposal } from '../changes'
import type { FamiliarScreen } from '../screen'

type I18n = ReturnType<typeof useI18n>

/** The card's line in the reader's language, names through the app's own translations. */
export function changeTitle(p: Proposal, i: I18n, screen?: FamiliarScreen): string {
  const { t, term, spellName, item, className, raceName, skill } = i
  const n = p.names
  const c = p.change
  switch (c.kind) {
    case 'learn_spell':
      return n.class ? t('familiar.change.learnSpellClass', { name: spellName(c.spellId, n.spell ?? c.spellId), class: className(c.classId) }) : t('familiar.change.learnSpell', { name: spellName(c.spellId, n.spell ?? c.spellId) })
    case 'forget_spell':
      return t('familiar.change.forgetSpell', { name: spellName(c.spellId, n.spell ?? c.spellId) })
    case 'prepare_spell':
      return t(c.prepared ? 'familiar.change.prepareSpell' : 'familiar.change.unprepareSpell', { name: spellName(c.spellId, n.spell ?? c.spellId) })
    case 'add_item': {
      const name = item(c.entry.itemId, n.item ?? c.entry.itemId)
      return c.qty > 1 ? t('familiar.change.addItemQty', { name, qty: c.qty }) : t('familiar.change.addItem', { name })
    }
    case 'add_note':
      return t('familiar.change.addNote')
    case 'plan_level': {
      const e = c.entry
      const what = [
        className(e.classId),
        e.subclassId && term('subclass', e.subclassId, n.subclass ?? e.subclassId),
        e.featId && term('feat', e.featId, n.feat ?? e.featId),
        e.abilities && Object.entries(e.abilities).filter(([, v]) => v).map(([a, v]) => `${i.abilityShort(a as Ability)} +${v}`).join(', '),
      ].filter(Boolean).join(' · ')
      return t('familiar.change.planLevel', { level: e.level, what })
    }
    case 'set_race':
      return t('familiar.change.setRace', { name: raceName(c.raceId, c.subraceId, screen?.edition) })
    case 'set_class':
      return t('familiar.change.setClass', { name: className(c.classId) })
    case 'set_subclass':
      return t('familiar.change.setSubclass', { name: term('subclass', c.subclassId, n.subclass ?? c.subclassId), class: className(c.classId) })
    case 'set_background':
      return t('familiar.change.setBackground', { name: term('background', c.backgroundId, n.background ?? c.backgroundId) })
    case 'set_feat': {
      const name = term('feat', c.featId, n.feat ?? c.featId)
      if (c.slot === 'origin') return t('familiar.change.setFeatOrigin', { name })
      return t('familiar.change.setFeatSlot', { name, class: className(c.slot.classId), level: c.slot.level })
    }
    case 'set_skills':
      return t('familiar.change.setSkills', { list: c.skills.map(s => skill(s as SkillId)).join(', ') })
  }
}
