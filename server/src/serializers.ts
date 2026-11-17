/** A `users` row exactly as SQLite returns it. */
export interface UserRow {
  id: string;
  name: string;
  age: number;
  bio: string;
  photo_url: string;
  city: string;
  college: string;
  interests_json: string;
  created_at: string;
}

/** The only shape of a profile that ever leaves the server (D-004). */
export interface PublicProfile {
  id: string;
  name: string;
  age: number;
  photoUrl: string;
  bio: string;
  city: string;
  college: string;
  interests: string[];
}

export const PUBLIC_PROFILE_KEYS = [
  'id', 'name', 'age', 'photoUrl', 'bio', 'city', 'college', 'interests',
] as const satisfies readonly (keyof PublicProfile)[];

/**
 * Whitelist serializer. Builds a fresh object field by field and never spreads
 * the row, so any column added later (or joined in by a query, such as a
 * "liked you" flag) is dropped by default. Fails closed.
 */
export function toPublicProfile(row: UserRow): PublicProfile {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    photoUrl: row.photo_url,
    bio: row.bio,
    city: row.city,
    college: row.college,
    interests: parseInterests(row.interests_json),
  };
}

function parseInterests(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
