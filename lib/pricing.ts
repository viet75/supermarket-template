import type { DeliverySettings } from './types';

const DEFAULTS: DeliverySettings = { base: 2.5, per_km: 0.8, free_over: 50, max_km: 10 };

const formatter = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})

/**
 * Formatta un numero come prezzo in euro (es. €6,49).
 * Evita problemi di floating point.
 * Robusta contro NaN/null/undefined: restituisce €0,00 se valore non finito.
 */
export function formatPrice(value: number | null | undefined): string {
    const n = Number(value)
    if (!Number.isFinite(n)) return '€0,00'
    return formatter.format(n)
}

// Back-compat: se chiami con (distance, subtotal) usa default; se passi cfg, usa cfg.
export function deliveryFeeFor(distanceKm: number, subtotal: number, cfg?: DeliverySettings) {
    const conf = cfg ?? DEFAULTS;
    if (subtotal >= conf.free_over) return 0;
    const km = Math.min(Math.max(distanceKm, 0), conf.max_km);
    const fee = conf.base + conf.per_km * km;
    return Math.round(fee * 10) / 10;
}
