import { supabaseServer } from '@/lib/supabaseServer'
import StoreClient from './StoreClient'
import type { Metadata } from 'next' // 👈 rimesso come nel tuo originale

export const revalidate = 0

export default async function Page() {
  const sb = supabaseServer()

  // categorie
  const { data: categories } = await sb
    .from('categories')
    .select('id, name')
    .order('name', { ascending: true })

  // prodotti
  // prodotti
  const { data: products } = await sb
    .from('products')
    .select(
      'id, name, description, price, price_sale, image_url, category_id, stock, is_active, sort_order, unit_type'
    )
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })


  return (
    <StoreClient products={products ?? []} categories={categories ?? []} />
  )
}
