'use client';

import * as React from 'react';
import { useFormStatus } from 'react-dom';
import type { StoreSettings } from '@/lib/types';

type Props = {
    initial: StoreSettings | null;
    action: (state: any, formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

function SubmitButton({ success }: { success: boolean }) {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="rounded-lg px-4 py-2 border border-transparent bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all duration-150 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 min-w-[120px]"
        >
            {pending ? (
                <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-zinc-400 dark:border-t-zinc-900" />
                    Salvataggio…
                </>
            ) : success ? (
                'Salvato ✓'
            ) : (
                'Salva'
            )}
        </button>
    );
}

export default function SettingsForm({ initial, action }: Props) {
    const [state, formAction] = React.useActionState(action, { ok: false, message: '' });
    const [success, setSuccess] = React.useState(false);

    React.useEffect(() => {
        if (state?.ok) {
            setSuccess(true);
            const t = setTimeout(() => setSuccess(false), 1500);
            return () => clearTimeout(t);
        }
    }, [state?.ok]);

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

    const inputClass =
        'w-full rounded-lg border px-3 py-2 text-sm outline-none transition bg-white text-gray-900 border-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-zinc-200 focus:border-gray-400 dark:bg-zinc-900 dark:text-gray-100 dark:border-zinc-800 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-700 dark:focus:border-zinc-600'

    return (
        <form action={formAction} className="space-y-6 rounded-2xl border border-gray-200 dark:border-zinc-800 p-4 md:p-6 shadow-md bg-white dark:bg-zinc-900">
            {/* Contatti negozio */}
            <fieldset className="space-y-4 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                <legend className="font-medium px-2 text-gray-900 dark:text-gray-100">Contatti negozio</legend>
                <Field label="Nome negozio">
                    <input name="store_name" type="text" defaultValue={init.store_name ?? ''} className={inputClass} />
                </Field>
                <Field label="Indirizzo">
                    <input name="address" type="text" defaultValue={init.address ?? ''} className={inputClass} />
                </Field>
                <Field label="Email">
                    <input name="email" type="email" defaultValue={init.email ?? ''} className={inputClass} />
                </Field>
                <Field label="Telefono">
                    <input name="phone" type="tel" defaultValue={init.phone ?? ''} className={inputClass} />
                </Field>
                <Field label="Orari di apertura">
                    <input name="opening_hours" type="text" defaultValue={init.opening_hours ?? ''} className={inputClass} />
                </Field>
                <Field label="Link Google Maps">
                    <input name="maps_link" type="url" defaultValue={init.maps_link ?? ''} className={inputClass} />
                </Field>
            </fieldset>

            <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-zinc-800 pt-4">
                <SubmitButton success={success} />
            </div>

            <p className="text-xs text-gray-500 dark:text-zinc-400">Ultimo aggiornamento: {new Date(init.updated_at).toLocaleString()}</p>
        </form>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="block text-sm mb-1 text-gray-900 dark:text-gray-100">{label}</span>
            {children}
        </label>
    );
}

