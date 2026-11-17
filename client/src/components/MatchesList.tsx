import { useEffect, useState } from 'react'
import type { ApiError } from '../api'
import { timeAgo } from '../lib/time'
import type { Match } from '../types'
import { Avatar } from './Avatar'
import { HeartIcon } from './icons'

interface Props {
  matches: Match[]
  status: 'loading' | 'ready' | 'error'
  error: ApiError | null
  onRetry: () => void
  onKeepSwiping: () => void
}

/** Grid of mutual matches, newest first (the server's order). */
export function MatchesList({ matches, status, error, onRetry, onKeepSwiping }: Props) {
  // Re-render once a minute so "5 min. ago" stays true.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  if (status === 'loading') {
    return (
      <ul aria-label="Loading matches" className="grid grid-cols-2 gap-3 px-4 pb-4">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-black/10" />
        ))}
      </ul>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="font-semibold text-ink">Couldn't load your matches</p>
        <p className="text-sm text-ink-muted">{error?.message}</p>
        <button type="button" onClick={onRetry} className="mt-2 rounded-full bg-brand px-5 py-2 font-semibold text-white">
          Retry
        </button>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <div className="mb-2 flex size-20 items-center justify-center rounded-full bg-brand-soft text-brand">
          <HeartIcon className="size-10" />
        </div>
        <p className="text-lg font-bold text-ink">No matches yet</p>
        <p className="text-sm text-ink-muted">When someone you like likes you back, they'll show up here.</p>
        <button type="button" onClick={onKeepSwiping} className="mt-3 rounded-full bg-brand px-5 py-2.5 font-semibold text-white">
          Keep swiping
        </button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-4 pb-4">
      <p className="mb-3 text-sm font-medium text-ink-muted">
        {matches.length === 1 ? '1 person likes you back' : `${matches.length} people like you back`}
      </p>
      <ul className="grid grid-cols-2 gap-3">
        {matches.map(({ profile, matchedAt }) => (
          <li key={profile.id} className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-ink shadow-md">
            <Avatar src={profile.photoUrl} name={profile.name} className="h-full w-full text-6xl" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3 text-white">
              <p className="font-bold">
                {profile.name}, {profile.age}
              </p>
              <p className="truncate text-xs text-white/80">{profile.college}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-pink-200">
                <time dateTime={matchedAt}>Matched {timeAgo(matchedAt, now)}</time>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
