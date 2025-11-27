export default function SkeletonCard() {
    return (
        <div className="animate-pulse rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="w-full aspect-[4/3] bg-gray-200" />
            <div className="p-3 space-y-2">
                <div className="h-3 w-16 bg-gray-200 rounded" />
                <div className="h-4 w-3/4 bg-gray-200 rounded" />
                <div className="h-10 w-full bg-gray-200 rounded-xl" />
            </div>
        </div>
    )
}
