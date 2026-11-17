import { useCallback, useEffect, useState } from 'react'

export type Tab = 'home' | 'discover'
export type DiscoverView = 'deck' | 'matches'

export interface UrlState {
  tab: Tab
  view: DiscoverView
}

/** Discover is the default: it's the point of the app, and what a reviewer should land on. */
function read(): UrlState {
  const params = new URLSearchParams(window.location.search)
  return {
    tab: params.get('tab') === 'home' ? 'home' : 'discover',
    view: params.get('view') === 'matches' ? 'matches' : 'deck',
  }
}

/**
 * Active tab and Discover sub-view, mirrored into `?tab=` and `?view=` so a
 * reload keeps your place (D-001: tabs use query params, never paths, so they
 * can't collide with the /feed, /swipe and /matches API paths).
 * Uses replaceState: switching tabs shouldn't fill the back-button history.
 */
export function useUrlState() {
  const [state, setState] = useState<UrlState>(read)

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', state.tab)
    if (state.tab === 'discover' && state.view === 'matches') url.searchParams.set('view', 'matches')
    else url.searchParams.delete('view')
    if (url.href !== window.location.href) window.history.replaceState(null, '', url)
  }, [state])

  const setTab = useCallback((tab: Tab) => setState((s) => ({ ...s, tab })), [])
  const setView = useCallback((view: DiscoverView) => setState((s) => ({ ...s, view })), [])

  return { ...state, setTab, setView }
}
