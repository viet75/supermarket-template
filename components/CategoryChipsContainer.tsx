'use client'

import { useEffect, useState, useRef } from 'react'
import { supabaseClient } from '@/lib/supabaseClient'
import CategoryChips from './CategoryChips'
import type { Category } from '@/lib/types'

const SCROLL_THRESHOLD = 10

// Type for Supabase Realtime postgres_changes payload
type RealtimePostgresChangesPayload<T = Record<string, any>> = {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    new: T | null
    old: T | null
    schema: string
    table: string
    commit_timestamp?: string
}

export default function CategoryChipsContainer({
    activeId,
    onChange,
}: {
    activeId: string | null
    onChange: (id: string | null) => void
}) {
    const [categories, setCategories] = useState<Category[]>([])
    const [showBar, setShowBar] = useState(true)
    const lastScrollY = useRef(0)

    // Smart sticky: nascondi su scroll down, mostra su scroll up
    useEffect(() => {
        const handleScroll = () => {
            const current = window.scrollY
            if (current > lastScrollY.current + SCROLL_THRESHOLD) {
                setShowBar(false)
            } else if (current < lastScrollY.current) {
                setShowBar(true)
            }
            lastScrollY.current = current
        }
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    useEffect(() => {
        const supabase = supabaseClient()
        
        const load = async () => {
            try {
                const { data, error } = await supabase
                    .from('categories')
                    .select('*')
                    .is('deleted_at', null) // mostra solo categorie attive
                    .order('name')

                if (error) {
                    console.error('Errore caricamento categorie:', error.message)
                    return
                }

                setCategories(data ?? [])
            } catch (err) {
                console.error('Errore caricamento categorie:', err)
                setCategories([])
            }
        }

        // Prima chiamata
        load()

        // 🔁 Realtime: ascolta tutte le modifiche e ricarica lista filtrata
        const channel = supabase
            .channel('realtime:categories')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'categories' },
                (payload: RealtimePostgresChangesPayload<Category>) => {
                    // Ricarica solo quando cambia deleted_at o viene inserita/eliminata una categoria
                    if (
                        payload.eventType === 'INSERT' ||
                        payload.eventType === 'DELETE' ||
                        payload.eventType === 'UPDATE'
                    ) {
                        load() // 👈 sempre carica di nuovo con filtro attivo
                    }
                }
            )
            .subscribe()

        // 🔹 Polling di fallback ogni 30s
        const interval = setInterval(load, 30000)

        return () => {
            supabase.removeChannel(channel)
            clearInterval(interval)
        }
    }, [])


    return (
        <div
            className={`
                sticky top-14 z-20 -mx-1 -mt-2 mb-2 pt-2
                bg-white dark:bg-gray-900
                transition-[transform,opacity] duration-250 ease-out
                ${showBar
                    ? 'translate-y-0 opacity-100'
                    : '-translate-y-full opacity-0 pointer-events-none'
                }
            `}
        >
            <CategoryChips categories={categories} activeId={activeId} onChange={onChange} />
        </div>
    )
}
