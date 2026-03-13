import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseServiceRole } from '@/lib/supabaseService';
import type { StoreSettings, PaymentMethod } from '@/lib/types';

// PATCH SQL (apply manually if the social_links column does not exist):
// alter table public.store_settings add column if not exists social_links jsonb not null default '{}'::jsonb;

const CONTACT_WHITELIST = ['store_name', 'address', 'email', 'phone', 'opening_hours', 'maps_link'] as const;
function hasValidInternalKey(req: Request): boolean {
    const hdr = req.headers.get('x-internal-admin-key');
    return !!hdr && hdr === process.env.INTERNAL_ADMIN_KEY;
}

async function requireAdminSession(): Promise<{ ok: false; status: 401 | 403 } | { ok: true; userId: string }> {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll() {
                    // Route Handler: no-op to avoid writes during check
                },
            },
        }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        return { ok: false, status: 401 };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (!profile || profile.role !== 'admin') {
        return { ok: false, status: 403 };
    }

    return { ok: true, userId: user.id };
}

function normalizeContact(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const t = value.trim();
    return t === '' ? null : t;
}

function validateContactFields(body: Record<string, unknown>): { ok: false; status: 400; message: string } | null {
    const maps = normalizeContact(body.maps_link);
    if (maps !== null && !/^https?:\/\//i.test(maps)) {
        return { ok: false, status: 400, message: 'maps_link must start with http:// or https://' };
    }
    const em = normalizeContact(body.email);
    if (em !== null && !em.includes('@')) {
        return { ok: false, status: 400, message: 'email is invalid' };
    }
    return null;
}

export async function GET() {
    const { data, error } = await supabaseServiceRole
        .from('store_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const out = (data ?? null) as StoreSettings | null;
    if (out && (out as any).social_links == null) (out as any).social_links = {};
    return NextResponse.json(out, { status: 200 });
}

export async function PUT(req: Request) {
    if (!hasValidInternalKey(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await requireAdminSession();
    if (!session.ok) {
        return NextResponse.json(
            { error: session.status === 401 ? 'Session requested' : 'Permission denied' },
            { status: session.status }
        );
    }

    let rawBody: Record<string, unknown>;
    try {
        rawBody = (await req.json()) as Record<string, unknown>;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validationError = validateContactFields(rawBody);
    if (validationError) {
        return NextResponse.json({ error: validationError.message }, { status: validationError.status });
    }

    const patch: Record<string, unknown> = {};

    for (const key of CONTACT_WHITELIST) {
        if (key in rawBody) {
            const val = normalizeContact(rawBody[key]);
            patch[key] = val;
        }
    }

    if (rawBody.social_links !== undefined && rawBody.social_links !== null && typeof rawBody.social_links === 'object' && !Array.isArray(rawBody.social_links)) {
        const sl = rawBody.social_links as Record<string, unknown>;
        const out: Record<string, string> = {};
        for (const k of ['instagram', 'facebook', 'whatsapp', 'tiktok', 'youtube', 'website']) {
            const v = sl[k];
            if (typeof v === 'string') {
                const t = v.trim();
                if (t) out[k] = t;
            }
        }
        patch.social_links = out;
    }

    if (typeof rawBody.delivery_enabled === 'boolean') patch.delivery_enabled = rawBody.delivery_enabled;
    if (typeof rawBody.delivery_fee_base === 'number') patch.delivery_fee_base = rawBody.delivery_fee_base;
    if (typeof rawBody.delivery_fee_per_km === 'number') patch.delivery_fee_per_km = rawBody.delivery_fee_per_km;
    if (typeof rawBody.delivery_max_km === 'number') patch.delivery_max_km = rawBody.delivery_max_km;
    if (Array.isArray(rawBody.payment_methods)) {
        const allowed: PaymentMethod[] = ['cash', 'card_online', 'pos_on_delivery'];
        const valid = rawBody.payment_methods.every((m: unknown) => typeof m === 'string');
        if (valid) {
            patch.payment_methods = (rawBody.payment_methods as string[]).filter((m): m is PaymentMethod =>
                allowed.includes(m as PaymentMethod)
            );
        }
    }

    patch.updated_at = new Date().toISOString();

    if (Object.keys(patch).length <= 1) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseServiceRole
        .from('store_settings')
        .upsert(patch, { onConflict: 'singleton_key' })
        .select('*')
        .limit(1)
        .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data as StoreSettings, { status: 200 });
}
