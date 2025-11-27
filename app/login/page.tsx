'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabaseClient } from '@/lib/supabaseClient'

function LoginForm() {
    const sb = supabaseClient()
    const params = useSearchParams()
    const back = params?.get('redirectedFrom') || '/admin'

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [busy, setBusy] = useState(false)

    const onLogin = async () => {
        if (busy) return
        setBusy(true)
        const { data, error } = await sb.auth.signInWithPassword({ email, password })
        setBusy(false)

        if (error) {
            alert('Credenziali non valide')
            return
        }

        await sb.auth.getSession()
        window.location.assign(back)
    }

    return (
        <div className="w-full max-w-sm space-y-4 border rounded-2xl p-6 
                        bg-white dark:bg-gray-900 
                        text-gray-900 dark:text-gray-100 
                        border-gray-200 dark:border-gray-700 
                        shadow-md">
            <h1 className="text-xl font-bold text-center">Login Admin</h1>

            <input
                className="w-full border rounded p-2 
                           bg-gray-50 dark:bg-gray-800 
                           text-gray-900 dark:text-gray-100 
                           placeholder-gray-500 dark:placeholder-gray-400 
                           border-gray-300 dark:border-gray-600"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />

            <input
                className="w-full border rounded p-2 
                           bg-gray-50 dark:bg-gray-800 
                           text-gray-900 dark:text-gray-100 
                           placeholder-gray-500 dark:placeholder-gray-400 
                           border-gray-300 dark:border-gray-600"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />

            <button
                onClick={onLogin}
                disabled={busy}
                className="w-full rounded p-2 font-medium 
                           bg-black dark:bg-green-600 
                           text-white disabled:opacity-50 
                           hover:opacity-90 transition"
            >
                {busy ? 'Accesso…' : 'Entra'}
            </button>
        </div>
    )
}

export default function LoginPage() {
    return (
        <main className="min-h-[60vh] grid place-items-center p-4 
                         bg-gray-100 dark:bg-gray-950 
                         text-gray-900 dark:text-gray-100">
            <Suspense fallback={<div>Loading…</div>}>
                <LoginForm />
            </Suspense>
        </main>
    )
}
