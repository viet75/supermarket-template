export function formatQty(qty: number, unit: 'per_unit' | 'per_kg') {
  const n = Number(qty) || 0

  if (unit === 'per_kg') {
    // max 3 decimali, niente trailing zeros, virgola italiana
    const s = n.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')
    return `${s} kg`
  }

  // per_unit: intero
  const i = Math.round(n)
  return `${i} pz`
}
