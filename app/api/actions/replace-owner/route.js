import { replaceOwner, logActivity } from '@/lib/store';
import { json, fail, readBody, requireSession } from '@/lib/http';

export const dynamic = 'force-dynamic';

// Remplace un rôle (ex. « Réf. sécurité ») par un nom sur toutes ses actions : mode admin.
export async function POST(req) {
  const { session, error } = requireSession(req, 'admin');
  if (error) return error;
  try {
    const body = await readBody(req);
    const from = String(body.from || '').trim();
    const to = String(body.to || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!from || !to) return json({ error: 'Choisissez un rôle et saisissez le nom du porteur.' }, 400);
    if (from === to) return json({ count: 0 });
    const count = await replaceOwner(from, to, session.name);
    if (count) await logActivity({ action_id: null, action_title: null, who: session.name, what: `« ${from} » remplacé par « ${to} » sur ${count} action${count > 1 ? 's' : ''}` });
    return json({ count });
  } catch (e) {
    return fail(e);
  }
}
