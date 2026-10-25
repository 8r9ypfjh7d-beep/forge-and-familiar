import { useI18n } from '../i18n'
import type { Character } from '../model/character'
import { dawnsBetween, formatDuration } from './clock'
import { useSheetRolls } from './dice'
import { advanceTime, clockOf, dawn, dawnCounters } from './engine'
import type { Apply } from './types'

/** Words a duration in the current language: "1 d 2 h". */
export function useDurationText() {
  const { t } = useI18n()
  return (minutes: number) => formatDuration(minutes, (unit, n) => t(`clock.unit.${unit}`, { n }))
}

/**
 * Passes in-game time, rolling regain dice for every dawn on the way. `then` runs
 * after the time passes (a rest). The log line names every charge regained.
 */
export function useAdvanceTime(character: Character, apply: Apply) {
  const { t } = useI18n()
  const duration = useDurationText()
  const rolls = useSheetRolls(character)
  return (minutes: number, label: string, then: (c: Character) => Character = c => c) => {
    const dawns = dawnsBetween(clockOf(character), clockOf(character) + minutes)
    // Roll dawn by dawn, and only for trackers that still have charges spent.
    const rolledPerDawn: Record<string, number>[] = []
    let sim = character
    for (let i = 0; i < dawns; i++) {
      const rolled: Record<string, number> = {}
      for (const k of dawnCounters(sim)) if (k.used > 0 && k.regain?.trim()) rolled[k.id] = rolls.total(k.regain, `${k.label} at dawn`)
      rolledPerDawn.push(rolled)
      sim = dawn(sim, rolled)
    }
    const gained = dawnCounters(character)
      .map(k => ({ label: k.label, n: k.used - (dawnCounters(sim).find(s => s.id === k.id)?.used ?? k.used) }))
      .filter(g => g.n > 0)
      .map(g => `${g.label} +${g.n}`)
    let text = t('clock.log.duration', { label, duration: duration(minutes) })
    if (dawns) text += (dawns > 1 ? t('clock.log.dawns', { n: dawns }) : t('clock.log.dawnOne')) + (gained.length ? `: ${gained.join(', ')}` : '')
    apply(text, c => then(advanceTime(c, minutes, rolledPerDawn)))
  }
}
