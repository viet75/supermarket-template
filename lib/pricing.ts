import type { DeliverySettings } from './types';

const DEFAULTS: DeliverySettings = { base: 2.5, per_km: 0.8, free_over: 50, max_km: 10 };

const formatter = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})

/**
 * Formats a number as a price in euros (e.g. €6,49).
 * Avoids floating point issues.
 * Robust against NaN/null/undefined: returns €0,00 if value is not finite.
 */
export function formatPrice(
    value: number | null | undefined,
    locale: string = 'it'
  ): string {
    const n = Number(value)
    if (!Number.isFinite(n)) {
      return locale === 'en' ? '€0.00' : '€0,00'
    }
  
    const formatter = new Intl.NumberFormat(
      locale === 'en' ? 'en-GB' : 'it-IT',
      {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )
  
    return formatter.format(n)
  }

// Back-compat: if called with (distance, subtotal) uses default; if passed cfg, uses cfg.
export function deliveryFeeFor(distanceKm: number, subtotal: number, cfg?: DeliverySettings) {
    const conf = cfg ?? DEFAULTS;
    if (subtotal >= conf.free_over) return 0;
    const km = Math.min(Math.max(distanceKm, 0), conf.max_km);
    const fee = conf.base + conf.per_km * km;
    return Math.round(fee * 10) / 10;
}
