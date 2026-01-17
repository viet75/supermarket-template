import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { handleOrderPaid } from '@/lib/handleOrderPaid'
import { releaseOrderStock } from '@/lib/releaseOrderStock'
import type { Order } from '@/lib/types'



export const runtime = 'nodejs'

/* ===========================
   GET /api/admin/orders
   Ritorna gli ordini con paginazione e filtri
=========================== */
export async function GET(req: NextRequest) {
    try {
        const svc = supabaseServer()
        const { searchParams } = new URL(req.url)

        const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
        const status = searchParams.get('status') || 'all'
        const paymentStatus = searchParams.get('payment_status') || 'all'
        const search = (searchParams.get('search') || '').trim().toLowerCase()
        const fromIdx = (page - 1) * limit
        const toIdx = fromIdx + limit - 1

        // 🔹 Selezione campi condivisa
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
          order_items:order_items (
            quantity,
            price,
            products (id, name, unit_type)
          )
        `

        // 🔹 Filtri base
        let q = svc
            .from('orders')
            .select(orderSelect, { count: 'exact' })
            .order('created_at', { ascending: false })

        if (status !== 'all') q = q.eq('status', status)
        if (paymentStatus !== 'all') q = q.eq('payment_status', paymentStatus)

        // 🔎 Ricerca: public_id o nome/cognome (strategia esclusiva)
        if (search) {
            const trimmedSearch = search.trim()
            
            // Pattern public_id: esattamente 8 caratteri esadecimali (UUID abbreviato)
            const isPublicId = /^[0-9a-f]{8}$/i.test(trimmedSearch)
            
            if (isPublicId) {
                // Ricerca per public_id: ricerca parziale su colonna text
                q = q.ilike('public_id', `%${trimmedSearch}%`)
            } else {
                // Ricerca per nome/cognome: tokenizza per spazi
                const tokens = trimmedSearch.split(/\s+/).filter(t => t.length > 0)
                if (tokens.length > 0) {
                    if (tokens.length === 1) {
                        // Singolo token: cerca in firstName O lastName
                        const term = tokens[0]
                        q = q.or(`customer_first_name.ilike.%${term}%,customer_last_name.ilike.%${term}%`)
                    } else {
                        // Multipli token: ogni token deve matchare (AND logico)
                        // Per ogni token, applica una q.or() separata
                        for (const token of tokens) {
                            q = q.or(`customer_first_name.ilike.%${token}%,customer_last_name.ilike.%${token}%`)
                        }
                    }
                }
            }
        }


        // 🔹 Paginazione standard
        const { data, count, error } = await q.range(fromIdx, toIdx)
        if (error) throw error

        const orders: Order[] = await Promise.all((data ?? []).map(async (o: any) => {
            const address =
                typeof o.address === 'string'
                    ? JSON.parse(o.address)
                    : (o.address ?? {})

            // Normalizzazione degli order_items usando i dati già inclusi dalla query
            const normalizedItems: any[] = Array.isArray(o.order_items)
                ? o.order_items.map((it: any) => {
                        // Usa i dati del prodotto già inclusi dalla query principale
                        // Supabase può restituire i dati come oggetto singolo o come array
                        let productData = it.products || it.product || null
                        if (Array.isArray(productData)) {
                            productData = productData[0] || null
                        }
                        
                        const quantity = Number(it.quantity)
                        const unitPrice = Number(it.price ?? 0)
                        
                        const product = productData
                            ? {
                                id: productData.id,
                                name: productData.name,
                                unit_type: productData.unit_type,
                            }
                            : {
                                id: '',
                                name: 'Prodotto',
                                unit_type: null,
                            }

                        return {
                            quantity,
                            price: unitPrice,
                            product,
                        }
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
                items: [], // legacy
            }
        }))

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
   Elimina un ordine
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

        // 1) Normalizzazione campi payload (retrocompatibilità)
        const orderId = body.orderId || body.id || body.order_id
        const action = body.action || body.type
        const status = body.status
        const paymentStatus = body.payment_status || body.paymentStatus

        // Validazione orderId
        if (!orderId) {
            console.error('❌ PATCH /api/admin/orders: orderId mancante nel payload', body)
            return NextResponse.json({ error: 'orderId mancante' }, { status: 400 })
        }

        const svc = supabaseServer()

        // Recupera l'ordine esistente
        const { data: existingOrder, error: fetchExistingError } = await svc
            .from('orders')
            .select('status, payment_status, payment_method, stock_reserved')
            .eq('id', orderId)
            .single()

        if (fetchExistingError) throw fetchExistingError

        // Blocco ordine annullato
        if (existingOrder.status === 'cancelled') {
            console.error('❌ PATCH /api/admin/orders: tentativo di modificare ordine già annullato', { orderId })
            return NextResponse.json(
                { error: 'Ordine annullato: operazione non consentita' },
                { status: 400 }
            )
        }

        // 2) Risoluzione azione (action-based o legacy)
        let resolvedAction: 'cancel' | 'mark_paid' | 'confirm' | null = null

        if (action) {
            // Action-based: usa direttamente l'action se presente
            if (action === 'cancel' || action === 'cancelled') {
                resolvedAction = 'cancel'
            } else if (action === 'mark_paid' || action === 'paid') {
                resolvedAction = 'mark_paid'
            } else if (action === 'confirm' || action === 'confirmed') {
                resolvedAction = 'confirm'
            }
        } else {
            // Legacy: risolvi da status/payment_status
            if (status === 'cancelled') {
                resolvedAction = 'cancel'
            } else if (paymentStatus === 'paid') {
                resolvedAction = 'mark_paid'
            } else if (status === 'confirmed') {
                resolvedAction = 'confirm'
            }
        }

        // Validazione azione risolta
        if (!resolvedAction) {
            console.error('❌ PATCH /api/admin/orders: azione non valida o mancante', { orderId, body })
            return NextResponse.json(
                { error: 'Azione non valida: specificare action, status o payment_status' },
                { status: 400 }
            )
        }

        // 3) Esecuzione switch sull'azione risolta
        switch (resolvedAction) {
            case 'cancel': {
                // Protezione contro annullamento ordine pagato
                if (existingOrder.payment_status === 'paid') {
                    console.error('❌ PATCH /api/admin/orders: tentativo di annullare ordine già pagato', { orderId })
                    return NextResponse.json(
                        { error: 'Impossibile annullare un ordine già pagato' },
                        { status: 400 }
                    )
                }

                // Rilascia stock (gestisce stock_committed, stock_reserved, reserve_expires_at)
                const releaseResult = await releaseOrderStock(orderId)
                if (releaseResult.ok === false) {
                    console.error('❌ PATCH /api/admin/orders: errore releaseOrderStock', { orderId, error: releaseResult.error })
                    return NextResponse.json({ error: releaseResult.error }, { status: 400 })
                }

                // Aggiorna status a cancelled
                const { error: updateError } = await svc
                    .from('orders')
                    .update({ status: 'cancelled' })
                    .eq('id', orderId)

                if (updateError) throw updateError

                return NextResponse.json({ ok: true })
            }

            case 'mark_paid': {
                // Aggiorna payment_status e status
                const updateData: any = {
                    payment_status: 'paid',
                    stock_reserved: false,
                    reserve_expires_at: null,
                }

                // Se è pagamento offline, imposta status a confirmed
                if (existingOrder.payment_method !== 'card_online') {
                    updateData.status = 'confirmed'
                }

                const { error: updateError } = await svc
                    .from('orders')
                    .update(updateData)
                    .eq('id', orderId)

                if (updateError) throw updateError

                // Gestisce post-pagamento (mantiene compatibilità)
                const handleResult = await handleOrderPaid(orderId)
                if (handleResult && !handleResult.ok) {
                    console.error('❌ PATCH /api/admin/orders: errore handleOrderPaid', { orderId, error: handleResult.error })
                    return NextResponse.json(
                        { error: handleResult.error || 'Errore gestione ordine pagato' },
                        { status: 400 }
                    )
                }

                return NextResponse.json({ ok: true })
            }

            case 'confirm': {
                // Protezione contro consegna non pagata (se si tenta di confermare un ordine non pagato)
                // Nota: la conferma è permessa anche per ordini non pagati (es. pagamento alla consegna)
                
                // Aggiorna solo status
                const { error: updateError } = await svc
                    .from('orders')
                    .update({ status: 'confirmed' })
                    .eq('id', orderId)

                if (updateError) throw updateError

                return NextResponse.json({ ok: true })
            }

            default:
                console.error('❌ PATCH /api/admin/orders: azione non supportata nel switch', { orderId, resolvedAction })
                return NextResponse.json(
                    { error: 'Azione non supportata' },
                    { status: 400 }
                )
        }
    } catch (e: any) {
        console.error('❌ PATCH /api/admin/orders error:', e.message)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
