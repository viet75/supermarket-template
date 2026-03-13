// lib/delivery.ts
import type { StoreSettings, PaymentMethod } from '@/lib/types'
import { computeDistanceFromStore, Coordinates } from './geo'

function round2(n: number) {
    return Math.round(n * 100) / 100
}

/** null/undefined/NaN/non-finite => null; otherwise finite number (for delivery_max_km). Unlimited if null. */
export function normalizeDeliveryMaxKm(value: unknown): number | null {
    if (value == null || value === '') return null
    const n = Number(value)
    return n !== n || !Number.isFinite(n) ? null : n
}

/**
 * Calculate the delivery fee based on the distance and the store settings
 * Pure function for calculating the delivery fee
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
        throw new Error('Outside delivery area')
    }

    if (distanceKm <= baseKm) {
        return round2(baseFee)
    }

    const extraKm = Math.ceil(distanceKm - baseKm)
    return round2(baseFee + extraKm * extraFeePerKm)
}

/**
 * Calculate the delivery fee based on the distance and the store settings
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

    // If a fixed cost is expected up to `delivery_fee_per_km` km
    // (e.g. 5€ up to 3 km, then calculate extra per each additional km)
    if (perKm > 0) {
        const extraKm = Math.max(0, km - s.delivery_fee_per_km)
        return round2(base + extraKm * perKm)
    }

    return base
}

/**
 * Verify if the client's address is within the delivery radius.
 */
export function validateDelivery(distanceKm: number, s: StoreSettings): { ok: boolean; reason?: string } {
    if (!s.delivery_enabled) {
        return { ok: false, reason: 'Delivery disabled' }
    }
    const km = Math.max(0, Number(distanceKm) || 0)
    const maxKmSafe = normalizeDeliveryMaxKm((s as any).delivery_max_km)
    if (maxKmSafe !== null && km > maxKmSafe) {
        return {
            ok: false,
            reason: `⚠️ The address is outside the maximum delivery radius (${maxKmSafe} km)`,
        }
    }
    return { ok: true }
}

/**
 * Automatically calculates the distance between the store and the client's address.
 * Returns 0 if the distance cannot be calculated.
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

// wrapper to reuse geocodeAddress and pass the correct object
async function geocodeAndGetCoords(fullAddress: string): Promise<Coordinates | null> {
    return await import('./geo').then(m => m.geocodeAddress(fullAddress))
}

/**
 * Returns the enabled payment methods from the store
 */
export function allowedPaymentMethods(s: StoreSettings): PaymentMethod[] {
    return s.payment_methods
}
