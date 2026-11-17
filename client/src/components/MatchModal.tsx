import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Match } from '../types'
import { Avatar } from './Avatar'
import { HeartIcon } from './icons'

interface Props {
  match: Match | null
  onKeepSwiping: () => void
  onViewMatches: () => void
}

// Fixed offsets so the burst looks the same every time (no Math.random in render).
const HEARTS = [-150, -110, -70, -30, 10, 50, 90, 130, -130, -50, 30, 110]

/**
 * Full-screen "It's a match!" moment. It's a modal dialog:
 * - focus moves to "Keep swiping" when it opens and returns to where it was on close
 * - Tab cycles between the two buttons (focus trap)
 * - Esc closes it
 * It renders into the phone frame (#app-frame), so on desktop it covers the app, not the whole page.
 */
export function MatchModal({ match, onKeepSwiping, onViewMatches }: Props) {
  const reduceMotion = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!match) return
    restoreFocus.current = document.activeElement as HTMLElement | null
    firstRef.current?.focus()
    return () => restoreFocus.current?.focus?.()
  }, [match])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onKeepSwiping()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button')
    if (!focusable?.length) return
    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const frame = document.getElementById('app-frame')
  if (!frame) return null

  return createPortal(
    <AnimatePresence>
      {match && (
        <motion.div
          key={match.profile.id}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-title"
          aria-describedby="match-desc"
          onKeyDown={onKeyDown}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-brand/95 via-[#5b21b6]/95 to-ink/95 px-6 text-center text-white backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {!reduceMotion &&
            HEARTS.map((dx, i) => (
              <motion.span
                key={i}
                aria-hidden="true"
                className="absolute top-1/2 left-1/2 text-pink-300"
                initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
                animate={{ x: dx, y: -220 - (i % 4) * 50, scale: 1, opacity: [0, 1, 0] }}
                transition={{ duration: 1.6, delay: 0.15 + (i % 6) * 0.08, ease: 'easeOut' }}
              >
                <HeartIcon className="size-6" filled />
              </motion.span>
            ))}

          <motion.h2
            id="match-title"
            className="text-5xl font-black tracking-tight italic"
            initial={{ scale: reduceMotion ? 1 : 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.05 }}
          >
            It's a match!
          </motion.h2>
          <p id="match-desc" className="mt-3 text-white/85">
            You and {match.profile.name} like each other.
          </p>

          <div className="mt-10 flex items-center">
            <motion.div
              initial={{ x: reduceMotion ? 0 : -120, rotate: -8, opacity: 0 }}
              animate={{ x: 12, rotate: -8, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.15 }}
            >
              <div className="flex size-32 items-center justify-center rounded-3xl bg-white/15 text-xl font-extrabold ring-4 ring-white">
                You
              </div>
            </motion.div>
            <motion.div
              initial={{ x: reduceMotion ? 0 : 120, rotate: 8, opacity: 0 }}
              animate={{ x: -12, rotate: 8, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.15 }}
            >
              <Avatar src={match.profile.photoUrl} name={match.profile.name} className="size-32 rounded-3xl text-5xl ring-4 ring-white" />
            </motion.div>
          </div>

          <div className="mt-12 flex w-full max-w-xs flex-col gap-3">
            <button
              ref={firstRef}
              type="button"
              onClick={onKeepSwiping}
              className="rounded-full bg-white py-3.5 font-bold text-brand shadow-lg transition hover:scale-[1.02] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Keep swiping
            </button>
            <button
              type="button"
              onClick={onViewMatches}
              className="rounded-full py-3.5 font-bold text-white ring-2 ring-white/70 transition hover:bg-white/10 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              View matches
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    frame,
  )
}
