import { NextResponse } from 'next/server';
import { sessionFromRequest } from './session';
import { ConfigError } from './store';
import { InputError } from './validate';

export const json = (data, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export function requireSession(req, role) {
  let s = null;
  try { s = sessionFromRequest(req); } catch (e) { return { error: json({ error: 'Configuration incomplète sur Vercel.' }, 500) }; }
  if (!s) return { error: json({ error: 'Session expirée. Saisissez à nouveau le code d’accès.' }, 401) };
  if (role === 'admin' && s.role !== 'admin') return { error: json({ error: 'Action réservée au mode admin.' }, 403) };
  return { session: s };
}

export function fail(e) {
  if (e instanceof InputError) return json({ error: e.message }, 400);
  if (e instanceof ConfigError) return json({ error: 'Base de données non configurée sur Vercel.' }, 500);
  console.error(e);
  return json({ error: 'L’enregistrement a échoué. Réessayez dans un instant.' }, 500);
}

export async function readBody(req) {
  try { return await req.json(); } catch (e) { return {}; }
}

export const pause = (ms) => new Promise((r) => setTimeout(r, ms));
