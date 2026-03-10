import { defineMiddleware } from 'astro:middleware';
import { validateSession } from './lib/auth';
import { seedDatabase } from './db/seed';

export const onRequest = defineMiddleware(async (context, next) => {
  // Ensure tables exist
  await seedDatabase();

  const { pathname } = context.url;

  // Parse session cookie
  const token = context.cookies.get('session')?.value ?? null;
  let user = null;

  if (token) {
    user = await validateSession(token);
    if (!user) {
      // Stale cookie — clear it
      context.cookies.delete('session', { path: '/' });
    }
  }

  (context.locals as any).user = user;

  // Protect student routes
  if (pathname.startsWith('/student')) {
    if (!user) return context.redirect('/login');
    if (user.role !== 'student') return context.redirect('/');
  }

  // Protect parent routes
  if (pathname.startsWith('/parent')) {
    if (!user) return context.redirect('/login');
    if (user.role !== 'parent') return context.redirect('/');
  }

  // Protect API routes (except auth)
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return next();
});
