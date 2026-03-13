import { supabaseServer } from '@/lib/supabaseServer'
import StoreClient from '@/app/(public)/StoreClient'
import type { Metadata } from 'next' 

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function Page() {
  const sb = supabaseServer()

  // categories
  const { data: categories, error: categoriesError } = await sb
    .from('categories')
    .select('id, name, sort_order')
    .order('name', { ascending: true })

  if (categoriesError) {
    console.error('❌ Error loading categories:', categoriesError)
  }

  // products
  let products: any[] | null = null
  let productsError: any = null

  try {
    // Select all available columns
    const result = await sb
      .from('products')
      .select('*')
      .eq('is_active', true)      // <-- fix: show only active products
      .eq('archived', false)       // <-- fix: exclude archived products (blocked by DB trigger)
      .is('deleted_at', null)      // <-- fix: exclude soft-deleted products
      .order('name', { ascending: true })

    products = result.data
    productsError = result.error

    if (productsError) {
      console.error('❌ Error loading products:', productsError.message)
    }

    if (products) {
      // Manually sort by sort_order and then name
      products.sort((a, b) => {
        const sortA = a.sort_order ?? 999
        const sortB = b.sort_order ?? 999
        if (sortA !== sortB) return sortA - sortB
        return (a.name || '').localeCompare(b.name || '')
      })
    }
  } catch (err: any) {
    productsError = err
    console.error('❌ Products loading exception:', err?.message)
  }

  return (
    <StoreClient products={products ?? []} categories={categories ?? []} />
  )
}
