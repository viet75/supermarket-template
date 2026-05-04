/** Minimum cart subtotal required for delivery (store_settings). */

export function getMissingAmount(subtotal: number, min: number): number {
  return Math.max(min - subtotal, 0)
}

export type DeliveryMinOrderSettings = {
  delivery_enabled?: boolean
  delivery_min_order_enabled?: boolean
  delivery_min_order_amount?: number | null
}

export function deliveryMinOrderStatus(
  settings: DeliveryMinOrderSettings | null | undefined,
  subtotal: number
): { active: boolean; missing: number; reached: boolean } {
  if (!settings?.delivery_enabled) {
    return { active: false, missing: 0, reached: false }
  }
  const min = settings.delivery_min_order_amount
  const active =
    !!settings.delivery_min_order_enabled &&
    min != null &&
    Number.isFinite(Number(min)) &&
    Number(min) > 0
  if (!active) {
    return { active: false, missing: 0, reached: false }
  }
  const minN = Number(min)
  const missing = getMissingAmount(subtotal, minN)
  return { active: true, missing, reached: missing === 0 }
}
