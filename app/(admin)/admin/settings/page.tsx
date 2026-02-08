import SettingsForm from './SettingsForm';
import { saveSettingsAction } from './actions';
import { getStoreSettings } from '@/lib/getStoreSettings';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
    const settings = await getStoreSettings();

    return (
        <main className="max-w-3xl mx-auto p-6 bg-white dark:bg-zinc-950 text-gray-900 dark:text-gray-100 rounded-2xl">
            <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Impostazioni negozio</h1>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mb-6">
                Contatti negozio (nome, indirizzo, email, telefono, orari, link mappe). Il salvataggio avviene lato server.
            </p>

            <SettingsForm initial={settings} action={saveSettingsAction} />
        </main>
    );
}
