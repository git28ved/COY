import { useCallback, useEffect, useState } from 'react'
import { useDiscoverFeed } from '../hooks/useDiscoverFeed'
import { useMatches } from '../hooks/useMatches'
import type { DiscoverView } from '../hooks/useUrlState'
import type { Match } from '../types'
import { CardDeck } from './CardDeck'
import { MatchesList } from './MatchesList'
import { MatchModal } from './MatchModal'
import { Toast, type ToastMessage } from './Toast'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const VIEWS: { id: DiscoverView; label: string }[] = [
  { id: 'deck', label: 'Discover' },
  { id: 'matches', label: 'Matches' },
]

interface Props {
  view: DiscoverView
  onViewChange: (v: DiscoverView) => void
  /** True while the Discover tab is the visible tab. */
  active: boolean
}

/**
 * Discover tab: a segmented switch between the swipe deck and the Matches list.
 * The feed and matches state live here (not in the deck), so switching views
 * or tabs never loses the deck position.
 */
export function DiscoverTab({ view, onViewChange, active }: Props) {
  const matches = useMatches()
  const { refresh: refreshMatches } = matches
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  /** New matches waiting to be celebrated, shown one at a time (fast swiping can make several). */
  const [celebrate, setCelebrate] = useState<Match[]>([])
  const current = celebrate[0] ?? null
  /** Read out by screen readers after each swipe ("Liked Priya."). */
  const [announcement, setAnnouncement] = useState('')

  const feed = useDiscoverFeed({
    onMatch: (match) => {
      matches.add(match)
      setCelebrate((q) => [...q, match])
    },
    onSwipeError: (err) =>
      setToast({
        id: Date.now(),
        tone: 'error',
        text: err.code === 'NETWORK' ? "You're offline. Card put back." : "Couldn't save that swipe. Try again.",
      }),
  })

  // Quietly re-sync with the server whenever the Matches view is opened.
  useEffect(() => {
    if (active && view === 'matches') refreshMatches()
  }, [active, view, refreshMatches])

  const closeModal = () => setCelebrate((q) => q.slice(1))

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">coy</h1>
        <div role="group" aria-label="Discover views" className="flex rounded-full bg-black/5 p-1">
          {VIEWS.map(({ id, label }) => {
            const selected = id === view
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => onViewChange(id)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-brand ${
                  selected ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {label}
                {id === 'matches' && matches.status === 'ready' && matches.matches.length > 0 && (
                  <span
                    className="min-w-5 rounded-full bg-brand px-1.5 text-center text-xs leading-5 text-white"
                    aria-label={plural(matches.matches.length, 'match', 'matches')}
                  >
                    {matches.matches.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </header>

      <section className="min-h-0 flex-1" aria-label={view === 'deck' ? 'Profiles' : 'Your matches'}>
        {view === 'deck' ? (
          <CardDeck
            queue={feed.queue}
            loading={feed.loading}
            empty={feed.empty}
            error={feed.error}
            onRetry={feed.retry}
            onSwipe={(profile, direction) => {
              setAnnouncement(direction === 'like' ? `Liked ${profile.name}.` : `Passed on ${profile.name}.`)
              feed.swipe(profile, direction)
            }}
            onShowMatches={() => onViewChange('matches')}
            matchCount={matches.matches.length}
            keyboardEnabled={active && !current}
          />
        ) : (
          <MatchesList
            matches={matches.matches}
            status={matches.status}
            error={matches.error}
            onRetry={matches.retry}
            onKeepSwiping={() => onViewChange('deck')}
          />
        )}
      </section>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <Toast toast={toast} onDone={clearToast} />
      <MatchModal
        match={current}
        onKeepSwiping={closeModal}
        onViewMatches={() => {
          setCelebrate([])
          onViewChange('matches')
        }}
      />
    </div>
  )
}
