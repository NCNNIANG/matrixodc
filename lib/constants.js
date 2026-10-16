// Référentiels partagés entre le serveur et l'interface.

export const EVENT_DAY = '2026-10-30';

export const WS = [
  { k: 'pil', l: 'Pilotage' },
  { k: 'sec', l: 'Sécurité & accréditations' },
  { k: 'trv', l: 'Travaux & aménagement' },
  { k: 'tec', l: 'Technique & agence' },
  { k: 'pro', l: 'Protocole & accueil' },
  { k: 's1', l: '17h00 · Accueil' },
  { k: 's2', l: '17h05 · Présentation' },
  { k: 's3', l: '17h15 · Entrepreneurs' },
  { k: 's4', l: '17h30 · École du Code' },
  { k: 's5', l: '17h45 · FabLab & pitchs' },
  { k: 's6', l: '18h10 · Photo & départ' },
  { k: 'edl', l: 'Éléments de langage' },
  { k: 'com', l: 'Communication & presse' },
  { k: 'rep', l: 'Répétitions & plans B' },
  { k: 'jj', l: 'Jour J & après' }
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

export const RUN = [
  { ws: 's1', t: '17h00', l: 'Accueil par le CEO et le DG', m: 5 },
  { ws: 's2', t: '17h05', l: 'Présentation Sonatel & Sonatel Academy', m: 10 },
  { ws: 's3', t: '17h15', l: '2 entrepreneurs du digital', m: 15 },
  { ws: 's4', t: '17h30', l: 'École du Code', m: 15 },
  { ws: 's5', t: '17h45', l: 'FabLab, démos & 2 pitchs', m: 25 },
  { ws: 's6', t: '18h10', l: 'Photo · départ 18h15', m: 5 }
];

export const MILESTONES = [
  ['2026-10-16', 'Noms des entrepreneurs à l’ambassade'],
  ['2026-10-17', 'Démarrage gros œuvre et mobilier'],
  ['2026-10-19', 'Survey agence · démarrage branding'],
  ['2026-10-24', 'Refresh réceptionné'],
  ['2026-10-25', 'Arrivée des précurseurs'],
  ['2026-10-28', 'Installation agence · filage technique'],
  ['2026-10-29', 'Répétition générale 17h'],
  ['2026-10-30', 'Visite 17h00', true],
  ['2026-10-31', 'Ouverture des JOJ Dakar 2026']
];

// Rôles génériques importés de la checklist : à remplacer par des noms de porteurs.
export const ROLE_LABELS = [
  'Chef de projet', 'Réf. protocole', 'Réf. sécurité', 'Réf. travaux', 'Réf. technique',
  'Réf. entrepreneurs', 'Réf. École du Code', 'Réf. FabLab', 'Réf. communication',
  'Réf. accueil', 'Time keeper', 'Cabinet DG'
];

export const WSMAP = Object.fromEntries(WS.map((w) => [w.k, w]));
export const STMAP = Object.fromEntries(ST.map((s) => [s.k, s]));
export const PRIOMAP = Object.fromEntries(PRIO.map((p) => [p.k, p]));
