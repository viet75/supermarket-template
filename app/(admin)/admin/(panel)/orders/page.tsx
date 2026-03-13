'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import type { Order } from '@/lib/types'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import { formatPrice } from '@/lib/pricing'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'

function formatQuantity(q: number, unit?: string | null) {
    if (!unit) return q.toString()
    return `${q} ${unit}`
}

function ProductListCell({ items, t }: { items: any[]; t: any }) {
    const locale = useLocale()
    const [showAll, setShowAll] = useState(false)
    const itemsToShow = showAll ? items : items.slice(0, 3)

    if (!items.length) {
        return <span className="text-gray-500 dark:text-gray-400">{t('noProducts')}</span>
    }

    function formatUnit(unit?: string | null): string {
        if (unit === 'per_unit') return locale === 'en' ? '(pcs)' : '(pz)'
        if (unit === 'per_kg') return '(kg)'
        return locale === 'en' ? '(pcs)' : '(pz)'
    }

    return (
        <ul className="space-y-1 md:space-y-1.5 text-gray-700 dark:text-gray-300 leading-tight">
            {itemsToShow.map((item, i) => {
                const name = item.product?.name ?? 'Product'
                const quantity = Number(item.quantity)
                const unit = item.product?.unit_type ?? null
                const unitLabel = formatUnit(unit)

                return (
                    <li key={i} className="flex flex-row items-center">
                        {/* Mobile: vertical layout - UNCHANGED */}
                        <div className="md:hidden text-sm flex flex-col gap-1">
                            <span className="font-medium text-gray-900 dark:text-gray-100">{name}</span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs">
                                {quantity} {unitLabel}
                            </span>
                        </div>
                        {/* Desktop: compact layout on one line */}
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
                    {t('showMore', { count: items.length - 3 })}
                </button>
            )}

            {showAll && items.length > 3 && (
                <button
                    onClick={() => setShowAll(false)}
                    className="text-blue-600 text-sm hover:underline"
                >
                    {t('showLess')}
                </button>
            )}
        </ul>
    )
}

type OrderDrawerProps = {
    order: Order
    onClose: () => void
    t: any
}

function OrderDrawer({ order, onClose, t }: OrderDrawerProps) {
    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Overlay */}
            <div className="flex-1 bg-black bg-opacity-50" onClick={onClose} />

            {/* Drawer */}
            <div className="w-full max-w-md bg-white shadow-xl h-full flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-lg font-semibold">
                        {t('drawerOrderTitle', { id: order.public_id || order.id.slice(0, 8) })}
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
                                {formatPrice(it.price * it.quantity)}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t text-sm flex justify-between">
                    <span>{t('drawerTotal')}</span>
                    <span className="font-semibold">{formatPrice(order.total)}</span>
                </div>
            </div>
        </div>
    )
}
function PaymentBadge(
    { status, payment_method, t }: {
        status: 'pending' | 'paid' | 'failed' | 'refunded' | null | undefined
        payment_method?: string
        t: any
    }
) {
    const normalizedStatus = status || 'pending'

    // Logic to determine badge and style
    let badgeStyle: string
    let badgeLabel: string
    let tooltip: string | undefined

    if (normalizedStatus === 'paid') {
        badgeStyle = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        badgeLabel = t('paymentPaid')
    } else if (normalizedStatus === 'pending' && (payment_method === 'cash' || payment_method === 'pos_on_delivery')) {
        badgeStyle = 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
        badgeLabel = t('paymentToCollect')
        tooltip = t('paymentTooltipCollect')
    } else if (normalizedStatus === 'pending' && payment_method === 'card_online') {
        badgeStyle = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
        badgeLabel = t('paymentStripePending')
    } else if (normalizedStatus === 'failed') {
        badgeStyle = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        badgeLabel = t('paymentFailed')
    } else if (normalizedStatus === 'refunded') {
        badgeStyle = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
        badgeLabel = t('paymentRefunded')
    } else {
        badgeStyle = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
        badgeLabel = t('paymentPending')
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



function StatusBadge({ status, t }: { status: Order['status'], t: any }) {
    const colors: Record<Order['status'], string> = {
        pending: 'bg-yellow-500',
        confirmed: 'bg-blue-500',
        delivered: 'bg-green-600',
        cancelled: 'bg-red-600',
    }

    const labels: Record<Order['status'], string> = {
        pending: t('statusPending'),
        confirmed: t('statusConfirmed'),
        delivered: t('statusDelivered'),
        cancelled: t('statusCancelled'),
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

function formatPayment(pm: string, t: any) {
    switch (pm) {
        case 'cash':
            return t('paymentCashLabel')
        case 'pos_on_delivery':
            return t('paymentPosLabel')
        case 'card_online':
            return t('paymentCardLabel')
        default:
            return pm
    }
}

// Component for horizontal scrollbar (only desktop)
function SyncedHorizontalScroll({ children }: { children: React.ReactNode }) {
    const topScrollRef = useRef<HTMLDivElement>(null)
    const topSpacerRef = useRef<HTMLDivElement>(null)
    const bottomScrollRef = useRef<HTMLDivElement>(null)
    const [showTopScroll, setShowTopScroll] = useState(false)

    // Effect to detect horizontal overflow
    useEffect(() => {
        const bottomEl = bottomScrollRef.current
        if (!bottomEl) return

        const checkOverflow = () => {
            if (bottomEl) {
                const hasOverflow = bottomEl.scrollWidth > bottomEl.clientWidth
                setShowTopScroll(hasOverflow)
            }
        }

        // ResizeObserver to detect horizontal overflow
        const resizeObserver = new ResizeObserver(checkOverflow)
        resizeObserver.observe(bottomEl)

        // Initial check
        checkOverflow()

        return () => {
            resizeObserver.disconnect()
        }
    }, [])

    // Effect to synchronize scroll and update the spacer
    useEffect(() => {
        if (!showTopScroll) return

        const bottomEl = bottomScrollRef.current
        const topEl = topScrollRef.current
        const topSpacerEl = topSpacerRef.current

        if (!bottomEl) return

        // Function to update the spacer
        const updateSpacer = () => {
            if (topSpacerEl && bottomEl) {
                topSpacerEl.style.width = `${bottomEl.scrollWidth}px`
            }
        }

        // ResizeObserver to update the spacer when the size changes
        const resizeObserver = new ResizeObserver(updateSpacer)
        resizeObserver.observe(bottomEl)

        // Update the spacer initially (with delay to ensure topEl is in the DOM)
        const timeoutId = setTimeout(() => {
            updateSpacer()
        }, 10)

        // Synchronize scroll
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
            {/* Upper scrollbar - only desktop, sticky, visible only if there is overflow */}
            {showTopScroll && (
                <div
                    className="hidden md:block sticky top-0 z-30 overflow-x-auto overflow-y-hidden"
                    style={{ height: '17px' }}
                    ref={topScrollRef}
                >
                    <div ref={topSpacerRef} style={{ height: '1px' }} />
                </div>
            )}
            {/* Scrollable container with overflow-x-auto */}
            <div ref={bottomScrollRef} className="overflow-x-auto">
                {children}
            </div>
        </>
    )
}

export default function OrdersAdminPage() {
    const t = useTranslations('adminOrders')
    function mapAdminOrderError(errorCode?: string | null, fallback?: string | null) {
        switch (errorCode) {
            case 'order_not_found':
                return t('orderNotFound')
            case 'orders_load_failed':
                return t('ordersLoadFailed')
            case 'missing_id':
                return t('missingId')
            case 'order_delete_failed':
                return t('orderDeleteFailed')
            case 'invalid_order_action':
                return t('invalidOrderAction')
            case 'cancelled_order_operation_not_allowed':
                return t('cancelledOrderOperationNotAllowed')
            case 'paid_order_cannot_be_cancelled':
                return t('paidOrderCannotBeCancelled')
            case 'paid_order_handling_failed':
                return t('paidOrderHandlingFailed')
            default:
                return fallback || t('genericError')
        }
    }
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


    const loadOrders = useCallback(async (p = 1) => {
        setLoading(true)
        const params = new URLSearchParams({
            page: String(p),
            limit: String(PAGE_SIZE),
        })
        if (statusFilter !== 'all') params.set('status', statusFilter)
        if (paymentFilter !== 'all') params.set('payment_status', paymentFilter)
        if (searchTerm.trim()) params.set('search', searchTerm.trim())

        try {
            const res = await fetch(`/api/admin/orders?${params.toString()}`, {
                cache: 'no-store'
            })
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
    }, [statusFilter, paymentFilter, searchTerm])

    // Refetch wrapper that uses the current page
    const refetchCurrentPage = useCallback(() => {
        loadOrders(page)
    }, [loadOrders, page])

    // Hook for automatic refetch when the app returns to the foreground
    useRefetchOnResume(refetchCurrentPage)

    // Auto-refresh every 30 seconds only when the page is visible
    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null

        const startPolling = () => {
            // Clear existing interval if present
            if (intervalId) {
                clearInterval(intervalId)
            }
            // Create new interval
            intervalId = setInterval(() => {
                if (!document.hidden) {
                    loadOrders(page)
                }
            }, 30000) // 30 seconds
        }

        const stopPolling = () => {
            if (intervalId) {
                clearInterval(intervalId)
                intervalId = null
            }
        }

        // Listener to handle visibility change
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Pause the polling when the page is hidden
                stopPolling()
            } else {
                // Resume the polling when the page becomes visible
                // Reload immediately when visible
                loadOrders(page)
                // Then continue with the interval
                startPolling()
            }
        }

        // Start the polling if the page is visible
        if (!document.hidden) {
            startPolling()
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            stopPolling()
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [loadOrders, page])

    useEffect(() => {
        loadOrders(1)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, paymentFilter])
    // 🔍 Reload orders when the search changes
    useEffect(() => {
        const delay = setTimeout(() => {
            loadOrders(1)
        }, 600)
        return () => clearTimeout(delay)
    }, [searchTerm])


    const updateStatus = useCallback(async (id: string, status: Order['status']) => {
        // Validation: status must be present
        if (!id || !status) {
            alert(t('missingStatusUpdateParams'))
            return
        }

        const order = orders.find((o) => o.id === id)
        if (!order) {
            setUpdating(null)
            return
        }

        // Verify: prevent marking as delivered an offline order that is not paid
        if (
            order.payment_method !== 'card_online' &&
            order.payment_status !== 'paid' &&
            status === 'delivered'
        ) {
            alert(t('markPaidFirst'))
            setUpdating(null)
            return
        }

        setUpdating(id)
        try {
            const payload: { id: string; status: Order['status'] } = { id, status }
            // Final verification: payload must contain at least status
            if (!payload.status) {
                alert(t('invalidStatus'))
                setUpdating(null)
                return
            }
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
                let errorData: unknown = {}
                try {
                    errorData = JSON.parse(text)
                } catch {
                    errorData = {}
                }

                const errorCode =
                    typeof errorData === 'object' &&
                        errorData !== null &&
                        'error_code' in errorData &&
                        typeof errorData.error_code === 'string'
                        ? errorData.error_code
                        : undefined

                const fallbackError =
                    typeof errorData === 'object' &&
                        errorData !== null &&
                        'error' in errorData &&
                        typeof errorData.error === 'string'
                        ? errorData.error
                        : t('statusUpdateFailed')

                alert(mapAdminOrderError(errorCode, fallbackError))
            }
        } catch (error) {
            console.error('Errore updateStatus:', error)
            alert(t('statusUpdateFailed'))
        } finally {
            setUpdating(null)
        }
    }, [orders])

    const updatePaymentStatus = useCallback(async (id: string, payment_status: 'paid') => {
        // Validation: payment_status must be present
        if (!id || !payment_status) {
            alert(t('missingPaymentUpdateParams'))
            return
        }

        setUpdating(id)
        try {
            const payload: { id: string; payment_status: 'paid' } = { id, payment_status }
            // Final verification: payload must contain at least payment_status
            if (!payload.payment_status) {
                alert(t('invalidPaymentStatus'))
                setUpdating(null)
                return
            }
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
                let errorData: unknown = {}
                try {
                    errorData = JSON.parse(text)
                } catch {
                    errorData = {}
                }

                const errorCode =
                    typeof errorData === 'object' &&
                        errorData !== null &&
                        'error_code' in errorData &&
                        typeof errorData.error_code === 'string'
                        ? errorData.error_code
                        : undefined

                const fallbackError =
                    typeof errorData === 'object' &&
                        errorData !== null &&
                        'error' in errorData &&
                        typeof errorData.error === 'string'
                        ? errorData.error
                        : t('paymentUpdateFailed')

                alert(mapAdminOrderError(errorCode, fallbackError))
            }
        } catch (error) {
            console.error('Errore updatePaymentStatus:', error)
            alert(t('paymentUpdateFailed'))
        } finally {
            setUpdating(null)
        }
    }, [])

    if (loading) return <p>{t('loading')}</p>

    return (
        <div className="flex justify-center w-full bg-gray-50 dark:bg-gray-900">

            <div className="w-full max-w-7xl p-6 overflow-x-auto text-gray-900 dark:text-gray-100">



                <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                    {t('title')}
                </h1>

                {/* Filtri */}
                <div className="hidden md:flex items-center gap-3 mb-4">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded px-3 py-2 text-sm"

                    >
                        <option value="all">{t('statusAll')}</option>
                        <option value="pending">{t('statusPending')}</option>
                        <option value="confirmed">{t('statusConfirmed')}</option>
                        <option value="delivered">{t('statusDelivered')}</option>
                        <option value="cancelled">{t('statusCancelled')}</option>
                    </select>

                    <select
                        value={paymentFilter}
                        onChange={(e) => setPaymentFilter(e.target.value as any)}
                        className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded px-3 py-2 text-sm"

                    >
                        <option value="all">{t('paymentsAll')}</option>
                        <option value="pending">{t('statusPending')}</option>
                        <option value="paid">{t('paymentPaid')}</option>
                        <option value="failed">{t('paymentFailed')}</option>
                        <option value="refunded">{t('paymentRefunded')}</option>
                    </select>
                </div>

                {/* Search bar - only desktop */}
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
                        placeholder={t('searchPlaceholderDesktop')}

                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"

                    />
                </div>


                {/* Table desktop */}
                <div className="hidden md:flex justify-center w-full">
                    <div className="relative w-full max-w-7xl">
                        {/* Scroll indicator shadow */}
                        <div
                            className="pointer-events-none absolute right-0 top-0 h-full w-8
                                       bg-gradient-to-l from-gray-50 to-transparent
                                       dark:from-gray-900 z-20"
                        />

                        {/* Scroll container with synchronized upper scrollbar */}
                        <SyncedHorizontalScroll>
                            <table className="min-w-[900px] w-full table-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 shadow-sm">


                                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 sticky top-0 z-10">

                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-semibold w-16">{t('tableId')}</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold w-40">{t('tableDate')}</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold">{t('tableAddress')}</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold w-40">{t('tableCustomer')}</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold">{t('tableProducts')}</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold w-24 min-w-[90px]">{t('tableTotal')}</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold w-36">{t('tablePayment')}</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold w-28">{t('tableStatus')}</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold w-40">{t('tableActions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredOrders.map((o) => (
                                        <tr
                                            key={o.id}
                                            className="border-t border-gray-200 dark:border-gray-700 even:bg-gray-50 dark:even:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"

                                        >
                                            {/* Order ID */}
                                            <td className="px-4 py-2 text-sm align-top">
                                                <Link
                                                    href={`/admin/orders/${o.id}`}
                                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                                >
                                                    {o.public_id || o.id.slice(0, 8)}
                                                </Link>
                                            </td>


                                            {/* Data */}
                                            <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 align-top">
                                                {formatDate(o.created_at)}
                                            </td>

                                            {/* Address */}
                                            <td
                                                className="px-4 py-2 text-sm text-gray-600 max-w-xs dark:text-gray-300 align-top"
                                                title={`${o.address?.line1}, ${o.address?.cap} ${o.address?.city}${o.address?.note?.trim() ? `\nNote: ${o.address.note}` : ''}`}
                                            >
                                                <div className="truncate">{o.address?.line1}, {o.address?.cap} {o.address?.city}</div>
                                                {o.address?.note?.trim() && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]" title={o.address.note}>
                                                        Note: {o.address.note}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Customer */}
                                            <td
                                                className="px-4 py-2 text-sm text-gray-700 font-medium truncate max-w-xs dark:text-gray-300 align-top"
                                                title={`${(o.first_name || o.address?.firstName) ?? ''} ${(o.last_name || o.address?.lastName) ?? ''}`}
                                            >
                                                {(o.first_name || o.address?.firstName) ?? ''}{' '}
                                                {(o.last_name || o.address?.lastName) ?? ''}
                                                {o.customer_phone ? (
                                                    <div className="text-xs text-gray-600 dark:text-zinc-300">
                                                        📞 {o.customer_phone}
                                                    </div>
                                                ) : null}
                                            </td>

                                            {/* Products */}
                                            <td className="px-4 py-2 text-sm max-w-xs align-top">
                                                <ProductListCell items={o.order_items || []} t={t} />
                                            </td>

                                            {/* Total */}
                                            <td className="px-4 py-2 text-sm font-semibold text-right text-gray-900 dark:text-gray-100 whitespace-nowrap min-w-[90px] w-24 align-top">

                                                {formatPrice(o.total)}
                                            </td>

                                            {/* Payment */}
                                            <td className="px-4 py-2 text-center text-sm align-top">
                                                <div className="flex flex-col items-center gap-1">
                                                    {/* ✅ Payment status badge */}
                                                    <PaymentBadge status={o.payment_status} payment_method={o.payment_method} t={t} />

                                                    {/* Payment method */}
                                                    <span
                                                        className="text-xs text-gray-500 truncate max-w-[24ch] dark:text-gray-300"
                                                        title={formatPayment(o.payment_method, t)}
                                                    >
                                                        {formatPayment(o.payment_method, t)}
                                                    </span>



                                                </div>
                                            </td>


                                            {/* Status */}
                                            <td className="px-4 py-2 text-center align-top">
                                                <StatusBadge status={o.status} t={t} />
                                            </td>

                                            {/* Actions */}
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
                                                                {t('confirm')}
                                                            </button>
                                                        )}

                                                        {o.status === 'confirmed' && (
                                                            <button
                                                                type="button"
                                                                disabled={updating === o.id}
                                                                onClick={() => updateStatus(o.id, 'delivered')}
                                                                className="flex items-center gap-1 px-3 py-1 rounded bg-green-500 text-white text-sm hover:bg-green-600 disabled:opacity-50 transition-colors"
                                                            >
                                                                {t('delivered')}
                                                            </button>
                                                        )}

                                                        {o.status !== 'cancelled' && o.status !== 'delivered' && (
                                                            <button
                                                                type="button"
                                                                disabled={updating === o.id}
                                                                onClick={() => updateStatus(o.id, 'cancelled')}
                                                                className="flex items-center gap-1 px-3 py-1 rounded bg-red-500 text-white text-sm hover:bg-red-600 disabled:opacity-50 transition-colors"
                                                            >
                                                                {t('cancel')}
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
                                                            {t('markAsPaid')}
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
                {/* Pagination */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mt-6 gap-2 md:gap-0 w-full max-w-7xl mx-auto px-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400 text-center md:text-left">

                        {t('pageLabel', { page, totalPages })}
                    </span>
                    <div className="flex justify-center md:justify-end gap-2">
                        <button
                            onClick={() => loadOrders(page - 1)}
                            disabled={page <= 1}
                            className="px-3 py-2 text-sm border rounded disabled:opacity-50 hover:bg-gray-100"
                        >
                            {t('previous')}
                        </button>
                        <button
                            onClick={() => loadOrders(page + 1)}
                            disabled={page >= totalPages}
                            className="px-3 py-2 text-sm border rounded disabled:opacity-50 hover:bg-gray-100"
                        >
                            {t('next')}
                        </button>
                    </div>
                </div>



                {/* MOBILE VIEW (mobile view) */}
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
                        placeholder={t('searchPlaceholderMobile')}
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
                                <Link
                                    href={`/admin/orders/${o.id}`}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    {t('orderPrefix')} #{o.public_id || o.id.slice(0, 8)}
                                </Link>
                                <div className="shrink-0">
                                    <StatusBadge status={o.status} t={t} />
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
                                {o.customer_phone ? (
                                    <div className="text-xs text-gray-600 dark:text-zinc-300">
                                        📞 {o.customer_phone}
                                    </div>
                                ) : null}

                                <p
                                    className="text-xs text-gray-500 dark:text-gray-300 break-words"
                                    title={`${o.address?.line1}, ${o.address?.cap} ${o.address?.city}`}
                                >
                                    📍 {o.address?.line1}, {o.address?.cap} {o.address?.city}
                                </p>
                                {o.address?.note?.trim() && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 break-words" title={o.address.note}>
                                        {t('notesPrefix')}: {o.address.note}
                                    </p>
                                )}

                                {/* Prodotti */}
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    <ProductListCell items={o.order_items || []} t={t} />
                                </div>
                            </div>


                            {/* FOOTER */}
                            <div className="px-4 py-3 border-t flex justify-between items-center">
                                <span className="text-sm font-semibold whitespace-nowrap">
                                    {t('totalLabel')}: {formatPrice(o.total)}
                                </span>
                                <PaymentBadge status={o.payment_status} payment_method={o.payment_method} t={t} />
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
                                    {t('drawerProductsTitle', { id: selectedOrder.public_id || selectedOrder.id.slice(0, 8) })}
                                </h2>
                                <button
                                    onClick={() => setSelectedOrder(null)}
                                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"
                                >
                                    ✕
                                </button>
                            </div>

                            {selectedOrder.address?.note?.trim() && (
                                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                                    <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('courierNotes')}</h3>
                                    <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                                        {selectedOrder.address.note.trim()}
                                    </div>
                                </div>
                            )}

                            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                                {selectedOrder.order_items.map((it, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="truncate w-2/3">
                                            {it.quantity} × {it.product.name}
                                            {it.product.unit_type && ` (${it.product.unit_type})`}
                                        </span>
                                        <span className="font-medium">
                                            {formatPrice(it.price * it.quantity)}
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
