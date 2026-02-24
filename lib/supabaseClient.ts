'use client'

import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function supabaseClient() {
    if (!client) {
        client = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                realtime: {
                    params: {
                        eventsPerSecond: 10,
                    },
                },
            }
        )
    }

    return client
}