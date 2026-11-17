import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'

export interface ToastMessage {
  id: number
  text: string
  tone?: 'info' | 'error' | 'success'
}

const TONES = {
  info: 'bg-ink text-white',
  error: 'bg-nope text-white',
  success: 'bg-brand text-white',
}

/**
 * A small message at the top of the deck that dismisses itself after 3 seconds.
 * Sits at the top so it never covers the ✕/♥ buttons. A newer toast replaces
 * the old one in the same spot (both are absolutely positioned and cross-fade).
 */
export function Toast({ toast, onDone }: { toast: ToastMessage | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [toast, onDone])

  return (
    <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 top-[4.25rem] z-30 flex justify-center px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`absolute max-w-[calc(100%-2rem)] truncate rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${TONES[toast.tone ?? 'info']}`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
