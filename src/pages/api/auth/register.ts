import type { APIRoute } from 'astro';
import { getDb } from '../../../db/index';
import { hashPassword, createSession, checkRateLimit } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  if (!checkRateLimit(`register:${clientAddress}`)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Try again later.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.formData();
  const name = (body.get('name') as string)?.trim();
  const email = (body.get('email') as string)?.trim().toLowerCase();
  const password = body.get('password') as string;
  const role = body.get('role') as string;
  const inviteCode = (body.get('invite_code') as string)?.trim();

  // Validate
  if (!name || !email || !password || !role) {
    return new Response(JSON.stringify({ error: 'All fields are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (password.length < 8) {
    return new Response(JSON.stringify({ error: 'Password must be at least 8 characters.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (role !== 'student' && role !== 'parent') {
    return new Response(JSON.stringify({ error: 'Invalid role.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  // Check duplicate email
  const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
  if (existing.rows.length > 0) {
    return new Response(JSON.stringify({ error: 'An account with this email already exists.' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const passwordHash = hashPassword(password);
  const userId = crypto.randomUUID();

  if (role === 'student') {
    // Create student with an invite code for parents
    const rawInviteCode = crypto.randomUUID().slice(0, 8).toUpperCase();
    await db.execute({
      sql: 'INSERT INTO users (id, email, password_hash, name, role, invite_code) VALUES (?, ?, ?, ?, ?, ?)',
      args: [userId, email, passwordHash, name, role, rawInviteCode],
    });
  } else {
    // Parent — must supply a valid invite code
    if (!inviteCode) {
      return new Response(JSON.stringify({ error: 'Invite code is required for parent accounts.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const studentResult = await db.execute({
      sql: "SELECT id FROM users WHERE invite_code = ? AND role = 'student'",
      args: [inviteCode.toUpperCase()],
    });

    if (studentResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid invite code.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const studentId = studentResult.rows[0].id as string;

    await db.execute({
      sql: 'INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
      args: [userId, email, passwordHash, name, role],
    });

    await db.execute({
      sql: 'INSERT INTO student_parent (student_id, parent_id) VALUES (?, ?)',
      args: [studentId, userId],
    });
  }

  // Create session
  const { token, expiresAt } = await createSession(userId);
  const isProd = import.meta.env.PROD;
  cookies.set('session', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    expires: new Date(expiresAt),
  });

  const redirectTo = role === 'student' ? '/student/dashboard' : '/parent/dashboard';
  return new Response(null, {
    status: 302,
    headers: { Location: redirectTo },
  });
};
