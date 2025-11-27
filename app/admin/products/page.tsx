'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminImageUploader from '@/components/AdminImageUploader'
import { supabaseClient } from '@/lib/supabaseClient'
import type { Product, Category } from '@/lib/types'


export default function ProductsAdminPage() {
    const sb = useMemo(() => supabaseClient(), [])
    const [items, setItems] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState<Product | null>(null)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)

    // categorie disponibili per il dropdown
    const [categories, setCategories] = useState<Category[]>([])
    const [newCategoryName, setNewCategoryName] = useState('')
    const [creatingCategory, setCreatingCategory] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    // filtri e ricerca
    const [filterCategory, setFilterCategory] = useState<string>('all')
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [search, setSearch] = useState('')
    // paginazione
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(20)
    // archivio
    const [showArchived, setShowArchived] = useState(false)






    // 🔎 Filtro ricerca + categoria + stato
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
            if (filterStatus === 'lowstock' && (p.stock == null || p.stock >= 5)) {
                return false
            }
            return true
        })
    // prodotti paginati
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedItems = filteredItems.slice(startIndex, endIndex)

    const totalPages = Math.ceil(filteredItems.length / itemsPerPage)




    // Carica categorie all’avvio
    useEffect(() => {
        (async () => {
            try {
                const { data, error } = await sb
                    .from('categories')
                    .select('id, name, deleted_at') // aggiunto deleted_at
                    .is('deleted_at', null)         // mostra solo categorie attive
                    .order('name')


                if (error) throw error
                setCategories(data || [])
            } catch (e) {
                console.error('Errore caricamento categorie:', e)
            }
        })()
    }, [sb])

    // Carica prodotti (attivi o archivio)
    useEffect(() => {
        let cancelled = false
            ; (async () => {
                setLoading(true)
                try {
                    const base = sb
                        .from('products')
                        .select('id, name, description, price, price_sale, image_url, images, category_id, stock, is_active, created_at, sort_order, deleted_at')
                        .order('created_at', { ascending: false })

                    const query = showArchived
                        ? base.not('deleted_at', 'is', null) // server-side: solo archiviati
                        : base.is('deleted_at', null)        // server-side: solo attivi

                    const { data, error } = await query
                    if (error) throw error

                    // doppia cintura: filtro anche client-side nel caso in cui il server filtrasse male
                    const filtered = (data ?? []).filter(p =>
                        showArchived ? p.deleted_at !== null : p.deleted_at === null
                    )

                    // diagnostica: vedi cosa sta arrivando
                    console.log('loadProducts', {
                        showArchived,
                        total: data?.length ?? 0,
                        archivedCount: (data ?? []).filter(p => p.deleted_at !== null).length
                    })

                    if (!cancelled) setItems(filtered)
                } catch (e) {
                    console.error('Errore caricamento prodotti:', e)
                    if (!cancelled) setItems([])
                } finally {
                    if (!cancelled) setLoading(false)
                }
            })()
        return () => { cancelled = true }
    }, [sb, showArchived])



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
            if (!data) throw new Error('Nessun dato restituito da Supabase')

            setCategories((prev) => [...prev, data])
            setEditing((cur) => (cur ? { ...cur, category_id: data.id } : cur))
            setNewCategoryName('')
            setMessage('✅ Categoria creata con successo!')
        } catch (e) {
            console.error('Errore creazione categoria:', e)
            alert('Errore durante la creazione della categoria')
        } finally {
            setCreatingCategory(false)
        }
    }

    async function deleteCategoryQuick(id: string) {
        const ok = window.confirm('Vuoi davvero eliminare questa categoria?')
        if (!ok) return
        try {
            const { error } = await sb.from('categories').delete().eq('id', id)
            if (error) throw error
            setCategories((prev) => prev.filter(c => c.id !== id))
            setMessage('🗑️ Categoria eliminata con successo!')
        } catch (e) {
            console.error('Errore eliminazione categoria:', e)
            alert('Errore durante l’eliminazione della categoria')
        }
    }


    // SAVE (create or update)
    async function save() {
        if (!editing) return
        setSaving(true)
        try {
            const payload: any = {
                name: editing?.name?.trim() || '',
                description: editing?.description?.trim() || null,
                price: editing?.price ? Number(editing.price) : 0,
                price_sale:
                    editing?.price_sale == null || String(editing?.price_sale).trim() === ''
                        ? null
                        : Number(editing?.price_sale),

                image_url: editing?.image_url || null,
                category_id: editing?.category_id || null,
                stock: (() => {
                    const val = editing?.stock
                    if (val == null) return null // null o undefined → stock illimitato
                    const strVal = String(val).trim()
                    if (strVal === '') return null // stringa vuota → stock illimitato
                    return Number(val) // numero valido
                })(),
                is_active:
                    typeof editing?.is_active === 'boolean' ? editing.is_active : true,
                sort_order: editing?.sort_order ?? 100,
                unit_type: editing.unit_type,
            }

            if (!editing.id) {
                // CREATE
                const res = await fetch('/api/admin/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                const json = await res.json()
                if (!res.ok) throw new Error(json?.error || 'Errore creazione')

                setItems((prev) => [json.product ?? json, ...prev])
            } else {
                // UPDATE via PATCH
                let res
                if (editing?.id) {
                    // ✅ Aggiorna prodotto esistente
                    res = await fetch('/api/admin/products', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: editing.id, ...payload }),
                    })
                } else {
                    // ✅ Crea nuovo prodotto
                    res = await fetch('/api/admin/products', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    })
                }

                const json = await res.json()
                if (!res.ok) throw new Error(json?.error || 'Errore aggiornamento')

                setItems((prev) =>
                    prev.map((p) =>
                        p.id === editing.id ? { ...p, ...payload } : p
                    )
                )
            }

            setEditing(null)
        } catch (e: any) {
            alert(e?.message || 'Errore salvataggio')
        } finally {
            setSaving(false)
        }
    }

    // DELETE
    // DELETE
    async function doDelete(id: string) {
        if (!id) return
        const ok = window.confirm('Vuoi davvero archiviare questo prodotto?')
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
                console.error('Errore HTTP archiviazione:', errorText)
                alert('⚠️ Errore durante l’archiviazione')
                return
            }

            const data = await res.json()

            switch (data.status) {
                case 'archived':
                    alert('📦 Prodotto archiviato')
                    setItems(prev => prev.filter(p => p.id !== id)) // rimuove subito dalla lista corrente
                    break
                case 'already_archived':
                    alert('ℹ️ Prodotto già archiviato')
                    break
                case 'not_found':
                    alert('⚠️ Prodotto non trovato (già rimosso?)')
                    break
                default:
                    alert('⚠️ Risposta sconosciuta dal server')
            }

            setEditing(cur => (cur?.id === id ? null : cur))
        } catch (e) {
            console.error('Eccezione archiviazione:', e)
            alert('Errore inatteso durante l’archiviazione')
        } finally {
            setDeleting(null)
        }
    }




    return (
        <div className="mx-auto max-w-screen-2xl p-4 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900">

            <header className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Gestione Prodotti</h1>

                <button
                    onClick={() =>
                        setEditing({
                            id: '',
                            name: '',
                            description: '',
                            price: 0,
                            price_sale: null,
                            image_url: '',
                            images: [],
                            category_id: '',
                            stock: null,
                            is_active: true,
                            sort_order: 100,
                            unit_type: 'per_unit',
                        })
                    }
                    className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700"
                >
                    <span className="text-lg">＋</span> Nuovo Prodotto
                </button>
            </header>
            {/* Toggle Archivio */}
            <div className="mb-4">
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={showArchived}
                        onChange={(e) => setShowArchived(e.target.checked)}
                    />
                    Mostra archivio
                </label>
            </div>


            {/* 🔎 Barra ricerca: subito sotto l’header */}
            <div className="w-full max-w-md mb-6">
                <input
                    type="text"
                    placeholder="Cerca prodotto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"

                />
            </div>
            {/* Filtri */}
            <div className="flex flex-wrap gap-3 mb-6">
                {/* Filtro categoria */}
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"

                >
                    <option value="all">Tutte le categorie</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>

                {/* Filtro stato */}
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"

                >
                    <option value="all">Tutti</option>
                    <option value="active">Solo attivi</option>
                    <option value="hidden">Solo nascosti</option>
                    <option value="lowstock">Stock basso (&lt; 5)</option>
                </select>
            </div>




            {/* Lista prodotti desktop */}
            {loading ? (
                <p className="text-sm text-gray-500">Caricamento…</p>
            ) : (
                <>
                    {/* Vista desktop */}
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
                                                <span className="ml-2 text-xs text-red-500 font-normal">(archiviato)</span>
                                            )}
                                        </div>

                                        <div className="text-sm text-gray-600">
                                            €{Number(p.price).toFixed(2)} / {p.unit_type === 'per_kg' ? 'kg' : 'pz'}
                                            {p.price_sale ? (
                                                <span className="ml-2 text-gray-500 line-through">
                                                    €{Number(p.price_sale).toFixed(2)} / {p.unit_type === 'per_kg' ? 'kg' : 'pz'}
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="text-xs text-gray-500">
                                            Stock: {p.stock == null ? 'illimitato' : `${p.stock} ${p.unit_type === 'per_kg' ? 'kg' : 'pz'}`}
                                        </div>

                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                                                }`}
                                        >
                                            {p.is_active ? 'Attivo' : 'Nascosto'}
                                        </span>

                                        {p.deleted_at ? (



                                            <button
                                                className="rounded-md border border-green-300 text-green-700 px-3 py-1.5 hover:bg-green-50"
                                                onClick={async () => {
                                                    try {
                                                        const { error } = await sb
                                                            .from('products')
                                                            .update({ deleted_at: null })
                                                            .eq('id', p.id)

                                                        if (error) {
                                                            console.error('Errore ripristino:', error)
                                                            alert('⚠️ Errore durante il ripristino')
                                                            return
                                                        }

                                                        // Rimuove subito il prodotto dalla lista archivio
                                                        setItems(prev => prev.filter(prod => prod.id !== p.id))
                                                        alert('✅ Prodotto ripristinato con successo')
                                                    } catch (e) {
                                                        console.error('Eccezione ripristino:', e)
                                                        alert('⚠️ Errore inatteso durante il ripristino')
                                                    }
                                                }}
                                            >
                                                Ripristina
                                            </button>

                                        ) : (
                                            <>
                                                <button
                                                    className="rounded-md border px-3 py-1.5 hover:bg-gray-50"
                                                    onClick={() => setEditing(p)}
                                                >
                                                    Modifica
                                                </button>
                                                <button
                                                    className="rounded-md border border-red-300 text-red-700 px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
                                                    onClick={() => p.id && doDelete(p.id)}
                                                    disabled={deleting === p.id}
                                                >
                                                    {deleting === p.id ? 'Eliminazione…' : 'Elimina'}
                                                </button>
                                            </>
                                        )}
                                    </div>


                                </li>
                            )
                        })}
                    </ul>



                    {/* Vista mobile */}
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
                                                    <span className="ml-2 text-xs text-red-500 font-normal">(archiviato)</span>
                                                )}
                                            </div>

                                            <div className="text-sm text-gray-600">
                                                €{Number(p.price).toFixed(2)} / {p.unit_type === 'per_kg' ? 'kg' : 'pz'}
                                                {p.price_sale ? (
                                                    <span className="ml-2 text-gray-500 line-through">
                                                        €{Number(p.price_sale).toFixed(2)} / {p.unit_type === 'per_kg' ? 'kg' : 'pz'}
                                                    </span>
                                                ) : null}
                                            </div>

                                            <div className="text-xs text-gray-500">
                                                Stock: {p.stock == null ? 'illimitato' : `${p.stock} ${p.unit_type === 'per_kg' ? 'kg' : 'pz'}`}
                                            </div>

                                            <span
                                                className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-xs ${p.is_active
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : 'bg-gray-100 text-gray-600'
                                                    }`}
                                            >
                                                {p.is_active ? 'Attivo' : 'Nascosto'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex gap-2">
                                        {p.deleted_at ? (


                                            <button
                                                className="flex-1 rounded-md border border-green-300 text-green-700 px-3 py-2 hover:bg-green-50 text-sm"
                                                onClick={async () => {
                                                    const { error } = await sb
                                                        .from('products')
                                                        .update({ deleted_at: null })
                                                        .eq('id', p.id)
                                                    if (!error) {
                                                        setItems((prev) =>
                                                            prev.map((prod) =>
                                                                prod.id === p.id ? { ...prod, deleted_at: null } : prod
                                                            )
                                                        )
                                                        alert('✅ Prodotto ripristinato con successo')
                                                    } else {
                                                        alert('Errore durante il ripristino')
                                                    }
                                                }}
                                            >
                                                Ripristina
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    className="flex-1 rounded-md border px-3 py-2 hover:bg-gray-50 text-sm"
                                                    onClick={() => setEditing(p)}
                                                >
                                                    Modifica
                                                </button>
                                                <button
                                                    className="flex-1 rounded-md border border-red-300 text-red-700 px-3 py-2 hover:bg-red-50 disabled:opacity-50 text-sm"
                                                    onClick={() => p.id && doDelete(p.id)}
                                                    disabled={deleting === p.id}
                                                >
                                                    {deleting === p.id ? 'Eliminazione…' : 'Elimina'}
                                                </button>
                                            </>
                                        )}
                                    </div>


                                </div>
                            )
                        })}
                    </div>
                    {/* Controlli di paginazione */}
                    {!loading && filteredItems.length > 0 && (
                        <div className="flex items-center justify-between mt-6">
                            {/* Mobile: Precedente / Successivo */}
                            <div className="flex w-full justify-between md:hidden">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    className="px-3 py-2 text-sm rounded-md border disabled:opacity-50"
                                >
                                    ← Precedente
                                </button>
                                <button
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    className="px-3 py-2 text-sm rounded-md border disabled:opacity-50"
                                >
                                    Successivo →
                                </button>
                            </div>

                            {/* Desktop: numeri di pagina */}
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

                            {/* Desktop: select prodotti per pagina */}
                            <div className="hidden md:block">
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value))
                                        setCurrentPage(1) // resetta alla prima pagina
                                    }}
                                    className="rounded-md border px-2 py-1 text-sm"
                                >
                                    <option value={20}>20 per pagina</option>
                                    <option value={50}>50 per pagina</option>
                                    <option value={100}>100 per pagina</option>
                                </select>
                            </div>
                        </div>
                    )}



                </>
            )}


            {/* Modal edit/nuovo */}
            {editing && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
                    <div className="w-full max-w-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6 rounded shadow-lg max-h-[80vh] overflow-y-auto">


                        <div className="flex items-center justify-between px-4 pt-4">
                            <h2 className="text-lg font-semibold">
                                {editing.id ? 'Modifica prodotto' : 'Nuovo prodotto'}
                            </h2>
                        </div>

                        <div className="px-4 pb-4 pt-2">
                            <div className="space-y-4">
                                {/* Info base */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium">Nome prodotto</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"

                                        value={editing.name ?? ''}
                                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                    />

                                    <label className="block text-sm font-medium">Descrizione</label>
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
                                        <label className="block text-sm font-medium">Prezzo (€)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"

                                            value={editing.price ?? ''}
                                            onChange={(e) =>
                                                setEditing({ ...editing, price: Number(e.target.value) })
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium">Prezzo scontato (€)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="opzionale"
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"

                                            value={editing.price_sale ?? ''}
                                            onChange={(e) =>
                                                setEditing({
                                                    ...editing,
                                                    price_sale: e.target.value === '' ? null : Number(e.target.value),
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Unità di misura
                                    </label>
                                    <select
                                        value={editing?.unit_type || 'per_unit'}
                                        onChange={(e) =>
                                            setEditing((prev) =>
                                                prev ? { ...prev, unit_type: e.target.value as 'per_unit' | 'per_kg' } : prev
                                            )
                                        }
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                    >
                                        <option value="per_unit">Pezzo</option>
                                        <option value="per_kg">Chilogrammo</option>
                                    </select>
                                </div>


                                {/* Immagine */}
                                <fieldset className="rounded-xl border border-gray-200 p-3">
                                    <legend className="px-1 text-sm font-medium text-gray-700">Immagine</legend>
                                    <AdminImageUploader
                                        onUploaded={(url) => setEditing({ ...editing, image_url: url })}
                                    />
                                    {editing.image_url ? (
                                        <div className="flex items-center gap-3 mt-2">
                                            <img
                                                src={editing.image_url}
                                                alt="Anteprima"
                                                className="w-20 h-20 rounded-md object-cover border"
                                            />
                                            <button
                                                type="button"
                                                className="text-sm text-red-600 hover:underline"
                                                onClick={() => setEditing({ ...editing, image_url: '' })}
                                            >
                                                Rimuovi immagine
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Carica un’immagine JPG/PNG (max ~5MB).
                                        </p>
                                    )}
                                </fieldset>

                                {/* Categoria & Stock */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        {/* Categoria */}
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium">Categoria</label>
                                            <select
                                                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"

                                                value={editing.category_id ?? ''}
                                                onChange={(e) =>
                                                    setEditing({ ...editing!, category_id: e.target.value || null })
                                                }
                                            >
                                                <option value="">Nessuna categoria</option>
                                                {categories.map(c => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium">Stock</label>
                                        <input
                                            type="number"
                                            min={0}
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"

                                            value={editing.stock ?? ''} // '' quando null
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
                                        <label className="block text-sm font-medium">Ordine (sort_order)</label>
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
                                            Numero per ordinare i prodotti nello shop (1 = in cima).
                                        </p>
                                    </div>


                                </div>

                                {/* Stato */}
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
                                    <span className="text-sm">Attivo (visibile nello shop)</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-3">
                            {/* Elimina nel modal (solo se esiste id) */}
                            {editing.id ? (
                                <button
                                    className="rounded-md border border-red-300 text-red-700 px-3 py-2 hover:bg-red-50 disabled:opacity-50"
                                    onClick={() => editing.id && doDelete(editing.id)}
                                    disabled={deleting === editing.id}
                                >
                                    {deleting === editing.id ? 'Eliminazione…' : 'Elimina'}
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
                                    Annulla
                                </button>
                                <button
                                    className="rounded-md bg-black text-white px-3 py-2 disabled:opacity-60"
                                    onClick={save}
                                    disabled={saving || (editing.id ? deleting === editing.id : false)}
                                >
                                    {saving ? 'Salvataggio…' : 'Salva'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
