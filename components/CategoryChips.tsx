'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

type Props = {
  categories: { id: string; name: string; slug?: string | null }[]
  activeId: string | null
  onChange: (id: string | null) => void
}

export default function CategoryChips({ categories, activeId, onChange }: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // Show fades only when needed (overflow + scroll position)
  const [fadeLeft, setFadeLeft] = useState(false)
  const [fadeRight, setFadeRight] = useState(false)

  const base =
    'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200'

  // Dark mode: more readable glass chip
  const inactive =
    'border border-gray-200/80 dark:border-white/10 ' +
    'bg-white/70 dark:bg-white/5 ' +
    'backdrop-blur-md ' +
    'text-gray-900 dark:text-zinc-100 ' +
    'shadow-sm hover:shadow-md hover:bg-white/90 dark:hover:bg-white/10'

  const active =
    'border border-green-600/80 ' +
    'bg-green-600 text-white ' +
    'shadow-md'

  // Return category name as stored in the database
  const getCategoryDisplayName = (category: { name: string; slug?: string | null }) => {
    return category.name
  }

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    let raf: number | null = null

    const compute = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el
      const max = Math.max(0, scrollWidth - clientWidth)

      // If there is no overflow, no fade
      if (max <= 1) {
        setFadeLeft(false)
        setFadeRight(false)
        return
      }

      // Anti-tremolo thresholds
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

    // React to resize + layout/categories change
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
    <div className="relative flex items-center gap-2 px-1 py-2">
      {/* PINNED: not inside the scroller */}
      <button
        onClick={() => onChange(null)}
        className={[base, activeId === null ? active : inactive].join(' ')}
      >
        <span className="inline-flex items-center gap-2">
          {activeId !== null && (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="block"
              aria-hidden
            >
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span>{t('categories.all')}</span>
        </span>
      </button>

      {/* SCROLL AREA: only categories + fade confined here */}
      <div className="relative flex-1 min-w-0">
        {/* Fade left */}
        {fadeLeft && (
          <div
            className="
              pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10
              bg-gradient-to-r from-white to-transparent
              dark:from-zinc-950
            "
            aria-hidden
          />
        )}

        {/* Fade right */}
        {fadeRight && (
          <div
            className="
              pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10
              bg-gradient-to-l from-white to-transparent
              dark:from-zinc-950
            "
            aria-hidden
          />
        )}

        <div className="min-w-0 flex-1 overflow-hidden">
          <div
            ref={scrollerRef}
            className="flex gap-2 overflow-x-auto no-scrollbar pr-1 touch-pan-x"
          >
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange(c.id)}
                className={[base, activeId === c.id ? active : inactive].join(' ')}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}