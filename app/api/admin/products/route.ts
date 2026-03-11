import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { normalizeStock } from '@/lib/stock'

function isQtyStepSchemaCacheError(err: any): boolean {
    const msg = String(err?.message ?? err?.error_description ?? err ?? '')
    const code = err?.code
    return (
        code === 'PGRST204' ||
        msg.includes('qty_step') ||
        msg.includes("Could not find the 'qty_step' column")
    )
}

// CREATE product
export async function POST(req: NextRequest) {
    const supabase = supabaseServer()
    try {
        const body = await req.json()

        // Normalize stock (real kg for per_kg, integer for per_unit)
        if (typeof body.stock !== 'undefined') {
            const normalizedStock = normalizeStock(body.unit_type, body.stock)
            
            // Unlimited stock management: if normalizedStock is null, set stock_unlimited = true and stock = 0
            if (normalizedStock === null) {
                body.stock_unlimited = true
                body.stock = 0
            } else {
                body.stock_unlimited = false
                body.stock = normalizedStock
            }
        }

        // qty_step: only for per_kg, otherwise 1
        if (body.unit_type === 'per_kg') {
            const raw = body.qty_step
            if (raw != null && raw !== '') {
                const n = Number(raw)
                if (!Number.isFinite(n) || n <= 0 || n > 10) {
                    return NextResponse.json({ error: 'qty_step deve essere un numero tra 0 e 10 (max 3 decimali)' }, { status: 400 })
                }
                body.qty_step = Math.round((n + Number.EPSILON) * 1000) / 1000
            } else {
                body.qty_step = 1
            }
        } else {
            body.qty_step = 1
        }

        // Remove stock_baseline if present: it must be managed ONLY by the DB trigger
        delete body.stock_baseline

        let { data, error } = await supabase
            .from('products')
            .insert([body])
            .select()
            .single()

        if (error && isQtyStepSchemaCacheError(error)) {
            delete body.qty_step
            const retry = await supabase.from('products').insert([body]).select().single()
            data = retry.data
            error = retry.error
        }
        if (error) throw error

        return NextResponse.json({ product: data })
    } catch (e: any) {
        console.error('Errore POST prodotto:', e)
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}

// UPDATE prodotto
export async function PATCH(req: NextRequest) {
    const supabase = supabaseServer()
    try {
        const body = await req.json()
        const { id, ...payload } = body

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }

        // Normalize stock (real kg for per_kg, integer for per_unit)
        if (typeof payload.stock !== 'undefined') {
            // Retrieve current unit_type if not modified
            let unitType = payload.unit_type
            if (unitType === undefined) {
                const { data: current } = await supabase
                    .from('products')
                    .select('unit_type')
                    .eq('id', id)
                    .single()
                unitType = current?.unit_type ?? null
            }
            
            const normalizedStock = normalizeStock(unitType, payload.stock)
            
            // Unlimited stock management: if normalizedStock is null, set stock_unlimited = true and stock = 0
            if (normalizedStock === null) {
                payload.stock_unlimited = true
                payload.stock = 0
            } else {
                payload.stock_unlimited = false
                payload.stock = normalizedStock
            }
        }

        // qty_step: for per_kg valid and normalize, for per_unit force 1
        let patchUnitType = payload.unit_type
        if (patchUnitType === undefined) {
            const { data: cur } = await supabase.from('products').select('unit_type').eq('id', id).single()
            patchUnitType = cur?.unit_type ?? null
        }
        if (patchUnitType === 'per_kg') {
            const raw = payload.qty_step
            if (raw != null && raw !== '') {
                const n = Number(raw)
                if (!Number.isFinite(n) || n <= 0 || n > 10) {
                    return NextResponse.json({ error: 'qty_step must be a number between 0 and 10 (max 3 decimals)' }, { status: 400 })
                }
                payload.qty_step = Math.round((n + Number.EPSILON) * 1000) / 1000
            } else {
                payload.qty_step = 1
            }
        } else {
            payload.qty_step = 1
        }

        // Remove stock_baseline if present: it must be managed ONLY by the DB trigger
        delete payload.stock_baseline

        let { data, error } = await supabase
            .from('products')
            .update(payload)
            .eq('id', id)
            .select()
            .single()

        if (error && isQtyStepSchemaCacheError(error)) {
            delete payload.qty_step
            const retry = await supabase.from('products').update(payload).eq('id', id).select().single()
            data = retry.data
            error = retry.error
        }
        if (error) throw error

        return NextResponse.json({ product: data })
    } catch (e: any) {
        console.error('Error patching product:', e)
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}

// DELETE product (soft delete with archive)
export async function DELETE(req: NextRequest) {
    const supabase = supabaseServer()
    try {
        const body = await req.json()
        const { id } = body

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }

        // Retrieve the product
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single()

        if (fetchError) {
            console.error('Product fetch error:', fetchError)
            return NextResponse.json({ status: 'not_found' }, { status: 404 })
        }

        if (!product) {
            return NextResponse.json({ status: 'not_found' }, { status: 404 })
        }

        if (product.deleted_at) {
            // Already archived
            return NextResponse.json({ status: 'already_archived' })
        }

        // Check if there are orders related to the product
        const { count, error: orderError } = await supabase
            .from('order_items')
            .select('*', { count: 'exact', head: true })
            .eq('product_id', id)

        if (orderError) throw orderError

        // QA: Browser A cart with product, Browser B archive product, Browser A confirm order → 409 PRODUCTS_NOT_AVAILABLE, cart reconciled.
        if (count && count > 0) {
            // Product linked to orders → archive (archived=true for DB order_items trigger)
            const { error: archiveError } = await supabase
                .from('products')
                .update({
                    is_active: false,
                    deleted_at: new Date().toISOString(),
                    archived: true,
                })
                .eq('id', id)

            if (archiveError) throw archiveError

            return NextResponse.json({ status: 'archived' })
        } else {
            // Normal soft delete (archived=true for DB order_items trigger)
            const { error: deleteError } = await supabase
                .from('products')
                .update({
                    is_active: false,
                    deleted_at: new Date().toISOString(),
                    archived: true,
                })
                .eq('id', id)

            if (deleteError) throw deleteError

            return NextResponse.json({ status: 'archived' })

        }
    } catch (e: any) {
        console.error('Error deleting product:', e)
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
