// VAST FINANCE - Supabase Browser Client
// Untuk digunakan di Client Components
// Using @supabase/ssr untuk proper cookie handling dengan middleware

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
