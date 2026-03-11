import SettingsForm from './SettingsForm';
import { saveSettingsAction } from './actions';
import { getStoreSettings } from '@/lib/getStoreSettings';
import SettingsPageHeader from './SettingsPageHeader';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {

    const settings = await getStoreSettings();

    return (
        <main className="max-w-3xl mx-auto p-6 bg-white dark:bg-zinc-950 text-gray-900 dark:text-gray-100 rounded-2xl">
            <SettingsPageHeader />

            <SettingsForm initial={settings} action={saveSettingsAction} />
        </main>
    );
}
