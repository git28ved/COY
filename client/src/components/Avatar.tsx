import { useState } from 'react'

/** Round-cornered photo with an initial-on-gradient fallback if the image fails. */
export function Avatar({ src, name, className = '' }: { src?: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div aria-hidden="true" className={`flex items-center justify-center bg-gradient-to-br from-brand to-nope font-black text-white/90 ${className}`}>
        {name[0]}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={`Photo of ${name}`}
      draggable={false}
      decoding="async"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  )
}
