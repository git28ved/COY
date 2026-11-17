import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api'
import type { Match } from '../types'

type Status = 'loading' | 'ready' | 'error'

const toApiError = (err: unknown) =>
  err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong')

/**
 * Loads GET /matches.
 * - `refresh()` refetches quietly, e.g. after a new match.
 * - `retry()` shows the loading state again, for a Retry button after an error.
 * - `add()` puts a just-created match at the top without waiting for the server.
 */
export function useMatches() {
  const [matches, setMatches] = useState<Match[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<ApiError | null>(null)
  const controller = useRef<AbortController | null>(null)

  /** Starts a request, cancelling any earlier one. State only changes once it settles. */
  const load = useCallback(() => {
    controller.current?.abort()
    const ctrl = new AbortController()
    controller.current = ctrl
    api.getMatches(ctrl.signal).then(
      (res) => {
        setMatches(res.matches)
        setError(null)
        setStatus('ready')
      },
      (err: unknown) => {
        if (ctrl.signal.aborted) return
        setError(toApiError(err))
        setStatus('error')
      },
    )
    return ctrl
  }, [])

  useEffect(() => {
    const ctrl = load()
    return () => ctrl.abort()
  }, [load])

  const refresh = useCallback(() => {
    load()
  }, [load])

  const retry = useCallback(() => {
    setStatus('loading')
    load()
  }, [load])

  const add = useCallback((match: Match) => {
    setMatches((prev) =>
      prev.some((m) => m.profile.id === match.profile.id) ? prev : [match, ...prev],
    )
  }, [])

  return { matches, status, error, refresh, retry, add }
}
