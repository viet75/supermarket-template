// lib/delivery.ts
import type { StoreSettings, PaymentMethod } from '@/lib/types'
import { computeDistanceFromStore, Coordinates } from './geo'

function round2(n: number) {
    return Math.round(n * 100) / 100
}

/** null/undefined/NaN/non finito => null; altrimenti numero finito (per delivery_max_km). Illimitato se null. */
export function normalizeDeliveryMaxKm(value: unknown): number | null {
    if (value == null || value === '') return null
    const n = Number(value)
    return n !== n || !Number.isFinite(n) ? null : n
}

/**
 * Calcola il costo della consegna in base alla distanza e alle impostazioni del negozio
 * Funzione pura per il calcolo della delivery fee
 */
export function calculateDeliveryFee({
    distanceKm,
    baseKm,
    baseFee,
    extraFeePerKm,
    maxKm,
}: {
    distanceKm: number
    baseKm: number
    baseFee: number
    extraFeePerKm: number
    maxKm: number | null
}): number {
    const max = normalizeDeliveryMaxKm(maxKm)
    if (max !== null && distanceKm > max) {
        throw new Error('Fuori zona di consegna')
    }

    if (distanceKm <= baseKm) {
        return round2(baseFee)
    }

    const extraKm = Math.ceil(distanceKm - baseKm)
    return round2(baseFee + extraKm * extraFeePerKm)
}

/**
 * Calcola il costo della consegna in base alla distanza e alle impostazioni del negozio
 */
export function computeDeliveryFee(distanceKm: number, s: StoreSettings): number {
    if (!s.delivery_enabled) return 0

    const km = Math.max(0, Number(distanceKm) || 0)
    const base = Number(s.delivery_fee_base || 0)
    const perKm = Number(s.delivery_fee_per_km || 0)
    const freeOver = Number(s.free_over || 0)

    if (freeOver > 0 && km <= freeOver) {
        return 0
    }

    // Se è previsto un costo fisso fino a `delivery_fee_per_km` km
    // (es. 5€ fino a 3 km, oltre calcoliamo extra per ogni km aggiuntivo)
    if (perKm > 0) {
        const extraKm = Math.max(0, km - s.delivery_fee_per_km)
        return round2(base + extraKm * perKm)
    }

    return base
}

/**
 * Verifica se l’indirizzo del cliente è entro il raggio di consegna.
 */
export function validateDelivery(distanceKm: number, s: StoreSettings): { ok: boolean; reason?: string } {
    if (!s.delivery_enabled) {
        return { ok: false, reason: 'Consegna disabilitata' }
    }
    const km = Math.max(0, Number(distanceKm) || 0)
    const maxKmSafe = normalizeDeliveryMaxKm((s as any).delivery_max_km)
    if (maxKmSafe !== null && km > maxKmSafe) {
        return {
            ok: false,
            reason: `⚠️ L’indirizzo è fuori dal raggio massimo di consegna (${maxKmSafe} km)`,
        }
    }
    return { ok: true }
}

/**
 * Calcola automaticamente la distanza tra il negozio e l’indirizzo del cliente.
 * Ritorna 0 se non è stato possibile calcolare.
 */
export async function getClientDistanceKm(
    store: StoreSettings,
    clientAddress: { line1: string; city: string; cap: string; }
): Promise<number> {
    if (!clientAddress.line1 || !clientAddress.city || !clientAddress.cap) return 0

    const fullAddress = `${clientAddress.line1}, ${clientAddress.cap} ${clientAddress.city}`
    const coords = await geocodeAndGetCoords(fullAddress)

    if (!coords) return 0

    return round2(
        computeDistanceFromStore(
            { ...store },
            coords
        )
    )
}

// wrapper per riutilizzare geocodeAddress e passare l’oggetto giusto
async function geocodeAndGetCoords(fullAddress: string): Promise<Coordinates | null> {
    return await import('./geo').then(m => m.geocodeAddress(fullAddress))
}

/**
 * Restituisce i metodi di pagamento abilitati dal negozio
 */
export function allowedPaymentMethods(s: StoreSettings): PaymentMethod[] {
    return s.payment_methods
}
