import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { ABILITY_NAMES, ITEMS, SKILLS, THROWN_SUFFIX, allRaces, backgroundsFor, classById, raceById, type Ability, type RulesEdition, type SkillId } from '../rules'
import type { MessageKey } from './locales/en'
import { getLocale, setLocale, subscribeLocale } from './store'
import { spellNoteHe } from './locales/notes.he'
import { spellMeasureHe } from './locales/spells.he'
import { LOCALES, spellTermId, term, translate, type Vars } from './translate'
import { rollLabel } from './rollLabel'
import type { RollType } from '../dice/types'

/** Term keys of items, races and subraces by English name, for labels that only carry a name (a spell's source). */
let named: Map<string, string> | undefined
function namedKey(name: string): string | undefined {
  if (!named) {
    named = new Map()
    for (const i of ITEMS) named.set(i.name, `item.${i.id}`)
    for (const edition of ['2014', '2024'] as const) {
      for (const r of allRaces(edition)) {
        named.set(r.name, `race.${r.id}`)
        for (const s of r.subraces ?? []) if (!named.has(s.name)) named.set(s.name, `race.${s.id}`)
      }
      for (const b of backgroundsFor(edition)) if (!named.has(b.name)) named.set(b.name, `background.${b.id}`)
    }
  }
  return named.get(name)
}

/** Current language plus translators. Re-renders the component when the language changes. */
export function useI18n() {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale)
  const t = useCallback((key: MessageKey, vars?: Vars) => translate(locale, key, vars), [locale])

  return useMemo(() => {
    const plain = (kind: string, id: string, fallback: string) => term(locale, kind, id, fallback)
    // What's in brackets after a name: a level, skills, a race ("Wood Elf") or a pick ("Forest", "Elementals").
    const detail = (text: string): string => {
      const level = /^(\d+)(?:st|nd|rd|th) level$/.exec(text)
      if (level) return translate(locale, 'common.levelN', { n: level[1] })
      const list = text.split(/,\s*|\s+or\s+/)
      if (list.length > 1) {
        const parts = list.map(detail)
        return parts.some((p, i) => p !== list[i]) ? parts.join(', ') : text
      }
      const skill = Object.entries(SKILLS).find(([, s]) => s.name === text)?.[0]
      if (skill) return plain('skill', skill, text)
      const key = namedKey(text)
      const named = key ? LOCALES[locale].terms[key] : undefined
      return named ?? plain('pick', spellTermId(text), plain('detail', text, plain('feature', text, text)))
    }
    /** Name-keyed kinds also translate "Name (detail)" when only the name has a term ("Longstrider (Wood Elf)"). */
    const tr = (kind: string, id: string, fallback: string) => {
      const own = plain(kind, id, fallback)
      if (own !== fallback || locale === 'en') return own
      const m = /^(.*?) \((.*)\)$/.exec(kind === 'resource' ? fallback : id)
      if (!m) return own
      const base = kind === 'resource' ? plain('feature', m[1], m[1]) : plain(kind, m[1], m[1])
      return base === m[1] ? own : `${base} (${detail(m[2])})`
    }
    const className = (id: string) => tr('class', id, classById(id)?.name ?? id)
    return {
      locale,
      dir: LOCALES[locale].dir,
      setLocale,
      t,
      term: tr,
      className,
      /** 2014: the subrace's name ("High Elf"), or race and subrace ("Halfling (Lightfoot)"). 2024: species and lineage ("Elf (Drow)"). */
      raceName: (raceId: string, subraceId?: string, edition?: RulesEdition) => {
        const race = raceById(raceId, edition)
        const sub = race?.subraces?.find(s => s.id === subraceId)
        if (!race) return raceId
        // A 2014 subrace that doesn't name its race ("Lightfoot") gets it too: "Halfling (Lightfoot)".
        if (sub && (edition === '2024' || !sub.name.includes(race.name))) return `${tr('race', race.id, race.name)} (${tr('race', sub.id, sub.name)})`
        return sub ? tr('race', sub.id, sub.name) : tr('race', race.id, race.name)
      },
      ability: (a: Ability) => tr('ability', a, ABILITY_NAMES[a]),
      abilityShort: (a: Ability) => tr('abilityShort', a, a.toUpperCase()),
      skill: (s: SkillId) => tr('skill', s, SKILLS[s].name),
      item: (id: string, fallback: string) => tr('item', id, fallback),
      /** A spell's name in the current language, from its id or English name; homebrew keeps its own name. */
      spellName: (nameOrId: string, fallback = nameOrId) => tr('spell', spellTermId(nameOrId), fallback),
      /** A monster's name in the current language: SRD names from `monster.<id>` terms, book and pack monsters from their own `nameHe`. */
      monsterName: (m: { id: string; name: string; nameHe?: string; source: string }) =>
        locale === 'he' ? (m.source.startsWith('srd-') ? tr('monster', m.id, m.nameHe ?? m.name) : m.nameHe ?? tr('monster', m.id, m.name)) : m.name,
      /** Casting time, range or duration in the current language ("1 action" → "פעולה"). */
      spellMeasure: (text: string) => (locale === 'he' ? spellMeasureHe(text) : text),
      /**
       * Where a granted spell or bonus comes from, by its English name: an item, race or subrace ("Forest Gnome"),
       * feat, feature or racial trait. Unknown names (homebrew, the player's own items) stay as written.
       */
      sourceName: (name: string) => {
        const key = namedKey(name)
        const own = key ? LOCALES[locale].terms[key] : undefined
        return own ?? (tr('feat', spellTermId(name), '') || tr('feature', name, name))
      },
      /** Where the AC comes from, as the engine writes it ("Unarmored Defense (Barbarian) + Shield + 1 magic"), part by part. */
      acSource: (source: string): string => {
        if (locale === 'en') return source
        const part = (p: string): string => {
          if (p === 'Unarmored') return t('ac.unarmored')
          if (p === 'feats') return t('cs.feats')
          if (p === 'Shield') return tr('item', 'shield', p)
          const magic = /^(\d+) magic$/.exec(p)
          if (magic) return t('ac.magic', { n: magic[1] })
          const named = /^(.+) \((.+)\)$/.exec(p)
          if (named) return `${tr('feature', named[1], named[1])} (${className(named[2].toLowerCase())})`
          const key = namedKey(p)
          return (key ? LOCALES[locale].terms[key] : undefined) ?? tr('feature', p, tr('spell', spellTermId(p), p))
        }
        return source.split(' + ').map(part).join(' + ')
      },
      /** A race or species pick's short rule text (draconic ancestry, resistance picks); other text stays as written. */
      optionDetail: (text: string): string => {
        if (locale === 'en') return text
        const dmg = (d: string) => tr('damage', d.toLowerCase(), d)
        let m = /^(\w+) damage: breath weapon \(15 ft\. cone or 30 ft\. line, DEX save\) and resistance$/.exec(text)
        if (m) return t('detail.breath2024', { type: dmg(m[1]) })
        m = /^(\w+)(?: damage)?, (5 by 30 ft\. line|15 ft\. cone) \((\w+) save\)$/.exec(text)
        if (m) return t(m[2].startsWith('5') ? 'detail.breathLine' : 'detail.breathCone', { type: dmg(m[1]), ability: m[3] })
        m = /^Resistance to (\w+) damage$/.exec(text)
        if (m) return t('detail.resist', { type: dmg(m[1]) })
        return text
      },
      /** A granted spell's note ("at will", "once per long rest"). */
      spellNote: (text: string) => (locale === 'he' ? spellNoteHe(text) : text),
      /** Attacks are named after their weapon (or "Unarmed Strike"); a thrown line is "<weapon> (thrown)". */
      attackName: (name: string): string => {
        const plain = (n: string) => {
          const item = ITEMS.find(i => i.name === n)
          return item ? tr('item', item.id, n) : tr('attack', n, n)
        }
        return name.endsWith(THROWN_SUFFIX) ? t('sheet.attacks.thrownName', { name: plain(name.slice(0, -THROWN_SUFFIX.length)) }) : plain(name)
      },
      /** A saved roll's English label ("DEX save", "Longsword slashing (crit)") in the current language. */
      rollLabel: (label: string, type: RollType): string => {
        if (locale === 'en') return label
        const plain = (n: string) => { const item = ITEMS.find(i => i.name === n); return item ? tr('item', item.id, n) : tr('attack', n, tr('spell', spellTermId(n), n)) }
        const named = (n: string) => { const key = namedKey(n); return (key ? LOCALES[locale].terms[key] : undefined) ?? (tr('feat', spellTermId(n), '') || tr('feature', n, tr('spell', spellTermId(n), n))) }
        return rollLabel(label, type, {
          t, ability: a => tr('ability', a, ABILITY_NAMES[a]), abilityShort: a => tr('abilityShort', a, a.toUpperCase()),
          skill: s => tr('skill', s, SKILLS[s].name), attackName: plain, name: named, damageType: d => tr('damage', d, d),
        })
      },
      /** "Fighter 3 / Wizard 2" */
      classLine: (classes: { classId: string; level: number }[]) =>
        classes.map(c => `${className(c.classId)} ${c.level}`).join(' / '),
      date: (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    }
  }, [locale, t])
}
