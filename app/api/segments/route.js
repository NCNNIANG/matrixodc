import crypto from 'crypto';
import { listSegments, saveSegments, countActionsByWs, logActivity } from '@/lib/store';
import { FIXED_WS_KEYS, fmtTime } from '@/lib/constants';
import { cleanSegments } from '@/lib/validate';
import { json, fail, readBody, requireSession } from '@/lib/http';

export const dynamic = 'force-dynamic';

// Enregistre le déroulé complet (heures, durées, titres des moments) : mode admin.
export async function PUT(req) {
  const { session, error } = requireSession(req, 'admin');
  if (error) return error;
  try {
    const current = await listSegments();
    if (current.missing) {
      return json({ error: 'Le déroulé modifiable n’est pas encore activé : lancez le script MatrixODC_3_deroule dans Supabase, SQL Editor.' }, 409);
    }
    const body = await readBody(req);
    const list = cleanSegments(body.segments).map((s) => ({
      ...s,
      id: s.id && !FIXED_WS_KEYS.includes(s.id) ? s.id : 'm' + crypto.randomBytes(4).toString('hex')
    }));
    const keep = new Set(list.map((s) => s.id));
    const removed = current.segments.map((s) => s.id).filter((id) => !keep.has(id));
    if (removed.length) {
      const counts = await countActionsByWs(removed);
      const busy = current.segments.filter((s) => counts[s.id]);
      if (busy.length) {
        const names = busy.map((s) => `« ${fmtTime(s.start)} · ${s.title} » (${counts[s.id]} action${counts[s.id] > 1 ? 's' : ''})`).join(', ');
        return json({ error: `Impossible de retirer ${names} : déplacez d’abord ${busy.length > 1 ? 'leurs' : 'ses'} actions vers un autre chantier.` }, 400);
      }
    }
    await saveSegments(list, removed);
    await logActivity({ action_id: null, action_title: null, who: session.name, what: 'déroulé du 30 octobre modifié' });
    return json({ segments: list });
  } catch (e) {
    return fail(e);
  }
}
