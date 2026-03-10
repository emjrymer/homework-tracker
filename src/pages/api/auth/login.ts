import type { APIRoute } from 'astro';
import { getDb } from '../../../db/index';
import { verifyPassword, createSession, checkRateLimit } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  if (!checkRateLimit(`login:${clientAddress}`)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Try again later.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.formData();
  const email = (body.get('email') as string)?.trim().toLowerCase();
  const password = body.get('password') as string;

  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Email and password are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT id, password_hash, role FROM users WHERE email = ?',
    args: [email],
  });

  if (result.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Invalid email or password.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = result.rows[0];
  if (!verifyPassword(password, user.password_hash as string)) {
    return new Response(JSON.stringify({ error: 'Invalid email or password.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { token, expiresAt } = await createSession(user.id as string);
  const isProd = import.meta.env.PROD;
  cookies.set('session', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    expires: new Date(expiresAt),
  });

  const redirectTo = user.role === 'student' ? '/student/dashboard' : '/parent/dashboard';
  return new Response(null, {
    status: 302,
    headers: { Location: redirectTo },
  });
};
