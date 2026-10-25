import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { ABILITY_NAMES, ITEMS, SKILLS, classById, raceById, type Ability, type SkillId } from '../rules'
import type { MessageKey } from './locales/en'
import { getLocale, setLocale, subscribeLocale } from './store'
import { LOCALES, term, translate, type Vars } from './translate'

/** Current language plus translators. Re-renders the component when the language changes. */
export function useI18n() {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale)
  const t = useCallback((key: MessageKey, vars?: Vars) => translate(locale, key, vars), [locale])

  return useMemo(() => {
    const tr = (kind: string, id: string, fallback: string) => term(locale, kind, id, fallback)
    const className = (id: string) => tr('class', id, classById(id)?.name ?? id)
    return {
      locale,
      dir: LOCALES[locale].dir,
      setLocale,
      t,
      term: tr,
      className,
      raceName: (raceId: string, subraceId?: string) => {
        const race = raceById(raceId)
        const sub = race?.subraces?.find(s => s.id === subraceId)
        return sub ? tr('race', sub.id, sub.name) : race ? tr('race', race.id, race.name) : raceId
      },
      ability: (a: Ability) => tr('ability', a, ABILITY_NAMES[a]),
      abilityShort: (a: Ability) => tr('abilityShort', a, a.toUpperCase()),
      skill: (s: SkillId) => tr('skill', s, SKILLS[s].name),
      item: (id: string, fallback: string) => tr('item', id, fallback),
      /** Attacks are named after their weapon (or "Unarmed Strike"). */
      attackName: (name: string) => {
        const item = ITEMS.find(i => i.name === name)
        return item ? tr('item', item.id, name) : tr('attack', name, name)
      },
      /** "Fighter 3 / Wizard 2" */
      classLine: (classes: { classId: string; level: number }[]) =>
        classes.map(c => `${className(c.classId)} ${c.level}`).join(' / '),
      date: (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    }
  }, [locale, t])
}
