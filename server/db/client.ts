import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _db: SupabaseClient | null = null

export function getDb(): SupabaseClient {
  if (!_db) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
    }
    _db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  }
  return _db
}

/** @deprecated Use getDb() instead */
export const db = null as unknown as SupabaseClient
