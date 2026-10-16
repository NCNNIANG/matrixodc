// Accès aux données. En production : Supabase, avec la clé service_role (côté serveur uniquement).
// En local, MATRIX_DEMO=1 active une base en mémoire pour tester l'interface sans Supabase.
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import crypto from 'crypto';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO = !URL && process.env.MATRIX_DEMO === '1';

export class ConfigError extends Error {}

let sb = null;
function db() {
  if (!URL || !KEY) throw new ConfigError('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant');
  if (!sb) sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return sb;
}

function check({ data, error }) {
  if (error) throw new Error(error.message || 'Erreur base de données');
  return data;
}

/* ---------- Mémoire (démo locale) ---------- */
const mem = globalThis.__matrixMem || (globalThis.__matrixMem = { actions: null, activity: [], seq: 1 });
function memInit() {
  if (mem.actions) return;
  let rows = [];
  try { if (process.env.MATRIX_DEMO_SEED) rows = JSON.parse(fs.readFileSync(process.env.MATRIX_DEMO_SEED, 'utf8')); } catch (e) {}
  const now = new Date().toISOString();
  mem.actions = rows.map((r) => ({ blocker: '', note: '', created_at: now, updated_at: now, updated_by: null, ...r, due: r.due || null }));
}
const clone = (x) => JSON.parse(JSON.stringify(x));

/* ---------- API ---------- */
export async function listAll() {
  if (DEMO) {
    memInit();
    return {
      actions: clone([...mem.actions].sort((a, b) => a.sort_order - b.sort_order)),
      activity: clone(mem.activity.slice(-15).reverse())
    };
  }
  const [actions, activity] = await Promise.all([
    db().from('actions').select('*').order('sort_order', { ascending: true }).limit(2000).then(check),
    db().from('activity').select('*').order('at', { ascending: false }).limit(15).then(check)
  ]);
  return { actions, activity };
}

export async function getAction(id) {
  if (DEMO) { memInit(); const a = mem.actions.find((x) => x.id === id); return a ? clone(a) : null; }
  const rows = await db().from('actions').select('*').eq('id', id).limit(1).then(check);
  return rows[0] || null;
}

export async function insertAction(row) {
  const id = 'n' + crypto.randomBytes(4).toString('hex');
  const now = new Date().toISOString();
  if (DEMO) {
    memInit();
    const order = Math.max(0, ...mem.actions.map((a) => a.sort_order)) + 1;
    const a = { id, blocker: '', note: '', ...row, sort_order: order, created_at: now, updated_at: now };
    mem.actions.push(a);
    return clone(a);
  }
  const last = await db().from('actions').select('sort_order').order('sort_order', { ascending: false }).limit(1).then(check);
  const order = (last[0]?.sort_order || 0) + 1;
  const rows = await db().from('actions').insert({ id, ...row, sort_order: order, created_at: now, updated_at: now }).select().then(check);
  return rows[0];
}

export async function updateAction(id, patch) {
  const p = { ...patch, updated_at: new Date().toISOString() };
  if (DEMO) {
    memInit();
    const a = mem.actions.find((x) => x.id === id);
    if (!a) return null;
    Object.assign(a, p);
    return clone(a);
  }
  const rows = await db().from('actions').update(p).eq('id', id).select().then(check);
  return rows[0] || null;
}

export async function deleteAction(id) {
  if (DEMO) { memInit(); mem.actions = mem.actions.filter((x) => x.id !== id); return true; }
  await db().from('actions').delete().eq('id', id).then(check);
  return true;
}

export async function replaceOwner(from, to, who) {
  const p = { owner: to, updated_at: new Date().toISOString(), updated_by: who };
  if (DEMO) {
    memInit();
    const hit = mem.actions.filter((x) => x.owner === from);
    hit.forEach((a) => Object.assign(a, p));
    return hit.length;
  }
  const rows = await db().from('actions').update(p).eq('owner', from).select('id').then(check);
  return rows.length;
}

export async function logActivity(entry) {
  try {
    if (DEMO) { mem.activity.push({ id: mem.seq++, at: new Date().toISOString(), ...entry }); return; }
    await db().from('activity').insert(entry).then(check);
  } catch (e) {
    // Le journal ne doit jamais bloquer une mise à jour.
  }
}
