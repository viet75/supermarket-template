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

    const isZoomed = () => {
      const vv = window.visualViewport
      if (!vv) return false
      return Math.abs(vv.scale - 1) > 0.01
    }

    const onOrientationChange = () => {
      // Se l'utente ruota mentre la pagina è zoomata, Safari ricalcola il viewport e può "esplodere".
      // Reload controllato per tornare a scale=1.
      if (isZoomed()) {
        setTimeout(() => window.location.reload(), 50)
      }
    }

    let locked = false
    let scrollY = 0
    let prevTouchAction = ''

    const lockScroll = () => {
      if (locked) return
      locked = true
      prevTouchAction = document.documentElement.style.touchAction
      document.documentElement.style.touchAction = 'pan-x pan-y'
      scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.width = '100%'
    }

    const unlockScroll = () => {
      if (!locked) return
      locked = false
      const top = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.width = ''
      document.documentElement.style.touchAction = prevTouchAction
      const y = top ? Math.abs(parseInt(top, 10)) : scrollY
      window.scrollTo(0, y)
    }

    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 1 && !isFormControlOrEditable(e.target)) {
        e.preventDefault()
        lockScroll()
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) unlockScroll()
    }

    const onGesture = (e: Event) => {
      e.preventDefault()
    }

    const onDblclick = (e: Event) => {
      e.preventDefault()
    }

    document.addEventListener('touchstart', onTouch, opts)
    document.addEventListener('touchmove', onTouch, opts)
    document.addEventListener('touchend', onTouchEnd, opts)
    document.addEventListener('touchcancel', onTouchEnd, opts)
    document.addEventListener('gesturestart', onGesture, opts)
    document.addEventListener('gesturechange', onGesture, opts)
    document.addEventListener('gestureend', onGesture, opts)
    document.addEventListener('dblclick', onDblclick, opts)
    window.addEventListener('orientationchange', onOrientationChange)

    return () => {
      document.removeEventListener('touchstart', onTouch, opts)
      document.removeEventListener('touchmove', onTouch, opts)
      document.removeEventListener('touchend', onTouchEnd, opts)
      document.removeEventListener('touchcancel', onTouchEnd, opts)
      document.removeEventListener('gesturestart', onGesture, opts)
      document.removeEventListener('gesturechange', onGesture, opts)
      document.removeEventListener('gestureend', onGesture, opts)
      document.removeEventListener('dblclick', onDblclick, opts)
      window.removeEventListener('orientationchange', onOrientationChange)
      unlockScroll()
    }
  }, [])

  return null
}
