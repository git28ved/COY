/** Shown when every profile has been swiped. */
export function EmptyDeck({ matchCount, onShowMatches }: { matchCount: number; onShowMatches: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-3xl bg-brand-soft/60 p-8 text-center">
      <svg viewBox="0 0 120 100" aria-hidden="true" className="mb-3 w-32">
        <rect x="34" y="10" width="52" height="72" rx="10" transform="rotate(10 60 46)" className="fill-brand/20" />
        <rect x="34" y="10" width="52" height="72" rx="10" transform="rotate(-8 60 46)" className="fill-brand/35" />
        <rect x="34" y="12" width="52" height="72" rx="10" className="fill-white stroke-brand/40" strokeWidth="2" />
        <circle cx="60" cy="48" r="16" className="fill-like" />
        <path d="M52 48l6 6 11-12" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="text-xl font-bold text-ink">You're all caught up</p>
      <p className="text-sm text-ink-muted">You've seen everyone for now. New people will show up here.</p>
      <button type="button" onClick={onShowMatches} className="mt-3 rounded-full bg-brand px-5 py-2.5 font-semibold text-white shadow-md transition hover:scale-[1.02] active:scale-95">
        {matchCount > 0 ? `See your ${matchCount === 1 ? 'match' : `${matchCount} matches`}` : 'See your matches'}
      </button>
    </div>
  )
}
