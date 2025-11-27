'use client'

import { useEffect, useState } from 'react'
import type { Order } from '@/lib/types'

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
                        Ordine {order.id.slice(0, 6)}
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
function PaymentBadge({ status }: { status: 'pending' | 'paid' | 'failed' | 'refunded' }) {
    const styles: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-800',
        paid: 'bg-green-100 text-green-800',
        failed: 'bg-red-100 text-red-800',
        refunded: 'bg-blue-100 text-blue-800',
    }

    const labels: Record<string, string> = {
        pending: 'In attesa',
        paid: 'Pagato',
        failed: 'Fallito',
        refunded: 'Rimborsato',
    }

    return (
        <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || ''}`}>
            {labels[status] || status}
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
        case 'card_on_delivery':
            return '💳 POS alla consegna'
        case 'card_online':
            return '🌐 Carta online'
        default:
            return pm
    }
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

        const res = await fetch(`/api/admin/orders?${params.toString()}`)
        const json = await res.json()
        if (res.ok) {
            setOrders(json.orders || [])
            setPage(json.page || p)
            setTotalPages(json.totalPages || 1)
        }
        setLoading(false)
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


    async function updateStatus(id: string, status: Order['status']) {
        setUpdating(id)
        const res = await fetch('/api/admin/orders', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status }),
        })
        if (res.ok) {
            setOrders((prev) =>
                prev.map((o) => (o.id === id ? { ...o, status } : o))
            )
        }
        setUpdating(null)
    }

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
                        placeholder="Cerca per nome cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"

                    />
                </div>


                {/* Tabella desktop */}
                <div className="hidden md:flex justify-center w-full">
                    <div className="w-full max-w-7xl overflow-x-auto">


                        <table className="w-full table-fixed border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 shadow-sm">


                            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 sticky top-0 z-10">

                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-semibold w-16">ID</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold w-40">Data</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold">Indirizzo</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold w-40">Cliente</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold">Prodotti</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold w-24">Totale</th>
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
                                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{o.id.slice(0, 6)}</td>


                                        {/* Data */}
                                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                                            {formatDate(o.created_at)}
                                        </td>

                                        {/* Indirizzo */}
                                        <td
                                            className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate dark:text-gray-300"
                                            title={`${o.address?.line1}, ${o.address?.cap} ${o.address?.city}`}
                                        >
                                            {o.address?.line1}, {o.address?.cap} {o.address?.city}
                                        </td>

                                        {/* Cliente */}
                                        <td
                                            className="px-4 py-2 text-sm text-gray-700 font-medium truncate max-w-xs dark:text-gray-300"
                                            title={`${(o.first_name || o.address?.firstName) ?? ''} ${(o.last_name || o.address?.lastName) ?? ''}`}
                                        >
                                            {(o.first_name || o.address?.firstName) ?? ''}{' '}
                                            {(o.last_name || o.address?.lastName) ?? ''}
                                        </td>

                                        {/* Prodotti */}
                                        <td className="px-4 py-2 text-sm max-w-xs">
                                            {o.order_items.slice(0, 2).map((it: any, idx: number) => (

                                                <div
                                                    key={idx}
                                                    className="truncate text-gray-700 dark:text-gray-300"
                                                    title={`${it.quantity} × ${it.product.name}${it.product.unit_type ? ` (${it.product.unit_type})` : ''}`}
                                                >
                                                    {it.quantity} × {it.product.name}{' '}
                                                    {it.product.unit_type && `(${it.product.unit_type})`}
                                                </div>
                                            ))}
                                            {o.order_items.length > 2 && (
                                                <button
                                                    onClick={() => setSelectedOrder(o)}
                                                    className="text-blue-600 text-xs hover:underline"
                                                >
                                                    +{o.order_items.length - 2} altri
                                                </button>
                                            )}
                                        </td>

                                        {/* Totale */}
                                        <td className="px-4 py-2 text-sm font-semibold text-right text-gray-900 dark:text-gray-100 whitespace-nowrap">

                                            € {o.total.toFixed(2)}
                                        </td>

                                        {/* Pagamento */}
                                        <td className="px-4 py-2 text-center text-sm">
                                            <div className="flex flex-col items-center gap-1">
                                                {/* ✅ Badge stato pagamento */}
                                                <PaymentBadge status={o.payment_status} />

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
                                        <td className="px-4 py-2 text-center">
                                            <StatusBadge status={o.status} />
                                        </td>

                                        {/* Azioni */}
                                        <td className="px-4 py-2 whitespace-nowrap pr-5">
                                            <div className="flex justify-center gap-2">
                                                {o.status === 'pending' && (
                                                    <button
                                                        disabled={updating === o.id}
                                                        onClick={() => updateStatus(o.id, 'confirmed')}
                                                        className="flex items-center gap-1 px-3 py-1 rounded bg-blue-500 text-white text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
                                                    >
                                                        Conferma
                                                    </button>
                                                )}

                                                {o.status === 'confirmed' && (
                                                    <button
                                                        disabled={updating === o.id}
                                                        onClick={() => updateStatus(o.id, 'delivered')}
                                                        className="flex items-center gap-1 px-3 py-1 rounded bg-green-500 text-white text-sm hover:bg-green-600 disabled:opacity-50 transition-colors"
                                                    >
                                                        Consegnato
                                                    </button>
                                                )}

                                                {o.status !== 'cancelled' && o.status !== 'delivered' && (
                                                    <button
                                                        disabled={updating === o.id}
                                                        onClick={() => updateStatus(o.id, 'cancelled')}
                                                        className="flex items-center gap-1 px-3 py-1 rounded bg-red-500 text-white text-sm hover:bg-red-600 disabled:opacity-50 transition-colors"
                                                    >
                                                        Annulla
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
                                    Ordine #{o.id.slice(0, 6)}
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
                                    {o.order_items.slice(0, 2).map((it: any, idx: number) => (
                                        <div
                                            key={idx}
                                            className="flex justify-between py-1 text-sm min-w-0"
                                        >
                                            <span
                                                className="truncate w-2/3 text-gray-700 dark:text-gray-200"
                                                title={`${it.quantity} × ${it.product.name}`}
                                            >
                                                {it.quantity} × {it.product.name}
                                            </span>
                                            <span className="font-medium text-gray-900 dark:text-gray-100">
                                                € {(it.price * it.quantity).toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                    {o.order_items.length > 2 && (
                                        <button
                                            onClick={() => setSelectedOrder(o)}
                                            className="text-blue-600 dark:text-blue-400 text-xs hover:underline mt-1"
                                        >
                                            +{o.order_items.length - 2} altri
                                        </button>
                                    )}
                                </div>
                            </div>


                            {/* FOOTER */}
                            <div className="px-4 py-3 border-t flex justify-between items-center">
                                <span className="text-sm font-semibold whitespace-nowrap">
                                    Totale: € {o.total.toFixed(2)}
                                </span>
                                <PaymentBadge status={o.payment_status} />
                            </div>

                            {/* AZIONI */}
                            <div className="px-4 py-3 flex gap-2">
                                {o.status === 'pending' && (
                                    <button
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
                        </div>
                    ))}
                </div>
                {selectedOrder && (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-md w-full mx-4 text-gray-900 dark:text-gray-100">

                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">

                                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">

                                    Prodotti dell’ordine #{selectedOrder.id.slice(0, 6)}
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
