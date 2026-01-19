'use client'

import { useEffect, useRef } from 'react'

/**
 * Hook che chiama automaticamente refetch() quando l'app torna in foreground
 * (quando l'utente torna all'app su mobile o quando la finestra riprende focus).
 * 
 * @param refetch - Funzione da chiamare quando l'app torna visibile
 */
export function useRefetchOnResume(refetch: () => void) {
    const refetchRef = useRef(refetch)
    const lastRunRef = useRef<number>(0)

    // Mantiene sempre la versione più recente di refetch
    useEffect(() => {
        refetchRef.current = refetch
    }, [refetch])

    useEffect(() => {
        // Funzione helper con guard temporale per evitare doppio refetch
        const executeRefetch = () => {
            const now = Date.now()
            const timeSinceLastRun = now - lastRunRef.current

            // Ignora se chiamata entro 500ms dall'ultima esecuzione
            if (timeSinceLastRun < 500) {
                return
            }

            lastRunRef.current = now
            refetchRef.current()
        }

        // Funzione helper che verifica se il documento è visibile e chiama refetch
        const handleVisibilityChange = () => {
            if (document.hidden === false) {
                executeRefetch()
            }
        }

        // Funzione helper per il focus della finestra
        const handleFocus = () => {
            executeRefetch()
        }

        // Ascolta i cambiamenti di visibilità (utile su mobile quando si torna dallo switcher)
        document.addEventListener('visibilitychange', handleVisibilityChange)

        // Ascolta il focus della finestra (utile su desktop e mobile)
        window.addEventListener('focus', handleFocus)

        // Cleanup
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('focus', handleFocus)
        }
    }, []) // Array vuoto: setup solo al mount, cleanup al unmount
}
