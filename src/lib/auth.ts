import { hashSync, compareSync } from 'bcryptjs';
import { getDb } from '../db/index';

const BCRYPT_ROUNDS = 12;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const SUBJECTS = [
  'Math',
  'Reading',
  'Science',
  'Writing',
  'History',
  'Foreign Language',
  'Other',
] as const;

export type Subject = (typeof SUBJECTS)[number];

export function hashPassword(password: string): string {
  return hashSync(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): boolean {
  return compareSync(password, hash);
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: string }> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  const db = getDb();
  await db.execute({
    sql: 'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    args: [token, userId, expiresAt],
  });
  return { token, expiresAt };
}

export async function validateSession(token: string) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT s.id as session_id, s.expires_at, u.id, u.email, u.name, u.role
          FROM sessions s JOIN users u ON s.user_id = u.id
          WHERE s.id = ?`,
    args: [token],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const expiresAt = new Date(row.expires_at as string);
  if (expiresAt < new Date()) {
    await db.execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [token] });
    return null;
  }

  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as 'student' | 'parent',
  };
}

export async function deleteSession(token: string) {
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [token] });
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) return false;

  entry.count++;
  return true;
}
