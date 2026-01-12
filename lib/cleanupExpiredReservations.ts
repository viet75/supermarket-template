import { supabaseService } from '@/lib/supabaseService'
import { releaseOrderStock } from '@/lib/releaseOrderStock'

/**
 * Rilascia stock per ordini card_online scaduti (reserve_expires_at < now).
 * Idempotente e sicuro: filtri durissimi per evitare rilasci errati.
 * 
 * @returns Numero di ordini per cui lo stock è stato rilasciato
 */
export async function cleanupExpiredReservations(): Promise<number> {
    const svc = supabaseService

    // Filtri durissimi: solo ordini card_online pending con stock_reserved=true e scaduti
    const { data: expiredOrders, error: queryError } = await svc
        .from('orders')
        .select('id')
        .eq('payment_method', 'card_online')
        .eq('payment_status', 'pending')
        .eq('status', 'pending')
        .eq('stock_reserved', true)
        .not('reserve_expires_at', 'is', null)
        .lt('reserve_expires_at', new Date().toISOString())

    if (queryError) {
        console.error('[cleanupExpiredReservations] Errore query ordini scaduti:', queryError)
        return 0
    }

    if (!expiredOrders || expiredOrders.length === 0) {
        return 0
    }

    let releasedCount = 0

    for (const expiredOrder of expiredOrders) {
        try {
            // releaseOrderStock aggiorna già stock_reserved=false e reserve_expires_at=NULL
            const releaseResult = await releaseOrderStock(expiredOrder.id)
            
            if (releaseResult.ok) {
                // Update esplicito per sicurezza: stock_reserved=false, reserve_expires_at=NULL, status='cancelled'
                await svc
                    .from('orders')
                    .update({ 
                        stock_reserved: false, 
                        reserve_expires_at: null,
                        status: 'cancelled'
                    })
                    .eq('id', expiredOrder.id)
                
                releasedCount++
            }
        } catch (err) {
            console.error(`[cleanupExpiredReservations] Errore rilascio ordine ${expiredOrder.id}:`, err)
            // Continua con gli altri ordini
        }
    }

    return releasedCount
}

