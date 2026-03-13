import { NextResponse } from 'next/server'
import { supabaseServiceRole } from '@/lib/supabaseService'
import type { OrderPayload, StoreSettings, PaymentMethod } from '@/lib/types'
import { geocodeAddress, computeDistanceFromStore } from '@/lib/geo'
import { calculateDeliveryFee, normalizeDeliveryMaxKm } from '@/lib/delivery'
import { reserveOrderStock } from '@/lib/reserveOrderStock'
import { release_order_stock } from '@/lib/releaseOrderStock'
import { getStripe } from '@/lib/stripe'
import { cleanupExpiredReservations } from '@/lib/cleanupExpiredReservations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function round2(n: number) {
    return Math.round(n * 100) / 100
}

// 🔎 Robust helper to normalize numbers (accepts "8,5", "8.5", number or string)
function parseDec(v: unknown, field: string): number {
    // If it's already a valid number, return it directly
    if (typeof v === 'number') {
        if (isNaN(v) || !isFinite(v) || v <= 0) {
            throw new Error(`Invalid ${field}: must be a positive number`)
        }
        return parseFloat(v.toFixed(3)) // keep up to 3 decimal places
    }

    // If it's null/undefined, error
    if (v === null || v === undefined) {
        throw new Error(`Invalid ${field}: value is required`)
    }

    // Convert to string and clean
    let s = String(v).trim()
    if (s === '' || s.toLowerCase() === 'nan') {
        throw new Error(`Invalid ${field}: empty or NaN`)
    }

    // Replace Italian comma with dot
    s = s.replace(',', '.')

    // Remove any spaces
    s = s.replace(/\s/g, '')

    // Parse
    const n = parseFloat(s)
    if (isNaN(n) || !isFinite(n)) {
        throw new Error(`Invalid ${field}: not a valid number`)
    }

    // Validate that it is positive
    if (n <= 0) {
        throw new Error(`Invalid ${field}: must be greater than 0`)
    }

    return parseFloat(n.toFixed(3)) // keep up to 3 decimal places
}

async function loadSettings(): Promise<StoreSettings | null> {
    const { data, error } = await supabaseServiceRole
        .from('store_settings')
        .select('*')
        .limit(1)
        .maybeSingle()

    if (error) {
        console.error('❌ Errore loadSettings:', error.message)
        return null
    }

    return (data ?? null) as StoreSettings | null
}
async function loadProductsForReconcile(productIds: string[]) {
    if (!productIds.length) return []

    const uniqueIds = [...new Set(productIds.map(String))]

    const { data, error } = await supabaseServiceRole
        .from('products')
        .select('id, stock, stock_unlimited')
        .in('id', uniqueIds)

    if (error) {
        console.error('❌ Errore loadProductsForReconcile:', error.message)
        return []
    }

    return data ?? []
}

/** Normalize payment methods from body */
function normalizePaymentMethod(pm: string): PaymentMethod | null {
    switch (pm) {
        case 'cash':
            return 'cash'
        case 'card':
            return 'pos_on_delivery'
        case 'online':
        case 'card_online':
            return 'card_online'
        case 'pos_on_delivery':
            return 'pos_on_delivery'
        default:
            return null
    }
}

/** GET: health check */
export async function GET() {
    const envOk = {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    }

    const ss = await supabaseServiceRole
        .from('store_settings')
        .select('id, updated_at')
        .limit(1)

    const ord = await supabaseServiceRole
        .from('orders')
        .select(
            'id, items, subtotal, delivery_fee, total, address, distance_km, payment_method, status, created_at'
        )
        .limit(0)

    return NextResponse.json({
        ok: true,
        checks: {
            envOk,
            store_settings: { status: ss.error ? 'error' : 'ok', error: ss.error?.message ?? null },
            orders: { status: ord.error ? 'error' : 'ok', error: ord.error?.message ?? null },
        },
    })
}

/** POST: create order with validations + distance calculation */
export async function POST(req: Request) {
    try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json(
                {
                    error_code: 'env_missing',
                    error: 'Missing environment variables',
                },
                { status: 500 }
            )
        }

        // Lazy cleanup (backup): release expired orders before creating a new order
        // If the cron is not running, the first user who makes an order unlocks the stock
        await cleanupExpiredReservations()

        const body = await req.json()

        // 🧾 Debug: log items payload
        console.log('🧾 /api/orders items payload:', JSON.stringify(body?.items ?? body?.order_items ?? null))

        // Validate base fields
        if (!Array.isArray(body.items) || body.items.length === 0) {
            return NextResponse.json(
                {
                    error_code: 'empty_cart',
                    error: 'Cart is empty',
                },
                { status: 400 }
            )
        }

        if (!body.address?.line1 || !body.address?.city || !body.address?.cap) {
            return NextResponse.json(
                {
                    error_code: 'incomplete_address',
                    error: 'Incomplete address',
                },
                { status: 400 }
            )
        }

        // Load store settings
        const settings = await loadSettings()
        if (!settings) {
            return NextResponse.json(
                {
                    error_code: 'store_settings_unavailable',
                    error: 'Unable to load store settings',
                },
                { status: 500 }
            )
        }

        const deliveryEnabled = settings.delivery_enabled
        if (deliveryEnabled !== true) {
            return NextResponse.json(
                {
                    error_code: 'delivery_disabled',
                    error: 'Delivery is temporarily disabled',
                    code: 'DELIVERY_DISABLED',
                    message: 'Delivery is temporarily disabled',
                },
                { status: 409 }
            )
        }

        // Validation of fulfillment: hours, cutoff, closures (same RPC used by the UI)
        const { data: fpData, error: fpErr } = await supabaseServiceRole.rpc('get_fulfillment_preview')
        const fp = (Array.isArray(fpData) ? fpData[0] : fpData) as {
            can_accept?: boolean
            message?: string
            next_fulfillment_date?: string | null
        } | null

        let fulfillmentDate: string | null = null
        let fulfillmentMessage = ''

        if (!fpErr && fp) {
            if (fp.can_accept === false) {
                const storeClosedMsg = fp.message ?? 'Store closed. Orders are not accepted.'
                return NextResponse.json(
                    {
                        ok: false,
                        error_code: 'store_closed',
                        error: storeClosedMsg,
                        code: 'STORE_CLOSED',
                        message: storeClosedMsg,
                    },
                    { status: 409, headers: { 'Cache-Control': 'no-store' } }
                )
            }

            fulfillmentDate =
                fp.next_fulfillment_date && /^\d{4}-\d{2}-\d{2}$/.test(String(fp.next_fulfillment_date))
                    ? String(fp.next_fulfillment_date)
                    : null

            fulfillmentMessage = fp.message ? String(fp.message) : ''
        }

        // Build baseUrl from the current request domain (works in Preview and Production)
        const url = new URL(req.url)
        const baseUrl = `${url.protocol}//${url.host}`

        // Build and validate geocoding query
        const query = [body.address.line1, body.address.cap, body.address.city]
            .filter(Boolean)
            .map((s: any) => String(s).trim())
            .filter((s: string) => s.length > 0)
            .join(', ')

        if (!query || query.trim().length === 0) {
            return NextResponse.json(
                {
                    error_code: 'incomplete_address',
                    error: 'Incomplete address',
                },
                { status: 400 }
            )
        }

        // Validate CAP and city with geocoding before creating the order
        const zip = body.address.cap ? String(body.address.cap).trim() : null
        const city = body.address.city ? String(body.address.city).trim() : null

        // Validate CAP format
        if (!zip || !/^\d{5}$/.test(zip) || zip === '00000') {
            return NextResponse.json(
                {
                    error_code: 'invalid_zip',
                    error: 'Invalid ZIP code',
                },
                { status: 400 }
            )
        }

        // Call geocoding with CAP and city validation
        const geocodeUrl = `${baseUrl}/api/geocode?q=${encodeURIComponent(query.trim())}&zip=${encodeURIComponent(zip)}&city=${encodeURIComponent(city || '')}`

        let geocodeData: any = null
        try {
            const geocodeRes = await fetch(geocodeUrl)
            const text = await geocodeRes.text()
            geocodeData = JSON.parse(text)
        } catch (err) {
            console.error('❌ Geocoding error:', err)
            return NextResponse.json(
                {
                    error_code: 'geocode_failed',
                    error: 'Unable to geocode customer address',
                },
                { status: 400 }
            )
        }

        if (!geocodeData.ok) {
            return NextResponse.json(
                {
                    error_code: 'invalid_zip',
                    error: 'Invalid ZIP code',
                },
                { status: 400 }
            )
        }

        const clientCoords = { lat: geocodeData.lat, lng: geocodeData.lng }
        const distanceKm = computeDistanceFromStore(settings, clientCoords)

        // Validation of maximum radius from environment variable
        const MAX_RADIUS_KM = Number(process.env.NEXT_PUBLIC_DELIVERY_RADIUS_KM ?? 0)
        if (MAX_RADIUS_KM > 0 && distanceKm > MAX_RADIUS_KM) {
            return NextResponse.json(
                {
                    error_code: 'outside_delivery_area',
                    error: 'Address outside delivery area',
                },
                { status: 400 }
            )
        }

        // Calculate delivery fee on server side (ignore any delivery_fee from frontend)
        let deliveryFee = 0
        if (settings.delivery_enabled) {
            // Read delivery fields from database (they may not be in the TypeScript type)
            const settingsData = settings as any
            const baseKm = Number(settingsData.delivery_base_km ?? 0)
            const baseFee = Number(settingsData.delivery_base_fee ?? settings.delivery_fee_base ?? 0)
            const extraFeePerKm = Number(settingsData.delivery_extra_fee_per_km ?? settings.delivery_fee_per_km ?? 0)
            const maxKmSafe = normalizeDeliveryMaxKm(settings.delivery_max_km)

            if (maxKmSafe !== null && distanceKm > maxKmSafe) {
                return NextResponse.json(
                    {
                        error_code: 'outside_delivery_area',
                        error: 'Address outside delivery area',
                    },
                    { status: 400 }
                )
            }

            try {
                deliveryFee = calculateDeliveryFee({
                    distanceKm,
                    baseKm,
                    baseFee,
                    extraFeePerKm,
                    maxKm: maxKmSafe,
                })
            } catch (error: any) {
                return NextResponse.json(
                    {
                        error_code: 'delivery_fee_calculation_failed',
                        error: error.message || 'Delivery fee calculation failed',
                    },
                    { status: 400 }
                )
            }
        }

        // Validation of payment method with normalization
        const pm = normalizePaymentMethod(body.payment_method as string)
        if (!pm || !settings.payment_methods.includes(pm)) {
            return NextResponse.json(
                {
                    error_code: 'payment_method_unavailable',
                    error: 'Payment method not available',
                },
                { status: 400 }
            )
        }

        // Normalize items with robust validation
        let items: { id: string; quantity: number; price: number; unit?: 'per_unit' | 'per_kg' }[] = []
        try {
            items = body.items.map((it: {
                id: string
                price?: number | string
                qty?: number | string
                quantity?: number | string
                unit?: 'per_unit' | 'per_kg' | string
            }) => {
                const unit = it.unit === 'per_kg' || it.unit === 'per_unit' ? it.unit : undefined
                // Normalize quantity: accept number, string with Italian comma, or string with dot
                const rawQty = it.qty ?? it.quantity ?? 1
                const normalizedQty = parseDec(rawQty, 'quantity')
                const qty = unit === 'per_kg' ? parseFloat(normalizedQty.toFixed(3)) : normalizedQty
                // Normalizza price
                const normalizedPrice = parseDec(it.price ?? 0, 'price')
                return {
                    id: it.id,
                    price: normalizedPrice,
                    quantity: qty,
                    unit,
                }
            })
        } catch (e: any) {
            return NextResponse.json(
                {
                    error_code: 'invalid_numeric_format',
                    error: e?.message ?? 'Invalid numeric format',
                },
                { status: 400 }
            )
        }

        // Validation of items (double check for security)
        for (const it of items) {
            if (!it.id || !Number.isFinite(it.quantity) || it.quantity <= 0) {
                return NextResponse.json(
                    {
                        error_code: 'invalid_items_format',
                        error: 'Invalid items format',
                    },
                    { status: 400 }
                )
            }
        }

        // ✅ Verify product existence and load unit_type, qty_step, name for validation
        const requestedIds = [...new Set(items.map((it) => it.id))]
        const { data: existingProducts, error: existingErr } = await supabaseServiceRole
            .from('products')
            .select('id, name, unit_type, qty_step')
            .in('id', requestedIds)

        if (existingErr) {
            console.error('❌ Errore verifica prodotti:', existingErr)
            return NextResponse.json(
                {
                    error_code: 'product_check_failed',
                    error: 'Product verification failed',
                },
                { status: 500, headers: { 'Cache-Control': 'no-store' } }
            )
        }

        const productsById = new Map((existingProducts ?? []).map((p: any) => [p.id, p]))
        const existingSet = new Set(productsById.keys())
        const missing = requestedIds.filter((id) => !existingSet.has(id))

        if (missing.length > 0) {
            console.warn('⚠️ Product IDs mancanti nel DB:', missing)

            const reconcileProducts = await loadProductsForReconcile(requestedIds)

            return NextResponse.json(
                {
                    error_code: 'products_not_found',
                    error: 'Some products in the cart are no longer available. Clear the cart and try again.',
                    code: 'PRODUCTS_NOT_FOUND',
                    message: 'Some products in the cart are no longer available. Clear the cart and try again.',
                    missing_product_ids: missing,
                    products: reconcileProducts,
                },
                { status: 400, headers: { 'Cache-Control': 'no-store' } }
            )
        }

        // Validation of qty_step (anti-tamper): per_kg => qty multiple of step; per_unit => qty integer
        const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000

        for (const it of items) {
            const product = productsById.get(it.id) as {
                id: string
                name?: string
                unit_type?: string | null
                qty_step?: number | null
            } | undefined

            if (!product) continue

            const unitType = product.unit_type || 'per_unit'
            const productName = product.name || product.id

            if (unitType === 'per_kg') {
                const step = product.qty_step != null && product.qty_step > 0 ? product.qty_step : 0.1
                const q = round3(it.quantity)
                const s = round3(step)
                const k = s > 0 ? q / s : 0

                if (Math.abs(k - Math.round(k)) >= 1e-6) {
                    return NextResponse.json(
                        {
                            error_code: 'invalid_qty_step',
                            error: `Invalid quantity for ${productName}. Select multiples of ${s} kg.`,
                            code: 'INVALID_QTY_STEP',
                            message: `Invalid quantity for ${productName}. Select multiples of ${s} kg.`,
                        },
                        { status: 400, headers: { 'Cache-Control': 'no-store' } }
                    )
                }
            } else {
                if (Math.abs(it.quantity - Math.round(it.quantity)) > 1e-6) {
                    return NextResponse.json(
                        {
                            error_code: 'invalid_qty_unit',
                            error: `Invalid quantity for ${productName}. Unit products require an integer quantity.`,
                            code: 'INVALID_QTY_UNIT',
                            message: `Invalid quantity for ${productName}. Unit products require an integer quantity.`,
                        },
                        { status: 400, headers: { 'Cache-Control': 'no-store' } }
                    )
                }
            }
        }

        // Calculate totals (ignore delivery_fee from frontend, use the one calculated on server side)
        const safeSubtotal = parseDec(body.subtotal, 'subtotal')
        const total = round2(safeSubtotal + deliveryFee)

        // Create the order directly
        // IMPORTANT: stock_reserved must be false at insert, it will be set to true only by reserveOrderStock
        const { data: orderData, error: orderError } = await supabaseServiceRole
            .from('orders')
            .insert({
                subtotal: safeSubtotal,
                delivery_fee: deliveryFee,
                total: total,
                address: body.address,
                customer_phone: String(body?.customer_phone ?? body?.address?.phone ?? '').trim() || null,
                payment_method: pm,
                payment_status: 'pending',
                status: 'pending',
                distance_km: round2(distanceKm),
                stock_reserved: false, // Forced to false: it will be set to true only by reserveOrderStock after successful decrement
                ...(fulfillmentDate && { fulfillment_date: fulfillmentDate }),
            })
            .select('id')
            .single()

        if (orderError || !orderData) {
            console.error('❌ Order creation error:', JSON.stringify(orderError, null, 2))
            const msg = (orderError as any)?.message || 'Order creation failed'
            return NextResponse.json(
                {
                    error_code: 'order_creation_failed',
                    error: msg,
                },
                { status: 500 }
            )
        }

        const newOrderId = orderData.id
        let stockCommitted = false // Track if reserveOrderStock succeeded

        // --- Insertion of order_items (bulk) --- //
        // Product archived: (1) two browsers; (2) A adds product to cart; (3) B sets products.archived=true; (4) A confirms order → 409 PRODUCTS_NOT_AVAILABLE, cart reconciled.
        const orderItemsRows = items.map((it) => ({
            order_id: newOrderId,
            product_id: it.id,
            quantity: it.quantity,
            price: it.price,
        }))

        const { error: itemsInsertErr } = await supabaseServiceRole
            .from('order_items')
            .insert(orderItemsRows)

        if (itemsInsertErr) {
            console.error('❌ Order items insertion error:', itemsInsertErr)

            // Cleanup: delete order (cascade if FK with on delete cascade, otherwise delete items and then order)
            try {
                await supabaseServiceRole.from('order_items').delete().eq('order_id', newOrderId)
            } catch {
                /* ignore */
            }

            try {
                await supabaseServiceRole.from('orders').delete().eq('id', newOrderId)
            } catch {
                /* ignore */
            }

            const errMsg = String((itemsInsertErr as { message?: string })?.message ?? '')
            const errCode = (itemsInsertErr as { code?: string })?.code
            const isProductUnavailable =
                errMsg.includes('PRODUCT_UNAVAILABLE') || errCode === 'P0001'

            if (isProductUnavailable) {
                const reconcileProducts = await loadProductsForReconcile(requestedIds)

                return NextResponse.json(
                    {
                        ok: false,
                        error_code: 'products_not_available',
                        error: 'Some products are no longer available. We updated the cart.',
                        code: 'PRODUCTS_NOT_AVAILABLE',
                        message: 'Some products are no longer available. We updated the cart.',
                        products: reconcileProducts,
                    },
                    { status: 409, headers: { 'Cache-Control': 'no-store' } }
                )
            }

            if (errCode === '23503') {
                const reconcileProducts = await loadProductsForReconcile(requestedIds)

                return NextResponse.json(
                    {
                        error_code: 'products_not_found',
                        error: 'Some products in the cart are no longer available. Clear the cart and try again.',
                        code: 'PRODUCTS_NOT_FOUND',
                        message: 'Some products in the cart are no longer available. Clear the cart and try again.',
                        products: reconcileProducts,
                    },
                    { status: 400, headers: { 'Cache-Control': 'no-store' } }
                )
            }

            return NextResponse.json(
                {
                    error_code: 'order_items_save_failed',
                    error: 'Error while saving order items',
                },
                { status: 500, headers: { 'Cache-Control': 'no-store' } }
            )
        }

        // Reserve stock after insertion of all order_items
        try {
            await reserveOrderStock(newOrderId)
            stockCommitted = true // Mark that stock reservation succeeded
        } catch (error) {
            // 📦 Debug: log stock check details before returning error
            const errorMessage =
                error instanceof Error ? error.message : 'Stock not available for one or more products'

            // Extract product name from error message if it matches pattern "Stock insufficient per <productName>"
            const stockErrorMatch = errorMessage.match(/Stock insufficiente per (.+)/)
            if (stockErrorMatch) {
                const productName = stockErrorMatch[1]

                // Query order_items with products to get full product details
                const { data: orderItemsWithProducts } = await supabaseServiceRole
                    .from('order_items')
                    .select('quantity, product_id, products(id, name, stock, unit_type, stock_unlimited)')
                    .eq('order_id', newOrderId)

                if (orderItemsWithProducts && orderItemsWithProducts.length > 0) {
                    // Find the product that matches the error
                    for (const oi of orderItemsWithProducts) {
                        let productData = (oi as any).products
                        if (Array.isArray(productData)) {
                            productData = productData[0] || null
                        }
                        if (productData && productData.name === productName) {
                            console.log('📦 Stock check', {
                                productId: oi.product_id,
                                productName: productData.name,
                                unitType: productData.unit_type || null,
                                stock: productData.stock ?? null,
                                stockUnlimited: productData.stock_unlimited ?? false,
                                requestedQty: oi.quantity,
                            })
                            break
                        }
                    }
                }
            }

            const reconcileProducts = await loadProductsForReconcile(requestedIds)

            // Cleanup: delete order_items and order
            await supabaseServiceRole.from('order_items').delete().eq('order_id', newOrderId)
            await supabaseServiceRole.from('orders').delete().eq('id', newOrderId)

            // Stock insufficient: HTTP 409 + code STOCK_INSUFFICIENT for dedicated UX
            const isStockError =
                errorMessage.includes('INSUFFICIENT_STOCK') || errorMessage.includes('Stock insufficiente')

            const status = isStockError ? 409 : 400
            const responseBody = isStockError
                ? {
                    ok: false,
                    error_code: 'stock_insufficient',
                    error: 'Some products are no longer available. We updated the cart.',
                    code: 'STOCK_INSUFFICIENT',
                    message: 'Some products are no longer available. We updated the cart.',
                    products: reconcileProducts,  
                }
                : {
                    error_code: 'stock_reservation_failed',
                    error: errorMessage,
                }

            return NextResponse.json(responseBody, {
                status,
                headers: { 'Cache-Control': 'no-store' },
            })
        }

        // Wrap everything after reserveOrderStock in try/catch for rollback protection
        try {
            // Set stock_committed=true and reserve_expires_at based on payment method
            let reserveExpiresAt: string | null = null
            let stockReserved: boolean

            if (pm === 'card_online') {
                // TTL different for dev/prod
                const TTL_MINUTES =
                    process.env.NODE_ENV === 'development' ? 1 : 15

                const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000)
                reserveExpiresAt = expiresAt.toISOString()
                stockReserved = true
            } else {
                // For cash/pos_on_delivery: not a temporary reservation, so stock_reserved=false
                stockReserved = false
            }

            // Update order: stock_committed=true for all methods, stock_reserved and reserve_expires_at only for card_online
            await supabaseServiceRole
                .from('orders')
                .update({
                    stock_committed: true,
                    stock_reserved: stockReserved,
                    reserve_expires_at: reserveExpiresAt,
                })
                .eq('id', newOrderId)

            // If payment_method is card_online, create Stripe Checkout Session
            let checkoutUrl: string | null = null
            if (pm === 'card_online') {
                try {
                    // Read order_items with join products to get name, unit_type, image_url
                    const { data: orderItems, error: itemsError } = await supabaseServiceRole
                        .from('order_items')
                        .select('quantity, price, products(id, name, unit_type, image_url)')
                        .eq('order_id', newOrderId)

                    if (itemsError || !orderItems || orderItems.length === 0) {
                        throw new Error('Error loading order items for checkout')
                    }

                    // Build line_items for Stripe
                    const line_items = orderItems.map((it: any) => {
                        // Normalize product data
                        let productData = it.products
                        if (Array.isArray(productData)) {
                            productData = productData[0] || null
                        }

                        const productName = productData?.name || 'Prodotto'
                        const unitType = productData?.unit_type || 'per_unit'
                        const imageUrl = productData?.image_url || null
                        const quantity = Number(it.quantity) || 1
                        const price = Number(it.price) || 0

                        // Stripe accepts only integer quantities
                        // If the product is "per_kg", incorporate the quantity into the price (label always in kg)
                        if (unitType === 'per_kg') {
                            const qtyKg = Math.round((quantity + Number.EPSILON) * 1000) / 1000
                            const qtyFormatted = new Intl.NumberFormat('it-IT', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 3,
                            }).format(qtyKg)

                            return {
                                quantity: 1, // always 1 for weight products
                                price_data: {
                                    currency: 'eur',
                                    unit_amount: Math.round(price * quantity * 100),
                                    product_data: {
                                        name: `${productName} (${qtyFormatted} kg)`,
                                        ...(imageUrl ? { images: [imageUrl] } : {}),
                                    },
                                },
                            }
                        }

                        // Unit products
                        return {
                            quantity: Math.round(quantity),
                            price_data: {
                                currency: 'eur',
                                unit_amount: Math.round(price * 100),
                                product_data: {
                                    name: `${productName} (${quantity} pz)`,
                                    ...(imageUrl ? { images: [imageUrl] } : {}),
                                },
                            },
                        }
                    })

                    // Add delivery fee as separate line item if > 0
                    if (deliveryFee > 0) {
                        line_items.push({
                            quantity: 1,
                            price_data: {
                                currency: 'eur',
                                unit_amount: Math.round(deliveryFee * 100),
                                product_data: {
                                    name: 'Spese di consegna',
                                },
                            },
                        })
                    }

                    // Derive siteUrl from the current request domain
                    const url = new URL(req.url)
                    const siteUrl = `${url.protocol}//${url.host}`

                    const stripe = getStripe()

                    // Create Stripe Checkout Session
                    const session = await stripe.checkout.sessions.create({
                        mode: 'payment',
                        payment_method_types: ['card'],
                        line_items,
                        success_url: `${siteUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
                        cancel_url: `${siteUrl}/checkout?cancelled=1&id=${newOrderId}`,
                        metadata: { orderId: newOrderId },
                    })

                    checkoutUrl = session.url

                    // Update order with stripe_session_id (do not block if fails)
                    void supabaseServiceRole
                        .from('orders')
                        .update({ stripe_session_id: session.id })
                        .eq('id', newOrderId)
                } catch (stripeError: any) {
                    // Re-throw to be caught by outer catch for rollback
                    throw new Error(stripeError?.message ?? 'Payment session creation failed')
                }
            }

            return NextResponse.json(
                {
                    ok: true,
                    order_id: newOrderId,
                    delivery_fee: deliveryFee,
                    total: total,
                    distance_km: round2(distanceKm),
                    fulfillment_date: fulfillmentDate ?? undefined,
                    fulfillment_message: fulfillmentMessage,
                    ...(checkoutUrl ? { checkoutUrl } : {}),
                },
                { headers: { 'Cache-Control': 'no-store' } }
            )
        } catch (error) {
            // Compensating transaction: if stock was committed, release it
            if (stockCommitted) {
                console.error('❌ Errore dopo reserveOrderStock, rilascio stock per ordine:', newOrderId)
                await release_order_stock(newOrderId).catch((releaseError) => {
                    console.error('❌ Errore durante release_order_stock:', releaseError)
                })
            }

            // Cleanup: delete order_items and order
            const { error: cleanupItemsError } = await supabaseServiceRole
                .from('order_items')
                .delete()
                .eq('order_id', newOrderId)

            if (cleanupItemsError && process.env.NODE_ENV !== 'production') {
                console.warn('⚠️ Cleanup order_items error (non-blocking):', cleanupItemsError.message)
            }

            const { error: cleanupOrderError } = await supabaseServiceRole
                .from('orders')
                .delete()
                .eq('id', newOrderId)

            if (cleanupOrderError && process.env.NODE_ENV !== 'production') {
                console.warn('⚠️ Cleanup orders error (non-blocking):', cleanupOrderError.message)
            }

            const errorMessage = error instanceof Error ? error.message : 'Order creation error'
            const isStockError =
                errorMessage.includes('INSUFFICIENT_STOCK') || errorMessage.includes('Stock insufficiente')

            console.error('❌ Errore dopo reserveOrderStock:', errorMessage)

            const status = isStockError ? 409 : 500
            const responseBody = isStockError
                ? {
                    ok: false,
                    error_code: 'stock_insufficient',
                    error: 'Some products are no longer available. We updated the cart.',
                    code: 'STOCK_INSUFFICIENT',
                    message: 'Some products are no longer available. We updated the cart.',
                }
                : {
                    error_code: 'order_creation_failed',
                    error: errorMessage,
                }

            return NextResponse.json(responseBody, {
                status,
                headers: { 'Cache-Control': 'no-store' },
            })
        }
    } catch (e: any) {
        console.error('❌ API ERROR /api/orders:', e)
        return NextResponse.json(
            {
                error_code: 'internal_error',
                error: e?.message ?? 'Internal error',
            },
            { status: 500 }
        )
    }
}