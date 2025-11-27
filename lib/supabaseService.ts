// LATO SERVER: client con service role (NON importare mai in componenti client)
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // ⚠️ non esporre al client

if (!url || !key) {
    throw new Error('Missing Supabase service role env vars');
}

export const supabaseService = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
