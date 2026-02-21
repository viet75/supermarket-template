import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { normalizeStock } from '@/lib/stock'

// CREATE prodotto
export async function POST(req: NextRequest) {
    const supabase = supabaseServer()
    try {
        const body = await req.json()

        // Normalizza stock (kg reali per per_kg, pezzi interi per per_unit)
        if (typeof body.stock !== 'undefined') {
            const normalizedStock = normalizeStock(body.unit_type, body.stock)
            
            // Gestione stock illimitato: se normalizedStock è null, imposta stock_unlimited = true e stock = 0
            if (normalizedStock === null) {
                body.stock_unlimited = true
                body.stock = 0
            } else {
                body.stock_unlimited = false
                body.stock = normalizedStock
            }
        }

        // Rimuovi stock_baseline se presente: deve essere gestito SOLO dal trigger DB
        delete body.stock_baseline

        const { data, error } = await supabase
            .from('products')
            .insert([body])
            .select()
            .single()

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
            return NextResponse.json({ error: 'ID mancante' }, { status: 400 })
        }

        // Normalizza stock (kg reali per per_kg, pezzi interi per per_unit)
        if (typeof payload.stock !== 'undefined') {
            // Recupera unit_type attuale se non viene modificato
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
            
            // Gestione stock illimitato: se normalizedStock è null, imposta stock_unlimited = true e stock = 0
            if (normalizedStock === null) {
                payload.stock_unlimited = true
                payload.stock = 0
            } else {
                payload.stock_unlimited = false
                payload.stock = normalizedStock
            }
        }

        // Rimuovi stock_baseline se presente: deve essere gestito SOLO dal trigger DB
        delete payload.stock_baseline

        const { data, error } = await supabase
            .from('products')
            .update(payload)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ product: data })
    } catch (e: any) {
        console.error('Errore PATCH prodotto:', e)
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}

// DELETE prodotto (soft delete con archivio)
export async function DELETE(req: NextRequest) {
    const supabase = supabaseServer()
    try {
        const body = await req.json()
        const { id } = body

        if (!id) {
            return NextResponse.json({ error: 'ID mancante' }, { status: 400 })
        }

        // Recupera il prodotto
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single()

        if (fetchError) {
            console.error('Errore fetch prodotto:', fetchError)
            return NextResponse.json({ status: 'not_found' }, { status: 404 })
        }

        if (!product) {
            return NextResponse.json({ status: 'not_found' }, { status: 404 })
        }

        if (product.deleted_at) {
            // Già archiviato
            return NextResponse.json({ status: 'already_archived' })
        }

        // Controlla se esistono ordini legati al prodotto
        const { count, error: orderError } = await supabase
            .from('order_items')
            .select('*', { count: 'exact', head: true })
            .eq('product_id', id)

        if (orderError) throw orderError

        // QA: Browser A carrello con prodotto, Browser B archivia prodotto, Browser A conferma ordine → 409 PRODUCTS_NOT_AVAILABLE, carrello riconciliato.
        if (count && count > 0) {
            // Prodotto collegato a ordini → archivia (archived=true per trigger DB order_items)
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
            // Soft delete normale (archived=true per trigger DB order_items)
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
        console.error('Errore DELETE prodotto:', e)
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
