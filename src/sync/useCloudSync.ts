// Runs sync while this device is linked to the cloud as the active player.
import { useEffect, useState } from 'react'
import { getCloudAccountId, getSupabase, onCloudChanged } from '../cloud'
import { startSync } from './runner'
import { supabaseRemote } from './supabaseRemote'

export function useCloudSync(activeProfileId: string | undefined) {
  const [accountId, setAccountId] = useState(getCloudAccountId)
  useEffect(() => onCloudChanged(() => setAccountId(getCloudAccountId())), [])

  useEffect(() => {
    if (!accountId || accountId !== activeProfileId) return
    let stop: (() => void) | undefined
    let cancelled = false
    // The client can't load while offline on a cold start; try again when the connection is back.
    const connect = () => void getSupabase().then(db => {
      if (cancelled || stop) return
      if (db) { window.removeEventListener('online', connect); stop = startSync(supabaseRemote(db), accountId) }
    })
    window.addEventListener('online', connect)
    connect()
    return () => { cancelled = true; window.removeEventListener('online', connect); stop?.() }
  }, [accountId, activeProfileId])
}
