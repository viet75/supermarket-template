import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
    const res = NextResponse.next()

    // Proteggi solo /admin
    if (!req.nextUrl.pathname.startsWith('/admin')) return res

    // ✅ Nuovo client server-side con gestione cookie manuale
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return req.cookies.get(name)?.value
                },
                set(name: string, value: string) {
                    res.cookies.set(name, value)
                },
                remove(name: string) {
                    res.cookies.delete(name)
                },
            },
        }
    )

    const {
        data: { session },
    } = await supabase.auth.getSession()

    const allowed = process.env.ADMIN_EMAIL

    // deve essere loggato e avere l'email admin
    if (!session || session.user.email !== allowed) {
        const url = req.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('redirectedFrom', req.nextUrl.pathname)
        return NextResponse.redirect(url)
    }

    return res
}

export const config = { matcher: ['/admin/:path*'] }
