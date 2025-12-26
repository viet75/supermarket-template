import { revalidatePath } from 'next/cache';
import SettingsForm from './SettingsForm';
import { saveSettingsAction } from './actions';   // ✅ import aggiunto
import type { StoreSettings } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function loadSettings(): Promise<StoreSettings | null> {
    const res = await fetch('/api/admin/settings', { cache: 'no-store' }).catch(() => null as any);
    if (!res || !res.ok) return null;
    return (await res.json()) as StoreSettings | null;
}

export default async function AdminSettingsPage() {
    const settings = await loadSettings();

    return (
        <main className="max-w-3xl mx-auto p-6">
            <h1 className="text-2xl font-semibold mb-4">Impostazioni negozio</h1>
            <p className="text-sm text-gray-500 mb-6">
                Configura consegna e metodi di pagamento. Il salvataggio avviene lato server in modo sicuro.
            </p>

            <SettingsForm initial={settings} action={saveSettingsAction} />
        </main>
    );
}
