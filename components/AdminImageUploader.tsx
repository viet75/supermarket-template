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
            setError('Please select an image file')
            return
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB
            setError('Image too large (max 5MB)')
            return
        }
        setError(null)
        setLoading(true)

        try {
            const fd = new FormData()
            fd.append('file', file)

            const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
            const json = await res.json()
            if (!res.ok || !json?.url) throw new Error(json?.error || 'Upload failed')

            onUploaded(json.url)
        } catch (err: any) {
            setError(err?.message || 'Upload error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            <label className="block text-sm font-medium mb-1">Image</label>
            <input type="file" accept="image/*" onChange={handleChange} disabled={loading} />
            {loading && <p className="text-sm text-gray-500 mt-1">Uploading…</p>}
            {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
        </div>
    )
}
