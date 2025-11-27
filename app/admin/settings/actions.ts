// app/admin/settings/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import type { PaymentMethod } from '@/lib/types';

export async function saveSettingsAction(_: any, formData: FormData) {
    const delivery_enabled = formData.get('delivery_enabled') === 'on';
    const delivery_fee_base = Number(formData.get('delivery_fee_base') ?? 0);
    const delivery_fee_per_km = Number(formData.get('delivery_fee_per_km') ?? 0);
    const delivery_max_km = Number(formData.get('delivery_max_km') ?? 0);

    // ✅ valori coerenti con PaymentMethod
    const allowed: PaymentMethod[] = ['cash', 'card_on_delivery', 'card_online'];
    const selected = new Set<string>(formData.getAll('payment_methods') as string[]);
    const payment_methods = allowed.filter((m) => selected.has(m));

    if ([delivery_fee_base, delivery_fee_per_km, delivery_max_km].some(Number.isNaN)) {
        return { ok: false, message: 'Valori numerici non validi.' };
    }

    const payload = {
        delivery_enabled,
        delivery_fee_base,
        delivery_fee_per_km,
        delivery_max_km,
        payment_methods,
    };

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? '';
    const res = await fetch(`${base}/api/admin/settings`, {
        method: 'PUT',
        headers: {
            'content-type': 'application/json',
            'x-internal-admin-key': process.env.INTERNAL_ADMIN_KEY ?? '',
        },
        body: JSON.stringify(payload),
    }).catch(() => null as any);

    if (!res || !res.ok) {
        const err = !res ? 'Connessione fallita' : `Errore salvataggio (${res.status})`;
        return { ok: false, message: err };
    }

    revalidatePath('/admin/settings');
    return { ok: true, message: 'Impostazioni salvate.' };
}
