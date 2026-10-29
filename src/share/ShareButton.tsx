import { useState } from 'react'
import type { Character } from '../model/character'
import { useI18n } from '../i18n'
import { shareLink } from './link'

/** Character card tool: shares (or copies) a read-only link anyone can open without an account. */
export function ShareButton({ character, className }: { character: Character; className?: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = await shareLink(character)
    if (navigator.share) {
      try {
        await navigator.share({ title: character.name, text: t('share.text', { name: character.name }), url })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // No clipboard (insecure page, old browser): show the link so it can be copied by hand.
      prompt(t('share.linkLabel'), url)
    }
  }

  return (
    <button type="button" className={className} onClick={share} title={t('share.hint')} aria-label={`${t('share.button')}: ${character.name}`}>
      <span aria-live="polite">{copied ? t('share.copied') : t('share.button')}</span>
    </button>
  )
}
