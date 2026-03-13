'use client'

import { useEffect, useRef, useState } from 'react'

type Options = {
  threshold?: number        // px accumulated before changing state
  revealAtTopPx?: number    // always show near the top
  cooldownMs?: number       // minimum time between a toggle and the other (anti-tremolo)
  minDeltaPx?: number       // ignore micro-jitter
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
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

        // always visible near the top
        if (y <= revealAtTopPx) {
          accRef.current = 0
          lastYRef.current = y
          if (!showRef.current) setShow(true)
          return
        }

        const dy = y - lastYRef.current
        lastYRef.current = y

        // ignore microscopical jitter
        if (Math.abs(dy) < minDeltaPx) return

        accRef.current += dy
        // reset accumulator when direction changes (smoother animation)
        if ((dy > 0 && accRef.current < 0) || (dy < 0 && accRef.current > 0)) {
          accRef.current = dy
        }

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

        // AUTO-SHOW after scroll inactivity 
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
        idleTimerRef.current = setTimeout(() => {
          setShow((prev) => (prev ? prev : true))
        }, 700)
      })
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current)
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
    }
  }, [scrollRef, threshold, revealAtTopPx, cooldownMs, minDeltaPx])

  return show
}
