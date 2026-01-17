'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import type { Order } from '@/lib/types'

function formatQuantity(q: number, unit?: string | null) {
    if (!unit) return q.toString()
    return `${q} ${unit}`
}

function formatPrice(value: number) {
    return `€${value.toFixed(2)}`
}

function ProductListCell({ items }: { items: any[] }) {
    const [showAll, setShowAll] = useState(false)
    const itemsToShow = showAll ? items : items.slice(0, 3)

    if (!items.length) {
        return <span className="text-gray-500 dark:text-gray-400">Nessun prodotto</span>
    }

    function formatUnit(unit?: string | null): string {
        if (unit === 'per_unit') return '(pz)'
        if (unit === 'per_kg') return '(kg)'
        return '(pz)'
    }

    return (
        <ul className="space-y-1 md:space-y-1.5 text-gray-700 dark:text-gray-300 leading-tight">
            {itemsToShow.map((item, i) => {
                const name = item.product?.name ?? "Prodotto"
                const quantity = Number(item.quantity)
                const unit = item.product?.unit_type ?? null
                const unitLabel = formatUnit(unit)

                return (
                    <li key={i} className="flex flex-row items-center">
                        {/* Mobile: layout verticale - INVARIATO */}
                        <div className="md:hidden text-sm flex flex-col gap-1">
                            <span className="font-medium text-gray-900 dark:text-gray-100">{name}</span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs">
                                {quantity} {unitLabel}
                            </span>
                        </div>
                        {/* Desktop: layout compatto su una riga */}
                        <div className="hidden md:flex md:flex-row md:items-center md:whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">× {quantity} {unitLabel}</span>
                        </div>
                    </li>
                )
            })}

            {items.length > 3 && !showAll && (
                <button
                    onClick={() => setShowAll(true)}
                    className="text-blue-600 text-sm hover:underline"
                >
                    +{items.length - 3} altri…
                </button>
            )}

            {showAll && items.length > 3 && (
                <button
                    onClick={() => setShowAll(false)}
                    className="text-blue-600 text-sm hover:underline"
                >
                    Mostra meno
                </button>
            )}
        </ul>
    )
}

type OrderDrawerProps = {
    order: Order
    onClose: () => void
}

function OrderDrawer({ order, onClose }: OrderDrawerProps) {
    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Overlay */}
            <div className="flex-1 bg-black bg-opacity-50" onClick={onClose} />

            {/* Drawer */}
            <div className="w-full max-w-md bg-white shadow-xl h-full flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-lg font-semibold">
                        Ordine {order.public_id || order.id.slice(0, 8)}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-600 hover:text-gray-800"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {order.order_items.map((it: any, idx: number) => (

                        <div key={idx} className="flex justify-between text-sm">
                            <span>
                                {it.quantity} × {it.product.name}
                                {it.product.unit_type && ` (${it.product.unit_type})`}
                            </span>
                            <span className="font-medium">
                                € {(it.price * it.quantity).toFixed(2)}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t text-sm flex justify-between">
                    <span>Totale</span>
                    <span className="font-semibold">€ {order.total.toFixed(2)}</span>
                </div>
            </div>
        </div>
    )
}
function PaymentBadge({ status, payment_method }: { status: 'pending' | 'paid' | 'failed' | 'refunded' | null | undefined, payment_method?: string }) {
    const normalizedStatus = status || 'pending'
    
    // Logica per determinare badge e stile
    let badgeStyle: string
    let badgeLabel: string
    let tooltip: string | undefined

    if (normalizedStatus === 'paid') {
        badgeStyle = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        badgeLabel = 'Pagato'
    } else if (normalizedStatus === 'pending' && (payment_method === 'cash' || payment_method === 'pos_on_delivery')) {
        badgeStyle = 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
        badgeLabel = 'Da incassare'
        tooltip = 'Incassa prima di segnare come consegnato'
    } else if (normalizedStatus === 'pending' && payment_method === 'card_online') {
        badgeStyle = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
        badgeLabel = 'In attesa (Stripe)'
    } else if (normalizedStatus === 'failed') {
        badgeStyle = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        badgeLabel = 'Fallito'
    } else if (normalizedStatus === 'refunded') {
        badgeStyle = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
        badgeLabel = 'Rimborsato'
    } else {
        badgeStyle = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
        badgeLabel = 'In attesa'
    }

    return (
        <span 
            className={`px-2 py-1 rounded text-xs font-medium ${badgeStyle}`}
            title={tooltip}
        >
            {badgeLabel}
        </span>
    )
}



function StatusBadge({ status }: { status: Order['status'] }) {
    const colors: Record<Order['status'], string> = {
        pending: 'bg-yellow-500',
        confirmed: 'bg-blue-500',
        delivered: 'bg-green-600',
        cancelled: 'bg-red-600',
    }

    const labels: Record<Order['status'], string> = {
        pending: 'In attesa',
        confirmed: 'Confermato',
        delivered: 'Consegnato',
        cancelled: 'Annullato',
    }

    return (
        <span
            className={`${colors[status]} text-white px-2 py-1 rounded text-xs font-medium`}
        >
            {labels[status] || status}
        </span>
    )
}

function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleString()
}

function formatPayment(pm: string) {
    switch (pm) {
        case 'cash':
            return '💵 Contanti'
        case 'pos_on_delivery':
            return '🏠💳 POS alla consegna'
        case 'card_online':
            return '🌐 Carta online'
        default:
            return pm
    }
}

// Componente per scrollbar orizzontale superiore sincronizzata (solo desktop)
function SyncedHorizontalScroll({ children }: { children: React.ReactNode }) {
    const topScrollRef = useRef<HTMLDivElement>(null)
    const topSpacerRef = useRef<HTMLDivElement>(null)
    const bottomScrollRef = useRef<HTMLDivElement>(null)
    const [showTopScroll, setShowTopScroll] = useState(false)

    // Effetto per rilevare overflow orizzontale
    useEffect(() => {
        const bottomEl = bottomScrollRef.current
        if (!bottomEl) return

        const checkOverflow = () => {
            if (bottomEl) {
                const hasOverflow = bottomEl.scrollWidth > bottomEl.clientWidth
                setShowTopScroll(hasOverflow)
            }
        }

        // ResizeObserver per rilevare overflow orizzontale
        const resizeObserver = new ResizeObserver(checkOverflow)
        resizeObserver.observe(bottomEl)

        // Controllo iniziale
        checkOverflow()

        return () => {
            resizeObserver.disconnect()
        }
    }, [])

    // Effetto per sincronizzare scroll e aggiornare lo spacer
    useEffect(() => {
        if (!showTopScroll) return

        const bottomEl = bottomScrollRef.current
        const topEl = topScrollRef.current
        const topSpacerEl = topSpacerRef.current
        
        if (!bottomEl) return

        // Funzione per aggiornare lo spacer
        const updateSpacer = () => {
            if (topSpacerEl && bottomEl) {
                topSpacerEl.style.width = `${bottomEl.scrollWidth}px`
            }
        }

        // ResizeObserver per aggiornare lo spacer quando cambia la dimensione
        const resizeObserver = new ResizeObserver(updateSpacer)
        resizeObserver.observe(bottomEl)

        // Aggiorna lo spacer inizialmente (con delay per assicurarsi che topEl sia nel DOM)
        const timeoutId = setTimeout(() => {
            updateSpacer()
        }, 10)

        // Sincronizzazione scroll
        if (!topEl) {
            return () => {
                resizeObserver.disconnect()
                clearTimeout(timeoutId)
            }
        }

        let isScrolling = false

        const syncScroll = (source: HTMLDivElement, target: HTMLDivElement) => {
            if (!isScrolling && target.scrollLeft !== source.scrollLeft) {
                isScrolling = true
                target.scrollLeft = source.scrollLeft
                requestAnimationFrame(() => {
                    isScrolling = false
                })
            }
        }

        const handleBottomScroll = () => {
            if (bottomEl && topEl) {
                syncScroll(bottomEl, topEl)
            }
        }

        const handleTopScroll = () => {
            if (topEl && bottomEl) {
                syncScroll(topEl, bottomEl)
            }
        }

        bottomEl.addEventListener('scroll', handleBottomScroll, { passive: true })
        topEl.addEventListener('scroll', handleTopScroll, { passive: true })

        return () => {
            resizeObserver.disconnect()
            clearTimeout(timeoutId)
            bottomEl.removeEventListener('scroll', handleBottomScroll)
            topEl.removeEventListener('scroll', handleTopScroll)
        }
    }, [showTopScroll])

    return (
        <>
            {/* Scrollbar superiore - solo desktop, sticky, visibile solo se c'è overflow */}
            {showTopScroll && (
                <div
                    className="hidden md:block sticky top-0 z-30 overflow-x-auto overflow-y-hidden"
                    style={{ height: '17px' }}
                    ref={topScrollRef}
                >
                    <div ref={topSpacerRef} style={{ height: '1px' }} />
                </div>
            )}
            {/* Contenitore scrollabile con overflow-x-auto */}
            <div ref={bottomScrollRef} className="overflow-x-auto">
                {children}
            </div>
        </>
    )
}

export default function OrdersAdminPage() {
    const [orders, setOrders] = useState<any[]>([])
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState<string | null>(null)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const PAGE_SIZE = 20
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [statusFilter, setStatusFilter] = useState<'all' | Order['status']>('all')
    const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'paid' | 'failed' | 'refunded'>('all')

    const filteredOrders = orders


    async function loadOrders(p = 1) {
        setLoading(true)
        const params = new URLSearchParams({
            page: String(p),
            limit: String(PAGE_SIZE),
        })
        if (statusFilter !== 'all') params.set('status', statusFilter)
        if (paymentFilter !== 'all') params.set('payment_status', paymentFilter)
        if (searchTerm.trim()) params.set('search', searchTerm.trim())

        try {
            const res = await fetch(`/api/admin/orders?${params.toString()}`)
            if (!res.ok) {
                const text = await res.text()
                console.error('❌ API error /api/admin/orders:', text)
                setLoading(false)
                return
            }
            const json = await res.json()
            setOrders(json.orders || [])
            setPage(json.page || p)
            setTotalPages(json.totalPages || 1)
        } catch (err) {
            console.error('Errore caricamento ordini:', err)
        } finally {
            setLoading(false)
        }
    }


    useEffect(() => {
        loadOrders(1)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, paymentFilter])
    // 🔍 Ricarica ordini quando cambia la ricerca
    useEffect(() => {
        const delay = setTimeout(() => {
            loadOrders(1)
        }, 600)
        return () => clearTimeout(delay)
    }, [searchTerm])


    const updateStatus = useCallback(async (id: string, status: Order['status']) => {
        const order = orders.find((o) => o.id === id)
        if (!order) {
            setUpdating(null)
            return
        }

        // Verifica: impedisci di segnare come delivered un ordine offline non pagato
        if (
            order.payment_method !== 'card_online' &&
            order.payment_status !== 'paid' &&
            status === 'delivered'
        ) {
            alert('Segna prima l\'ordine come pagato')
            setUpdating(null)
            return
        }

        setUpdating(id)
        try {
            const payload = { id, status }
            const res = await fetch('/api/admin/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const text = await res.text()
            if (res.ok) {
                setOrders((prev) =>
                    prev.map((o) => (o.id === id ? { ...o, status } : o))
                )
            } else {
                let errorData = {}
                try {
                    errorData = JSON.parse(text)
                } catch {
                    errorData = {}
                }
                alert(errorData.error || 'Errore durante l\'aggiornamento dello stato')
            }
        } catch (error) {
            console.error('Errore updateStatus:', error)
            alert('Errore durante l\'aggiornamento dello stato')
        } finally {
            setUpdating(null)
        }
    }, [orders])

    const updatePaymentStatus = useCallback(async (id: string, payment_status: 'paid') => {
        setUpdating(id)
        try {
            const payload = { id, payment_status }
            const res = await fetch('/api/admin/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const text = await res.text()
            if (res.ok) {
                setOrders((prev) =>
                    prev.map((o) =>
                        o.id === id
                            ? { ...o, payment_status, status: 'confirmed' }
                            : o
                    )
                )
            } else {
                let errorData = {}
                try {
                    errorData = JSON.parse(text)
                } catch {
                    errorData = {}
                }
                alert(errorData.error || 'Errore durante l\'aggiornamento del pagamento')
            }
        } catch (error) {
            console.error('Errore updatePaymentStatus:', error)
            alert('Errore durante l\'aggiornamento del pagamento')
        } finally {
            setUpdating(null)
        }
    }, [])

    if (loading) return <p>Caricamento ordini...</p>

    return (
        <div className="flex justify-center w-full bg-gray-50 dark:bg-gray-900">

            <div className="w-full max-w-7xl p-6 overflow-x-auto text-gray-900 dark:text-gray-100">



                <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Gestione Ordini</h1>

                {/* Filtri */}
                <div className="hidden md:flex items-center gap-3 mb-4">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded px-3 py-2 text-sm"

                    >
                        <option value="all">Tutti gli stati</option>
                        <option value="pending">In attesa</option>
                        <option value="confirmed">Confermato</option>
                        <option value="delivered">Consegnato</option>
                        <option value="cancelled">Annullato</option>
                    </select>

                    <select
                        value={paymentFilter}
                        onChange={(e) => setPaymentFilter(e.target.value as any)}
                        className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded px-3 py-2 text-sm"

                    >
                        <option value="all">Tutti i pagamenti</option>
                        <option value="pending">In attesa</option>
                        <option value="paid">Pagato</option>
                        <option value="failed">Fallito</option>
                        <option value="refunded">Rimborsato</option>
                    </select>
                </div>

                {/* Barra di ricerca - solo desktop */}
                <div className="hidden md:flex items-center mb-4 w-full md:w-1/3 relative">
                    <span className="absolute left-3 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none"
                            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        autoFocus={typeof window !== 'undefined' && window.innerWidth > 768}
                        placeholder="Cerca per ID ordine o nome cliente…"

                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"

                    />
                </div>


                {/* Tabella desktop */}
                <div className="hidden md:flex justify-center w-full">
                    <div className="relative w-full max-w-7xl">
                        {/* Ombra indicatore scroll */}
                        <div
                            className="pointer-events-none absolute right-0 top-0 h-full w-8
                                       bg-gradient-to-l from-gray-50 to-transparent
                                       dark:from-gray-900 z-20"
                        />

                        {/* Scroll container con scrollbar superiore sincronizzata */}
                        <SyncedHorizontalScroll>
                            <table className="min-w-[900px] w-full table-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 shadow-sm">


                            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 sticky top-0 z-10">

                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-semibold w-16">ID</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold w-40">Data</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold">Indirizzo</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold w-40">Cliente</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold">Prodotti</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold w-24 min-w-[90px]">Totale</th>
                                    <th className="px-3 py-2 text-center text-xs font-semibold w-36">Pagamento</th>
                                    <th className="px-3 py-2 text-center text-xs font-semibold w-28">Stato</th>
                                    <th className="px-3 py-2 text-center text-xs font-semibold w-40">Azioni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map((o) => (
                                    <tr
                                        key={o.id}
                                        className="border-t border-gray-200 dark:border-gray-700 even:bg-gray-50 dark:even:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"

                                    >
                                        {/* ID */}
                                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 align-top">{o.public_id || o.id.slice(0, 8)}</td>


                                        {/* Data */}
                                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 align-top">
                                            {formatDate(o.created_at)}
                                        </td>

                                        {/* Indirizzo */}
                                        <td
                                            className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate dark:text-gray-300 align-top"
                                            title={`${o.address?.line1}, ${o.address?.cap} ${o.address?.city}`}
                                        >
                                            {o.address?.line1}, {o.address?.cap} {o.address?.city}
                                        </td>

                                        {/* Cliente */}
                                        <td
                                            className="px-4 py-2 text-sm text-gray-700 font-medium truncate max-w-xs dark:text-gray-300 align-top"
                                            title={`${(o.first_name || o.address?.firstName) ?? ''} ${(o.last_name || o.address?.lastName) ?? ''}`}
                                        >
                                            {(o.first_name || o.address?.firstName) ?? ''}{' '}
                                            {(o.last_name || o.address?.lastName) ?? ''}
                                        </td>

                                        {/* Prodotti */}
                                        <td className="px-4 py-2 text-sm max-w-xs align-top">
                                            <ProductListCell items={o.order_items || []} />
                                        </td>

                                        {/* Totale */}
                                        <td className="px-4 py-2 text-sm font-semibold text-right text-gray-900 dark:text-gray-100 whitespace-nowrap min-w-[90px] w-24 align-top">

                                            € {o.total.toFixed(2)}
                                        </td>

                                        {/* Pagamento */}
                                        <td className="px-4 py-2 text-center text-sm align-top">
                                            <div className="flex flex-col items-center gap-1">
                                                {/* ✅ Badge stato pagamento */}
                                                <PaymentBadge status={o.payment_status} payment_method={o.payment_method} />

                                                {/* Metodo di pagamento */}
                                                <span
                                                    className="text-xs text-gray-500 truncate max-w-[24ch] dark:text-gray-300"
                                                    title={formatPayment(o.payment_method)}
                                                >
                                                    {formatPayment(o.payment_method)}
                                                </span>



                                            </div>
                                        </td>


                                        {/* Stato */}
                                        <td className="px-4 py-2 text-center align-top">
                                            <StatusBadge status={o.status} />
                                        </td>

                                        {/* Azioni */}
                                        <td className="px-4 py-2 whitespace-nowrap pr-5 align-top">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="flex justify-center gap-2">
                                                    {o.status === 'pending' && (
                                                        <button
                                                            type="button"
                                                            disabled={updating === o.id}
                                                            onClick={() => updateStatus(o.id, 'confirmed')}
                                                            className="flex items-center gap-1 px-3 py-1 rounded bg-blue-500 text-white text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
                                                        >
                                                            Conferma
                                                        </button>
                                                    )}

                                                    {o.status === 'confirmed' && (
                                                        <button
                                                            type="button"
                                                            disabled={updating === o.id}
                                                            onClick={() => updateStatus(o.id, 'delivered')}
                                                            className="flex items-center gap-1 px-3 py-1 rounded bg-green-500 text-white text-sm hover:bg-green-600 disabled:opacity-50 transition-colors"
                                                        >
                                                            Consegnato
                                                        </button>
                                                    )}

                                                    {o.status !== 'cancelled' && o.status !== 'delivered' && (
                                                        <button
                                                            type="button"
                                                            disabled={updating === o.id}
                                                            onClick={() => updateStatus(o.id, 'cancelled')}
                                                            className="flex items-center gap-1 px-3 py-1 rounded bg-red-500 text-white text-sm hover:bg-red-600 disabled:opacity-50 transition-colors"
                                                        >
                                                            Annulla
                                                        </button>
                                                    )}
                                                </div>
                                                {o.payment_status === 'pending' && (o.payment_method === 'cash' || o.payment_method === 'pos_on_delivery') && (
                                                    <button
                                                        type="button"
                                                        disabled={updating === o.id}
                                                        onClick={() => updatePaymentStatus(o.id, 'paid')}
                                                        className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-500 text-white text-sm hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                                                    >
                                                        Segna come pagato
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </SyncedHorizontalScroll>
                    </div>



                </div>
                {/* Paginazione */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mt-6 gap-2 md:gap-0 w-full max-w-7xl mx-auto px-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400 text-center md:text-left">

                        Pagina {page} di {totalPages}
                    </span>
                    <div className="flex justify-center md:justify-end gap-2">
                        <button
                            onClick={() => loadOrders(page - 1)}
                            disabled={page <= 1}
                            className="px-3 py-2 text-sm border rounded disabled:opacity-50 hover:bg-gray-100"
                        >
                            ← Precedente
                        </button>
                        <button
                            onClick={() => loadOrders(page + 1)}
                            disabled={page >= totalPages}
                            className="px-3 py-2 text-sm border rounded disabled:opacity-50 hover:bg-gray-100"
                        >
                            Successiva →
                        </button>
                    </div>
                </div>



                {/* MOBILE VIEW (card) */}
                <div className="flex md:hidden items-center mb-4 w-full relative">
                    <span className="absolute left-3 text-gray-400 dark:text-gray-500">

                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none"
                            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        placeholder="Cerca per nome cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                    />
                </div>


                <div className="space-y-5 md:hidden px-4 max-w-full overflow-hidden">
                    {filteredOrders.map((o) => (

                        <div
                            key={o.id}
                            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 shadow-sm w-full max-w-full overflow-hidden"



                        >

                            {/* HEADER */}
                            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Ordine #{o.public_id || o.id.slice(0, 8)}
                                </p>
                                <div className="shrink-0">
                                    <StatusBadge status={o.status} />
                                </div>
                            </div>

                            {/* BODY */}
                            <div className="flex-1 w-full px-6 py-6 bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
                                <p
                                    className="text-sm font-medium text-gray-800 dark:text-gray-100 break-words"
                                    title={`${(o.first_name || o.address?.firstName) ?? ''} ${(o.last_name || o.address?.lastName) ?? ''}`}
                                >
                                    👤 {(o.first_name || o.address?.firstName) ?? ''}{' '}
                                    {(o.last_name || o.address?.lastName) ?? ''}
                                </p>

                                <p
                                    className="text-xs text-gray-500 dark:text-gray-300 break-words"
                                    title={`${o.address?.line1}, ${o.address?.cap} ${o.address?.city}`}
                                >
                                    📍 {o.address?.line1}, {o.address?.cap} {o.address?.city}
                                </p>

                                {/* Prodotti */}
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    <ProductListCell items={o.order_items || []} />
                                </div>
                            </div>


                            {/* FOOTER */}
                            <div className="px-4 py-3 border-t flex justify-between items-center">
                                <span className="text-sm font-semibold whitespace-nowrap">
                                    Totale: € {o.total.toFixed(2)}
                                </span>
                                <PaymentBadge status={o.payment_status} payment_method={o.payment_method} />
                            </div>

                            {/* AZIONI */}
                            <div className="px-4 py-3 space-y-2">
                                <div className="flex gap-2">
                                    {o.status === 'pending' && (
                                        <button
                                            type="button"
                                            disabled={updating === o.id}
                                            onClick={() => updateStatus(o.id, 'confirmed')}
                                            className="flex-1 flex items-center justify-center gap-1 bg-blue-500 text-white rounded-lg py-2 text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"
                                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                            Conferma
                                        </button>
                                    )}

                                    {o.status === 'confirmed' && (
                                        <button
                                            type="button"
                                            disabled={updating === o.id}
                                            onClick={() => updateStatus(o.id, 'delivered')}
                                            className="flex-1 flex items-center justify-center gap-1 bg-green-500 text-white rounded-lg py-2 text-sm hover:bg-green-600 disabled:opacity-50 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"
                                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6h13v6M9 17l-4-4m0 0l-4 4m4-4v12" />
                                            </svg>
                                            Consegnato
                                        </button>
                                    )}

                                    {o.status !== 'cancelled' && o.status !== 'delivered' && (
                                        <button
                                            type="button"
                                            disabled={updating === o.id}
                                            onClick={() => updateStatus(o.id, 'cancelled')}
                                            className="flex-1 flex items-center justify-center gap-1 bg-red-500 text-white rounded-lg py-2 text-sm hover:bg-red-600 disabled:opacity-50 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"
                                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            Annulla
                                        </button>
                                    )}
                                </div>
                                {o.payment_status === 'pending' && (o.payment_method === 'cash' || o.payment_method === 'pos_on_delivery') && (
                                    <button
                                        type="button"
                                        disabled={updating === o.id}
                                        onClick={() => updatePaymentStatus(o.id, 'paid')}
                                        className="w-full flex items-center justify-center gap-1 bg-emerald-500 text-white rounded-lg py-2 text-sm hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"
                                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Segna come pagato
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {selectedOrder && (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-md w-full mx-4 text-gray-900 dark:text-gray-100">

                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">

                                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">

                                    Prodotti dell\'ordine #{selectedOrder.public_id || selectedOrder.id.slice(0, 8)}
                                </h2>
                                <button
                                    onClick={() => setSelectedOrder(null)}
                                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"

                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                                {selectedOrder.order_items.map((it, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="truncate w-2/3">
                                            {it.quantity} × {it.product.name}
                                            {it.product.unit_type && ` (${it.product.unit_type})`}
                                        </span>
                                        <span className="font-medium">
                                            € {(it.price * it.quantity).toFixed(2)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}


            </div>
        </div >

    )

}
