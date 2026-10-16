import { COOKIE, codeMatches, cleanName, makeToken, cookieOptions, configProblem } from '@/lib/session';
import { json, readBody, pause } from '@/lib/http';

export const dynamic = 'force-dynamic';

// Entrée : code d'accès commun + nom de la personne (affiché dans l'activité).
export async function POST(req) {
  if (configProblem().length) return json({ error: 'MatrixODC n’est pas encore configuré. Prévenez l’administratrice.' }, 500);
  const { code, name } = await readBody(req);
  const n = cleanName(name);
  if (n.length < 2) return json({ error: 'Indiquez votre prénom et votre nom.' }, 400);
  if (!codeMatches(code, 'ACCESS_CODE')) {
    await pause(800);
    return json({ error: 'Ce code ne correspond pas. Vérifiez-le et réessayez.' }, 401);
  }
  const res = json({ ok: true, name: n, role: 'member' });
  res.cookies.set(COOKIE, makeToken(n, 'member'), cookieOptions);
  return res;
}

export async function DELETE() {
  const res = json({ ok: true });
  res.cookies.set(COOKIE, '', { ...cookieOptions, maxAge: 0 });
  return res;
}
