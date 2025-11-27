'use client';

import { useEffect, useMemo } from 'react';
import { useFormState } from 'react-dom';
import type { StoreSettings, PaymentMethod } from '@/lib/types';

type Props = {
    initial: StoreSettings | null;
    action: (state: any, formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

// ✅ Allineato con types.ts
const ALL_PM: PaymentMethod[] = ['cash', 'card_on_delivery', 'card_online'];

export default function SettingsForm({ initial, action }: Props) {
    const [state, formAction] = useFormState(action, { ok: false, message: '' });

    // Valori iniziali fallback se non c'è riga (dopo seed dovrebbe esistere)
    const init = useMemo<StoreSettings>(
        () =>
            initial ?? {
                id: '',
                delivery_enabled: false,
                delivery_fee_base: 0,
                delivery_fee_per_km: 0,
                delivery_max_km: 0,
                free_over: 0,            // ✅ aggiunto
                store_lat: null,         // ✅ aggiunto
                store_lng: null,         // ✅ aggiunto
                payment_methods: ['cash'],
                updated_at: new Date().toISOString(),
            },
        [initial]
    );

    useEffect(() => {
        if (state?.message) {
            // sostituisci con il tuo Toast se preferisci
            // eslint-disable-next-line no-alert
            alert(state.message);
        }
    }, [state?.message]);

    return (
        <form action={formAction} className="space-y-6 rounded-2xl border p-4 md:p-6 shadow-sm bg-white">
            {/* Consegna attiva */}
            <div className="flex items-center justify-between">
                <label htmlFor="delivery_enabled" className="font-medium">
                    Abilita consegna
                </label>
                <input
                    id="delivery_enabled"
                    name="delivery_enabled"
                    type="checkbox"
                    defaultChecked={init.delivery_enabled}
                    className="h-5 w-5"
                />
            </div>

            {/* Costi/consegna */}
            <fieldset className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Fee base (€)">
                    <input
                        name="delivery_fee_base"
                        type="number"
                        step="0.01"
                        defaultValue={init.delivery_fee_base}
                        className="w-full rounded-md border p-2"
                    />
                </Field>
                <Field label="€/km aggiuntivo">
                    <input
                        name="delivery_fee_per_km"
                        type="number"
                        step="0.01"
                        defaultValue={init.delivery_fee_per_km}
                        className="w-full rounded-md border p-2"
                    />
                </Field>
                <Field label="Raggio massimo (km)">
                    <input
                        name="delivery_max_km"
                        type="number"
                        step="0.1"
                        defaultValue={init.delivery_max_km}
                        className="w-full rounded-md border p-2"
                    />
                </Field>
            </fieldset>

            {/* Metodi di pagamento */}
            <div>
                <div className="font-medium mb-2">Metodi di pagamento</div>
                <div className="flex flex-wrap gap-4">
                    {ALL_PM.map((m) => {
                        const checked = init.payment_methods.includes(m);
                        return (
                            <label key={m} className="inline-flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    name="payment_methods"
                                    value={m}
                                    defaultChecked={checked}
                                    className="h-5 w-5"
                                />
                                <span>{labelPM(m)}</span>
                            </label>
                        );
                    })}
                </div>
            </div>

            <div className="flex justify-end gap-3">
                <button type="submit" className="rounded-lg px-4 py-2 border bg-gray-900 text-white hover:bg-black">
                    Salva impostazioni
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

// ✅ Etichette aggiornate
function labelPM(m: PaymentMethod) {
    switch (m) {
        case 'cash':
            return 'Contanti';
        case 'card_on_delivery':
            return 'Carta alla consegna';
        case 'card_online':
            return 'Pagamento online';
        default:
            return m;
    }
}
