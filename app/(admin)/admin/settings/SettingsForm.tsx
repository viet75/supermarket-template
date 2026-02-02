'use client';

import * as React from 'react';
import type { StoreSettings } from '@/lib/types';

type Props = {
    initial: StoreSettings | null;
    action: (state: any, formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

export default function SettingsForm({ initial, action }: Props) {
    const [state, formAction] = React.useActionState(action, { ok: false, message: '' });

    const init = React.useMemo<StoreSettings>(
        () =>
            initial ?? {
                id: '',
                delivery_enabled: false,
                delivery_fee_base: 0,
                delivery_fee_per_km: 0,
                delivery_max_km: 0,
                free_over: 0,
                store_lat: null,
                store_lng: null,
                payment_methods: ['cash'],
                updated_at: new Date().toISOString(),
                store_name: '',
                address: '',
                email: '',
                phone: '',
                opening_hours: '',
                maps_link: '',
            },
        [initial]
    );

    React.useEffect(() => {
        if (state?.message) {
            // eslint-disable-next-line no-alert
            alert(state.message);
        }
    }, [state?.message]);

    return (
        <form action={formAction} className="space-y-6 rounded-2xl border p-4 md:p-6 shadow-sm bg-white">
            {/* Contatti negozio */}
            <fieldset className="space-y-4 rounded-xl border p-4">
                <legend className="font-medium px-2">Contatti negozio</legend>
                <Field label="Nome negozio">
                    <input name="store_name" type="text" defaultValue={init.store_name ?? ''} className="w-full rounded-md border p-2" />
                </Field>
                <Field label="Indirizzo">
                    <input name="address" type="text" defaultValue={init.address ?? ''} className="w-full rounded-md border p-2" />
                </Field>
                <Field label="Email">
                    <input name="email" type="email" defaultValue={init.email ?? ''} className="w-full rounded-md border p-2" />
                </Field>
                <Field label="Telefono">
                    <input name="phone" type="tel" defaultValue={init.phone ?? ''} className="w-full rounded-md border p-2" />
                </Field>
                <Field label="Orari di apertura">
                    <input name="opening_hours" type="text" defaultValue={init.opening_hours ?? ''} className="w-full rounded-md border p-2" />
                </Field>
                <Field label="Link Google Maps">
                    <input name="maps_link" type="url" defaultValue={init.maps_link ?? ''} className="w-full rounded-md border p-2" />
                </Field>
            </fieldset>

            <div className="flex justify-end gap-3">
                <button type="submit" className="rounded-lg px-4 py-2 border bg-gray-900 text-white hover:bg-black">
                    Salva
                </button>
            </div>

            <p className="text-xs text-gray-400">Ultimo aggiornamento: {new Date(init.updated_at).toLocaleString()}</p>
        </form>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="block text-sm mb-1">{label}</span>
            {children}
        </label>
    );
}

