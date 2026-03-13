// SERVER SIDE: client with service role (NEVER import into client components)
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // ⚠️ do not expose to client

if (!url || !key) {
    throw new Error('Missing Supabase service role env vars');
}

export const supabaseServiceRole = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
