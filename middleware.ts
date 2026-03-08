import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'

const intlMiddleware = createMiddleware(routing)

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl

    // Route admin: manteniamo la logica auth esistente
    if (pathname.startsWith('/admin')) {
        // NON proteggiamo la pagina di login
        if (pathname === '/admin/login') {
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

        const { data: { user }, error } = await supabase.auth.getUser()

        if (!user || error) {
            const url = req.nextUrl.clone()
            url.pathname = '/admin/login'
            return NextResponse.redirect(url)
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!profile || profile.role !== 'admin') {
            const url = req.nextUrl.clone()
            url.pathname = '/admin/login'
            return NextResponse.redirect(url)
        }

        return res
    }

    // Tutte le route pubbliche passano da next-intl
    return intlMiddleware(req)
}

export const config = {
    matcher: [
        '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
        '/admin/:path*'
    ],
}
