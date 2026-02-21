'use client'

import { useEffect, useRef } from 'react'

export default function PublicScrollShell({
  header,
  children,
  footer,
}: {
  header: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  // Espone lo scroll host per i componenti client che vogliono leggerlo
  useEffect(() => {
    const el = ref.current
    if (!el) return
    ;(window as any).__PUBLIC_SCROLL_EL__ = el
    return () => {
      if ((window as any).__PUBLIC_SCROLL_EL__ === el) {
        delete (window as any).__PUBLIC_SCROLL_EL__
      }
    }
  }, [])

  return (
    <div ref={ref} id="public-scroll-container" className="h-dvh overflow-y-auto overscroll-contain">
      {header}
      {children}
      {footer}
    </div>
  )
}
