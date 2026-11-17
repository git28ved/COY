import { describe, expect, it } from 'vitest';
import { PUBLIC_PROFILE_KEYS, toPublicProfile, type UserRow } from '../src/serializers.js';

const row: UserRow = {
  id: 'p01',
  name: 'Priya',
  age: 21,
  bio: 'hi',
  photo_url: 'https://example.com/p.jpg',
  city: 'Delhi',
  college: 'DU',
  interests_json: '["Music","Coffee"]',
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('toPublicProfile (D-004)', () => {
  it('returns exactly the whitelisted keys ⭐', () => {
    expect(Object.keys(toPublicProfile(row)).sort()).toEqual(
      ['age', 'bio', 'city', 'college', 'id', 'interests', 'name', 'photoUrl'],
    );
    expect([...PUBLIC_PROFILE_KEYS].sort()).toEqual(Object.keys(toPublicProfile(row)).sort());
  });

  it('maps the fields and parses interests', () => {
    expect(toPublicProfile(row)).toEqual({
      id: 'p01',
      name: 'Priya',
      age: 21,
      photoUrl: 'https://example.com/p.jpg',
      bio: 'hi',
      city: 'Delhi',
      college: 'DU',
      interests: ['Music', 'Coffee'],
    });
  });

  it('drops extra columns such as a joined "liked you" flag ⭐', () => {
    const leaky = { ...row, liked_you: 1, direction: 'like', swiper_id: 'x', matched_at: 'y' };
    const out = toPublicProfile(leaky);
    expect(out).not.toHaveProperty('liked_you');
    expect(out).not.toHaveProperty('direction');
    expect(out).not.toHaveProperty('swiper_id');
    expect(out).not.toHaveProperty('created_at');
    expect(JSON.stringify(out)).not.toMatch(/liked|direction|swiper/);
  });

  it('falls back to [] for bad interests JSON', () => {
    expect(toPublicProfile({ ...row, interests_json: 'not json' }).interests).toEqual([]);
    expect(toPublicProfile({ ...row, interests_json: '{"a":1}' }).interests).toEqual([]);
    expect(toPublicProfile({ ...row, interests_json: '["ok", 3]' }).interests).toEqual(['ok']);
  });
});
