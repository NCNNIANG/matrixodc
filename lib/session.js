// Sessions signées (cookie httpOnly). Aucun compte, aucun email :
// le code d'accès ouvre une session « membre », le code admin la fait passer « admin ».
// Changer ACCESS_CODE dans Vercel déconnecte tout le monde ; changer ADMIN_CODE retire le rôle admin.
import crypto from 'crypto';

export const COOKIE = 'mx_session';
const MAX_AGE_DAYS = 30;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET manquant ou trop court');
  return s;
}

const norm = (c) => String(c || '').trim().toUpperCase();
const fingerprint = (c) => crypto.createHash('sha256').update(norm(c)).digest('base64url').slice(0, 16);

function safeEqual(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function codeMatches(input, envName) {
  const expected = process.env[envName];
  if (!expected) return false;
  return safeEqual(norm(input), norm(expected));
}

export function cleanName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

export function makeToken(name, role) {
  const payload = {
    n: cleanName(name),
    r: role === 'admin' ? 'admin' : 'member',
    v: fingerprint(process.env.ACCESS_CODE),
    a: role === 'admin' ? fingerprint(process.env.ADMIN_CODE) : undefined,
    iat: Date.now()
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return body + '.' + sig;
}

export function readToken(token) {
  try {
    if (!token || !process.env.ACCESS_CODE) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
    if (!safeEqual(sig, expected)) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (p.v !== fingerprint(process.env.ACCESS_CODE)) return null;
    if (!p.iat || Date.now() - p.iat > MAX_AGE_DAYS * 864e5) return null;
    const admin = p.r === 'admin' && !!process.env.ADMIN_CODE && p.a === fingerprint(process.env.ADMIN_CODE);
    return { name: cleanName(p.n) || 'Membre', role: admin ? 'admin' : 'member' };
  } catch (e) {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: MAX_AGE_DAYS * 24 * 3600
};

export function sessionFromRequest(req) {
  return readToken(req.cookies.get(COOKIE)?.value);
}

export function configProblem() {
  const missing = ['ACCESS_CODE', 'ADMIN_CODE', 'SESSION_SECRET'].filter((k) => !process.env[k]);
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 16) missing.push('SESSION_SECRET (au moins 16 caractères)');
  return missing;
}
