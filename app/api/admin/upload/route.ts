import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabaseService'

export const runtime = 'nodejs'

export async function POST(req: Request) {
    try {
        const form = await req.formData()
        const file = form.get('file') as File | null

        if (!file) {
            return NextResponse.json({ error: 'No file' }, { status: 400 })
        }

        const safeName = file.name.replace(/\s+/g, '-')
        const fileName = `${Date.now()}-${safeName}`
        const filePath = `images/${fileName}`

        const buffer = Buffer.from(await file.arrayBuffer())

        const { error } = await supabaseService.storage
            .from('products')
            .upload(filePath, buffer, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type,
            })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // ✅ RITORNIAMO SOLO IL PATH
        return NextResponse.json({ path: filePath })
    } catch (e: any) {
        console.error('Errore upload:', e)
        return NextResponse.json({ error: e.message || 'Errore upload' }, { status: 500 })
    }
}
