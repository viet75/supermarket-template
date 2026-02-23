// lib/qty.ts
const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000

function formatNumberIT(n: number, maxDecimals: number) {
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(n)
}

export function formatQty(
  qty: number,
  unitType?: 'per_unit' | 'per_kg' | null,
  _qtyStep?: number | null
): string {
  if (unitType !== 'per_kg') {
    return `${Math.round(qty)}`
  }

  const q = round3(qty)
  return `${formatNumberIT(q, 3)} kg`
}