'use client'

type Props = {
    categories: { id: string; name: string }[]
    activeId: string | null
    onChange: (id: string | null) => void
}

export default function CategoryChips({ categories, activeId, onChange }: Props) {
    return (
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-1">
            {/* Bottone "Tutti" */}
            <button
                onClick={() => onChange(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 shadow-sm
          ${activeId === null
                        ? 'bg-green-600 text-white shadow-md scale-105 border border-green-600'
                        : 'bg-gray-100 text-gray-900 border border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-700'
                    }`}
            >
                Tutti
            </button>

            {/* Altre categorie */}
            {categories.map((c) => (
                <button
                    key={c.id}
                    onClick={() => onChange(c.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 shadow-sm
            ${activeId === c.id
                            ? 'bg-green-600 text-white shadow-md scale-105 border border-green-600'
                            : 'bg-gray-100 text-gray-900 border border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-700'
                        }`}
                >
                    {c.name}
                </button>
            ))}
        </div>
    )
}
