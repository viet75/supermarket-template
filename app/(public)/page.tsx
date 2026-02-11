import { supabaseServer } from '@/lib/supabaseServer'
import StoreClient from '@/app/(public)/StoreClient'
import type { Metadata } from 'next' // 👈 rimesso come nel tuo originale

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function Page() {
  const sb = supabaseServer()

  // categorie
  const { data: categories, error: categoriesError } = await sb
    .from('categories')
    .select('id, name, sort_order')
    .order('name', { ascending: true })

  if (categoriesError) {
    console.error('❌ Errore caricamento categorie:', categoriesError)
  }

  // prodotti
  let products: any[] | null = null
  let productsError: any = null

  try {
    // Seleziona tutte le colonne disponibili
    const result = await sb
      .from('products')
      .select('*')
      .eq('is_active', true)      // <-- fix: mostra solo prodotti attivi
      .eq('archived', false)       // <-- fix: esclude prodotti archiviati (bloccati da trigger DB)
      .is('deleted_at', null)      // <-- fix: esclude prodotti soft-deleted
      .order('name', { ascending: true })

    products = result.data
    productsError = result.error

    if (productsError) {
      console.error('❌ Errore caricamento prodotti:', productsError.message)
    }

    if (products) {
      // Ordina manualmente per sort_order e poi name
      products.sort((a, b) => {
        const sortA = a.sort_order ?? 999
        const sortB = b.sort_order ?? 999
        if (sortA !== sortB) return sortA - sortB
        return (a.name || '').localeCompare(b.name || '')
      })
    }
  } catch (err: any) {
    productsError = err
    console.error('❌ Eccezione caricamento prodotti:', err?.message)
  }

  return (
    <StoreClient products={products ?? []} categories={categories ?? []} />
  )
}
