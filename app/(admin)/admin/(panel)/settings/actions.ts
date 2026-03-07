// app/admin/settings/actions.ts
'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

function trimUrl(v: FormDataEntryValue | null): string {
    const s = v != null ? String(v).trim() : '';
    return s;
}

export async function saveSettingsAction(_: any, formData: FormData) {
    const socialInstagram = trimUrl(formData.get('social_instagram'));
    const socialFacebook = trimUrl(formData.get('social_facebook'));
    const socialWhatsapp = trimUrl(formData.get('social_whatsapp'));
    const socialTiktok = trimUrl(formData.get('social_tiktok'));
    const socialYoutube = trimUrl(formData.get('social_youtube'));
    const socialWebsite = trimUrl(formData.get('social_website'));
    const social_links: Record<string, string> = {};
    if (socialInstagram) social_links.instagram = socialInstagram;
    if (socialFacebook) social_links.facebook = socialFacebook;
    if (socialWhatsapp) social_links.whatsapp = socialWhatsapp;
    if (socialTiktok) social_links.tiktok = socialTiktok;
    if (socialYoutube) social_links.youtube = socialYoutube;
    if (socialWebsite) social_links.website = socialWebsite;

    const payload = {
        store_name: String(formData.get('store_name') ?? '').trim() || '',
        address: String(formData.get('address') ?? '').trim() || '',
        email: String(formData.get('email') ?? '').trim() || '',
        phone: String(formData.get('phone') ?? '').trim() || '',
        opening_hours: String(formData.get('opening_hours') ?? '').trim() || '',
        maps_link: String(formData.get('maps_link') ?? '').trim() || '',
        social_links,
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
