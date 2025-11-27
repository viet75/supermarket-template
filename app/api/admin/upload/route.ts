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

        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
        const filePath = `images/${fileName}` // 👈 salviamo in una cartella "images/"

        // Converto in ArrayBuffer → Buffer (necessario su Node)
        const buffer = Buffer.from(await file.arrayBuffer())

        const { error: uploadError } = await supabaseService.storage
            .from('products')
            .upload(filePath, buffer, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type, // 👈 mantiene il MIME type corretto
            })

        if (uploadError) {
            return NextResponse.json({ error: uploadError.message }, { status: 500 })
        }

        // Otteniamo URL pubblico
        const { data: publicUrlData } = supabaseService
            .storage
            .from('products')
            .getPublicUrl(filePath)

        if (!publicUrlData?.publicUrl) {
            return NextResponse.json({ error: 'Impossibile generare URL pubblico' }, { status: 500 })
        }

        return NextResponse.json({ url: publicUrlData.publicUrl })
    } catch (e: any) {
        console.error('Errore upload:', e)
        return NextResponse.json({ error: e.message || 'Errore upload' }, { status: 500 })
    }
}
