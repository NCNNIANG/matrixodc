// Référentiels partagés entre le serveur et l'interface.

export const EVENT_DAY = '2026-10-30';

// Chantiers fixes, avant et après les moments du déroulé.
export const WS_BEFORE = [
  { k: 'pil', l: 'Pilotage' },
  { k: 'sec', l: 'Sécurité & accréditations' },
  { k: 'trv', l: 'Travaux & aménagement' },
  { k: 'tec', l: 'Technique & agence' },
  { k: 'pro', l: 'Protocole & accueil' }
];
export const WS_AFTER = [
  { k: 'edl', l: 'Éléments de langage' },
  { k: 'com', l: 'Communication & presse' },
  { k: 'rep', l: 'Répétitions & plans B' },
  { k: 'jj', l: 'Jour J & après' }
];
export const FIXED_WS_KEYS = [...WS_BEFORE, ...WS_AFTER].map((w) => w.k);

// Déroulé par défaut du 30 octobre (modifiable en mode admin, enregistré dans la table « segments »).
export const DEFAULT_SEGMENTS = [
  { id: 's1', start: '17:00', duration: 5, title: 'Accueil par le CEO et le DG' },
  { id: 's2', start: '17:05', duration: 10, title: 'Présentation Sonatel & Sonatel Academy' },
  { id: 's3', start: '17:15', duration: 15, title: 'Rencontre de 2 entrepreneurs du digital' },
  { id: 's4', start: '17:30', duration: 15, title: 'École du Code : étudiants et formateurs' },
  { id: 's5', start: '17:45', duration: 25, title: 'FabLab : démos et 2 pitchs' },
  { id: 's6', start: '18:10', duration: 5, title: 'Photo de groupe et départ' }
];

export const ST = [
  { k: 'todo', l: 'To Do' },
  { k: 'doing', l: 'In Progress' },
  { k: 'blocked', l: 'Blocked' },
  { k: 'done', l: 'Done' }
];

export const PRIO = [
  { k: 'critique', l: 'Critique', r: 0 },
  { k: 'haute', l: 'Haute', r: 1 },
  { k: 'normale', l: 'Normale', r: 2 }
];

export const MILESTONES = [
  ['2026-10-16', 'Noms des entrepreneurs à l’ambassade'],
  ['2026-10-17', 'Démarrage gros œuvre et mobilier'],
  ['2026-10-19', 'Survey agence · démarrage branding'],
  ['2026-10-24', 'Refresh réceptionné'],
  ['2026-10-25', 'Arrivée des précurseurs'],
  ['2026-10-28', 'Installation agence · filage technique'],
  ['2026-10-29', 'Répétition générale'],
  ['2026-10-30', 'Visite', true],
  ['2026-10-31', 'Ouverture des JOJ Dakar 2026']
];

// Rôles génériques importés de la checklist : à remplacer par des noms de porteurs.
export const ROLE_LABELS = [
  'Chef de projet', 'Réf. protocole', 'Réf. sécurité', 'Réf. travaux', 'Réf. technique',
  'Réf. entrepreneurs', 'Réf. École du Code', 'Réf. FabLab', 'Réf. communication',
  'Réf. accueil', 'Time keeper', 'Cabinet DG'
];

export const STMAP = Object.fromEntries(ST.map((s) => [s.k, s]));
export const PRIOMAP = Object.fromEntries(PRIO.map((p) => [p.k, p]));

/* ---------- Heures du déroulé ---------- */
export const isTime = (t) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const fromMin = (m) => {
  const x = ((m % 1440) + 1440) % 1440;
  return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0');
};
export const fmtTime = (t) => (isTime(t) ? t.replace(':', 'h') : t);
export const endOf = (s) => fromMin(toMin(s.start) + s.duration);

export const sortSegments = (list) =>
  [...list].sort((a, b) => toMin(a.start) - toMin(b.start) || String(a.id).localeCompare(String(b.id)));

// Liste complète des chantiers : fixes + un chantier par moment du déroulé, dans l'ordre horaire.
export function buildWS(segments) {
  const segs = sortSegments(segments && segments.length ? segments : DEFAULT_SEGMENTS);
  const list = [
    ...WS_BEFORE,
    ...segs.map((s) => ({ k: s.id, l: `${fmtTime(s.start)} · ${s.title}`, seg: true })),
    ...WS_AFTER
  ];
  return { list, map: Object.fromEntries(list.map((w) => [w.k, w])), segments: segs };
}
