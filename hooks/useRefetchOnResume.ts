'use client'

import { useEffect, useRef } from 'react'

/**
 * Hook that automatically calls refetch() when the app returns to the foreground
 * (when the user returns to the app on mobile or when the window gains focus).
 * 
 * @param refetch - Function to call when the app returns visible
 */
export function useRefetchOnResume(refetch: () => void) {
    const refetchRef = useRef(refetch)
    const lastRunRef = useRef<number>(0)

    // Always keep the most recent version of refetch
    useEffect(() => {
        refetchRef.current = refetch
    }, [refetch])

    useEffect(() => {
        // Helper function with timeout guard to avoid double refetch
        const executeRefetch = () => {
            const now = Date.now()
            const timeSinceLastRun = now - lastRunRef.current

            // Ignore if called within 500ms of the last execution
            if (timeSinceLastRun < 500) {
                return
            }

            lastRunRef.current = now
            refetchRef.current()
        }

        // Helper function to check if the document is visible and call refetch
        const handleVisibilityChange = () => {
            if (document.hidden === false) {
                executeRefetch()
            }
        }

        // Helper function to handle window focus
        const handleFocus = () => {
            executeRefetch()
        }

        // Listen to visibility changes (useful on mobile when returning from the switcher)
        document.addEventListener('visibilitychange', handleVisibilityChange)

        // Listen to window focus (useful on desktop and mobile)
        window.addEventListener('focus', handleFocus)

        // Cleanup
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('focus', handleFocus)
        }
    }, []) // Empty array: setup only on mount, cleanup on unmount
}
