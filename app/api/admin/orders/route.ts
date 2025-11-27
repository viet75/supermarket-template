import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import type { Order } from '@/lib/types'

// ✅ (facoltativo, non usata ma lasciata per compatibilità futura)
async function getIdsLike(svc: any, search: string): Promise<string> {
    const { data, error } = await svc
        .from('orders')
        .select('id')
        .filter('id::text', 'ilike', `%${search}%`)

    if (error) {
        console.error('Errore getIdsLike:', error.message)
        return ''
    }
    return (data ?? []).map((r: { id: string }) => `'${r.id}'`).join(',') || "''"
}


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
          created_at,
          status,
          payment_method,
          payment_status,
          subtotal,
          delivery_fee,
          total,
          distance_km,
          address,
          first_name,
          last_name,
          items,
          order_items (
            quantity,
            price,
            product:products (id, name, unit_type)
          )
        `

        // 🔹 Filtri base
        let q = svc
            .from('orders')
            .select(orderSelect, { count: 'exact' })
            .order('created_at', { ascending: false })

        if (status !== 'all') q = q.eq('status', status)
        if (paymentStatus !== 'all') q = q.eq('payment_status', paymentStatus)

        // 🔎 Ricerca combinata nome, cognome o ID
        if (search) {
            const searchLower = search.toLowerCase()
            const terms = searchLower.split(/\s+/).filter(Boolean)
            let nameMatches: any[] = []

            // 🔹 Ricerca per nome e cognome (multi-termine, OR + verifica completa)
            if (terms.length > 0) {
                let allResults: any[] = []

                // Esegui una query per ogni termine e unisci i risultati
                for (const term of terms) {
                    const termLower = term.toLowerCase()
                    let partialResults: any[] = []

                    // 1️⃣ Ricerca su first_name e last_name
                    const { data: baseData, error: baseErr } = await svc
                        .from('orders')
                        .select(orderSelect)
                        .or(`first_name.ilike.%${termLower}%,last_name.ilike.%${termLower}%`)
                        .order('created_at', { ascending: false })

                    if (baseErr) console.error(`Errore ricerca base per "${term}":`, baseErr.message)
                    partialResults.push(...(baseData ?? []))

                    // 2️⃣ Ricerca su address (gestita con filtro SQL text)
                    const { data: addressData, error: addrErr } = await svc
                        .from('orders')
                        .select(orderSelect)
                        .filter('address', 'ilike', `%${termLower}%`)
                        .order('created_at', { ascending: false })

                    if (addrErr) console.error(`Errore ricerca address per "${term}":`, addrErr.message)
                    partialResults.push(...(addressData ?? []))

                    // 3️⃣ Unisci e deduplica
                    allResults.push(...partialResults)
                }


                // Deduplica
                nameMatches = Array.from(new Map(allResults.map((o: any) => [o.id, o])).values())

                // Se l'utente ha scritto più parole (es. "gigi bianchi"),
                // tieni solo chi contiene *tutti* i termini in nome, cognome o address
                if (terms.length > 1) {
                    nameMatches = nameMatches.filter((o: any) => {
                        const fn = (o.first_name ?? '').toLowerCase()
                        const ln = (o.last_name ?? '').toLowerCase()
                        const addrObj =
                            typeof o.address === 'string'
                                ? JSON.parse(o.address)
                                : o.address ?? {}
                        const addrFn = (addrObj.firstName ?? '').toLowerCase()
                        const addrLn = (addrObj.lastName ?? '').toLowerCase()

                        return terms.every((t) =>
                            fn.includes(t) || ln.includes(t) || addrFn.includes(t) || addrLn.includes(t)
                        )
                    })
                }
            }

            // 🔹 Ricerca per ID parziale (tramite funzione RPC)
            let idMatches: any[] = []
            if (searchLower.length >= 3) {
                const { data, error } = await svc.rpc('search_orders_by_id', {
                    search_text: `%${searchLower}%`,
                })

                if (error) {
                    console.error('Errore ricerca ID RPC:', error.message)
                    idMatches = []
                } else {
                    idMatches = data ?? []
                }
            }


            // 🔹 Merge e deduplica
            const combined = [...(nameMatches ?? []), ...idMatches]
            const unique = Array.from(new Map(combined.map((o: any) => [o.id, o])).values())

            // 🔹 Normalizzazione per output
            const orders: Order[] = unique.map((o: any) => {
                const address =
                    typeof o.address === 'string'
                        ? JSON.parse(o.address)
                        : (o.address ?? {})

                const normalizedItems =
                    Array.isArray(o.order_items) && o.order_items.length > 0
                        ? o.order_items.map((it: any) => ({
                            quantity: Number(it.quantity),
                            price: Number(it.price),
                            product: {
                                id: it.product?.id ?? '',
                                name: it.product?.name ?? '',
                                unit_type: it.product?.unit_type ?? null,
                            },
                        }))
                        : Array.isArray(o.items)
                            ? o.items.map((it: any) => ({
                                quantity: Number(it.qty ?? it.quantity ?? 1),
                                price: Number(it.price ?? 0),
                                product: {
                                    id: String(it.id ?? ''),
                                    name: String(it.name ?? ''),
                                    unit_type: it.unit ?? null,
                                },
                            }))
                            : []

                return {
                    ...o,
                    address,
                    subtotal: Number(o.subtotal),
                    delivery_fee: Number(o.delivery_fee),
                    total: Number(o.total),
                    distance_km: Number(o.distance_km),
                    order_items: normalizedItems,
                }
            })

            return NextResponse.json({
                orders,
                page: 1,
                totalPages: 1,
            })
        }


        // 🔹 Paginazione standard
        const { data, count, error } = await q.range(fromIdx, toIdx)
        if (error) throw error

        const orders: Order[] = (data ?? []).map((o: any) => {
            const address =
                typeof o.address === 'string'
                    ? JSON.parse(o.address)
                    : (o.address ?? {})

            const normalizedItems =
                Array.isArray(o.order_items) && o.order_items.length > 0
                    ? o.order_items.map((it: any) => ({
                        quantity: Number(it.quantity),
                        price: Number(it.price),
                        product: {
                            id: it.product?.id ?? '',
                            name: it.product?.name ?? '',
                            unit_type: it.product?.unit_type ?? null,
                        },
                    }))
                    : Array.isArray(o.items)
                        ? o.items.map((it: any) => ({
                            quantity: Number(it.qty ?? it.quantity ?? 1),
                            price: Number(it.price ?? 0),
                            product: {
                                id: String(it.id ?? ''),
                                name: String(it.name ?? ''),
                                unit_type: it.unit ?? null,
                            },
                        }))
                        : []

            return {
                ...o,
                address,
                subtotal: Number(o.subtotal),
                delivery_fee: Number(o.delivery_fee),
                total: Number(o.total),
                distance_km: Number(o.distance_km),
                order_items: normalizedItems,
            }
        })

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
        const { id, status } = await req.json()
        if (!id || !status) {
            return NextResponse.json({ error: 'id o status mancanti' }, { status: 400 })
        }

        const svc = supabaseServer()
        const { error } = await svc
            .from('orders')
            .update({ status })
            .eq('id', id)

        if (error) throw error

        return NextResponse.json({ ok: true })
    } catch (e: any) {
        console.error('❌ PATCH /api/admin/orders error:', e.message)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
