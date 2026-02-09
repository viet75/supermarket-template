'use client'

import { useEffect } from 'react'

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  // iPadOS 13+ reports as MacIntel with touch
  const isMacIntel = /Macintosh|Mac Intel/i.test(ua)
  const hasTouch = navigator.maxTouchPoints > 1
  return Boolean(isMacIntel && hasTouch)
}

function isFormControlOrEditable(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  return target.isContentEditable
}

export default function DisableIOSZoom() {
  useEffect(() => {
    if (!isIOS()) return

    const opts = { passive: false, capture: true } as const

    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 1 && !isFormControlOrEditable(e.target)) {
        e.preventDefault()
      }
    }

    const onGesture = (e: Event) => {
      e.preventDefault()
    }

    const onDblclick = (e: Event) => {
      e.preventDefault()
    }

    document.addEventListener('touchstart', onTouch, opts)
    document.addEventListener('touchmove', onTouch, opts)
    document.addEventListener('gesturestart', onGesture, opts)
    document.addEventListener('gesturechange', onGesture, opts)
    document.addEventListener('gestureend', onGesture, opts)
    document.addEventListener('dblclick', onDblclick, opts)

    return () => {
      document.removeEventListener('touchstart', onTouch, opts)
      document.removeEventListener('touchmove', onTouch, opts)
      document.removeEventListener('gesturestart', onGesture, opts)
      document.removeEventListener('gesturechange', onGesture, opts)
      document.removeEventListener('gestureend', onGesture, opts)
      document.removeEventListener('dblclick', onDblclick, opts)
    }
  }, [])

  return null
}
