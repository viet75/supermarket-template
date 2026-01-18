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
            body.stock = normalizeStock(body.unit_type, body.stock)
        }

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
            payload.stock = normalizeStock(unitType, payload.stock)
        }

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

        if (count && count > 0) {
            // Prodotto collegato a ordini → archivia
            const { error: archiveError } = await supabase
                .from('products')
                .update({
                    is_active: false,
                    deleted_at: new Date().toISOString(),
                })
                .eq('id', id)

            if (archiveError) throw archiveError

            return NextResponse.json({ status: 'archived' })
        } else {
            // Soft delete normale
            const { error: deleteError } = await supabase
                .from('products')
                .update({
                    deleted_at: new Date().toISOString(),
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
