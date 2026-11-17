import { useCallback, useState } from 'react'
import { useDiscoverFeed } from '../hooks/useDiscoverFeed'
import { useMatches } from '../hooks/useMatches'
import type { DiscoverView } from '../hooks/useUrlState'
import { CardDeck } from './CardDeck'
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
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const show = (text: string, tone: ToastMessage['tone']) => setToast({ id: Date.now(), text, tone })
  const clearToast = useCallback(() => setToast(null), [])

  const feed = useDiscoverFeed({
    onMatch: (match) => {
      matches.add(match)
      // Phase 6 replaces this with the full-screen "It's a match!" overlay.
      show(`It's a match with ${match.profile.name}!`, 'success')
    },
    onSwipeError: (err) => show(err.code === 'NETWORK' ? "You're offline. Card put back." : "Couldn't save that swipe. Try again.", 'error'),
  })

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

      <section className="min-h-0 flex-1">
        {view === 'deck' ? (
          <CardDeck
            queue={feed.queue}
            loading={feed.loading}
            empty={feed.empty}
            error={feed.error}
            onRetry={feed.retry}
            onSwipe={feed.swipe}
            onShowMatches={() => onViewChange('matches')}
            keyboardEnabled={active}
          />
        ) : (
          <p className="flex h-full items-center justify-center px-5 text-center text-ink-muted" aria-live="polite">
            {matches.status === 'loading' && 'Loading matches…'}
            {matches.status === 'error' && "Couldn't load matches."}
            {matches.status === 'ready' &&
              (matches.matches.length === 0
                ? 'No matches yet. Keep swiping!'
                : `${plural(matches.matches.length, 'match', 'matches')}: ${matches.matches.map((m) => m.profile.name).join(', ')}. Full list arrives in Phase 6.`)}
          </p>
        )}
      </section>

      <Toast toast={toast} onDone={clearToast} />
    </div>
  )
}
