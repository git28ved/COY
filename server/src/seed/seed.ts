import { pathToFileURL } from 'node:url';
import { CURRENT_USER_ID } from '../constants.js';
import { createDb, type Db } from '../db/db.js';
import {
  INCOMING_LIKE_IDS,
  INCOMING_PASS_IDS,
  ME,
  SEED_PROFILES,
  type SeedProfile,
} from './profiles.js';

/**
 * Wipes all data and inserts `me`, the 36 demo profiles and their incoming
 * swipes. Runs in one transaction, so it is all-or-nothing and safe to rerun.
 */
export function seed(db: Db): { users: number; incomingLikes: number; incomingPasses: number } {
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, age, bio, photo_url, city, college, interests_json)
    VALUES (@id, @name, @age, @bio, @photoUrl, @city, @college, @interestsJson)
  `);
  const insertSwipe = db.prepare(
    `INSERT INTO swipes (swiper_id, target_id, direction) VALUES (?, ?, ?)`,
  );

  const run = db.transaction(() => {
    // Children first so foreign keys never dangle mid-wipe.
    db.exec('DELETE FROM matches; DELETE FROM swipes; DELETE FROM users;');

    const add = (p: SeedProfile) =>
      insertUser.run({ ...p, interestsJson: JSON.stringify(p.interests) });
    add(ME);
    SEED_PROFILES.forEach(add);

    for (const id of INCOMING_LIKE_IDS) insertSwipe.run(id, CURRENT_USER_ID, 'like');
    for (const id of INCOMING_PASS_IDS) insertSwipe.run(id, CURRENT_USER_ID, 'pass');
  });
  run();

  return {
    users: SEED_PROFILES.length + 1,
    incomingLikes: INCOMING_LIKE_IDS.length,
    incomingPasses: INCOMING_PASS_IDS.length,
  };
}

// CLI entry: `npm run seed`. Skipped when imported (e.g. by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = createDb();
  const result = seed(db);
  db.close();
  console.log(
    `[seed] ${result.users} users, ${result.incomingLikes} incoming likes, ` +
      `${result.incomingPasses} incoming passes → ${process.env.DB_PATH ?? 'server/data/coy.db'}`,
  );
}
