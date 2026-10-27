// Supabase settings, baked in at build time from VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// (Render environment variables). Missing means the app runs on this device only, as before.
export interface CloudConfig {
  url: string
  anonKey: string
}

export function readCloudConfig(env: Record<string, string | undefined>): CloudConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
  return url && anonKey ? { url, anonKey } : null
}

export const cloudConfig = readCloudConfig(import.meta.env)
export const isCloudEnabled = () => cloudConfig !== null
