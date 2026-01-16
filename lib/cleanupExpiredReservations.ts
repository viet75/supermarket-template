// vercel: include helper in build

import { supabaseServiceRole } from '@/lib/supabaseService'

/**
 * Rilascia stock per ordini card_online scaduti usando RPC DB-side.
 * 
 * La logica di selezione e cleanup è completamente delegata al database
 * tramite la RPC cleanup_expired_reservations(), che usa now() di Postgres
 * per confronti temporali affidabili e timezone-safe.
 * 
 * Questo garantisce:
 * - Confronti temporali sempre corretti (DB-side con now() UTC)
 * - Nessuna dipendenza da timezone del runtime o scheduler
 * - Comportamento deterministico identico tra manual trigger e scheduler
 * - Architettura robusta stile Amazon
 * 
 * @returns Numero di ordini per cui lo stock è stato rilasciato
 */
export async function cleanupExpiredReservations(): Promise<number> {
    const svc = supabaseServiceRole

    try {
        // Chiama RPC DB-side: tutta la logica è nel database
        const { data, error } = await svc.rpc('cleanup_expired_reservations')

        if (error) {
            console.error('[cleanupExpiredReservations] Errore RPC cleanup:', error)
            return 0
        }

        // La RPC ritorna il numero di ordini processati
        const processedCount = typeof data === 'number' ? data : 0

        if (processedCount > 0) {
            console.log(`[cleanupExpiredReservations] ✅ Rilasciati ${processedCount} ordini scaduti`)
        }

        return processedCount
    } catch (err) {
        console.error('[cleanupExpiredReservations] Errore chiamata RPC:', err)
        return 0
    }
}

