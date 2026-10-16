import { COOKIE, codeMatches, makeToken, cookieOptions } from '@/lib/session';
import { json, readBody, pause, requireSession } from '@/lib/http';

export const dynamic = 'force-dynamic';

// Active le mode admin pour la session en cours.
export async function POST(req) {
  const { session, error } = requireSession(req);
  if (error) return error;
  const { code } = await readBody(req);
  if (!codeMatches(code, 'ADMIN_CODE')) {
    await pause(800);
    return json({ error: 'Ce code admin ne correspond pas.' }, 401);
  }
  const res = json({ ok: true, name: session.name, role: 'admin' });
  res.cookies.set(COOKIE, makeToken(session.name, 'admin'), cookieOptions);
  return res;
}

// Quitte le mode admin (la session reste ouverte en simple participant).
export async function DELETE(req) {
  const { session, error } = requireSession(req);
  if (error) return error;
  const res = json({ ok: true, name: session.name, role: 'member' });
  res.cookies.set(COOKIE, makeToken(session.name, 'member'), cookieOptions);
  return res;
}
