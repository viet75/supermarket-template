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
  show = true, // ✅ opzionale: default = visibile
}: {
  activeId: string | null
  onChange: (id: string | null) => void
  show?: boolean
}) {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    const supabase = supabaseClient()

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .is('deleted_at', null)
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

    // 🔁 Realtime: ricarica sempre se cambia qualcosa
    const channel = supabase
      .channel('realtime:categories')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        (_payload: RealtimePostgresChangesPayload<Category>) => load()
      )
      .subscribe()

    // 🔹 Polling fallback
    const interval = setInterval(load, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  return (
    <div
      className={[
        'relative overflow-hidden [overflow-anchor:none]',
        'transition-[height] duration-300 ease-in-out',
        show ? 'h-11' : 'h-0',
      ].join(' ')}
    >
      <div
        className={[
          'absolute inset-0 transform-gpu will-change-transform',
          'transition-[transform,opacity] duration-300 ease-in-out',
          '[-webkit-backface-visibility:hidden] [backface-visibility:hidden]',
          show ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0 pointer-events-none',
        ].join(' ')}
      >
        <CategoryChips categories={categories} activeId={activeId} onChange={onChange} />
      </div>
    </div>
  )
}
