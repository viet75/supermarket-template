// app/admin/settings/actions.ts
'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function saveSettingsAction(_: any, formData: FormData) {
    const payload = {
        store_name: String(formData.get('store_name') ?? '').trim() || '',
        address: String(formData.get('address') ?? '').trim() || '',
        email: String(formData.get('email') ?? '').trim() || '',
        phone: String(formData.get('phone') ?? '').trim() || '',
        opening_hours: String(formData.get('opening_hours') ?? '').trim() || '',
        maps_link: String(formData.get('maps_link') ?? '').trim() || '',
    };

    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');

    const h = await headers();
    const proto = h.get('x-forwarded-proto') ?? 'https';
    const host = h.get('x-forwarded-host') ?? h.get('host');
    const base = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'));
    const res = await fetch(`${base}/api/settings`, {
        method: 'PUT',
        headers: {
            'content-type': 'application/json',
            'x-internal-admin-key': process.env.INTERNAL_ADMIN_KEY ?? '',
            ...(cookieHeader && { cookie: cookieHeader }),
        },
        body: JSON.stringify(payload),
    }).catch(() => null as any);

    if (!res || !res.ok) {
        const err = !res ? 'Connessione fallita' : `Errore salvataggio (${res.status})`;
        return { ok: false, message: err };
    }

    revalidatePath('/admin/settings');
    revalidatePath('/');
    return { ok: true, message: 'Impostazioni salvate.' };
}
