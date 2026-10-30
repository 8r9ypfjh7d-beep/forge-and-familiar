import { useI18n } from './useI18n'

/** A spell's name in the current language; in Hebrew the English name follows as a small subtitle for table talk. */
export function SpellName({ name, id }: { name: string; id?: string }) {
  const { spellName } = useI18n()
  const shown = spellName(id ?? name, name)
  if (shown === name) return <bdi lang="en">{name}</bdi>
  return <span className="spell-name"><bdi>{shown}</bdi> <small className="spell-en" lang="en" dir="ltr">{name}</small></span>
}
