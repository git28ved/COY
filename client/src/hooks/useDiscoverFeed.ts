import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api'
import type { Direction, Match, Profile } from '../types'

const PAGE_SIZE = 10
/** Fetch the next page once this many cards (or fewer) are left. */
const PREFETCH_AT = 3

const toApiError = (err: unknown) =>
  err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong')

interface Options {
  onMatch?: (match: Match) => void
  /** A swipe failed and its card was put back on top. */
  onSwipeError?: (err: ApiError, profile: Profile) => void
}

/**
 * The local card queue for the Discover deck.
 *
 * - Fetches GET /feed on mount, and again when ≤ 3 cards are left.
 * - It only fetches when no swipe is still in flight. Then the server already
 *   knows about every card we've swiped, and never sends one back.
 * - `swipe()` is optimistic: the card leaves the queue at once and POST /swipe
 *   runs in the background. If the request fails, the card goes back on top and
 *   `onSwipeError` fires. A 409 (already swiped) or 404 counts as done.
 * - Preloads the next two photos so the card behind is never blank.
 */
export function useDiscoverFeed({ onMatch, onSwipeError }: Options = {}) {
  const [queue, setQueue] = useState<Profile[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [pending, setPending] = useState(0)
  /** Bumped after each fetch so the effect re-checks even if the queue didn't change. */
  const [fetchCount, setFetchCount] = useState(0)

  const inFlight = useRef(false)
  /** Ids swiped this session (sent or in flight). Never shown again. */
  const swiped = useRef(new Set<string>())

  const callbacks = useRef({ onMatch, onSwipeError })
  useEffect(() => {
    callbacks.current = { onMatch, onSwipeError }
  })

  useEffect(() => {
    if (inFlight.current || error || !hasMore || pending > 0 || queue.length > PREFETCH_AT) return
    inFlight.current = true
    api
      .getFeed(PAGE_SIZE)
      .then(
        (res) => {
          setQueue((q) => {
            const have = new Set(q.map((p) => p.id))
            const fresh = res.profiles.filter((p) => !have.has(p.id) && !swiped.current.has(p.id))
            return fresh.length ? [...q, ...fresh] : q
          })
          setHasMore(res.remaining)
        },
        (err: unknown) => setError(toApiError(err)),
      )
      .finally(() => {
        inFlight.current = false
        setFetchCount((n) => n + 1)
      })
  }, [queue.length, hasMore, error, pending, fetchCount])

  // Warm the browser cache for the next two photos.
  useEffect(() => {
    for (const p of queue.slice(1, 3)) {
      const img = new Image()
      img.decoding = 'async'
      img.src = p.photoUrl
    }
  }, [queue])

  const swipe = useCallback((profile: Profile, direction: Direction) => {
    if (swiped.current.has(profile.id)) return // double tap, or a key press during the fly-out
    swiped.current.add(profile.id)
    setQueue((q) => q.filter((p) => p.id !== profile.id))
    setPending((n) => n + 1)

    api
      .swipe(profile.id, direction)
      .then(
        (res) => {
          if (res.matched) callbacks.current.onMatch?.(res.match)
        },
        (err: unknown) => {
          const e = toApiError(err)
          // Already recorded (409), or the profile is gone (404): nothing to retry.
          if (e.code === 'ALREADY_SWIPED' || e.code === 'NOT_FOUND') return
          swiped.current.delete(profile.id)
          setQueue((q) => [profile, ...q.filter((p) => p.id !== profile.id)])
          callbacks.current.onSwipeError?.(e, profile)
        },
      )
      .finally(() => setPending((n) => n - 1))
  }, [])

  const retry = useCallback(() => setError(null), [])

  const loading = queue.length === 0 && !error && (hasMore || pending > 0)
  const empty = queue.length === 0 && !error && !hasMore && pending === 0

  return { queue, loading, empty, error, swipe, retry }
}
