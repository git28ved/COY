import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA } from './schema.js';

export type Db = Database.Database;

// server/ root. Same depth from src/db/ and dist/db/, so it works in dev and prod.
const SERVER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Default on-disk location; override with DB_PATH (e.g. a mounted disk in prod). */
export const DEFAULT_DB_PATH = resolve(SERVER_ROOT, 'data', 'coy.db');

/**
 * Opens (or creates) the database and applies the schema.
 * Tests pass ':memory:' for a fresh, isolated DB.
 */
export function createDb(path: string = process.env.DB_PATH ?? DEFAULT_DB_PATH): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  if (path !== ':memory:') db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}
