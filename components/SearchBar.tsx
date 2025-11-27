'use client'
import { useEffect, useRef, useState } from 'react'

export default function SearchBar({ onChange }: { onChange: (q: string) => void }) {
    const [q, setQ] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    const clear = () => {
        setQ('')
        onChange('')
        inputRef.current?.focus()
    }

    return (
        <div className="px-3 mb-2">
            <div
                className="
          relative
          rounded-xl border border-gray-200 bg-white
          focus-within:ring-2 focus-within:ring-brand/30 focus-within:border-brand/60
          transition
        "
                role="search"
                aria-label="Cerca prodotti"
            >
                {/* icona lente */}
                <span
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    aria-hidden
                >
                    🔎
                </span>

                <input
                    ref={inputRef}
                    type="search"
                    value={q}
                    onChange={(e) => {
                        const v = e.target.value
                        setQ(v)
                        onChange(v)
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') clear()
                    }}
                    placeholder="Cerca un prodotto..."
                    className="
            w-full h-11 pl-10 pr-10 rounded-xl
            outline-none bg-transparent
            placeholder:text-gray-400
          "
                />

                {/* bottone clear */}
                {q && (
                    <button
                        type="button"
                        onClick={clear}
                        className="
              absolute right-2 top-1/2 -translate-y-1/2
              h-7 w-7 rounded-lg
              bg-gray-200 hover:bg-gray-300
              text-gray-700
              transition
            "
                        aria-label="Pulisci ricerca"
                        title="Pulisci"
                    >
                        ✕
                    </button>
                )}
            </div>
        </div>
    )
}
