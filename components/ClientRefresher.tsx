'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * ClientRefresher
 * Forza refresh quando l’utente usa la freccia indietro/avanti del browser
 */
export default function ClientRefresher() {
    const router = useRouter()

    useEffect(() => {
        const handler = () => {
            console.log('🔄 Back/forward → refresh forzato')
            // piccolo delay per assicurarsi che Next abbia completato il ripristino
            setTimeout(() => {
                router.refresh()
            }, 100)
        }

        window.addEventListener('popstate', handler)
        return () => window.removeEventListener('popstate', handler)
    }, [router])

    return null
}
