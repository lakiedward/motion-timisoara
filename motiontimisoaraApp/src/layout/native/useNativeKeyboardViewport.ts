import { useEffect, useState, type RefObject } from 'react'
import type { KeyboardInfo } from '@capacitor/keyboard'
import { revealNativeInput } from './native-focus'

export function useNativeKeyboardViewport(contentRef: RefObject<HTMLElement | null>) {
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    let keyboardVisible = false
    let frame: number | undefined
    const reveal = () => {
      frame = undefined
      revealNativeInput(content, keyboardVisible)
    }
    const scheduleReveal = () => {
      if (frame === undefined) frame = requestAnimationFrame(reveal)
    }
    const onShow = (event: Event) => {
      const height = (event as Event & Partial<KeyboardInfo>).keyboardHeight
      keyboardVisible = typeof height === 'number' && height > 0
      setKeyboardOpen(keyboardVisible)
      scheduleReveal()
    }
    const onHide = () => {
      keyboardVisible = false
      setKeyboardOpen(false)
      scheduleReveal()
    }
    const viewport = window.visualViewport
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleReveal)
    const mutations = new MutationObserver(scheduleReveal)
    observer?.observe(content)
    mutations.observe(content, { childList: true, characterData: true, subtree: true })
    document.addEventListener('focusin', scheduleReveal)
    window.addEventListener('keyboardWillShow', onShow)
    window.addEventListener('keyboardDidShow', onShow)
    window.addEventListener('keyboardDidHide', onHide)
    window.addEventListener('resize', scheduleReveal)
    viewport?.addEventListener('resize', scheduleReveal)
    viewport?.addEventListener('scroll', scheduleReveal)

    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame)
      observer?.disconnect()
      mutations.disconnect()
      document.removeEventListener('focusin', scheduleReveal)
      window.removeEventListener('keyboardWillShow', onShow)
      window.removeEventListener('keyboardDidShow', onShow)
      window.removeEventListener('keyboardDidHide', onHide)
      window.removeEventListener('resize', scheduleReveal)
      viewport?.removeEventListener('resize', scheduleReveal)
      viewport?.removeEventListener('scroll', scheduleReveal)
    }
  }, [contentRef])

  return keyboardOpen
}
