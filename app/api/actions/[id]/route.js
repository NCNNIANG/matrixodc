import { getAction, updateAction, deleteAction, logActivity, listSegments } from '@/lib/store';
import { buildWS } from '@/lib/constants';
import { cleanPatch, applyBlockRule, describeChange, MEMBER_FIELDS, ADMIN_FIELDS } from '@/lib/validate';
import { json, fail, readBody, requireSession } from '@/lib/http';

export const dynamic = 'force-dynamic';

// Mise à jour : un participant change statut, blocage et note ; l'admin peut tout modifier.
export async function PATCH(req, { params }) {
  const { session, error } = requireSession(req);
  if (error) return error;
  try {
    const before = await getAction(params.id);
    if (!before) return json({ error: 'Cette action n’existe plus.' }, 404);
    const allowed = session.role === 'admin' ? ADMIN_FIELDS : MEMBER_FIELDS;
    const body = await readBody(req);
    const refused = Object.keys(body).filter((k) => ADMIN_FIELDS.includes(k) && !allowed.includes(k));
    if (refused.length) return json({ error: 'Seul un admin peut modifier l’intitulé, le chantier, la priorité, le porteur et l’échéance.' }, 403);
    const W = buildWS((await listSegments()).segments);
    const patch = applyBlockRule(cleanPatch(body, allowed, W.map), before);
    if (!Object.keys(patch).length) return json({ action: before });
    patch.updated_by = session.name;
    const after = await updateAction(params.id, patch);
    await logActivity({ action_id: before.id, action_title: (after || before).title, who: session.name, what: describeChange(before, patch, W.map) });
    return json({ action: after });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req, { params }) {
  const { session, error } = requireSession(req, 'admin');
  if (error) return error;
  try {
    const before = await getAction(params.id);
    if (!before) return json({ ok: true });
    await deleteAction(params.id);
    await logActivity({ action_id: before.id, action_title: before.title, who: session.name, what: 'action supprimée' });
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
