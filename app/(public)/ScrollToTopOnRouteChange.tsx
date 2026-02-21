'use client'

import { usePathname } from 'next/navigation'
import { useLayoutEffect } from 'react'

export default function ScrollToTopOnRouteChange() {
  const pathname = usePathname()

  useLayoutEffect(() => {
    const el = document.getElementById('public-scroll-container')
    requestAnimationFrame(() => {
      if (el) el.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      else window.scrollTo({ top: 0, left: 0, behavior: 'auto' })

      requestAnimationFrame(() => {
        if (el) el.scrollTo({ top: 0, left: 0, behavior: 'auto' })
        else window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      })
    })
  }, [pathname])

  return null
}
