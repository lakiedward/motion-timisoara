import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { usesNativeNavigation } from '@/layout/native/native-runtime'
import { ACCOUNT_NAV, activeAccountTab } from './account-nav'

const FADE = '32px'

function edgeMask(start: boolean, end: boolean) {
  if (!start && !end) return undefined
  const from = start ? `transparent, black ${FADE}` : 'black'
  const to = end ? `black calc(100% - ${FADE}), transparent` : 'black'
  const mask = `linear-gradient(to right, ${from}, ${to})`
  return { maskImage: mask, WebkitMaskImage: mask }
}

function AccountTabs() {
  const { pathname } = useLocation()
  const active = activeAccountTab(pathname)
  const scroller = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  const measure = useCallback(() => {
    const el = scroller.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setEdges({ start: el.scrollLeft > 1, end: el.scrollLeft < max - 1 })
  }, [])

  useLayoutEffect(() => {
    const el = scroller.current
    const tab = el?.querySelector<HTMLElement>('[aria-current="page"]')
    if (el && tab) {
      const left = tab.offsetLeft
      const right = left + tab.offsetWidth
      if (left < el.scrollLeft) el.scrollLeft = left
      else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth
    }
    measure()
  }, [active, measure])

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure])

  return (
    <nav aria-label="Contul meu" className="border-border mb-8 border-b">
      <div
        ref={scroller}
        onScroll={measure}
        className="-mb-px flex gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={edgeMask(edges.start, edges.end)}
      >
        {ACCOUNT_NAV.map((n) => {
          const current = n.to === active
          return (
            <Link
              key={n.to}
              to={n.to}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'min-h-touch-target flex shrink-0 items-center whitespace-nowrap rounded-t-md border-b-2 px-4 text-sm font-medium transition-colors focus-visible:-outline-offset-2',
                current
                  ? 'border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {n.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default function AccountLayout() {
  if (usesNativeNavigation()) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <AccountTabs />
      <Outlet />
    </div>
  )
}
