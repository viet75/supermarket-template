'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { supabaseClient } from '@/lib/supabaseClient'
import type { Product, Category } from '@/lib/types'
import { toDisplayStock, getUnitLabel } from '@/lib/stock'
import { formatPrice } from '@/lib/pricing'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import { useLocale, useTranslations } from 'next-intl'

type EditableProduct = Omit<Product, 'price' | 'price_sale'> & {
    price: string | number | null
    price_sale: string | number | null
}

function parsePriceInput(v: unknown): number {
    if (v == null) return NaN
    if (typeof v === 'number') return v
    if (typeof v !== 'string') return NaN
    const s = v.trim().replace(',', '.')
    if (s === '') return NaN
    const n = Number(s)
    return Number.isFinite(n) ? n : NaN
}

function parseOptionalPriceInput(v: unknown): number | null {
    const n = parsePriceInput(v)
    return Number.isFinite(n) ? n : null
}

export default function ProductsAdminPage() {
    const t = useTranslations('adminProducts')
    const locale = useLocale()
    const sb = useMemo(() => supabaseClient(), [])
    const [items, setItems] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState<EditableProduct | null>(null)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)

    // available categories for the dropdown
    const [categories, setCategories] = useState<Category[]>([])
    const [newCategoryName, setNewCategoryName] = useState('')
    const [creatingCategory, setCreatingCategory] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    // filters and search
    const [filterCategory, setFilterCategory] = useState<string>('all')
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [search, setSearch] = useState('')
    // pagination
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(20)
    // archive
    const [showArchived, setShowArchived] = useState(false)

    // upload image
    const [uploadingImage, setUploadingImage] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)






    // 🔎 Search filter + category + status
    const filteredItems = items
        .filter((p) =>
            p.name.toLowerCase().includes(search.toLowerCase())
        )
        .filter((p) => {
            if (filterCategory !== 'all' && p.category_id !== filterCategory) {
                return false
            }
            if (filterStatus === 'active' && !p.is_active) return false
            if (filterStatus === 'hidden' && p.is_active) return false
            if (filterStatus === 'lowstock') {
                const displayStock = toDisplayStock(p)
                if (displayStock == null || displayStock >= 5) {
                    return false
                }
            }
            return true
        })
    // paginated products
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedItems = filteredItems.slice(startIndex, endIndex)

    const totalPages = Math.ceil(filteredItems.length / itemsPerPage)




    // Function to load categories
    const loadCategories = useCallback(async () => {
        try {
            const { data, error } = await sb
                .from('categories')
                .select('id, name, deleted_at') // added deleted_at
                .is('deleted_at', null)         // show only active categories
                .order('name')

            if (error) throw error
            setCategories(data || [])
        } catch (e) {
            console.error('Error loading categories:', e)
        }
    }, [sb])

    // Helper: error PostgREST when the qty_step column is not in the schema cache
    const isQtyStepSchemaError = (err: any) => {
        const msg = String(err?.message ?? err?.error_description ?? err ?? '')
        const code = err?.code
        return (
            code === 'PGRST204' ||
            msg.includes('qty_step') ||
            msg.includes("Could not find the 'qty_step' column")
        )
    }

    // Function to load products
    const loadProducts = useCallback(async () => {
        setLoading(true)
        try {
            const selectWithQtyStep = 'id, name, description, price, price_sale, image_url, images, category_id, stock, stock_unit, unit_type, qty_step, is_active, created_at, sort_order, deleted_at'
            const selectWithoutQtyStep = 'id, name, description, price, price_sale, image_url, images, category_id, stock, stock_unit, unit_type, is_active, created_at, sort_order, deleted_at'

            let base = sb.from('products').select(selectWithQtyStep).order('created_at', { ascending: false })
            const query = showArchived ? base.not('deleted_at', 'is', null) : base.is('deleted_at', null)

            let { data, error } = await query
            if (error && isQtyStepSchemaError(error)) {
                base = sb.from('products').select(selectWithoutQtyStep).order('created_at', { ascending: false })
                const retryQuery = showArchived ? base.not('deleted_at', 'is', null) : base.is('deleted_at', null)
                const retry = await retryQuery
                data = retry.data
                error = retry.error
            }
            if (error) throw error

            // double filter: filter also client-side in case the server filtered badly
            const filtered = (data ?? []).filter((p: Product) =>
                showArchived ? p.deleted_at !== null : p.deleted_at === null
            )

            // diagnose: see what is coming
            console.log('loadProducts', {
                showArchived,
                total: data?.length ?? 0,
                archivedCount: (data ?? []).filter((p: Product) => p.deleted_at !== null).length
            })

            setItems(filtered)
        } catch (e) {
            console.error('Error loading products:', e)
            setItems([])
        } finally {
            setLoading(false)
        }
    }, [sb, showArchived])

    // Function to refetch complete (categories + products)
    const refetchAll = useCallback(() => {
        loadCategories()
        loadProducts()
    }, [loadCategories, loadProducts])

    // Hook for automatic refetch when the app returns to the foreground
    useRefetchOnResume(refetchAll)

    // Load categories at startup
    useEffect(() => {
        loadCategories()
    }, [loadCategories])

    // Load products (active or archive)
    useEffect(() => {
        loadProducts()
    }, [loadProducts])



    async function createCategoryQuick() {
        if (!newCategoryName.trim()) return
        setCreatingCategory(true)
        try {
            const { data, error } = await sb
                .from('categories')
                .insert([{ name: newCategoryName }])
                .select()
                .single()

            if (error) throw error
            if (!data) throw new Error(t('noSupabaseData'))

            setCategories((prev) => [...prev, data])
            setEditing((cur) => (cur ? { ...cur, category_id: data.id } : cur))
            setNewCategoryName('')
            setMessage(`✅ ${t('categoryCreated')}`)
        } catch (e) {
            console.error('Errore creazione categoria:', e)
            alert(t('categoryCreateError'))
        } finally {
            setCreatingCategory(false)
        }
    }

    async function deleteCategoryQuick(id: string) {
        const ok = window.confirm(t('deleteCategoryConfirm'))
        if (!ok) return
        try {
            const { error } = await sb.from('categories').delete().eq('id', id)
            if (error) throw error
            setCategories((prev) => prev.filter(c => c.id !== id))
            setMessage(`🗑️ ${t('categoryDeleted')}`)
        } catch (e) {
            console.error('Errore eliminazione categoria:', e)
            alert(t('categoryDeleteError'))
        }
    }


    // SAVE (create or update)
    async function save() {
        if (!editing) return
        const priceNum = parsePriceInput(editing.price)
        if (!Number.isFinite(priceNum) || priceNum <= 0) {
            alert(`⚠️ ${t('priceRequired')}`)
            return
        }
        setSaving(true)
        try {
            const payload: any = {
                name: editing?.name?.trim() || '',
                description: editing?.description?.trim() || null,
                price: priceNum,
                price_sale: parseOptionalPriceInput(editing.price_sale),

                image_url: editing?.image_url || null,
                category_id: editing?.category_id || null,
                stock: (() => {
                    const val = editing?.stock
                    if (val == null) return null // null or undefined → unlimited stock
                    const strVal = String(val).trim()
                    if (strVal === '') return null // empty string → unlimited stock
                    return Number(val) // numero valido
                })(),
                is_active:
                    typeof editing?.is_active === 'boolean' ? editing.is_active : true,
                sort_order: editing?.sort_order ?? 100,
                unit_type: editing.unit_type,
                qty_step: editing.unit_type === 'per_kg' ? Number(editing.qty_step ?? 1) : 1,
            }

            if (!editing.id) {
                // CREATE
                const res = await fetch('/api/admin/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                const json = await res.json()
                if (!res.ok) throw new Error(json?.error || t('createError'))

                setItems((prev) => [json.product ?? json, ...prev])
            } else {
                // UPDATE via PATCH
                let res
                if (editing?.id) {
                    // ✅ Update existing product
                    res = await fetch('/api/admin/products', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: editing.id, ...payload }),
                    })
                } else {
                    // ✅ Create new product
                    res = await fetch('/api/admin/products', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    })
                }

                const json = await res.json()
                if (!res.ok) throw new Error(json?.error || t('updateError'))

                setItems((prev) =>
                    prev.map((p) =>
                        p.id === editing.id ? json.product ?? json : p
                    )
                )
            }

            setEditing(null)
        } catch (e: any) {
            alert(e?.message || t('saveError'))
        } finally {
            setSaving(false)
        }
    }

    // DELETE
    async function doDelete(id: string) {
        if (!id) return
        const ok = window.confirm(t('archiveConfirm'))
        if (!ok) return

        setDeleting(id)
        try {
            const res = await fetch('/api/admin/products', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            })

            if (!res.ok) {
                const errorText = await res.text()
                console.error('HTTP archive error:', errorText)
                alert(`⚠️ ${t('archiveError')}`)
                return
            }

            const data = await res.json()

            switch (data.status) {
                case 'archived':
                    alert(`📦 ${t('productArchived')}`)
                    setItems(prev => prev.filter(p => p.id !== id)) // remove immediately from the current list
                    break
                case 'already_archived':
                    alert(`ℹ️ ${t('productAlreadyArchived')}`)
                    break
                case 'not_found':
                    alert(`⚠️ ${t('productNotFound')}`)
                    break
                default:
                    alert(`⚠️ ${t('unknownServerResponse')}`)
            }

            setEditing(cur => (cur?.id === id ? null : cur))
        } catch (e) {
            console.error('Archive exception:', e)
            alert(t('archiveUnexpectedError'))
        } finally {
            setDeleting(null)
        }
    }




    return (
        <div className="mx-auto max-w-screen-2xl p-4 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900">

            <header className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {t('title')}
                </h1>

                <button
                    onClick={() =>
                        setEditing({
                            id: '',
                            name: '',
                            description: '',
                            price: '',
                            price_sale: '',
                            image_url: '',
                            images: [],
                            category_id: '',
                            stock: null,
                            is_active: true,
                            sort_order: 100,
                            unit_type: 'per_unit',
                            qty_step: 1,
                        })
                    }
                    className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700"
                >
                    <span className="text-lg">＋</span> {t('newProduct')}
                </button>
            </header>
            {/* Toggle Archive */}
            <div className="mb-4">
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={showArchived}
                        onChange={(e) => setShowArchived(e.target.checked)}
                    />
                    {t('showArchive')}
                </label>
            </div>


            {/* 🔎 Search bar: immediately below the header */}
            <div className="w-full max-w-md mb-6">
                <input
                    type="text"
                    placeholder={t('searchPlaceholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"

                />
            </div>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
                {/* Category filter */}
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"

                >
                    <option value="all">{t('allCategories')}</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>

                {/* Status filter */}
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"

                >
                    <option value="all">{t('filterAll')}</option>
                    <option value="active">{t('filterActive')}</option>
                    <option value="hidden">{t('filterHidden')}</option>
                    <option value="lowstock">{t('filterLowStock')}</option>
                </select>
            </div>




            {/* List of products desktop */}
            {loading ? (
                <p className="text-sm text-gray-500">{t('loading')}</p>
            ) : (
                <>
                    {/* Desktop view */}
                    <ul className="hidden md:block divide-y divide-gray-200 dark:divide-gray-700 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">

                        {paginatedItems.map((p) => {
                            const first = Array.isArray(p.images) ? p.images[0] : null
                            const fromArray =
                                typeof first === 'string'
                                    ? first
                                    : first && typeof first === 'object' && 'url' in (first as any)
                                        ? (first as any).url
                                        : null
                            const thumb = p.image_url || fromArray

                            return (
                                <li key={p.id} className="flex items-center gap-3 p-3 even:bg-gray-50 dark:even:bg-gray-800">

                                    {thumb ? (
                                        <img
                                            src={thumb}
                                            alt=""
                                            className="w-16 h-16 rounded object-cover border"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded bg-gray-100" />
                                    )}

                                    <div className="flex-1">
                                        <div className="font-medium">
                                            {p.name}
                                            {showArchived && (
                                                <span className="ml-2 text-xs text-red-500 font-normal">
                                                    ({t('archived')})
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-sm text-gray-600 dark:text-zinc-400">
                                        {formatPrice(Number(p.price))} / {getUnitLabel(p, locale)}
                                            {p.price_sale ? (
                                                <span className="ml-2 text-gray-500 dark:text-zinc-400 line-through">
                                                    {formatPrice(Number(p.price_sale))} / {getUnitLabel(p, locale)}
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="text-xs text-gray-500 dark:text-zinc-400">
                                            {t('stock')}: {toDisplayStock(p) == null ? t('unlimited') : `${toDisplayStock(p)} ${getUnitLabel(p, locale)}`}
                                        </div>

                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                                                }`}
                                        >
                                            {p.is_active ? t('active') : t('hidden')}
                                        </span>

                                        {p.deleted_at ? (



                                            <button
                                                className="rounded-md border border-green-300 text-green-700 px-3 py-1.5 hover:bg-green-50"
                                                onClick={async () => {
                                                    try {
                                                        // QA: Restore product - must include archived=false, is_active=true, deleted_at=null
                                                        // to avoid the DB trigger blocking order_items on restored products
                                                        const { error } = await sb
                                                            .from('products')
                                                            .update({
                                                                deleted_at: null,
                                                                archived: false,
                                                                is_active: true,
                                                            })
                                                            .eq('id', p.id)
                                                        if (error) {
                                                            console.error('Restore error:', error)
                                                            alert(`⚠️ ${t('restoreError')}`)
                                                            return
                                                        }

                                                        // Remove immediately from the archive list
                                                        setItems(prev => prev.filter(prod => prod.id !== p.id))
                                                        alert(`✅ ${t('productRestored')}`)
                                                    } catch (e) {
                                                        console.error('Restore exception:', e)
                                                        alert(`⚠️ ${t('restoreError')}`)
                                                    }
                                                }}
                                            >
                                                {t('restore')}
                                            </button>

                                        ) : (
                                            <>
                                                <button
                                                    className="rounded-md border px-3 py-1.5 hover:bg-gray-50"
                                                    onClick={() => {
                                                        const displayStock = toDisplayStock(p)
                                                        setEditing({
                                                            ...p,
                                                            stock: displayStock,
                                                            price: p.price ?? "",
                                                            price_sale: p.price_sale ?? "",
                                                            qty_step: (p as any).qty_step ?? (p.unit_type === 'per_kg' ? 1 : 1),
                                                        })
                                                    }}
                                                >
                                                    {t('edit')}
                                                </button>
                                                <button
                                                    className="rounded-md border border-red-300 text-red-700 px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
                                                    onClick={() => p.id && doDelete(p.id)}
                                                    disabled={deleting === p.id}
                                                >
                                                    {deleting === p.id ? t('deleting') : t('delete')}
                                                </button>
                                            </>
                                        )}
                                    </div>


                                </li>
                            )
                        })}
                    </ul>



                    {/* Mobile view */}
                    <div className="space-y-4 md:hidden">
                        {paginatedItems.map((p) => {
                            const first = Array.isArray(p.images) ? p.images[0] : null
                            const fromArray =
                                typeof first === 'string'
                                    ? first
                                    : first && typeof first === 'object' && 'url' in (first as any)
                                        ? (first as any).url
                                        : null
                            const thumb = p.image_url || fromArray

                            return (
                                <div key={p.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm bg-white dark:bg-gray-900">

                                    <div className="flex items-center gap-3">
                                        {thumb ? (
                                            <img
                                                src={thumb}
                                                alt=""
                                                className="w-20 h-20 rounded object-cover border"
                                            />
                                        ) : (
                                            <div className="w-20 h-20 rounded bg-gray-100" />
                                        )}

                                        <div className="flex-1">
                                            <div className="font-semibold">
                                                {p.name}
                                                {showArchived && (
                                                    <span className="ml-2 text-xs text-red-500 font-normal">({t('archived')})</span>
                                                )}
                                            </div>

                                            <div className="text-sm text-gray-600 dark:text-zinc-400">
                                                {formatPrice(Number(p.price))} / {getUnitLabel(p, locale)}
                                                {p.price_sale ? (
                                                    <span className="ml-2 text-gray-500 dark:text-zinc-400 line-through">
                                                        {formatPrice(Number(p.price_sale))} / {getUnitLabel(p, locale)}
                                                    </span>
                                                ) : null}
                                            </div>

                                            <div className="text-xs text-gray-500 dark:text-zinc-400">
                                            Stock: {toDisplayStock(p) == null ? t('unlimited') : `${toDisplayStock(p)} ${getUnitLabel(p, locale)}`}
                                            </div>

                                            <span
                                                className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-xs ${p.is_active
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : 'bg-gray-100 text-gray-600'
                                                    }`}
                                            >
                                                {p.is_active ? t('active') : t('hidden')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex gap-2">
                                        {p.deleted_at ? (


                                            <button
                                                className="flex-1 rounded-md border border-green-300 text-green-700 px-3 py-2 hover:bg-green-50 text-sm"
                                                onClick={async () => {
                                                    try {
                                                        // QA: Restore product - must include archived=false, is_active=true, deleted_at=null
                                                        // to avoid the DB trigger blocking order_items on restored products
                                                        const { data, error } = await sb
                                                            .from('products')
                                                            .update({
                                                                deleted_at: null,
                                                                archived: false,
                                                                is_active: true,
                                                            })
                                                            .eq('id', p.id)
                                                            .select()
                                                            .single()

                                                        if (error) {
                                                            console.error('Restore error:', error)
                                                            alert(`⚠️ ${t('restoreError')}`)
                                                            return
                                                        }

                                                        if (data) {
                                                            setItems((prev) =>
                                                                prev.map((prod) =>
                                                                    prod.id === p.id ? data : prod
                                                                )
                                                            )
                                                        }
                                                        alert(`✅ ${t('productRestored')}`)
                                                    } catch (e) {
                                                        console.error('Restore exception:', e)
                                                        alert(`⚠️ ${t('restoreError')}`)
                                                    }
                                                }}
                                            >
                                                {t('restore')}
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    className="flex-1 rounded-md border px-3 py-2 hover:bg-gray-50 text-sm"
                                                    onClick={() => {
                                                        const displayStock = toDisplayStock(p)
                                                        setEditing({
                                                            ...p,
                                                            stock: displayStock,
                                                            price: p.price ?? "",
                                                            price_sale: p.price_sale ?? "",
                                                            qty_step: (p as any).qty_step ?? (p.unit_type === 'per_kg' ? 1 : 1),
                                                        })
                                                    }}
                                                >
                                                    {t('edit')}
                                                </button>
                                                <button
                                                    className="flex-1 rounded-md border border-red-300 text-red-700 px-3 py-2 hover:bg-red-50 disabled:opacity-50 text-sm"
                                                    onClick={() => p.id && doDelete(p.id)}
                                                    disabled={deleting === p.id}
                                                >
                                                    {deleting === p.id ? t('deleting') : t('delete')}
                                                </button>
                                            </>
                                        )}
                                    </div>


                                </div>
                            )
                        })}
                    </div>
                    {/* Pagination controls */}
                    {!loading && filteredItems.length > 0 && (
                        <div className="flex items-center justify-between mt-6">
                            {/* Mobile: Previous / Next */}
                            <div className="flex w-full justify-between md:hidden">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    className="px-3 py-2 text-sm rounded-md border disabled:opacity-50"
                                >
                                    ← Previous
                                </button>
                                <button
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    className="px-3 py-2 text-sm rounded-md border disabled:opacity-50"
                                >
                                    Next →
                                </button>
                            </div>

                            {/* Desktop: page numbers */}
                            <div className="hidden md:flex gap-2">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`px-3 py-2 text-sm rounded-md border ${currentPage === page
                                            ? 'bg-green-600 text-white border-green-600'
                                            : 'hover:bg-gray-100'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>

                            {/* Desktop: select products per page */}
                            <div className="hidden md:block">
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value))
                                        setCurrentPage(1) // reset to the first page
                                    }}
                                    className="rounded-md border px-2 py-1 text-sm"
                                >
                                    <option value={20}>20 per page</option>
                                    <option value={50}>50 per page</option>
                                    <option value={100}>100 per page</option>
                                </select>
                            </div>
                        </div>
                    )}



                </>
            )}


            {/* Modal edit/new */}
            {editing && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
                    <div className="w-full max-w-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6 rounded shadow-lg max-h-[80vh] overflow-y-auto">


                        <div className="flex items-center justify-between px-4 pt-4">
                            <h2 className="text-lg font-semibold">
                                {editing.id ? t('editProduct') : t('newProduct')}
                            </h2>
                        </div>

                        <div className="px-4 pb-4 pt-2">
                            <div className="space-y-4">
                                {/* Info base */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium">{t('productName')}</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"

                                        value={editing.name ?? ''}
                                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                    />

                                    <label className="block text-sm font-medium">{t('description')}</label>
                                    <textarea
                                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"

                                        rows={3}
                                        value={editing.description ?? ''}
                                        onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                                    />
                                </div>

                                {/* Prezzi */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium">{t('price')} (€)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"
                                            value={editing.price == null || editing.price === '' ? '' : String(editing.price)}
                                            onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium">{t('salePrice')} (€)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="opzionale"
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"
                                            value={editing.price_sale == null || editing.price_sale === '' ? '' : String(editing.price_sale)}
                                            onChange={(e) => setEditing({ ...editing, price_sale: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-400">
                                        {t('unitType')}
                                    </label>
                                    <select
                                        value={editing?.unit_type || 'per_unit'}
                                        onChange={(e) => {
                                            const u = e.target.value as 'per_unit' | 'per_kg'
                                            setEditing((prev) =>
                                                prev ? { ...prev, unit_type: u, qty_step: u === 'per_kg' ? (prev.qty_step ?? 1) : 1 } : prev
                                            )
                                        }}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                    >
                                        <option value="per_unit">{t('perUnit')}</option>
                                        <option value="per_kg">{t('perKg')}</option>
                                    </select>
                                </div>

                                {editing?.unit_type === 'per_kg' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-400">{t('purchaseStep')}</label>
                                        <select
                                            value={editing.qty_step ?? 1}
                                            onChange={(e) =>
                                                setEditing((prev) => (prev ? { ...prev, qty_step: Number(e.target.value) } : prev))
                                            }
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                        >
                                            <option value={1}>1 kg</option>
                                            <option value={0.5}>0,5 kg</option>
                                            <option value={0.25}>0,25 kg</option>
                                            <option value={0.1}>0,1 kg</option>
                                        </select>
                                    </div>
                                )}

                                {/* Image */}
                                <fieldset className="rounded-xl border border-gray-200 p-3">
                                    <legend className="px-1 text-sm font-medium text-gray-700 dark:text-zinc-400">{t('image')}</legend>

                                    {/* Hidden file input */}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0]
                                            if (!file) return

                                            // Validations (same logic as AdminImageUploader)
                                            if (!file.type.startsWith('image/')) {
                                                setUploadError(t('imageOnly'))
                                                return
                                            }
                                            if (file.size > 5 * 1024 * 1024) {
                                                setUploadError(t('imageTooLarge'))
                                                return
                                            }
                                            setUploadError(null)
                                            setUploadingImage(true)

                                            try {
                                                const fd = new FormData()
                                                fd.append('file', file)

                                                const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
                                                const json = await res.json()
                                                if (!res.ok || !json?.url) throw new Error(json?.error || t('uploadFailed'))

                                                setEditing({ ...editing, image_url: json.url })
                                            } catch (err: any) {
                                                setUploadError(err?.message || t('uploadError'))
                                            } finally {
                                                setUploadingImage(false)
                                            }
                                        }}
                                        disabled={uploadingImage}
                                    />

                                    {/* Clickable dropzone */}
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`
                                            relative mt-2 rounded-lg border-2 border-dashed
                                            ${editing.image_url
                                                ? 'border-gray-300 dark:border-gray-600'
                                                : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'
                                            }
                                            cursor-pointer transition-all hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20
                                            ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}
                                        `}
                                    >
                                        {editing.image_url ? (
                                            <>
                                                {/* Preview image */}
                                                <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                                                    <img
                                                        src={editing.image_url}
                                                        alt={t('preview')}
                                                        className="h-full w-full object-cover"
                                                    />
                                                    {/* Overlay "Change image" */}
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                                                        <span className="text-white font-medium">{t('changeImage')}</span>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            /* Placeholder when there is no image */
                                            <div className="flex flex-col items-center justify-center py-12 px-4">
                                                <svg
                                                    className="w-12 h-12 text-gray-400 mb-3"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                                    />
                                                </svg>
                                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                {t('clickToUpload')}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    JPG/PNG (max 5MB)
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Status messages */}
                                    {uploadingImage && (
                                        <p className="text-sm text-gray-500 mt-2">{t('imageUploading')}</p>
                                    )}
                                    {uploadError && (
                                        <p className="text-sm text-red-600 mt-2">{uploadError}</p>
                                    )}

                                    {/* Remove image button */}
                                    {editing.image_url && (
                                        <button
                                            type="button"
                                            className="mt-3 text-sm text-red-600 hover:underline"
                                            onClick={() => setEditing({ ...editing, image_url: '' })}
                                        >
                                            {t('removeImage')}
                                        </button>
                                    )}
                                </fieldset>

                                {/* Category & Stock */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        {/* Categoria */}
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium">{t('category')}</label>
                                            <select
                                                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"

                                                value={editing.category_id ?? ''}
                                                onChange={(e) =>
                                                    setEditing({ ...editing!, category_id: e.target.value || null })
                                                }
                                            >
                                                <option value="">{t('noCategory')}</option>
                                                {categories.map(c => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium">Stock ({getUnitLabel(editing, locale)})</label>
                                        <input
                                            type="number"
                                            min={0}
                                            step={editing.unit_type === 'per_kg' ? (Number(editing.qty_step) || 0.1) : 1}
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"

                                            value={editing.stock ?? ''} // '' when null (value already in display format)
                                            onChange={(e) => {
                                                const val = e.target.value
                                                setEditing({
                                                    ...editing,
                                                    stock: val === '' ? null : Number(val),
                                                })
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium">{t('sortOrder')}</label>
                                        <input
                                            type="number"
                                            min={0}
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"

                                            value={editing?.sort_order ?? 100}
                                            onChange={(e) =>
                                                setEditing({
                                                    ...editing!,
                                                    sort_order: e.target.value === '' ? 100 : Number(e.target.value),
                                                })
                                            }
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Number to order products in the shop (1 = at the top).
                                        </p>
                                    </div>


                                </div>

                                {/* Status */}
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(editing.is_active ?? true)}
                                        onChange={(e) =>
                                            setEditing({
                                                ...editing,
                                                is_active: e.target.checked,
                                            })
                                        }
                                    />
                                    <span className="text-sm">{t('activeVisible')}</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-3">
                            {/* Delete in the modal (only if id exists) */}
                            {editing.id ? (
                                <button
                                    className="rounded-md border border-red-300 text-red-700 px-3 py-2 hover:bg-red-50 disabled:opacity-50"
                                    onClick={() => editing.id && doDelete(editing.id)}
                                    disabled={deleting === editing.id}
                                >
                                    {deleting === editing.id ? 'Deletion…' : 'Delete'}
                                </button>
                            ) : (
                                <span />
                            )}

                            <div className="flex items-center gap-2">
                                <button
                                    className="rounded-md border px-3 py-2 hover:bg-gray-50"
                                    onClick={() => setEditing(null)}
                                    disabled={saving || (editing.id ? deleting === editing.id : false)}
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    className="rounded-md bg-black text-white px-3 py-2 disabled:opacity-60"
                                    onClick={save}
                                    disabled={saving || (editing.id ? deleting === editing.id : false)}
                                >
                                    {saving ? t('saving') : t('save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
