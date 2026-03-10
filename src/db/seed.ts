import { getDb } from './index';

let seeded = false;

export async function seedDatabase() {
  if (seeded) return;

  const db = getDb();

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student', 'parent')),
      invite_code TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS student_parent (
      student_id TEXT NOT NULL REFERENCES users(id),
      parent_id TEXT NOT NULL REFERENCES users(id),
      PRIMARY KEY (student_id, parent_id)
    );

    CREATE TABLE IF NOT EXISTS time_logs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      student_id TEXT NOT NULL REFERENCES users(id),
      subject TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      notes TEXT DEFAULT '',
      logged_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS help_requests (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      student_id TEXT NOT NULL REFERENCES users(id),
      subject TEXT NOT NULL,
      topic TEXT NOT NULL,
      message TEXT NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
      preferred_format TEXT NOT NULL DEFAULT 'written' CHECK (preferred_format IN ('in-person', 'video-call', 'written')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'resolved')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invite_codes (
      code_hash TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES users(id),
      used INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL
    );
  `);

  seeded = true;
}
