/**
 * Supabase client singleton.
 *
 * Imported anywhere that needs DB access — but components shouldn't import
 * this directly. They go through services in `services/` which use this client.
 * That way, swapping Supabase out (or stubbing it in tests) is a one-file change.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fail loud at startup — better than mysterious null responses later
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase credentials. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase: SupabaseClient = createClient(
  url ?? '',
  anonKey ?? '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    db: { schema: 'public' },
  }
)
