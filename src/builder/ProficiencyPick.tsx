import { useState } from 'react'
import { useI18n } from '../i18n'
import { TOOL_GROUPS, languageGroups, type RulesEdition } from '../rules'

export interface PickGroup {
  label?: string
  items: { value: string; label: string }[]
}

/** A "write your own" entry: picking it shows a text box; typed text is saved with the prefix. */
export interface WriteOption {
  prefix: string
  label: string
}

const WRITE = '__write:'

/**
 * A select over grouped options plus "Write your own…" entries. A saved value that matches no option
 * (a typed language, a homebrew tool) opens with its text box filled.
 */
export function PickOrWrite({ value, onChange, groups, write, placeholder, ariaLabel }: {
  value: string
  onChange: (value: string) => void
  groups: PickGroup[]
  write: WriteOption[]
  placeholder: string
  ariaLabel: string
}) {
  const { t } = useI18n()
  const listed = groups.some(g => g.items.some(i => i.value === value))
  const typedPrefix = () => [...write].sort((a, b) => b.prefix.length - a.prefix.length).find(w => value.startsWith(w.prefix))?.prefix
  const [writing, setWriting] = useState<string | undefined>(() => (value && !listed ? typedPrefix() : undefined))
  const open = writing !== undefined && !listed
  const text = open && value.startsWith(writing) ? value.slice(writing.length) : ''
  return (
    <span className="pick-or-write">
      <select
        value={open ? WRITE + writing : value}
        aria-label={ariaLabel}
        onChange={e => {
          const v = e.target.value
          if (v.startsWith(WRITE)) {
            setWriting(v.slice(WRITE.length))
            onChange('')
          } else {
            setWriting(undefined)
            onChange(v)
          }
        }}
      >
        <option value="">{placeholder}</option>
        {groups.filter(g => g.items.length > 0).map((g, gi) => g.label
          ? <optgroup key={gi} label={g.label}>{g.items.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}</optgroup>
          : g.items.map(i => <option key={i.value} value={i.value}>{i.label}</option>))}
        {write.map(w => <option key={w.prefix} value={WRITE + w.prefix}>{w.label}</option>)}
      </select>
      {open && (
        <input
          className="pick-write"
          value={text}
          autoFocus={!value}
          aria-label={t('builder.writeOwnName')}
          placeholder={t('builder.writeOwnPlaceholder')}
          onChange={e => onChange(e.target.value.trim() ? writing + e.target.value : '')}
        />
      )}
    </span>
  )
}

/** Picker groups for languages in this edition, leaving out `hide` (already known or picked elsewhere). */
export function useLanguageGroups(edition: RulesEdition, hide: (lang: string) => boolean, prefix = ''): PickGroup[] {
  const { t, term } = useI18n()
  return languageGroups(edition).map(g => ({
    label: t(`builder.langGroup.${g.id}`),
    items: g.languages.filter(l => !hide(l)).map(l => ({ value: prefix + l, label: term('language', l, l) })),
  }))
}

/**
 * Picker groups for tools: `first` (a pick's own list) unlabeled on top, then every other tool by kind
 * under "Other tools". With no `first`, all tools by kind.
 */
export function useToolGroups(hide: (tool: string) => boolean, first?: string[], prefix = ''): PickGroup[] {
  const { t, term } = useI18n()
  const item = (x: string) => ({ value: prefix + x, label: term('tool', x, x) })
  const rest = TOOL_GROUPS.map(g => ({
    label: first ? `${t('builder.otherTools')}: ${t(`builder.toolGroup.${g.id}`)}` : t(`builder.toolGroup.${g.id}`),
    items: g.tools.filter(x => !first?.includes(x) && !hide(x)).map(item),
  }))
  return first ? [{ items: first.filter(x => !hide(x)).map(item) }, ...rest] : rest
}
