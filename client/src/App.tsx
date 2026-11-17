import { DiscoverTab } from './components/DiscoverTab'
import { HomeTab } from './components/HomeTab'
import { TabBar } from './components/TabBar'
import { useUrlState } from './hooks/useUrlState'

/**
 * App shell: a phone-sized column (full screen on mobile, a centred "phone"
 * on desktop) with the content area on top and the tab bar at the bottom.
 *
 * Both tab panels stay mounted and the inactive one is `hidden`, so switching
 * to Home and back never loses the deck's position or refetches it.
 */
export default function App() {
  const { tab, view, setTab, setView } = useUrlState()

  return (
    <div className="flex h-dvh items-center justify-center sm:py-6">
      <div className="flex h-full w-full max-w-[430px] flex-col overflow-hidden bg-surface pt-[env(safe-area-inset-top)] sm:rounded-[2.25rem] sm:shadow-2xl sm:ring-1 sm:ring-black/5">
        <main className="relative min-h-0 flex-1">
          <div id="panel-home" role="tabpanel" aria-labelledby="tab-home" hidden={tab !== 'home'} className="h-full">
            <HomeTab />
          </div>
          <div id="panel-discover" role="tabpanel" aria-labelledby="tab-discover" hidden={tab !== 'discover'} className="h-full">
            <DiscoverTab view={view} onViewChange={setView} />
          </div>
        </main>
        <TabBar active={tab} onChange={setTab} />
      </div>
    </div>
  )
}
