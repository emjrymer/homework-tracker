import type { APIRoute } from 'astro';
import { getDb } from '../../db/index';
import { SUBJECTS } from '../../lib/auth';

export const POST: APIRoute = async ({ locals, request }) => {
  const user = (locals as App.Locals).user!;
  if (user.role !== 'student') {
    return new Response(JSON.stringify({ error: 'Only students can log time.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { subject, duration_minutes, notes } = body;

  if (!subject || !SUBJECTS.includes(subject)) {
    return new Response(JSON.stringify({ error: 'Invalid subject.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const duration = Number(duration_minutes);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 1440) {
    return new Response(JSON.stringify({ error: 'Duration must be between 1 and 1440 minutes.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const safeNotes = typeof notes === 'string' ? notes.slice(0, 1000) : '';

  const db = getDb();
  const id = crypto.randomUUID();
  await db.execute({
    sql: 'INSERT INTO time_logs (id, student_id, subject, duration_minutes, notes) VALUES (?, ?, ?, ?, ?)',
    args: [id, user.id, subject, duration, safeNotes],
  });

  return new Response(JSON.stringify({ id, subject, duration_minutes: duration, notes: safeNotes }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const GET: APIRoute = async ({ locals, url }) => {
  const user = (locals as App.Locals).user!;
  const db = getDb();

  let studentId = user.id;

  // If parent, look up linked student
  if (user.role === 'parent') {
    const link = await db.execute({
      sql: 'SELECT student_id FROM student_parent WHERE parent_id = ?',
      args: [user.id],
    });
    if (link.rows.length === 0) {
      return new Response(JSON.stringify({ logs: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    studentId = link.rows[0].student_id as string;
  }

  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const result = await db.execute({
    sql: 'SELECT * FROM time_logs WHERE student_id = ? ORDER BY logged_at DESC LIMIT ?',
    args: [studentId, limit],
  });

  return new Response(JSON.stringify({ logs: result.rows }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
