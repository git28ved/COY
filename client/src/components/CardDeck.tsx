import { useEffect, useRef } from 'react'
import type { ApiError } from '../api'
import type { Direction, Profile } from '../types'
import { CloseIcon, HeartIcon } from './icons'
import { SwipeCard, type SwipeCardHandle } from './SwipeCard'

interface Props {
  queue: Profile[]
  loading: boolean
  empty: boolean
  error: ApiError | null
  onRetry: () => void
  onSwipe: (profile: Profile, direction: Direction) => void
  onShowMatches: () => void
  /** Keyboard shortcuts only work while the deck is on screen and nothing covers it. */
  keyboardEnabled: boolean
}

/**
 * The swipe deck: the top card plus the next one behind it, ✕/♥ buttons,
 * and ←/→ keys. Buttons and keys go through the same fly-out as a drag.
 */
export function CardDeck({ queue, loading, empty, error, onRetry, onSwipe, onShowMatches, keyboardEnabled }: Props) {
  const topRef = useRef<SwipeCardHandle>(null)
  const top = queue[0]
  const visible = queue.slice(0, 2)

  useEffect(() => {
    if (!keyboardEnabled || !top) return
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      if (e.key === 'ArrowLeft') topRef.current?.swipe('pass')
      else if (e.key === 'ArrowRight') topRef.current?.swipe('like')
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keyboardEnabled, top])

  return (
    <div className="flex h-full flex-col px-4 pb-4">
      <div className="relative min-h-0 flex-1">
        {visible
          .map((p, i) => (
            <SwipeCard
              key={p.id}
              ref={i === 0 ? topRef : undefined}
              profile={p}
              isTop={i === 0}
              onSwiped={(dir) => onSwipe(p, dir)}
            />
          ))
          .reverse() /* top card last in the DOM, so it paints above */}

        {!top && loading && <CardSkeleton />}
        {!top && error && (
          <Centered>
            <p className="font-semibold text-ink">Couldn't load profiles</p>
            <p className="text-sm text-ink-muted">{error.message}</p>
            <button type="button" onClick={onRetry} className="mt-2 rounded-full bg-brand px-5 py-2 font-semibold text-white">
              Retry
            </button>
          </Centered>
        )}
        {!top && empty && (
          <Centered>
            <p className="text-lg font-bold text-ink">You're all caught up</p>
            <p className="text-sm text-ink-muted">No new profiles right now.</p>
            <button type="button" onClick={onShowMatches} className="mt-2 rounded-full bg-brand px-5 py-2 font-semibold text-white">
              See your matches
            </button>
          </Centered>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-8 pt-4">
        <RoundButton label="Pass" disabled={!top} onClick={() => topRef.current?.swipe('pass')} className="text-nope">
          <CloseIcon className="size-7" />
        </RoundButton>
        <RoundButton label="Like" disabled={!top} onClick={() => topRef.current?.swipe('like')} className="text-like">
          <HeartIcon className="size-7" filled />
        </RoundButton>
      </div>
    </div>
  )
}

function RoundButton({ label, disabled, onClick, className, children }: { label: string; disabled: boolean; onClick: () => void; className: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={`${label} (${label === 'Pass' ? '←' : '→'})`}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-16 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/5 transition hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-40 disabled:hover:scale-100 ${className}`}
    >
      {children}
    </button>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-3xl bg-brand-soft/60 p-6 text-center">{children}</div>
}

function CardSkeleton() {
  return (
    <div aria-label="Loading profiles" className="absolute inset-0 animate-pulse rounded-3xl bg-black/10">
      <div className="absolute inset-x-5 bottom-5 space-y-2">
        <div className="h-7 w-1/2 rounded bg-black/10" />
        <div className="h-4 w-2/3 rounded bg-black/10" />
        <div className="h-4 w-full rounded bg-black/10" />
      </div>
    </div>
  )
}
