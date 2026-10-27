// The shared Supabase client. Loaded on first use, so the library stays out of the bundle's
// first load and devices without cloud settings never download it.
import type { SupabaseClient } from '@supabase/supabase-js'
import { cloudConfig } from './config'

let client: Promise<SupabaseClient | null> | undefined

/** The client, or null when the cloud isn't configured or the library can't load (offline). */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!cloudConfig) return Promise.resolve(null)
  const { url, anonKey } = cloudConfig
  client ??= import('@supabase/supabase-js')
    .then(({ createClient }) => createClient(url, anonKey, { auth: { persistSession: true, storageKey: 'ff.supabase.auth' } }))
    .catch(() => {
      client = undefined
      return null
    })
  return client
}
