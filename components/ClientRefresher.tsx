'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * ClientRefresher
 * Force refresh when the user uses the browser's back/forward arrow
 */
export default function ClientRefresher() {
    const router = useRouter()

    useEffect(() => {
        const handler = () => {
            console.log('🔄 Back/forward → refresh forzato')
            // small delay to ensure Next has completed the restoration
            setTimeout(() => {
                router.refresh()
            }, 100)
        }

        window.addEventListener('popstate', handler)
        return () => window.removeEventListener('popstate', handler)
    }, [router])

    return null
}
