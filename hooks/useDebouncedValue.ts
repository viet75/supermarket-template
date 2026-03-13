import { useState, useEffect } from 'react'

/**
 * Hook that returns a "debounced" value
 * i.e. updated only after the user stops writing for a certain delay
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value)

    useEffect(() => {
        const handler = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(handler)
    }, [value, delay])

    return debounced
}
