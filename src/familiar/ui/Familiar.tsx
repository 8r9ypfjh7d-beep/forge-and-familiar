// The Familiar on screen: a sparkle button above the dice that opens a glass sheet (side sheet on wide screens,
// bottom sheet on phones), and the full-screen #/familiar page. Both continue the same conversation.
import { useEffect, useId, useRef, useState } from 'react'
import { isCloudEnabled } from '../../cloud/config'
import { useI18n } from '../../i18n'
import { onFamiliarOpen, type OpenRequest } from '../screen'
import { FamiliarChat, Sparkle } from './FamiliarChat'
import { useFamiliarScreenValue } from './screen'
import { useFamiliarChat, type ChatSetup } from './useFamiliarChat'
import { useOnline } from './useOnline'
import { blockedReason, chipKeys } from './view'
import './familiar.css'

export interface FamiliarSetup extends Omit<ChatSetup, 'locale'> {
  /** The open profile is linked to a cloud account (activation code), which the Edge Function needs. */
  signedIn: boolean
  /** Screen-specific chips (i18n keys); the default set for the context otherwise. */
  chips?: string[]
  /** "About Vex": what the answers will know about. */
  subject?: string
}

/** App's guess from the route, overridden by what a screen publishes (the sheet's character, the builder's draft). */
function useSetup(base: FamiliarSetup) {
  const { locale } = useI18n()
  const online = useOnline()
  const screen = useFamiliarScreenValue()
  const published = screen.context.kind !== 'general'
  const setup: FamiliarSetup = published
    ? { ...base, context: screen.context, card: screen.card ?? base.card, edition: screen.edition ?? base.edition, role: screen.role ?? base.role, data: screen.data ?? base.data, chips: screen.chips ?? base.chips, prepare: screen.context.kind === 'dm' ? base.prepare : undefined }
    : base
  const chat = useFamiliarChat({ ...setup, locale })
  const blocked = blockedReason({ cloud: isCloudEnabled() || !!setup.transport, signedIn: setup.signedIn, online })
  const chips = setup.chips ?? chipKeys(setup.context, setup.role)
  return { chat, blocked, chips }
}

/** Takes "Ask the Familiar" requests from the sheet and the builder while mounted. */
function useOpenRequests(onOpen: () => void) {
  const [request, setRequest] = useState<(OpenRequest & { at: number }) | null>(null)
  const opened = useRef(onOpen)
  useEffect(() => { opened.current = onOpen })
  useEffect(() => onFamiliarOpen(r => { opened.current(); setRequest({ ...r, at: Date.now() }) }), [])
  return request
}

export function FamiliarFab({ open, onOpenChange, ...setup }: FamiliarSetup & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const { chat, blocked, chips } = useSetup(setup)
  const request = useOpenRequests(() => onOpenChange(true))
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const close = () => { onOpenChange(false); button.current?.focus() }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { onOpenChange(false); button.current?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  return (
    <>
      {open && <div className="fam-scrim" onClick={close} aria-hidden="true" />}
      {open && (
        <div id={id} className="fam-sheet" role="dialog" aria-label={t('familiar.name')}>
          <FamiliarChat chat={chat} chips={chips} blocked={blocked} subject={setup.subject} variant="sheet" onClose={close} autoFocus request={request} />
        </div>
      )}
      <button
        ref={button}
        type="button"
        className={`fam-fab ${open ? 'is-open' : ''} ${chat.busy ? 'is-busy' : ''}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={t(open ? 'familiar.close' : 'familiar.open')}
        title={t(open ? 'familiar.close' : 'familiar.open')}
        onClick={() => (open ? close() : onOpenChange(true))}
      >
        <Sparkle size={22} />
      </button>
    </>
  )
}

export function FamiliarPage(setup: FamiliarSetup) {
  const { chat, blocked, chips } = useSetup(setup)
  const request = useOpenRequests(() => {})
  return (
    <section className="fam-page-wrap glass thick">
      <FamiliarChat chat={chat} chips={chips} blocked={blocked} subject={setup.subject} variant="page" autoFocus request={request} />
    </section>
  )
}
