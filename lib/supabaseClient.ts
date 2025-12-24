'use client'

import { createBrowserClient } from '@supabase/ssr'

// Singleton globale: NEXT NON ricostruisce più mille client
let client: ReturnType<typeof createBrowserClient> | null = null

export function supabaseClient() {
    if (!client) {
        client = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
    }
    return client
}
