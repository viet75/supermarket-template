import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { normalizeStock } from '@/lib/stock'

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
   Return a single product
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
   Update an existing product
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
        if (typeof body.category_id !== 'undefined') update.category_id = body.category_id ?? null
        // is_active=false → archived=true so that the DB trigger blocks order_items. QA: B archive, A confirm order → 409, cart reconciled.
        // is_active=true → archived=false to ensure consistency when restoring a product
        if (typeof body.is_active === 'boolean') {
            update.is_active = body.is_active
            if (body.is_active === false) {
                update.archived = true
            } else if (body.is_active === true) {
                // QA: When restoring a product (is_active=true), ensure that archived=false
                // to avoid the DB trigger blocking order_items on restored products
                update.archived = false
            }
        }
        if (typeof body.archived === 'boolean') update.archived = body.archived
        if (typeof body.sort_order !== 'undefined') update.sort_order = mustNumber(body.sort_order, 'sort_order')

        // Retrieve the current product status (ONE QUERY)
        const svc = supabaseServer()
        const { data: current, error: currentError } = await svc
            .from('products')
            .select('unit_type')
            .eq('id', id)
            .single()

        if (currentError || !current) {
            throw new Error('Product not found')
        }

        // final unit_type (new or current)
        const unitType = body.unit_type ?? current.unit_type
        update.unit_type = unitType

        // Normalize stock (real kg for per_kg, integer for per_unit)
        if (typeof body.stock !== 'undefined') {
            update.stock = normalizeStock(unitType, body.stock)
        }

        if (Object.keys(update).length === 0) {
            return NextResponse.json(
                { error: 'No valid fields to update'},
                { status: 400 }
            )
        }

        const { data, error } = await svc
            .from('products')
            .update(update)
            .eq('id', id)
            .select('*')
            .single()

        if (error) throw error

        return NextResponse.json({ product: data })
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message ?? 'Product update error' },
            { status: 500 }
        )
    }
}


/* ===========================
   DELETE /api/admin/products/[id]
   Delete a product
=========================== */
export async function DELETE(_req: Request, context: any) {
    try {
        const { id } = context.params
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

        const svc = supabaseServer()
        const { error } = await svc.from('products').delete().eq('id', id)

        if (error) throw error
        return NextResponse.json({ ok: true })
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? 'Error deleting product' }, { status: 500 })
    }
}
