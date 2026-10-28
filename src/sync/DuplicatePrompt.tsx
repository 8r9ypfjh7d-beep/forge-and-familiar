// Asks which copy to keep when the account has the same character twice with different builds.
// Copies with the same build merge without asking.
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Character } from '../model/character'
import { getCloudAccountId } from '../cloud'
import { getBackground, subclassById } from '../rules'
import { useI18n } from '../i18n'
import { findDuplicates, keepBoth, keepCopy, mergeSameBuilds } from './duplicates'
import { getSyncStatus, onSyncStatus } from './runner'
import './sync.css'

export function DuplicatePrompt({ characters }: { characters: Character[] }) {
  const { t, className, raceName, term, date } = useI18n()
  const sync = useSyncExternalStore(onSyncStatus, getSyncStatus)
  const [groups, setGroups] = useState<Character[][]>([])
  const [busy, setBusy] = useState(false)
  // Only for a cloud-linked account (local profiles may name two heroes alike on purpose), and not mid-pass.
  const settled = sync.state !== 'syncing' && !!characters[0] && getCloudAccountId() === characters[0].ownerId

  useEffect(() => {
    if (!settled) return
    let cancelled = false
    void mergeSameBuilds(findDuplicates(characters)).then(open => { if (!cancelled) setGroups(open) }, () => {})
    return () => { cancelled = true }
  }, [characters, settled])

  const group = groups[0]
  if (!group) return null

  const classes = (c: Character) => c.classes.map(cl => {
    const sub = cl.subclassId ? subclassById(cl.subclassId, c.rulesEdition) : undefined
    const base = `${className(cl.classId)} ${cl.level}`
    return sub ? `${base} (${term('subclass', sub.id, sub.name)})` : base
  }).join(' / ')
  const background = (c: Character) => {
    const bg = getBackground(c)
    return bg ? term('background', bg.id, bg.name) : undefined
  }
  const act = async (fn: () => Promise<void> | void) => {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
    setGroups(g => g.slice(1))
  }

  return (
    <section className="dupe glass thick" aria-labelledby="dupe-title">
      <h2 id="dupe-title">{t('sync.dupeTitle', { name: group[0].name })}</h2>
      <p>{t('sync.dupeBody', { count: group.length })}</p>
      <ul className="dupe-copies">
        {group.map((c, i) => (
          <li key={c.id} className="dupe-copy glass thin">
            <span className="glass-eyebrow">{t('sync.dupeCopy', { n: i + 1 })}</span>
            <strong className="dupe-line">{classes(c)}</strong>
            <span className="muted small">{[raceName(c.raceId, c.subraceId, c.rulesEdition), background(c)].filter(Boolean).join(' · ')}</span>
            <span className="muted small">{t('sync.dupeChanged', { date: date(c.updatedAt) })}</span>
            <button className="glass-btn" disabled={busy} onClick={() => act(() => keepCopy(c, group))}>
              {t('sync.dupeKeep', { n: i + 1 })}
            </button>
          </li>
        ))}
      </ul>
      <p className="muted small">{t('sync.dupeSafe')}</p>
      <button className="glass-btn small" disabled={busy} onClick={() => act(() => keepBoth(group))}>{t('sync.dupeKeepBoth')}</button>
    </section>
  )
}
