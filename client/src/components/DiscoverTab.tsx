import type { DiscoverView } from '../hooks/useUrlState'
import { useMatches } from '../hooks/useMatches'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const VIEWS: { id: DiscoverView; label: string }[] = [
  { id: 'deck', label: 'Discover' },
  { id: 'matches', label: 'Matches' },
]

/**
 * Discover tab: a segmented switch between the swipe deck and the Matches list.
 * Phase 5 fills in the deck and Phase 6 the Matches view.
 */
export function DiscoverTab({ view, onViewChange }: { view: DiscoverView; onViewChange: (v: DiscoverView) => void }) {
  const { matches, status } = useMatches()

  return (
    <div className="flex h-full flex-col">
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
                {id === 'matches' && status === 'ready' && matches.length > 0 && (
                  <span
                    className="min-w-5 rounded-full bg-brand px-1.5 text-center text-xs leading-5 text-white"
                    aria-label={plural(matches.length, 'match', 'matches')}
                  >
                    {matches.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-5 pb-6 text-center text-ink-muted" aria-live="polite">
        {view === 'deck' ? (
          <p>Swipe deck arrives in Phase 5.</p>
        ) : (
          <p>
            {status === 'loading' && 'Loading matches…'}
            {status === 'error' && "Couldn't load matches."}
            {status === 'ready' &&
              (matches.length === 0 ? 'No matches yet. Keep swiping!' : `${plural(matches.length, 'match', 'matches')}. List arrives in Phase 6.`)}
          </p>
        )}
      </section>
    </div>
  )
}
