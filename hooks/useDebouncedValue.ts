import { useState, useEffect } from 'react'

/**
 * Hook che restituisce un valore "debounced"
 * cioè aggiornato solo dopo che l'utente smette di scrivere per un certo delay
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value)

    useEffect(() => {
        const handler = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(handler)
    }, [value, delay])

    return debounced
}
