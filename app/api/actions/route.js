import { listAll, insertAction, logActivity, listSegments } from '@/lib/store';
import { buildWS } from '@/lib/constants';
import { cleanPatch, applyBlockRule, ADMIN_FIELDS, InputError } from '@/lib/validate';
import { json, fail, readBody, requireSession } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { session, error } = requireSession(req);
  if (error) return error;
  try {
    const data = await listAll();
    return json({ ...data, session });
  } catch (e) {
    return fail(e);
  }
}

// Création d'une action : mode admin uniquement.
export async function POST(req) {
  const { session, error } = requireSession(req, 'admin');
  if (error) return error;
  try {
    const body = await readBody(req);
    if (!body.title) throw new InputError('Décrivez l’action en quelques mots.');
    const W = buildWS((await listSegments()).segments);
    const row = applyBlockRule({ ws: 'pil', prio: 'normale', status: 'todo', owner: '', due: null, ...cleanPatch(body, ADMIN_FIELDS, W.map) });
    row.updated_by = session.name;
    const created = await insertAction(row);
    await logActivity({ action_id: created.id, action_title: created.title, who: session.name, what: 'action créée' });
    return json({ action: created }, 201);
  } catch (e) {
    return fail(e);
  }
}
