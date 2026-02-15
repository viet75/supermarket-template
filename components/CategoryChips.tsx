'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  categories: { id: string; name: string }[]
  activeId: string | null
  onChange: (id: string | null) => void
}

export default function CategoryChips({ categories, activeId, onChange }: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // Mostra sfumature solo quando servono (overflow + posizione scroll)
  const [fadeLeft, setFadeLeft] = useState(false)
  const [fadeRight, setFadeRight] = useState(false)

  const base =
    'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200'

  // Dark mode: chip “glass” più leggibili
  const inactive =
    'border border-gray-200/80 dark:border-white/10 ' +
    'bg-white/70 dark:bg-white/5 ' +
    'backdrop-blur-md ' +
    'text-gray-900 dark:text-gray-100 ' +
    'shadow-sm hover:shadow-md hover:bg-white/90 dark:hover:bg-white/10'

  const active =
    'border border-green-600/80 ' +
    'bg-green-600 text-white ' +
    'shadow-md'

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    let raf: number | null = null

    const compute = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el
      const max = Math.max(0, scrollWidth - clientWidth)

      // Se non c'è overflow, nessun fade
      if (max <= 1) {
        setFadeLeft(false)
        setFadeRight(false)
        return
      }

      // Soglie anti-tremolio
      setFadeLeft(scrollLeft > 2)
      setFadeRight(scrollLeft < max - 2)
    }

    const schedule = () => {
      if (raf != null) return
      raf = window.requestAnimationFrame(() => {
        raf = null
        compute()
      })
    }

    schedule()

    el.addEventListener('scroll', schedule, { passive: true })

    // Reagisci a resize + cambi layout/categorie
    const ro = new ResizeObserver(schedule)
    ro.observe(el)

    window.addEventListener('resize', schedule, { passive: true })

    return () => {
      el.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      ro.disconnect()
      if (raf != null) window.cancelAnimationFrame(raf)
    }
  }, [categories.length])

  return (
    <div className="relative">
      {/* Fade sinistra */}
      {fadeLeft && (
        <div
          className="
            pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10
            bg-gradient-to-r from-white to-transparent
            dark:from-gray-950
          "
          aria-hidden
        />
      )}

      {/* Fade destra */}
      {fadeRight && (
        <div
          className="
            pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10
            bg-gradient-to-l from-white to-transparent
            dark:from-gray-950
          "
          aria-hidden
        />
      )}

      <div ref={scrollerRef} className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => onChange(null)}
          className={[base, activeId === null ? active : inactive].join(' ')}
        >
          Tutti
        </button>

        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => onChange(c.id)}
            className={[base, activeId === c.id ? active : inactive].join(' ')}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  )
}
