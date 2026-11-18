import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type PanInfo,
} from 'framer-motion'
import { useImperativeHandle, useRef, useState, type Ref } from 'react'
import type { Direction, Profile } from '../types'

/** Drag distance (px) or flick speed (px/s) that commits a swipe. */
export const SWIPE_DISTANCE = 120
export const SWIPE_VELOCITY = 600

export interface SwipeCardHandle {
  /** Fly the card out programmatically (✕/♥ buttons, arrow keys). */
  swipe: (direction: Direction) => void
}

interface Props {
  profile: Profile
  /** Only the top card is draggable. The one behind sits slightly smaller. */
  isTop: boolean
  onSwiped: (direction: Direction) => void
  ref?: Ref<SwipeCardHandle>
}

export function SwipeCard({ profile, isTop, onSwiped, ref }: Props) {
  const reduceMotion = useReducedMotion()
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-15, 15])
  const likeOpacity = useTransform(x, [20, SWIPE_DISTANCE], [0, 1])
  const nopeOpacity = useTransform(x, [-SWIPE_DISTANCE, -20], [1, 0])
  const opacity = useMotionValue(1)
  const leaving = useRef(false)

  function flyOut(direction: Direction) {
    if (leaving.current) return
    leaving.current = true
    // A tiny haptic tick on phones that support it (no-op elsewhere, e.g. iOS Safari).
    navigator.vibrate?.(10)
    const done = () => onSwiped(direction)
    if (reduceMotion) {
      // No big movement for people who asked for less motion: a quick fade.
      void animate(opacity, 0, { duration: 0.15 }).then(done)
      return
    }
    const distance = Math.max(window.innerWidth, 500) * 1.5
    void animate(x, direction === 'like' ? distance : -distance, {
      duration: 0.3,
      ease: [0.32, 0.72, 0, 1],
    }).then(done)
  }

  useImperativeHandle(ref, () => ({ swipe: flyOut }))

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) flyOut('like')
    else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) flyOut('pass')
    else void animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 })
  }

  return (
    <motion.article
      aria-label={`${profile.name}, ${profile.age}, ${profile.college}`}
      aria-hidden={!isTop}
      className="absolute inset-0 cursor-grab touch-pan-y overflow-hidden rounded-3xl bg-ink shadow-xl select-none active:cursor-grabbing"
      style={{ x, rotate, opacity, zIndex: isTop ? 2 : 1 }}
      initial={false}
      animate={{ scale: isTop ? 1 : 0.95, y: isTop ? 0 : 14 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      drag={isTop ? 'x' : false}
      dragMomentum={false}
      onDragEnd={onDragEnd}
    >
      <Photo profile={profile} eager={isTop} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

      <Stamp label="LIKE" className="left-5 -rotate-12 border-like text-like" style={{ opacity: likeOpacity }} />
      <Stamp label="NOPE" className="right-5 rotate-12 border-nope text-nope" style={{ opacity: nopeOpacity }} />

      <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 text-white">
        <h2 className="text-3xl font-extrabold tracking-tight">
          {profile.name}
          <span className="ml-2 font-semibold text-white/85">{profile.age}</span>
        </h2>
        <p className="text-sm font-medium text-white/85">
          {profile.college} · {profile.city}
        </p>
        <p className="line-clamp-2 text-[15px] leading-snug text-white/95">{profile.bio}</p>
        <ul className="flex flex-wrap gap-1.5 pt-1" aria-label="Interests">
          {profile.interests.map((i) => (
            <li key={i} className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
              {i}
            </li>
          ))}
        </ul>
      </div>
    </motion.article>
  )
}

function Stamp({ label, className, style }: { label: string; className: string; style: { opacity: MotionValue<number> } }) {
  return (
    <motion.span
      aria-hidden="true"
      style={style}
      className={`absolute top-8 rounded-lg border-4 px-3 py-1 text-3xl font-black tracking-widest ${className}`}
    >
      {label}
    </motion.span>
  )
}

/** Photo with a graceful fallback (initial on a gradient) if the image fails to load. */
function Photo({ profile, eager }: { profile: Profile; eager: boolean }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand to-nope text-8xl font-black text-white/80">
        {profile.name[0]}
      </div>
    )
  }
  return (
    <img
      src={profile.photoUrl}
      alt={`Photo of ${profile.name}`}
      draggable={false}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className="pointer-events-none h-full w-full object-cover"
    />
  )
}
