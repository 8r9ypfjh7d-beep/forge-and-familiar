// Player names for the Codex when it sits outside the party page (the DM screen): local profiles first,
// then the names of cloud accounts in the party.
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { fetchAccountNames } from '../party/cloud'
import { listProfiles } from '../storage'

export function usePartyNames(): (userId: string) => string {
  const { t } = useI18n()
  const [names, setNames] = useState<Record<string, string>>({})
  useEffect(() => {
    let live = true
    Promise.all([listProfiles(), fetchAccountNames()]).then(([profiles, accounts]) => {
      if (live) setNames({ ...accounts, ...Object.fromEntries(profiles.map(p => [p.id, p.displayName])) })
    })
    return () => { live = false }
  }, [])
  return id => names[id] ?? t('party.unknownPlayer')
}
