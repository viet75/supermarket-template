import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseServer } from '@/lib/supabaseServer'
import { formatPrice } from '@/lib/pricing'
import { getUnitLabel } from '@/lib/stock'
import AddToCartControls from '@/components/AddToCartControls'
import StockIndicator from '@/components/StockIndicator'
import { getTranslations } from 'next-intl/server'

type Params = { params: Promise<{ locale: string; id: string }> }

export const revalidate = 0
export const dynamic = 'force-dynamic'

function getProductImage(product: Record<string, unknown>): string {
  const imageUrl = product?.image_url
  if (typeof imageUrl === 'string' && imageUrl.trim()) return imageUrl.trim()

  const images = product?.images
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0]
    if (typeof first === 'string' && first.trim()) return first.trim()
    if (first && typeof first === 'object' && 'url' in first) {
      const url = (first as { url?: string }).url
      if (typeof url === 'string' && url.trim()) return url.trim()
    }
  }

  const image = product?.image
  if (typeof image === 'string' && image.trim()) return image.trim()

  return '/placeholder-product.png'
}

export default async function ProductPage({ params }: Params) {
  const t = await getTranslations('product')
  const { id: key, locale } = await params
  const sb = supabaseServer()

  // A) Search by slug
  let result = await sb
    .from('products')
    .select('*')
    .eq('slug', key)
    .eq('is_active', true)
    .eq('archived', false)
    .is('deleted_at', null)
    .maybeSingle()

  let product = result.data

  // B) If not found, search by id (UUID)
  if (!product) {
    result = await sb
      .from('products')
      .select('*')
      .eq('id', key)
      .eq('is_active', true)
      .eq('archived', false)
      .is('deleted_at', null)
      .maybeSingle()

    product = result.data
  }

  if (!product) {
    notFound()
  }

  const row = product as Record<string, unknown>
  const heroImage = getProductImage(row)
  const base = Number(row?.price ?? 0)
  const priceSale = row?.price_sale != null ? Number(row.price_sale) : null
  const hasSale = priceSale != null && !Number.isNaN(priceSale) && priceSale > 0 && priceSale < base
  const effective = hasSale ? priceSale : base

  return (
    <div className="min-h-dvh bg-white dark:bg-zinc-900">
      <div className="
  mx-auto
  max-w-6xl
  px-4
  py-6
  pb-24
  rounded-2xl
  border
  border-gray-200
  dark:border-zinc-800
  shadow-sm
  bg-white
  dark:bg-zinc-900
">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-zinc-400 hover:text-green-600 dark:hover:text-green-400 mb-4"
        >
          ← {t('backToStore')}
        </Link>

        <article className="
          rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden

          lg:grid
          lg:grid-cols-2
          lg:gap-8
          lg:items-start
        ">
          {/* Hero image */}
          <div className="relative aspect-square w-full overflow-hidden bg-gray-50 dark:bg-zinc-900 lg:aspect-auto">
            {hasSale && (
              <span className="absolute left-3 top-3 z-10 rounded-full bg-green-500/90 px-3 py-1 text-xs font-medium text-white shadow">
                {t('offerBadge')}
              </span>
            )}
            <img
              src={heroImage}
              alt={String(row.name ?? '')}
              className="
                h-full w-full object-cover

                lg:h-auto
                lg:max-h-[70vh]
                lg:object-contain
              "
              style={{ viewTransitionName: `pimg-${row.id}` } as React.CSSProperties}
            />
          </div>

          <div className="p-4 md:p-6 flex flex-col gap-3">
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-zinc-100">
              {String(row.name ?? '')}
            </h1>

            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
                {formatPrice(effective)}
              </span>

              <span className="text-sm text-gray-500 dark:text-zinc-400">
                / {getUnitLabel(row as any, locale)}
              </span>

              {hasSale && (
                <span className="text-sm text-gray-500 dark:text-zinc-400 line-through ml-1">
                  {formatPrice(base)}
                </span>
              )}
            </div>

            <StockIndicator product={row as any} className="mt-3" />

            {row.description != null && String(row.description).trim() !== '' && (
              <div className="text-sm text-gray-600 dark:text-zinc-300 whitespace-pre-wrap">
                {String(row.description)}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800">
              <AddToCartControls p={row as any} img={heroImage} />
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
