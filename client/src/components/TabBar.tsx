import { useRef, type KeyboardEvent } from 'react'
import type { Tab } from '../hooks/useUrlState'
import { DiscoverIcon, HomeIcon } from './icons'

const TABS: { id: Tab; label: string; Icon: typeof HomeIcon }[] = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'discover', label: 'Discover', Icon: DiscoverIcon },
]

/**
 * Bottom tab bar. Follows the WAI-ARIA tabs pattern: role="tablist", only the
 * active tab is in the Tab order, and ←/→ (or Home/End) move between tabs.
 */
export function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ home: null, discover: null })

  function onKeyDown(e: KeyboardEvent) {
    const i = TABS.findIndex((t) => t.id === active)
    const next =
      e.key === 'ArrowRight' ? TABS[(i + 1) % TABS.length]
      : e.key === 'ArrowLeft' ? TABS[(i - 1 + TABS.length) % TABS.length]
      : e.key === 'Home' ? TABS[0]
      : e.key === 'End' ? TABS[TABS.length - 1]
      : undefined
    if (!next) return
    e.preventDefault()
    e.stopPropagation() // don't let ←/→ also swipe a card
    onChange(next.id)
    refs.current[next.id]?.focus()
  }

  return (
    <nav className="shrink-0 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div role="tablist" aria-label="Main" className="flex" onKeyDown={onKeyDown}>
        {TABS.map(({ id, label, Icon }) => {
          const selected = id === active
          return (
            <button
              key={id}
              ref={(el) => { refs.current[id] = el }}
              id={`tab-${id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`panel-${id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-brand ${
                selected ? 'text-brand' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Icon className="size-6" filled={selected} />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
