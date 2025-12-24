import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabaseServiceRole';
import type { StoreSettings, PaymentMethod } from '@/lib/types';

// (Opzionale) semplice chiave header per abilitare PUT solo da server actions o strumenti interni
function isAuthorized(req: Request) {
    const hdr = req.headers.get('x-internal-admin-key');
    return hdr && hdr === process.env.INTERNAL_ADMIN_KEY;
}

export async function GET() {
    const { data, error } = await supabaseService
        .from('store_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data ?? null) as StoreSettings | null, { status: 200 });
}

export async function PUT(req: Request) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: Partial<StoreSettings>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Normalizzazione minima
    const patch: Partial<StoreSettings> = {};
    if (typeof body.delivery_enabled === 'boolean') patch.delivery_enabled = body.delivery_enabled;
    if (typeof body.delivery_fee_base === 'number') patch.delivery_fee_base = body.delivery_fee_base;
    if (typeof body.delivery_fee_per_km === 'number') patch.delivery_fee_per_km = body.delivery_fee_per_km;
    if (typeof body.delivery_max_km === 'number') patch.delivery_max_km = body.delivery_max_km;
    if (Array.isArray(body.payment_methods)) {
        // Validazione: payment_methods deve essere un array di stringhe
        const isValidStringArray = body.payment_methods.every((m: any) => typeof m === 'string');
        if (isValidStringArray) {
            // Filtriamo solo i metodi validi
            const allowed: PaymentMethod[] = ['cash', 'card_online', 'pos_on_delivery'];
            patch.payment_methods = body.payment_methods.filter((m: any): m is PaymentMethod => allowed.includes(m as PaymentMethod));
        }
    }
    patch.updated_at = new Date().toISOString() as unknown as any;

    // Upsert della riga singleton (vincolo gestito dall'indice ux_store_settings_singleton)
    const { data, error } = await supabaseService
        .from('store_settings')
        .upsert(patch, { onConflict: 'ux_store_settings_singleton' })
        .select('*')
        .limit(1)
        .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data as StoreSettings, { status: 200 });
}
