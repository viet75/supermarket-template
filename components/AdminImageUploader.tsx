'use client'
import { useState } from 'react'

export default function AdminImageUploader({ onUploaded }: { onUploaded: (url: string) => void }) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        // (opz) mini validazioni
        if (!file.type.startsWith('image/')) {
            setError('Seleziona un file immagine')
            return
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB
            setError('Immagine troppo grande (max 5MB)')
            return
        }
        setError(null)
        setLoading(true)

        try {
            const fd = new FormData()
            fd.append('file', file)

            const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
            const json = await res.json()
            if (!res.ok || !json?.url) throw new Error(json?.error || 'Upload fallito')

            onUploaded(json.url)
        } catch (err: any) {
            setError(err?.message || 'Errore upload')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            <label className="block text-sm font-medium mb-1">Immagine</label>
            <input type="file" accept="image/*" onChange={handleChange} disabled={loading} />
            {loading && <p className="text-sm text-gray-500 mt-1">Caricamento…</p>}
            {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
        </div>
    )
}
