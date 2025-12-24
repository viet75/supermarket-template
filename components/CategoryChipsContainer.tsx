'use client'

import { useEffect, useState } from 'react'
import { supabaseClient } from '@/lib/supabaseClient'
import CategoryChips from './CategoryChips'
import type { Category } from '@/lib/types'

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
        <CategoryChips categories={categories} activeId={activeId} onChange={onChange} />
    )
}
