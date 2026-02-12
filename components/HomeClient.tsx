'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabaseClient } from '@/lib/supabaseClient'
import SearchBar from '@/components/SearchBar'
import CategoryChipsContainer from '@/components/CategoryChipsContainer'
import ProductCard from '@/components/ProductCard'
import CartBar from '@/components/CartBar'
import SkeletonCard from '@/components/SkeletonCard'
import Toast from '@/components/Toast'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

type Product = {
  id: string
  name: string
  price: number
  price_sale?: number | null
  unit_type?: 'per_unit' | 'per_kg'
  images?: any[]
  category_id?: string | null
}

export default function HomeClient() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const qDebounced = useDebouncedValue(q, 300)

  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const sb = supabaseClient()
      try {
        const { data: prods, error: prodErr } = await sb
          .from('products')
          .select('id,name,price,price_sale,unit_type,images,category_id,is_active')
          .eq('is_active', true)
          .eq('archived', false)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })

        if (prodErr) console.error('Prodotti ERR', prodErr)
        setProducts(prods ?? [])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const filtered = useMemo(() => {
    let list = products ?? []
    if (cat) list = list.filter((p) => p.category_id === cat)
    const k = qDebounced.trim().toLowerCase()
    if (k) list = list.filter((p) => p.name.toLowerCase().includes(k))
    return list
  }, [products, qDebounced, cat])

  return (
    <>
      {/* Search sempre sticky */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="px-3 pt-2">
          <SearchBar onChange={setQ} />
        </div>
      </div>

      {/* Categorie smart sticky (gestite SOLO dal container) */}
      <CategoryChipsContainer activeId={cat} onChange={setCat} />

      {loading ? (
        <div className="mx-auto max-w-screen-2xl w-full px-3 pb-24">
          <div
            className="
              grid gap-2 md:gap-4 lg:gap-6
              grid-cols-2
              sm:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]
              md:[grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]
            "
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-screen-2xl w-full px-3 pb-24">
          <div
            className="
              grid gap-2 md:gap-4 lg:gap-6
              grid-cols-2
              sm:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]
              md:[grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]
            "
          >
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                p={p}
                onAdded={(name) => setToast(`${name} aggiunto al carrello`)}
              />
            ))}

            {!filtered.length && (
              <div className="col-span-full text-center text-gray-500 py-8">
                Nessun prodotto trovato
              </div>
            )}
          </div>
        </div>
      )}

      <CartBar onCheckout={() => location.assign('/checkout')} />
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  )
}
