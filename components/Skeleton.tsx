export default function Skeleton({ msg }: { msg?: string }) {
    return (
        <div className="animate-pulse rounded-lg border p-4 bg-gray-50 text-gray-500 text-sm">
            {msg ?? 'Caricamento…'}
        </div>
    );
}
