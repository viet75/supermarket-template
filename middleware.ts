import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl

    // 1) NON proteggiamo la pagina di login
    if (pathname === '/admin/login') {
        return NextResponse.next()
    }

    // 2) Proteggiamo solo /admin e sotto-percorsi
    if (!pathname.startsWith('/admin')) {
        return NextResponse.next()
    }

    const res = NextResponse.next()

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
                }
            }
        }
    )

    const { data: { session } } = await supabase.auth.getSession()

    // 3) Se NON loggato → redirect al login
    if (!session) {
        const url = req.nextUrl.clone()
        url.pathname = '/admin/login'
        return NextResponse.redirect(url)
    }

    // 4) Controllo admin EMAIL
    const adminEmail = process.env.ADMIN_EMAIL
    if (session.user.email !== adminEmail) {
        const url = req.nextUrl.clone()
        url.pathname = '/admin/login'
        return NextResponse.redirect(url)
    }

    return res
}

export const config = {
    matcher: ['/admin/:path*']
}
