import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

/* ===========================
   Helpers
=========================== */
function numOrNull(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}
function mustNumber(v: unknown, field = 'number'): number {
    const n = Number(v)
    if (!Number.isFinite(n)) throw new Error(`Invalid ${field}`)
    return n
}

/* ===========================
   GET /api/admin/products/[id]
   Ritorna un singolo prodotto
=========================== */
export async function GET(_req: Request, context: any) {
    try {
        const { id } = context.params
        const svc = supabaseServer()
        const { data, error } = await svc.from('products').select('*').eq('id', id).single()

        if (error) throw error
        return NextResponse.json({ product: data })
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? 'Errore caricamento prodotto' }, { status: 500 })
    }
}

/* ===========================
   PUT /api/admin/products/[id]
   Aggiorna un prodotto esistente
=========================== */
export async function PUT(req: Request, context: any) {
    try {
        const { id } = context.params
        const body = await req.json()

        const update: Record<string, any> = {}

        if (typeof body.name !== 'undefined') update.name = body.name
        if (typeof body.description !== 'undefined') update.description = body.description ?? ''
        if (typeof body.price !== 'undefined') update.price = mustNumber(body.price, 'price')
        if (typeof body.price_sale !== 'undefined') update.price_sale = numOrNull(body.price_sale)
        if (typeof body.image_url !== 'undefined') update.image_url = body.image_url ?? null
        if (typeof body.images !== 'undefined') update.images = Array.isArray(body.images) ? body.images : null
        if (typeof body.unit_type !== 'undefined') update.unit_type = body.unit_type ?? null
        if (typeof body.category_id !== 'undefined') update.category_id = body.category_id ?? null
        if (typeof body.stock !== 'undefined') update.stock = numOrNull(body.stock)
        if (typeof body.is_active === 'boolean') update.is_active = body.is_active
        if (typeof body.sort_order !== 'undefined') update.sort_order = mustNumber(body.sort_order, 'sort_order')

        if (Object.keys(update).length === 0) {
            return NextResponse.json({ error: 'Nessun campo valido da aggiornare' }, { status: 400 })
        }

        const svc = supabaseServer()
        const { data, error } = await svc.from('products').update(update).eq('id', id).select('*').single()
        if (error) throw error

        return NextResponse.json({ product: data })
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? 'Errore aggiornamento prodotto' }, { status: 500 })
    }
}

/* ===========================
   DELETE /api/admin/products/[id]
   Elimina un prodotto
=========================== */
export async function DELETE(_req: Request, context: any) {
    try {
        const { id } = context.params
        if (!id) return NextResponse.json({ error: 'id obbligatorio' }, { status: 400 })

        const svc = supabaseServer()
        const { error } = await svc.from('products').delete().eq('id', id)

        if (error) throw error
        return NextResponse.json({ ok: true })
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? 'Errore eliminazione prodotto' }, { status: 500 })
    }
}
