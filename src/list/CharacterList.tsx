import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/locales/en'
import type { Character, UserProfile } from '../model/character'
import { ExportButton, ImportButton } from '../portability/ui'
import type { EditState } from '../requests'
import { ShareButton } from '../share'
import './list.css'

const EDIT_LABEL: Record<EditState, MessageKey> = { approved: 'list.edit', pending: 'list.editRequested', none: 'list.askEdit' }

/** The Characters page. Tapping a card opens its sheet; each card shows one Edit button and keeps the rarer tools
 *  (Levels, Plan, Print, Export, Share, Delete) in a "⋯" menu. "+ New character" is the one prominent action. */
export function CharacterList({ owner, characters, onNew, onStarter, onOpen, editState, onEdit, onLevels, onPlan, onPrint, onImported, onDelete }: {
  owner: UserProfile
  characters: Character[]
  onNew: () => void
  onStarter: () => void
  onOpen: (id: string) => void
  editState: (id: string) => EditState
  onEdit: (id: string) => void
  onLevels: (id: string) => void
  onPlan: (id: string) => void
  onPrint: (id: string) => void
  onImported: () => void
  onDelete: (id: string) => void
}) {
  const { t, classLine, raceName } = useI18n()
  const quiet = (
    <p className="heroes-links small">
      <ImportButton ownerId={owner.id} onImported={onImported} className="heroes-link" />
      <span aria-hidden="true">·</span>
      <button type="button" className="heroes-link" onClick={onStarter}>{t('list.starters')}</button>
    </p>
  )
  return (
    <section className="heroes">
      <header className="heroes-head">
        <h2 className="glass-title">{t('list.title', { name: owner.displayName })}</h2>
        {characters.length > 0 && <button className="glass-btn prominent heroes-new" onClick={onNew}>{t('list.new')}</button>}
        {characters.length > 0 && quiet}
      </header>
      {characters.length === 0 ? (
        <div className="glass heroes-empty">
          <div className="portrait-empty" aria-hidden="true">✦</div>
          <p>{t('list.empty')}</p>
          <div className="heroes-actions">
            <button className="glass-btn prominent" onClick={onNew}>{t('list.buildFirst')}</button>
          </div>
          {quiet}
        </div>
      ) : (
        <div className="heroes-grid">
          {characters.map(c => (
            <article key={c.id} className="glass heroes-card">
              <button type="button" className="heroes-open" onClick={() => onOpen(c.id)} aria-label={`${t('common.openSheet')}: ${c.name}`}>
                {c.portrait ? <img src={c.portrait} alt="" /> : <span className="portrait-empty" aria-hidden="true">{c.name.slice(0, 1)}</span>}
                <span className="heroes-name">
                  <strong>{c.name}</strong>
                  <span className="muted small">{raceName(c.raceId, c.subraceId, c.rulesEdition)} · {classLine(c.classes)}</span>
                </span>
              </button>
              <div className="heroes-main">
                <button className="glass-btn small" onClick={() => onEdit(c.id)} aria-label={`${t(EDIT_LABEL[editState(c.id)])}: ${c.name}`}>{t(EDIT_LABEL[editState(c.id)])}</button>
                <CardMenu label={t('list.moreFor', { name: c.name })}>
                  {close => <>
                    <button type="button" role="menuitem" className="heroes-tool" onClick={() => { close(); onLevels(c.id) }}>{t('list.levels')}</button>
                    <button type="button" role="menuitem" className="heroes-tool" onClick={() => { close(); onPlan(c.id) }}>{t('list.plan')}</button>
                    <button type="button" role="menuitem" className="heroes-tool" onClick={() => { close(); onPrint(c.id) }}>{t('list.print')}</button>
                    <ExportButton character={c} className="heroes-tool" />
                    <ShareButton character={c} className="heroes-tool" />
                    <button type="button" role="menuitem" className="heroes-tool danger"
                      onClick={() => { close(); if (confirm(t('list.confirmDelete', { name: c.name }))) onDelete(c.id) }}>{t('common.delete')}</button>
                  </>}
                </CardMenu>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

/** "⋯" button with a small drop-down; closes on outside tap or Escape. The panel stays mounted while hidden, so
 *  Export and Share finish (and Share can say "Copied") after the tap. */
function CardMenu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus() } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className="heroes-menu" ref={box}>
      <button ref={button} type="button" className="glass-btn small heroes-more" aria-haspopup="menu" aria-expanded={open} aria-controls={id}
        aria-label={label} title={label} onClick={() => setOpen(o => !o)}>
        <span aria-hidden="true">⋯</span>
      </button>
      <div id={id} role="menu" aria-label={label} className="heroes-menu-panel glass-sheet" hidden={!open}>
        {children(() => setOpen(false))}
      </div>
    </div>
  )
}
