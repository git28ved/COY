// Mirrors the server's API contract (server/src/serializers.ts and
// services/discover-service.ts). Copied rather than shared, see D-001.

export interface Profile {
  id: string
  name: string
  age: number
  photoUrl: string
  bio: string
  city: string
  college: string
  interests: string[]
}

export type Direction = 'like' | 'pass'

export interface Match {
  profile: Profile
  matchedAt: string
}

export interface FeedResponse {
  profiles: Profile[]
  remaining: boolean
}

export type SwipeResult = { matched: false } | { matched: true; match: Match }

export interface MatchesResponse {
  matches: Match[]
}

/** Stable error codes the server sends in `{ error, code }`. */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_JSON'
  | 'SELF_SWIPE'
  | 'NOT_FOUND'
  | 'ALREADY_SWIPED'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL'
  | 'NETWORK' // client side: the request never reached the server
  | 'UNKNOWN'
