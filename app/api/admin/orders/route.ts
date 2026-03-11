import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { handleOrderPaid } from '@/lib/handleOrderPaid'
import { release_order_stock } from '@/lib/releaseOrderStock'
import type { Order } from '@/lib/types'



export const runtime = 'nodejs'

/* ===========================
   GET /api/admin/orders
   Return orders with pagination and filters
=========================== */
async function normalizeOrderRow(o: any): Promise<Order> {
    const address =
        typeof o.address === 'string'
            ? JSON.parse(o.address)
            : (o.address ?? {})

    const normalizedItems: any[] = Array.isArray(o.order_items)
        ? o.order_items.map((it: any) => {
                let productData = it.products || it.product || null
                if (Array.isArray(productData)) productData = productData[0] || null
                const quantity = Number(it.quantity)
                const unitPrice = Number(it.price ?? 0)
                const product = productData
                    ? { id: productData.id, name: productData.name, unit_type: productData.unit_type }
                    : { id: '', name: 'Prodotto', unit_type: null }
                return { quantity, price: unitPrice, product }
            })
        : []

    return {
        ...o,
        first_name: address.firstName ?? null,
        last_name: address.lastName ?? null,
        address,
        subtotal: Number(o.subtotal),
        delivery_fee: Number(o.delivery_fee),
        total: Number(o.total),
        distance_km: Number(o.distance_km),
        order_items: normalizedItems,
        items: [],
    }
}

export async function GET(req: NextRequest) {
    try {
        const svc = supabaseServer()
        const { searchParams } = new URL(req.url)

        // 🔹 Single order by id (for detail page)
        const singleId = (searchParams.get('id') || '').trim()
        if (singleId) {
            const orderSelect = `
              id,
              public_id,
              created_at,
              status,
              payment_method,
              payment_status,
              subtotal,
              delivery_fee,
              total,
              distance_km,
              address,
              customer_phone,
              order_items:order_items (
                quantity,
                price,
                products (id, name, unit_type)
              )
            `
            const { data: row, error } = await svc
                .from('orders')
                .select(orderSelect)
                .eq('id', singleId)
                .maybeSingle()
            if (error) throw error
            if (!row) return NextResponse.json({ error: 'Ordine non trovato' }, { status: 404 })
            const order = await normalizeOrderRow(row)
            return NextResponse.json({ order })
        }

        const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
        const status = searchParams.get('status') || 'all'
        const paymentStatus = searchParams.get('payment_status') || 'all'
        const search = (searchParams.get('search') || '').trim().toLowerCase()
        const fromIdx = (page - 1) * limit
        const toIdx = fromIdx + limit - 1

        // 🔹 Shared fields selection
        const orderSelect = `
          id,
          public_id,
          created_at,
          status,
          payment_method,
          payment_status,
          subtotal,
          delivery_fee,
          total,
          distance_km,
          address,
          customer_phone,
          order_items:order_items (
            quantity,
            price,
            products (id, name, unit_type)
          )
        `

        // 🔹 Base filters
        let q = svc
            .from('orders')
            .select(orderSelect, { count: 'exact' })
            .order('created_at', { ascending: false })

        if (status !== 'all') q = q.eq('status', status)
        if (paymentStatus !== 'all') q = q.eq('payment_status', paymentStatus)

        // 🔎 Search: public_id or name/surname (exclusive strategy)
        if (search) {
            const trimmedSearch = search.trim()
            
            // Pattern public_id: exactly 8 hexadecimal characters (abbreviated UUID)
            const isPublicId = /^[0-9a-f]{8}$/i.test(trimmedSearch)
            
            if (isPublicId) {
                // Search by public_id: partial search on text column
                q = q.ilike('public_id', `%${trimmedSearch}%`)
            } else {
                // Search by name/surname: tokenize by spaces
                const tokens = trimmedSearch.split(/\s+/).filter(t => t.length > 0)
                if (tokens.length > 0) {
                    if (tokens.length === 1) {
                        // Single token: search in firstName or lastName
                        const term = tokens[0]
                        q = q.or(`customer_first_name.ilike.%${term}%,customer_last_name.ilike.%${term}%`)
                    } else {
                        // Multiple tokens: each token must match (logical AND)
                        // For each token, apply a separate q.or()
                        for (const token of tokens) {
                            q = q.or(`customer_first_name.ilike.%${token}%,customer_last_name.ilike.%${token}%`)
                        }
                    }
                }
            }
        }


        // 🔹 Standard pagination
        const { data, count, error } = await q.range(fromIdx, toIdx)
        if (error) throw error

        const orders: Order[] = await Promise.all((data ?? []).map((o: any) => normalizeOrderRow(o)))

        return NextResponse.json({
            orders,
            page,
            totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
        })
    } catch (e: any) {
        console.error('❌ GET /api/admin/orders error:', e)
        return NextResponse.json(
            { error: e?.message ?? 'Errore caricamento ordini' },
            { status: 500 },
        )
    }
}

/* ===========================
   DELETE /api/admin/orders
   Delete an order
=========================== */
export async function DELETE(req: NextRequest) {
    try {
        const body = await req.json()
        const { id } = body ?? {}
        if (!id) {
            return NextResponse.json({ error: 'id obbligatorio' }, { status: 400 })
        }

        const svc = supabaseServer()
        const { error } = await svc.from('orders').delete().eq('id', id)
        if (error) throw error

        return NextResponse.json({ ok: true })
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message ?? 'Errore eliminazione ordine' },
            { status: 500 },
        )
    }
}
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json()

        // 1) Parsing JSON with normalization
        const id = body?.id ?? body?.orderId ?? body?.order_id
        const status = body?.status
        const payment_status = body?.payment_status ?? body?.paymentStatus
        const action = body?.action ?? body?.type

        // 2) Validation
        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 })
        }

        if (!status && !payment_status && !action) {
            return NextResponse.json(
                { error: 'Azione non valida: specificare action, status o payment_status' },
                { status: 400 }
            )
        }

        const svc = supabaseServer()

        // Retrieve the existing order
        const { data: existingOrder, error: fetchExistingError } = await svc
            .from('orders')
            .select('status, payment_status, payment_method, stock_reserved, stock_committed')
            .eq('id', id)
            .single()

        if (fetchExistingError) throw fetchExistingError

        // Canceled order block
        if (existingOrder.status === 'cancelled') {
            return NextResponse.json(
                { error: 'Ordine annullato: operazione non consentita' },
                { status: 400 }
            )
        }

        // 3) Normalization action (backward compatibility)
        // If status/payment_status are already present, they take precedence over action
        let finalStatus = status
        let finalPaymentStatus = payment_status

        if (action && !status && !payment_status) {
            // Use action only if status/payment_status are not present
            switch (action) {
                case 'cancel':
                case 'cancelled':
                    finalStatus = 'cancelled'
                    break
                case 'deliver':
                case 'delivered':
                    finalStatus = 'delivered'
                    break
                case 'confirm':
                case 'confirmed':
                    finalStatus = 'confirmed'
                    break
                case 'mark_paid':
                case 'paid':
                    finalPaymentStatus = 'paid'
                    break
            }
        }

        // 4) Business logic
        const updateData: any = {}

        // Status management
        if (finalStatus) {
            // Protection against canceled paid order
            if (finalStatus === 'cancelled' && existingOrder.payment_status === 'paid') {
                return NextResponse.json(
                    { error: 'Impossibile annullare un ordine già pagato' },
                    { status: 400 }
                )
            }

            updateData.status = finalStatus

            // If status becomes 'cancelled', release stock
            if (finalStatus === 'cancelled') {
                const releaseResult = await release_order_stock(id)
                if (releaseResult.ok === false) {
                    return NextResponse.json({ error: releaseResult.error }, { status: 400 })
                }
            }
        }

        // Payment_status management
        if (finalPaymentStatus) {
            const wasPaid = existingOrder.payment_status === 'paid'
            const willBePaid = finalPaymentStatus === 'paid'

            updateData.payment_status = finalPaymentStatus

            // If payment_status becomes 'paid' from non-paid
            if (!wasPaid && willBePaid) {
                // For offline payments, if status is not passed, set status='confirmed'
                if (existingOrder.payment_method !== 'card_online' && !finalStatus) {
                    updateData.status = 'confirmed'
                }

                // Reset stock_reserved and reserve_expires_at
                updateData.stock_reserved = false
                updateData.reserve_expires_at = null

                // Handles post-payment (without scaling stock again)
                const handleResult = await handleOrderPaid(id)
                if (handleResult && !handleResult.ok) {
                    return NextResponse.json(
                        { error: handleResult.error || 'Errore gestione ordine pagato' },
                        { status: 400 }
                    )
                }
            }
        }

        // 5) Database update (only if there are fields to update)
        if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await svc
                .from('orders')
                .update(updateData)
                .eq('id', id)

            if (updateError) throw updateError
        }

        return NextResponse.json({ ok: true })
    } catch (e: any) {
        console.error('❌ PATCH /api/admin/orders error:', e.message)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
