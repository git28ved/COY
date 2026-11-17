import type {
  ApiErrorCode,
  Direction,
  FeedResponse,
  MatchesResponse,
  SwipeResult,
} from './types'

/** Every failed request becomes an ApiError. UI code switches on `code`, not on message text. */
export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, 'NETWORK', "Can't reach the server. Check your connection.")
  }

  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const { error, code } = (body ?? {}) as { error?: string; code?: ApiErrorCode }
    throw new ApiError(res.status, code ?? 'UNKNOWN', error ?? `Request failed (${res.status})`)
  }
  return body as T
}

export const api = {
  getFeed: (limit = 10, signal?: AbortSignal) =>
    request<FeedResponse>(`/feed?limit=${limit}`, { signal }),

  swipe: (targetId: string, direction: Direction) =>
    request<SwipeResult>('/swipe', {
      method: 'POST',
      body: JSON.stringify({ targetId, direction }),
    }),

  getMatches: (signal?: AbortSignal) => request<MatchesResponse>('/matches', { signal }),
}
