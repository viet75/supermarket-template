// lib/supabase-server.ts
import { createClient } from '@supabase/supabase-js';

/**
 * Factory "safe": valida le env solo quando viene chiamata,
 * NON a import-time (evita 500 immediati nelle route).
 */
export function supabaseServer() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
    if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

    return createClient(url, serviceKey, {
        auth: { persistSession: false },
        global: { headers: { 'X-Client-Info': 'server-service-role' } },
    });
}
