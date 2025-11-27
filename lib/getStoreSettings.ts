// lib/getStoreSettings.ts
import 'server-only'
import { supabaseService } from './supabaseService'  // ✅ usa questo file corretto
import type { StoreSettings } from '@/lib/types'

export async function getStoreSettings(): Promise<StoreSettings | null> {
    const { data, error } = await supabaseService
        .from('store_settings')
        .select('*')
        .limit(1)
        .maybeSingle()

    if (error) {
        console.error('Errore caricamento store_settings:', error.message)
        return null
    }

    return (data ?? null) as StoreSettings | null
}
