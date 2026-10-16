import { WSMAP, STMAP, PRIOMAP } from './constants';

const DF = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const frDate = (iso) => DF.format(new Date(iso + 'T00:00:00Z'));

const str = (v, max) => String(v == null ? '' : v).replace(/\r\n/g, '\n').trim().slice(0, max);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));

// Champs que tout participant peut modifier
export const MEMBER_FIELDS = ['status', 'blocker', 'note'];
// Champs réservés au mode admin
export const ADMIN_FIELDS = ['title', 'ws', 'owner', 'due', 'prio', 'status', 'blocker', 'note'];

export class InputError extends Error {}

export function cleanPatch(body, allowed) {
  const out = {};
  for (const k of allowed) {
    if (!(k in (body || {}))) continue;
    const v = body[k];
    switch (k) {
      case 'title': out.title = str(v, 300); if (!out.title) throw new InputError('Décrivez l’action en quelques mots.'); break;
      case 'ws': if (!WSMAP[v]) throw new InputError('Chantier inconnu.'); out.ws = v; break;
      case 'owner': out.owner = str(v, 80); break;
      case 'due': if (v === '' || v == null) out.due = null; else if (isDate(v)) out.due = v; else throw new InputError('Date d’échéance invalide.'); break;
      case 'prio': if (!PRIOMAP[v]) throw new InputError('Priorité inconnue.'); out.prio = v; break;
      case 'status': if (!STMAP[v]) throw new InputError('Statut inconnu.'); out.status = v; break;
      case 'blocker': out.blocker = str(v, 400); break;
      case 'note': out.note = str(v, 2000); break;
    }
  }
  return out;
}

// Règle commune : un blocage doit toujours dire ce qui bloque ; hors blocage, le motif est vidé.
export function applyBlockRule(patch, current) {
  const status = patch.status ?? current?.status;
  if (status === 'blocked') {
    const blocker = patch.blocker ?? current?.blocker ?? '';
    if (!blocker) throw new InputError('Indiquez ce qui bloque pour que l’équipe puisse agir.');
  } else if ('status' in patch) {
    patch.blocker = '';
  }
  return patch;
}

export function describeChange(before, patch) {
  const parts = [];
  if (patch.status && patch.status !== before.status) parts.push(STMAP[patch.status].l);
  if ('owner' in patch && patch.owner !== before.owner) parts.push('porteur : ' + (patch.owner || 'aucun'));
  if ('due' in patch && (patch.due || null) !== (before.due || null)) parts.push('échéance : ' + (patch.due ? frDate(patch.due) : 'aucune'));
  if (patch.title && patch.title !== before.title) parts.push('intitulé modifié');
  if (patch.prio && patch.prio !== before.prio) parts.push('priorité : ' + PRIOMAP[patch.prio].l);
  if (patch.ws && patch.ws !== before.ws) parts.push('chantier : ' + WSMAP[patch.ws].l);
  if ('note' in patch && patch.note !== before.note) parts.push('note');
  if (patch.blocker && patch.blocker !== before.blocker && !parts.length) parts.push('motif de blocage');
  return parts.join(' · ') || 'mise à jour';
}
