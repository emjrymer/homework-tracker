import type { APIRoute } from 'astro';
import { getDb } from '../../db/index';
import { SUBJECTS } from '../../lib/auth';

const URGENCIES = ['low', 'medium', 'high'];
const FORMATS = ['in-person', 'video-call', 'written'];

export const POST: APIRoute = async ({ locals, request }) => {
  const user = (locals as App.Locals).user!;
  if (user.role !== 'student') {
    return new Response(JSON.stringify({ error: 'Only students can request help.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { subject, topic, message, urgency, preferred_format } = body;

  if (!subject || !SUBJECTS.includes(subject)) {
    return new Response(JSON.stringify({ error: 'Invalid subject.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!topic || typeof topic !== 'string' || topic.length > 100) {
    return new Response(JSON.stringify({ error: 'Topic is required (max 100 characters).' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!message || typeof message !== 'string' || message.length > 2000) {
    return new Response(JSON.stringify({ error: 'Description is required (max 2000 characters).' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!urgency || !URGENCIES.includes(urgency)) {
    return new Response(JSON.stringify({ error: 'Invalid urgency level.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!preferred_format || !FORMATS.includes(preferred_format)) {
    return new Response(JSON.stringify({ error: 'Invalid help format.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();
  const id = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO help_requests (id, student_id, subject, topic, message, urgency, preferred_format)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, user.id, subject, topic.slice(0, 100), message.slice(0, 2000), urgency, preferred_format],
  });

  return new Response(JSON.stringify({ id, subject, topic, urgency, status: 'pending' }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const GET: APIRoute = async ({ locals, url }) => {
  const user = (locals as App.Locals).user!;
  const db = getDb();

  let studentId = user.id;

  if (user.role === 'parent') {
    const link = await db.execute({
      sql: 'SELECT student_id FROM student_parent WHERE parent_id = ?',
      args: [user.id],
    });
    if (link.rows.length === 0) {
      return new Response(JSON.stringify({ requests: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    studentId = link.rows[0].student_id as string;
  }

  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const result = await db.execute({
    sql: 'SELECT * FROM help_requests WHERE student_id = ? ORDER BY created_at DESC LIMIT ?',
    args: [studentId, limit],
  });

  return new Response(JSON.stringify({ requests: result.rows }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
