import { useEffect, useLayoutEffect } from 'react'
import { useLocation, useMatches } from 'react-router-dom'

export const APP_NAME = 'Motion România'
export const HOME_TITLE = `Cursuri și tabere sportive pentru copii · ${APP_NAME}`

export type PageTitleHandle = { pageTitle?: string }

export function pageTitle(title: string): PageTitleHandle {
  return { pageTitle: title }
}

export function formatPageTitle(page?: string | null): string {
  const name = page?.trim()
  return name ? `${name} · ${APP_NAME}` : APP_NAME
}

function titleOfMatch(handle: unknown): string | undefined {
  if (typeof handle !== 'object' || handle === null) return undefined
  const { pageTitle: title } = handle as PageTitleHandle
  return typeof title === 'string' ? title : undefined
}

export function useRouteTitle() {
  const { pathname } = useLocation()
  const matches = useMatches()
  const page = [...matches]
    .reverse()
    .map((m) => titleOfMatch(m.handle))
    .find(Boolean)
  const title = pathname === '/' ? HOME_TITLE : formatPageTitle(page)

  useLayoutEffect(() => {
    document.title = title
  }, [title, pathname])
}

export function useDocumentTitle(name: string | null | undefined, section: string) {
  const title = formatPageTitle(name || section)

  useEffect(() => {
    document.title = title
  }, [title])
}
