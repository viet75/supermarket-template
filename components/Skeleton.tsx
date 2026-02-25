export default function Skeleton({ msg }: { msg?: string }) {
    return (
        <div className="animate-pulse rounded-lg border border-gray-200 dark:border-zinc-800 p-4 bg-gray-50 dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 text-sm">
            {msg ?? 'Caricamento…'}
        </div>
    );
}
