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
        const { id, status, payment_status } = body
        if (!id) {
            return NextResponse.json({ error: 'id mancante' }, { status: 400 })
        }
        if (!status && payment_status == null) {
            return NextResponse.json(
                { error: 'status o payment_status richiesti' },
                { status: 400 }
            )
        }


        const svc = supabaseServer()

        // Recupera l'ordine completo all'inizio
        const { data: existingOrder, error: fetchExistingError } = await svc
            .from('orders')
            .select('status, payment_status, stock_reserved')
            .eq('id', id)
            .single()

        if (fetchExistingError) throw fetchExistingError

        // Blocco ordine annullato
        if (existingOrder.status === 'cancelled') {
            return NextResponse.json(
                { error: 'Ordine annullato: operazione non consentita' },
                { status: 400 }
            )
        }

        // Protezione contro consegna non pagata
        if (status === 'delivered' && existingOrder.payment_status !== 'paid') {
            return NextResponse.json(
                { error: 'Impossibile consegnare un ordine non pagato' },
                { status: 400 }
            )
        }

        // Protezione contro annullamento ordine pagato
        if (status === 'cancelled' && existingOrder.payment_status === 'paid') {
            return NextResponse.json(
                { error: 'Impossibile annullare un ordine già pagato' },
                { status: 400 }
            )
        }

        const updateData: any = {}

        // Se arriva solo status, aggiorna solo quello
        if (status) {
            updateData.status = status
        }

        // Se arriva payment_status, aggiorna payment_status
        if (payment_status !== undefined && payment_status !== null) {
            updateData.payment_status = payment_status
        }

        // Se payment_status passa a 'paid', imposta status a confirmed per pagamenti offline
        if (payment_status === 'paid' && existingOrder.payment_status !== 'paid') {
            // Recupera payment_method per determinare se impostare status a confirmed
            const { data: fetchedOrder, error: fetchFlagError } = await svc
                .from('orders')
                .select('payment_method')
                .eq('id', id)
                .single()

            if (fetchFlagError) throw fetchFlagError

            // Se è pagamento offline, imposta status a confirmed
            if (fetchedOrder.payment_method !== 'card_online') {
                updateData.status = 'confirmed'
            }
        }

        // Aggiorna l'ordine solo se tutto è andato a buon fine
        const { error } = await svc
            .from('orders')
            .update(updateData)
            .eq('id', id)

        if (error) throw error

        // Gestisce il ripristino stock quando l'ordine viene annullato
        if (status === 'cancelled') {
            const result = await releaseOrderStock(id)
            if (result.ok === false) {
                return NextResponse.json({ error: result.error }, { status: 400 })
            }
        }

        // Gestisce post-pagamento (stock già riservato alla creazione ordine, non qui)
        if (payment_status === 'paid' && existingOrder.payment_status !== 'paid') {
            const handleResult = await handleOrderPaid(id)
            if (handleResult && !handleResult.ok) {
                return NextResponse.json({ error: handleResult.error || 'Errore gestione ordine pagato' }, { status: 400 })
            }
        }

        return NextResponse.json({ ok: true })
    } catch (e: any) {
        console.error('❌ PATCH /api/admin/orders error:', e.message)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
