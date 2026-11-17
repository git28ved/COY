import { useEffect, useState } from 'react'

// Phase 0 placeholder: proves the client and the Express API are wired together.
// Phase 4 replaces this with the Home | Discover tab shell.
function App() {
  const [api, setApi] = useState<'checking' | 'ok' | 'down'>('checking')

  useEffect(() => {
    fetch('/health')
      .then((res) => setApi(res.ok ? 'ok' : 'down'))
      .catch(() => setApi('down'))
  }, [])

  return (
    <main className="mx-auto flex h-dvh max-w-[430px] flex-col items-center justify-center gap-3 bg-white px-4 text-center">
      <h1 className="text-3xl font-bold text-violet-700">Coy Discover</h1>
      <p className="text-sm text-gray-500">
        API: <span data-testid="api-status">{api}</span>
      </p>
    </main>
  )
}

export default App
