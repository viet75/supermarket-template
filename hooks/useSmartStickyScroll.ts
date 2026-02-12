'use client'

import { useEffect, useRef, useState } from 'react'

type Options = {
  threshold?: number        // px accumulati prima di cambiare stato
  revealAtTopPx?: number    // vicino al top mostra sempre
  cooldownMs?: number       // tempo minimo tra un toggle e l’altro (anti tremolio)
  minDeltaPx?: number       // ignora micro-jitter
}

export function useSmartStickyScroll<T extends HTMLElement>(
  scrollRef: React.RefObject<T | null>,
  options?: Options
) {
  const threshold = options?.threshold ?? 18
  const revealAtTopPx = options?.revealAtTopPx ?? 24
  const cooldownMs = options?.cooldownMs ?? 220
  const minDeltaPx = options?.minDeltaPx ?? 1

  const [show, setShow] = useState(true)

  const lastYRef = useRef(0)
  const accRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastToggleTsRef = useRef(0)
  const showRef = useRef(true)

  useEffect(() => {
    showRef.current = show
  }, [show])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const getY = () => el.scrollTop || 0

    lastYRef.current = getY()
    accRef.current = 0
    lastToggleTsRef.current = 0

    const onScroll = () => {
      if (rafRef.current != null) return

      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null

        const y = getY()

        // sempre visibile vicino al top
        if (y <= revealAtTopPx) {
          accRef.current = 0
          lastYRef.current = y
          if (!showRef.current) setShow(true)
          return
        }

        const dy = y - lastYRef.current
        lastYRef.current = y

        // ignora jitter microscopico
        if (Math.abs(dy) < minDeltaPx) return

        accRef.current += dy

        const now = Date.now()
        const canToggle = now - lastToggleTsRef.current >= cooldownMs

        // down => hide
        if (accRef.current >= threshold && canToggle) {
          accRef.current = 0
          lastToggleTsRef.current = now
          if (showRef.current) setShow(false)
          return
        }

        // up => show
        if (accRef.current <= -threshold && canToggle) {
          accRef.current = 0
          lastToggleTsRef.current = now
          if (!showRef.current) setShow(true)
        }
      })
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current)
    }
  }, [scrollRef, threshold, revealAtTopPx, cooldownMs, minDeltaPx])

  return show
}
