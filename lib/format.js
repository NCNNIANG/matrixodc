import { PRIOMAP, ROLE_LABELS } from './constants';

// Dakar est à UTC+0 toute l'année : les dates du jour se calculent en UTC.
export const todayISO = () => new Date().toISOString().slice(0, 10);

export const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const dayDiff = (a, b) =>
  Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

const DF = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const DTF = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

export const fmtDate = (iso) => {
  if (!iso) return 'Sans échéance';
  try { return DF.format(new Date(iso + 'T00:00:00Z')); } catch (e) { return iso; }
};

export const fmtRel = (iso) => {
  if (!iso) return '';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'à l’instant';
  if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h';
  return DTF.format(new Date(iso));
};

export const isLate = (a) => !!a.due && a.status !== 'done' && a.due < todayISO();

export const isSoon = (a) => {
  const t = todayISO();
  return !!a.due && a.status !== 'done' && a.due >= t && a.due <= addDays(t, 2);
};

export const byDue = (a, b) =>
  (a.due || '9999').localeCompare(b.due || '9999') ||
  (PRIOMAP[a.prio].r - PRIOMAP[b.prio].r) ||
  ((a.sort_order || 0) - (b.sort_order || 0));

export const plural = (n, one, many) => n + ' ' + (n > 1 ? many : one);

export const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const ROLES = new Set(ROLE_LABELS);
export const needsName = (a) => !a.owner || ROLES.has(a.owner);
