// vercel: include helper in build

import { supabaseServiceRole } from '@/lib/supabaseService'

/**
 * Release stock for expired card_online orders using DB-side RPC.
 * 
 * The selection and cleanup logic is completely delegated to the database
 * through the cleanup_expired_reservations() RPC, which uses now() of Postgres
 * for reliable temporal comparisons and timezone-safe.
 * 
 * This ensures:
 * - Temporal comparisons are always correct (DB-side with now() UTC)
 * - No dependency on runtime or scheduler timezone
 * - Deterministic behavior identical between manual trigger and scheduler
 * - Robust architecture 
 * 
 * @returns Number of orders for which stock has been released
 */
export async function cleanupExpiredReservations(): Promise<number> {
    const svc = supabaseServiceRole

    try {
        // Call DB-side RPC: all logic is in the database
        const { data, error } = await svc.rpc('cleanup_expired_reservations')

        if (error) {
            console.error('[cleanupExpiredReservations] Error RPC cleanup:', error)
            return 0
        }

        // The RPC returns the number of orders processed
        const processedCount = typeof data === 'number' ? data : 0

        if (processedCount > 0) {
            console.log(`[cleanupExpiredReservations] ✅ Released ${processedCount} expired orders`)
        }

        return processedCount
    } catch (err) {
        console.error('[cleanupExpiredReservations] Error calling RPC:', err)
        return 0
    }
}

