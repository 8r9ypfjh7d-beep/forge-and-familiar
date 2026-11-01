import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import type { Character } from '../model/character'
import { levelForXp, totalLevel } from '../rules'
import type { Party } from './types'
import { pendingLevel } from './xp'

// "Later" is remembered per character and level on this device, so the same level doesn't ask twice.
const KEY = 'ff.levelPrompt.v1'
const readLater = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {} } catch { return {} } }
const writeLater = (v: Record<string, number>) => { try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* asks again next visit */ } }

/**
 * The player's "New level!" moment: when the DM's level (or enough XP) reaches a character this player brought,
 * it asks once per level to open Level Up, which walks through hit points, features and choices. After one
 * level is taken it asks again for the next, so two milestones walk through two levels.
 */
export function LevelUpPrompt({ characters, parties, userId, paused, onLevelUp }: {
  characters: Character[]
  parties: Party[] | null
  userId: string
  /** True on screens that shouldn't be interrupted (the builder, Level Up itself). */
  paused: boolean
  onLevelUp: (id: string) => void
}) {
  const { t } = useI18n()
  const [later, setLater] = useState(readLater)
  const ref = useRef<HTMLDialogElement>(null)
  const found = paused || !parties?.length ? undefined : characters
    .filter(c => c.ownerId === userId)
    .map(c => ({ c, p: pendingLevel(c, parties) }))
    .find(x => x.p && later[x.c.id] !== x.p.level && x.p.party.dmId !== userId)
  const open = !!found
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal?.()
    if (!open && d.open) d.close()
  }, [open])

  const dismiss = () => {
    if (!found?.p) return
    const next = { ...later, [found.c.id]: found.p.level }
    setLater(next)
    writeLater(next)
  }
  const go = () => {
    if (!found) return
    dismiss()
    onLevelUp(found.c.id)
  }
  const extra = found ? Math.max(0, levelForXp(found.c.xp) - totalLevel(found.c) - 1) : 0
  const level = found?.p?.level ?? 0
  const title = found && (found.p!.award.xp
    ? t('levelPrompt.titleXp', { name: found.c.name, level })
    : t('levelPrompt.title', { name: found.c.name, level }))

  return (
    <dialog ref={ref} className="confirm-dialog glass-sheet glass-dialog level-prompt" aria-labelledby="level-prompt-title" onCancel={e => { e.preventDefault(); dismiss() }}>
      {found && (
        <>
          <p className="glass-eyebrow"><span aria-hidden="true">⬆ </span>{t('levelPrompt.eyebrow', { campaign: found.p!.party.name })}</p>
          <h2 id="level-prompt-title" className="confirm-dialog-title">{title}</h2>
          <p className="confirm-dialog-body">{t('levelPrompt.body')}</p>
          {extra > 0 && <p className="confirm-dialog-body">{t('levelPrompt.more', { count: extra })}</p>}
          <div className="confirm-dialog-actions">
            <button type="button" className="glass-btn prominent" onClick={go}>{t('levelPrompt.go', { level })}</button>
            <button type="button" className="glass-btn" onClick={dismiss}>{t('levelPrompt.later')}</button>
          </div>
          <p className="muted small">{t('levelPrompt.laterHint')}</p>
        </>
      )}
    </dialog>
  )
}
