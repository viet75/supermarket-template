'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { Order } from '@/lib/types'
import { formatPrice } from '@/lib/pricing'

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString()
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

export default function OrderDetailPage() {
    const params = useParams()
    const id = typeof params.id === 'string' ? params.id : ''
    const [order, setOrder] = useState<Order | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!id) {
            setLoading(false)
            setError('ID ordine mancante')
            return
        }
        fetch(`/api/admin/orders?id=${encodeURIComponent(id)}`)
            .then((res) => {
                if (!res.ok) {
                    if (res.status === 404) throw new Error('Ordine non trovato')
                    throw new Error('Errore caricamento ordine')
                }
                return res.json()
            })
            .then((data) => {
                setOrder(data.order ?? null)
                setError(null)
            })
            .catch((e) => {
                setError(e.message ?? 'Errore')
                setOrder(null)
            })
            .finally(() => setLoading(false))
    }, [id])

    if (loading) return <div className="p-6">Caricamento…</div>
    if (error || !order) {
        return (
            <div className="p-6">
                <p className="text-red-600 dark:text-red-400">{error ?? 'Ordine non trovato'}</p>
                <Link href="/admin/orders" className="mt-4 inline-block text-blue-600 hover:underline">
                    ← Torna alla lista ordini
                </Link>
            </div>
        )
    }

    const notes = order.address?.note?.trim() ?? ''

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    Ordine {order.public_id || order.id.slice(0, 8)}
                </h1>
                <Link
                    href="/admin/orders"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                    ← Lista ordini
                </Link>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3 text-sm">
                <p className="text-gray-500 dark:text-gray-400">
                    {formatDate(order.created_at)}
                </p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                    {(order.first_name ?? order.address?.firstName ?? '')}{' '}
                    {(order.last_name ?? order.address?.lastName ?? '')}
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                    📍 {order.address?.line1}, {order.address?.cap} {order.address?.city}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                    {formatPayment(order.payment_method)} · Totale {formatPrice(order.total)}
                </p>
            </div>

            {notes ? (
                <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Note per il corriere
                    </h2>
                    <div
                        className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words"
                    >
                        {notes}
                    </div>
                </div>
            ) : null}

            <div className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Prodotti
                </h2>
                <ul className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                    {order.order_items?.map((it: any, idx: number) => (
                        <li
                            key={idx}
                            className="flex justify-between items-center px-4 py-2 text-sm"
                        >
                            <span className="text-gray-900 dark:text-gray-100">
                                {it.quantity} × {it.product?.name ?? 'Prodotto'}
                            </span>
                            <span className="font-medium">
                                {formatPrice((it.price ?? 0) * (it.quantity ?? 0))}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Riepilogo costi
                </h2>
                <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-gray-700 dark:text-gray-300">
                        <span>Subtotale prodotti</span>
                        <span>{formatPrice(Number(order.subtotal) || 0)}</span>
                    </div>
                    <div className="flex justify-between text-gray-700 dark:text-gray-300">
                        <span>Costo consegna</span>
                        <span>{formatPrice(Number.isFinite(Number(order.delivery_fee)) ? Number(order.delivery_fee) : 0)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-gray-900 dark:text-gray-100 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <span>Totale</span>
                        <span>{formatPrice(Number(order.total) || 0)}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
