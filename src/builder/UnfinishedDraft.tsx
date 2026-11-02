// Kept apart from Builder.tsx so Home can show the banner without loading the whole wizard.
import { useState } from 'react'
import { useI18n } from '../i18n'
import { ConfirmDialog } from './ConfirmDialog'
import { clearDraft, loadDraft } from './draftStore'
import './draft.css'

/** Home and character list: offers the player's unfinished new character, if there is one. */
export function UnfinishedDraft({ ownerId, onContinue }: { ownerId: string; onContinue: () => void }) {
  const { t } = useI18n()
  const [saved, setSaved] = useState(() => loadDraft(ownerId))
  const [asking, setAsking] = useState(false)
  if (!saved) return null
  const discard = () => {
    clearDraft(ownerId)
    setSaved(undefined)
  }
  return (
    <div className="glass draft-banner" role="note">
      <span>{saved.draft.name.trim() ? t('builder.draft.unfinishedNamed', { name: saved.draft.name.trim() }) : t('builder.draft.unfinished')}</span>
      <span className="row">
        <button className="glass-btn small prominent" onClick={onContinue}>{t('builder.draft.continue')}</button>
        <button className="glass-btn small" onClick={() => setAsking(true)}>{t('builder.draft.discard')}</button>
      </span>
      <ConfirmDialog open={asking} title={t('builder.draft.discardConfirm')} yes={t('builder.draft.discard')} onYes={discard} onClose={() => setAsking(false)} />
    </div>
  )
}
