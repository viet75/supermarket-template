import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

// CREATE prodotto
export async function POST(req: NextRequest) {
    const supabase = supabaseServer()
    try {
        const body = await req.json()

        // Imposta stock_unit in base a unit_type
        if (body.unit_type === 'per_kg') {
            body.stock_unit = 100
        } else {
            body.stock_unit = body.stock_unit ?? 1
        }

        // Converti stock inserito dall'admin in unità intere
        if (typeof body.stock === 'number' && body.stock !== null) {
            if (body.unit_type === 'per_kg') {
                // per_kg: converti kg in unità (1 kg = 10 unità da 100g)
                body.stock = Math.round(body.stock * 10)
            }
            // per_unit: stock rimane invariato (già in pezzi)
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

        // Imposta stock_unit in base a unit_type
        if (payload.unit_type === 'per_kg') {
            payload.stock_unit = 100
        } else if (payload.unit_type === 'per_unit' || payload.unit_type === null || payload.unit_type === undefined) {
            // Se unit_type non è per_kg, mantieni stock_unit esistente o imposta 1
            if (payload.stock_unit === undefined) {
                // Recupera unit_type attuale se non viene modificato
                const { data: current } = await supabase
                    .from('products')
                    .select('unit_type, stock_unit')
                    .eq('id', id)
                    .single()
                
                if (current?.unit_type === 'per_kg') {
                    payload.stock_unit = 100
                } else {
                    payload.stock_unit = 1
                }
            }
        }

        // Converti stock inserito dall'admin in unità intere
        if (typeof payload.stock === 'number' && payload.stock !== null) {
            const unitType = payload.unit_type
            if (unitType === undefined) {
                // Se unit_type non viene modificato, recuperalo dal DB
                const { data: current } = await supabase
                    .from('products')
                    .select('unit_type')
                    .eq('id', id)
                    .single()
                
                if (current?.unit_type === 'per_kg') {
                    payload.stock = Math.round(payload.stock * 10)
                }
            } else if (unitType === 'per_kg') {
                // per_kg: converti kg in unità (1 kg = 10 unità da 100g)
                payload.stock = Math.round(payload.stock * 10)
            }
            // per_unit: stock rimane invariato (già in pezzi)
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
