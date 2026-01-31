'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Hook che chiama una callback quando l'app torna in foreground
 * (visibilitychange o window focus).
 * Usa throttle per evitare spam (default 3000ms).
 *
 * @param refresh - Funzione da chiamare (es. fetchProducts, router.refresh)
 * @param minIntervalMs - Intervallo minimo tra chiamate (default 3000)
 */
export function useForegroundRefresh(
    refresh: () => void | Promise<void>,
    minIntervalMs = 3000
) {
    const refreshRef = useRef(refresh)
    const lastRunRef = useRef<number>(0)

    useEffect(() => {
        refreshRef.current = refresh
    }, [refresh])

    const execute = useCallback(() => {
        const now = Date.now()
        if (now - lastRunRef.current < minIntervalMs) return
        lastRunRef.current = now
        void Promise.resolve(refreshRef.current()).catch(() => {})
    }, [minIntervalMs])

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') execute()
        }

        const handleFocus = () => execute()

        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('focus', handleFocus)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('focus', handleFocus)
        }
    }, [execute])
}
