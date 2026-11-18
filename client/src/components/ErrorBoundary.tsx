import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  crashed: boolean
}

/**
 * Last line of defence: if a render throws, show a friendly screen with a
 * reload button instead of a blank page. The error goes to the console only.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui] crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.crashed) return this.props.children
    return (
      <div role="alert" className="flex h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-xl font-bold text-ink">Something went wrong</p>
        <p className="text-sm text-ink-muted">Your swipes are saved. Reloading should fix it.</p>
        <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-brand px-5 py-2.5 font-semibold text-white">
          Reload
        </button>
      </div>
    )
  }
}
