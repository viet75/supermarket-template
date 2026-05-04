'use client'

import { useEffect, useState } from 'react'
import type { DeliveryMinOrderSettings } from '@/lib/minOrderDelivery'

export function useStoreDeliveryMinSettings(): DeliveryMinOrderSettings | null {
  const [settings, setSettings] = useState<DeliveryMinOrderSettings | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data: Record<string, unknown>) => {
        if (cancelled || !data || typeof data !== 'object' || 'error' in data) return
        setSettings({
          delivery_enabled: data.delivery_enabled === true,
          delivery_min_order_enabled: Boolean(data.delivery_min_order_enabled),
          delivery_min_order_amount:
            data.delivery_min_order_amount !== null &&
            data.delivery_min_order_amount !== undefined
              ? Number(data.delivery_min_order_amount)
              : null,
        })
      })
      .catch(() => {
        if (!cancelled) setSettings(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return settings
}
