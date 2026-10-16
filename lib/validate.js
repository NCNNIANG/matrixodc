import { STMAP, PRIOMAP, isTime, sortSegments } from './constants';

const DF = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const frDate = (iso) => DF.format(new Date(iso + 'T00:00:00Z'));

const str = (v, max) => String(v == null ? '' : v).replace(/\r\n/g, '\n').trim().slice(0, max);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));

// Champs que tout participant peut modifier
export const MEMBER_FIELDS = ['status', 'blocker', 'note'];
// Champs réservés au mode admin
export const ADMIN_FIELDS = ['title', 'ws', 'owner', 'due', 'prio', 'status', 'blocker', 'note'];

export class InputError extends Error {}

// wsMap : chantiers valides (fixes + moments du déroulé), clé → { l }
export function cleanPatch(body, allowed, wsMap) {
  const out = {};
  for (const k of allowed) {
    if (!(k in (body || {}))) continue;
    const v = body[k];
    switch (k) {
      case 'title': out.title = str(v, 300); if (!out.title) throw new InputError('Décrivez l’action en quelques mots.'); break;
      case 'ws': if (!wsMap || !wsMap[v]) throw new InputError('Chantier inconnu.'); out.ws = v; break;
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

export function describeChange(before, patch, wsMap) {
  const parts = [];
  if (patch.status && patch.status !== before.status) parts.push(STMAP[patch.status].l);
  if ('owner' in patch && patch.owner !== before.owner) parts.push('porteur : ' + (patch.owner || 'aucun'));
  if ('due' in patch && (patch.due || null) !== (before.due || null)) parts.push('échéance : ' + (patch.due ? frDate(patch.due) : 'aucune'));
  if (patch.title && patch.title !== before.title) parts.push('intitulé modifié');
  if (patch.prio && patch.prio !== before.prio) parts.push('priorité : ' + PRIOMAP[patch.prio].l);
  if (patch.ws && patch.ws !== before.ws) parts.push('chantier : ' + (wsMap?.[patch.ws]?.l || patch.ws));
  if ('note' in patch && patch.note !== before.note) parts.push('note');
  if (patch.blocker && patch.blocker !== before.blocker && !parts.length) parts.push('motif de blocage');
  return parts.join(' · ') || 'mise à jour';
}

// Déroulé : liste complète des moments envoyée par l'éditeur admin.
export function cleanSegments(input) {
  if (!Array.isArray(input) || !input.length) throw new InputError('Le déroulé doit compter au moins un moment.');
  if (input.length > 30) throw new InputError('Le déroulé ne peut pas dépasser 30 moments.');
  const seen = new Set();
  const out = input.map((s, i) => {
    const title = str(s && s.title, 120);
    const start = String((s && s.start) || '');
    const duration = Math.round(Number(s && s.duration));
    const n = i + 1;
    if (!title) throw new InputError(`Moment ${n} : donnez-lui un titre.`);
    if (!isTime(start)) throw new InputError(`Moment ${n} : heure de début invalide.`);
    if (!Number.isFinite(duration) || duration < 1 || duration > 600) throw new InputError(`Moment ${n} : durée entre 1 et 600 minutes.`);
    let id = s && typeof s.id === 'string' && /^[a-z0-9]{1,24}$/i.test(s.id) ? s.id : null;
    if (id && seen.has(id)) id = null;
    if (id) seen.add(id);
    return { id, start, duration, title };
  });
  return sortSegments(out.map((s, i) => ({ ...s, _i: i }))).map(({ _i, ...s }) => s);
}
