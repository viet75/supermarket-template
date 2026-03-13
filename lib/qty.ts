// lib/qty.ts
const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000

function formatNumber(value: number, locale: 'it' | 'en', maxDecimals: number) {
  return new Intl.NumberFormat(locale === 'it' ? 'it-IT' : 'en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(value)
}

export function formatQty(
  qty: number,
  unitType?: 'per_unit' | 'per_kg' | null,
  _qtyStep?: number | null,
  locale: 'it' | 'en' = 'it'
): string {
  if (unitType !== 'per_kg') {
    const q = Math.round(qty)
    return locale === 'it' ? `${q} pz` : `${q} pcs`
  }

  const q = round3(qty)
  return `${formatNumber(q, locale, 3)} kg`
}