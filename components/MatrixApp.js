'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ST, PRIO, STMAP, EVENT_DAY, buildWS, fmtTime, endOf, toMin, fromMin, isTime } from '@/lib/constants';
import { todayISO, dayDiff, fmtRel, isLate, isSoon, trunc, plural } from '@/lib/format';
import { Vue360, Kanban, Checklist, Affectation } from './Views';
import Squares from './Squares';

const EMPTY_F = { q: '', ws: '', owner: '', status: '', prio: '', when: '' };
const VIEWS = [
  { k: 'v360', l: 'Vue 360' },
  { k: 'kanban', l: 'Kanban' },
  { k: 'checklist', l: 'Checklist' },
  { k: 'assign', l: 'Affectation', admin: true }
];
const HASHES = { '#vue360': 'v360', '#kanban': 'kanban', '#checklist': 'checklist', '#affectation': 'assign' };
const POLL_MS = 20000;

const LS = {
  get(k, d) { try { const v = localStorage.getItem('matrixodc.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('matrixodc.' + k, JSON.stringify(v)); } catch (e) {} }
};

const norm = (a) => ({ ...a, due: a.due || '', owner: a.owner || '', blocker: a.blocker || '', note: a.note || '' });

async function api(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  });
  let j = null;
  try { j = await r.json(); } catch (e) {}
  if (!r.ok) {
    const err = new Error((j && j.error) || 'L’enregistrement a échoué. Réessayez dans un instant.');
    err.status = r.status;
    throw err;
  }
  return j || {};
}

export default function MatrixApp({ initial, session: initialSession, dbError }) {
  const [actions, setActions] = useState(() => (initial.actions || []).map(norm));
  const [activity, setActivity] = useState(initial.activity || []);
  const [segments, setSegments] = useState(initial.segments || []);
  const [runOpen, setRunOpen] = useState(false);
  const [session, setSession] = useState(initialSession);
  const [sync, setSync] = useState(dbError ? 'offline' : 'live');
  const [view, setViewState] = useState('v360');
  const [f, setF] = useState(EMPTY_F);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [drawer, setDrawer] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [, setTick] = useState(0);
  const pending = useRef(0);
  const toastTimer = useRef(null);
  const ready = useRef(false);

  const isAdmin = session.role === 'admin';
  const effView = view === 'assign' && !isAdmin ? 'v360' : view;
  const W = useMemo(() => buildWS(segments), [segments]);
  // Une action rattachée à un moment disparu du déroulé s'affiche sous « Pilotage ».
  const shownActions = useMemo(() => actions.map((a) => (W.map[a.ws] ? a : { ...a, ws: 'pil' })), [actions, W]);

  /* Préférences locales (vue, filtres, groupes repliés) */
  useEffect(() => {
    setViewState(HASHES[window.location.hash] || LS.get('view', 'v360'));
    setF({ ...EMPTY_F, ...LS.get('filters', {}) });
    setCollapsed(new Set(LS.get('collapsed', [])));
    ready.current = true;
  }, []);
  useEffect(() => { if (ready.current) LS.set('filters', f); }, [f]);

  const toast = useCallback((m) => {
    setToastMsg(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 3400);
  }, []);

  const onAuthLost = useCallback(() => { window.location.reload(); }, []);

  /* Synchronisation : toutes les 20 s quand la page est visible, et au retour sur l'onglet */
  const refresh = useCallback(async () => {
    try {
      const j = await api('GET', '/api/actions');
      if (pending.current > 0) return;
      setActions((j.actions || []).map(norm));
      setActivity(j.activity || []);
      if (j.segments) setSegments(j.segments);
      if (j.session) setSession((s) => (s.role !== j.session.role || s.name !== j.session.name ? j.session : s));
      setSync('live');
    } catch (e) {
      if (e.status === 401) { onAuthLost(); return; }
      setSync('offline');
    }
  }, [onAuthLost]);

  useEffect(() => {
    const tick = () => { setTick((n) => n + 1); if (document.visibilityState === 'visible') refresh(); };
    const t = setInterval(tick, POLL_MS);
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis); };
  }, [refresh]);

  /* Écritures */
  const mutate = useCallback(async (id, patch, msg) => {
    const now = new Date().toISOString();
    setActions((list) => list.map((a) => {
      if (a.id !== id) return a;
      const next = { ...a, ...patch, updated_at: now, updated_by: session.name };
      if ('status' in patch && patch.status !== 'blocked') next.blocker = '';
      return next;
    }));
    pending.current++;
    setSync('sync');
    try {
      await api('PATCH', `/api/actions/${id}`, patch);
      if (msg) toast(msg);
      return true;
    } catch (e) {
      if (e.status === 401) { onAuthLost(); return false; }
      toast(e.message);
      return false;
    } finally {
      pending.current--;
      if (pending.current === 0) refresh();
    }
  }, [session.name, refresh, toast, onAuthLost]);

  const setStatus = useCallback((id, st) => {
    const a = actions.find((x) => x.id === id);
    if (!a || a.status === st) return;
    if (st === 'blocked') { setDrawer({ id, preset: { status: 'blocked' } }); return; }
    mutate(id, { status: st }, `${STMAP[st].l} · ${trunc(a.title, 50)}`);
  }, [actions, mutate]);

  async function saveDrawer(form) {
    const { id, isNew } = drawer;
    setDrawer(null);
    if (isNew) {
      pending.current++;
      try { await api('POST', '/api/actions', form); toast('Action ajoutée'); }
      catch (e) { if (e.status === 401) return onAuthLost(); toast(e.message); }
      finally { pending.current--; refresh(); }
      return;
    }
    const patch = isAdmin ? form : { status: form.status, blocker: form.blocker, note: form.note };
    await mutate(id, patch, 'Modifications enregistrées');
  }

  async function deleteAction(id) {
    const a = actions.find((x) => x.id === id);
    setDrawer(null);
    setActions((l) => l.filter((x) => x.id !== id));
    pending.current++;
    try { await api('DELETE', `/api/actions/${id}`); toast('Action supprimée' + (a ? ' · ' + trunc(a.title, 40) : '')); }
    catch (e) { if (e.status === 401) return onAuthLost(); toast(e.message); }
    finally { pending.current--; refresh(); }
  }

  async function replaceRole(from, to) {
    if (!from || !to) { toast('Choisissez un rôle et saisissez le nom du porteur.'); return false; }
    pending.current++;
    try {
      const j = await api('POST', '/api/actions/replace-owner', { from, to });
      toast(`« ${from} » remplacé par « ${to} » sur ${plural(j.count || 0, 'action', 'actions')}`);
      return true;
    } catch (e) {
      if (e.status === 401) { onAuthLost(); return false; }
      toast(e.message);
      return false;
    } finally { pending.current--; refresh(); }
  }

  async function saveRun(list) {
    pending.current++;
    try {
      const j = await api('PUT', '/api/segments', { segments: list });
      setSegments(j.segments);
      toast('Déroulé enregistré');
      return true;
    } catch (e) {
      if (e.status === 401) { onAuthLost(); return false; }
      throw e;
    } finally { pending.current--; refresh(); }
  }

  async function enableAdmin(code) {
    const j = await api('POST', '/api/admin', { code });
    setSession({ name: j.name, role: 'admin' });
    toast('Mode admin activé');
  }
  async function disableAdmin() {
    try { const j = await api('DELETE', '/api/admin'); setSession({ name: j.name, role: 'member' }); toast('Mode admin désactivé'); }
    catch (e) { if (e.status === 401) onAuthLost(); else toast(e.message); }
  }
  async function logout() {
    try { await api('DELETE', '/api/session'); } catch (e) {}
    window.location.reload();
  }

  /* Navigation */
  const setView = (v) => { setViewState(v); LS.set('view', v); window.scrollTo(0, 0); };
  const jump = (obj) => {
    setF({ ...EMPTY_F, ...obj });
    if (obj.ws) setCollapsed((c) => { const n = new Set(c); n.delete(obj.ws); LS.set('collapsed', [...n]); return n; });
    setView('checklist');
  };
  const toggleGroup = (k) => setCollapsed((c) => { const n = new Set(c); n.has(k) ? n.delete(k) : n.add(k); LS.set('collapsed', [...n]); return n; });

  /* Filtres */
  const owners = useMemo(() => [...new Set(actions.map((a) => a.owner).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')), [actions]);
  const filtered = useCallback((ignoreStatus) => {
    const q = f.q.trim().toLowerCase();
    return shownActions.filter((a) =>
      (!f.ws || a.ws === f.ws) &&
      (!f.owner || a.owner === f.owner) &&
      (ignoreStatus || !f.status || a.status === f.status) &&
      (!f.prio || a.prio === f.prio) &&
      (!f.when || (f.when === 'late' ? isLate(a) : isSoon(a))) &&
      (!q || `${a.title} ${a.owner} ${a.note} ${a.blocker} ${W.map[a.ws]?.l || ''}`.toLowerCase().includes(q))
    );
  }, [shownActions, f, W]);
  const shown = filtered(effView === 'kanban');
  const filtersActive = Object.keys(EMPTY_F).some((k) => f[k] && !(effView === 'kanban' && k === 'status'));

  /* En-tête */
  const d = dayDiff(todayISO(), EVENT_DAY);
  const countN = d > 0 ? `J-${d}` : d === 0 ? 'Jour J' : `J+${-d}`;
  const firstStart = W.segments[0] ? fmtTime(W.segments[0].start) : '';
  const countL = d > 0 ? ['avant', 'la visite'] : d === 0 ? ['arrivée', firstStart ? 'à ' + firstStart : 'aujourd’hui'] : ['après', 'la visite'];
  const syncTxt = sync === 'live' ? 'En direct' : sync === 'sync' ? 'Enregistrement…' : 'Hors connexion';
  const syncC = sync === 'live' ? 'var(--done)' : sync === 'sync' ? 'var(--doing)' : 'var(--blocked)';

  const drawerAction = drawer && !drawer.isNew ? shownActions.find((a) => a.id === drawer.id) : null;

  return (
    <>
      <header className="top">
        <div className="wrap top-in">
          <div className="brand"><div className="wordmark">Matrix<b>ODC</b></div><Squares /></div>
          <div className="count"><span className="count-n">{countN}</span><span className="count-l">{countL[0]}<br />{countL[1]}</span></div>
          <nav className="tabs" role="tablist" aria-label="Vues">
            {VIEWS.filter((v) => !v.admin || isAdmin).map((v) => (
              <button key={v.k} className="tab" role="tab" aria-selected={effView === v.k} onClick={() => setView(v.k)} type="button">{v.l}</button>
            ))}
          </nav>
          <div className="top-actions">
            <span className="sync" style={{ '--c': syncC }}>{syncTxt}</span>
            <span className="who" title="Vous êtes connecté sous ce nom">{session.name}</span>
            {isAdmin && <span className="role-badge">Admin</span>}
            {isAdmin && <button className="btn btn-accent" type="button" onClick={() => setDrawer({ isNew: true })}>+ Action</button>}
            <button className="btn btn-ghost" type="button" onClick={() => (isAdmin ? disableAdmin() : setAdminOpen(true))}>{isAdmin ? 'Quitter le mode admin' : 'Mode admin'}</button>
            <button className="btn btn-ghost" type="button" onClick={logout}>Déconnexion</button>
          </div>
        </div>
      </header>

      {effView !== 'v360' && actions.length > 0 && (
        <div className="wrap">
          <div className="filters" role="search">
            <label className="sr" htmlFor="f-q">Rechercher</label>
            <input className="inp q" id="f-q" type="search" placeholder="Rechercher une action ou un porteur" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
            <label className="sr" htmlFor="f-ws">Chantier</label>
            <select className="inp" id="f-ws" value={f.ws} onChange={(e) => setF({ ...f, ws: e.target.value })}>
              <option value="">Tous les chantiers</option>
              {W.list.map((w) => <option key={w.k} value={w.k}>{w.l}</option>)}
            </select>
            <label className="sr" htmlFor="f-owner">Porteur</label>
            <select className="inp" id="f-owner" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>
              <option value="">Tous les porteurs</option>
              {(f.owner && !owners.includes(f.owner) ? [...owners, f.owner] : owners).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {effView !== 'kanban' && (
              <>
                <label className="sr" htmlFor="f-status">Statut</label>
                <select className="inp" id="f-status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                  <option value="">Tous les statuts</option>
                  {ST.map((s) => <option key={s.k} value={s.k}>{s.l}</option>)}
                </select>
              </>
            )}
            <label className="sr" htmlFor="f-prio">Priorité</label>
            <select className="inp" id="f-prio" value={f.prio} onChange={(e) => setF({ ...f, prio: e.target.value })}>
              <option value="">Toutes priorités</option>
              {PRIO.map((p) => <option key={p.k} value={p.k}>{p.l}</option>)}
            </select>
            <label className="sr" htmlFor="f-when">Échéance</label>
            <select className="inp" id="f-when" value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })}>
              <option value="">Toutes échéances</option>
              <option value="late">En retard</option>
              <option value="soon">Sous 48 h</option>
            </select>
            {filtersActive && <button className="btn btn-ghost" type="button" onClick={() => setF(EMPTY_F)}>Effacer les filtres</button>}
            <span className="f-count">{shown.length} sur {plural(actions.length, 'action', 'actions')}</span>
          </div>
        </div>
      )}

      <main className="wrap">
        {dbError && !actions.length ? (
          <div className="state"><h2>Les actions ne peuvent pas être chargées</h2><p>La base de données ne répond pas. Vérifiez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans Vercel, puis rechargez la page.</p></div>
        ) : !actions.length ? (
          <div className="state">
            <h2>Aucune action pour l’instant</h2>
            <p>{isAdmin ? 'Ajoutez la première action, ou importez la checklist avec le script seed.sql dans Supabase.' : 'Les actions apparaîtront ici dès qu’un admin les aura ajoutées.'}</p>
            {isAdmin && <button className="btn btn-accent" type="button" onClick={() => setDrawer({ isNew: true })}>+ Ajouter la première action</button>}
          </div>
        ) : effView === 'v360' ? (
          <Vue360 actions={shownActions} activity={activity} W={W} isAdmin={isAdmin} onEditRun={() => setRunOpen(true)} onJump={jump} onOpen={(id) => setDrawer({ id })} />
        ) : effView === 'kanban' ? (
          <Kanban items={shown} W={W} canDrag onOpen={(id) => setDrawer({ id })} onStatus={setStatus} />
        ) : effView === 'assign' ? (
          <Affectation all={shownActions} items={shown} W={W} onOpen={(id) => setDrawer({ id })}
            onOwner={(id, v) => mutate(id, { owner: v }, v ? 'Porteur : ' + v : 'Porteur retiré')}
            onDue={(id, v) => mutate(id, { due: v }, 'Échéance mise à jour')}
            onReplace={replaceRole} />
        ) : (
          <Checklist items={shown} all={shownActions} W={W} collapsed={collapsed} onToggleGroup={toggleGroup}
            onOpen={(id) => setDrawer({ id })} onStatus={setStatus} onReset={() => setF(EMPTY_F)} />
        )}
        <footer className="foot">
          <span>MatrixODC · mises à jour partagées, actualisées toutes les 20 secondes.</span>
          <span>Ne saisissez ici aucune pièce d’identité ni donnée personnelle sensible.</span>
        </footer>
      </main>

      <datalist id="owners-dl">{owners.map((o) => <option key={o} value={o} />)}</datalist>

      {drawer && (drawer.isNew || drawerAction) && (
        <Drawer key={drawer.id || 'new'} action={drawerAction} preset={drawer.preset} isNew={!!drawer.isNew} isAdmin={isAdmin} W={W}
          defaultWs={f.ws || 'pil'} onClose={() => setDrawer(null)} onSave={saveDrawer} onDelete={deleteAction} />
      )}
      {runOpen && isAdmin && (
        <DerouleEditor segments={W.segments} counts={actions.reduce((m, a) => { m[a.ws] = (m[a.ws] || 0) + 1; return m; }, {})}
          onClose={() => setRunOpen(false)} onSave={saveRun} />
      )}
      {adminOpen && <AdminDialog onClose={() => setAdminOpen(false)} onSubmit={enableAdmin} />}
      {toastMsg && <div className="toast" role="status" aria-live="polite">{toastMsg}</div>}
    </>
  );
}

/* ---------- Tiroir d'édition ---------- */
function Drawer({ action, preset, isNew, isAdmin, W, defaultWs, onClose, onSave, onDelete }) {
  const base = action || { title: '', ws: defaultWs, prio: 'normale', owner: '', due: '', status: 'todo', blocker: '', note: '' };
  const [form, setForm] = useState(() => ({
    title: base.title, ws: base.ws, prio: base.prio, owner: base.owner, due: base.due || '',
    status: base.status, blocker: base.blocker, note: base.note, ...(preset || {})
  }));
  const [errs, setErrs] = useState({});
  const [armed, setArmed] = useState(false);
  const titleRef = useRef(null);
  const blockerRef = useRef(null);
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  const locked = !isAdmin;

  useEffect(() => {
    const t = setTimeout(() => {
      if (form.status === 'blocked' && preset?.status === 'blocked') blockerRef.current?.focus();
      else if (!locked) titleRef.current?.focus();
    }, 30);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);

  function submit(e) {
    e.preventDefault();
    const er = {};
    if (isAdmin && !form.title.trim()) er.title = true;
    if (form.status === 'blocked' && !form.blocker.trim()) er.blocker = true;
    setErrs(er);
    if (er.title) return titleRef.current?.focus();
    if (er.blocker) return blockerRef.current?.focus();
    onSave({ ...form, title: form.title.trim(), owner: form.owner.trim(), blocker: form.status === 'blocked' ? form.blocker.trim() : '', note: form.note.trim() });
  }

  return (
    <div className="drawer">
      <div className="dr-scrim" onClick={onClose} />
      <form className="dr-panel" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="dr-h" noValidate>
        <div className="dr-head">
          <h2 id="dr-h">{isNew ? 'Nouvelle action' : 'Action'}</h2>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Fermer</button>
        </div>
        <div className="dr-body">
          <div className="field">
            <label htmlFor="f-title">Action</label>
            <textarea className="inp" id="f-title" rows={2} ref={titleRef} value={form.title} disabled={locked} onChange={(e) => set('title', e.target.value)} />
            {errs.title && <p className="err">Décrivez l’action en quelques mots.</p>}
          </div>
          <div className="field">
            <span className="lbl" id="lbl-status">Statut</span>
            <div className="seg" role="radiogroup" aria-labelledby="lbl-status">
              {ST.map((s) => (
                <div key={s.k}>
                  <input type="radio" name="f-status" id={`f-st-${s.k}`} value={s.k} checked={form.status === s.k} onChange={() => set('status', s.k)} />
                  <label htmlFor={`f-st-${s.k}`} style={{ '--c': `var(--${s.k})` }}>{s.l}</label>
                </div>
              ))}
            </div>
          </div>
          {form.status === 'blocked' && (
            <div className="field">
              <label htmlFor="f-blocker">Ce qui bloque</label>
              <textarea className="inp" id="f-blocker" rows={2} ref={blockerRef} value={form.blocker} placeholder="Ex. : attente de validation du devis par les Achats" onChange={(e) => set('blocker', e.target.value)} />
              {errs.blocker && <p className="err">Indiquez ce qui bloque pour que l’équipe puisse agir.</p>}
            </div>
          )}
          <div className="two">
            <div className="field">
              <label htmlFor="f-ws">Chantier</label>
              <select className="inp" id="f-ws" value={form.ws} disabled={locked} onChange={(e) => set('ws', e.target.value)}>
                {W.list.map((w) => <option key={w.k} value={w.k}>{w.l}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-prio">Priorité</label>
              <select className="inp" id="f-prio" value={form.prio} disabled={locked} onChange={(e) => set('prio', e.target.value)}>
                {PRIO.map((p) => <option key={p.k} value={p.k}>{p.l}</option>)}
              </select>
            </div>
          </div>
          <div className="two">
            <div className="field">
              <label htmlFor="f-owner">Porteur</label>
              <input className="inp" id="f-owner" list="owners-dl" placeholder="Nom du porteur" value={form.owner} disabled={locked} onChange={(e) => set('owner', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-due">Échéance</label>
              <input className="inp" id="f-due" type="date" value={form.due} disabled={locked} onChange={(e) => set('due', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="f-note">Note</label>
            <textarea className="inp" id="f-note" rows={3} placeholder="Contexte, contact, prochaine étape" value={form.note} onChange={(e) => set('note', e.target.value)} />
          </div>
          {locked && <p className="hint">Seul un admin peut modifier l’intitulé, le chantier, la priorité, le porteur et l’échéance.</p>}
          {action?.updated_by && <p className="dr-meta">Dernière mise à jour par {action.updated_by} · {fmtRel(action.updated_at)}</p>}
        </div>
        <div className="dr-foot">
          {isAdmin && !isNew && (
            <button className={`btn btn-danger${armed ? ' armed' : ''}`} type="button" onClick={() => (armed ? onDelete(action.id) : setArmed(true))}>
              {armed ? 'Confirmer la suppression' : 'Supprimer'}
            </button>
          )}
          <span className="sp" />
          <button className="btn btn-ghost" type="button" onClick={onClose}>Annuler</button>
          <button className="btn btn-accent" type="submit">Enregistrer</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Mode admin ---------- */
function AdminDialog({ onClose, onSubmit }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    setTimeout(() => ref.current?.focus(), 30);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await onSubmit(code); onClose(); }
    catch (x) { setErr(x.message || 'Ce code admin ne correspond pas.'); setBusy(false); ref.current?.select(); }
  }
  return (
    <div className="modal">
      <div className="dr-scrim" onClick={onClose} />
      <form className="modal-card" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="admin-h" autoComplete="off">
        <h2 id="admin-h">Mode admin</h2>
        <p className="hint">Le mode admin permet d’affecter les porteurs, et de créer, modifier ou supprimer des actions.</p>
        <label htmlFor="admin-code">Code admin</label>
        <input className="inp" id="admin-code" type="password" ref={ref} value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} />
        {err && <p className="err" role="alert">{err}</p>}
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-accent" type="submit" disabled={busy}>{busy ? 'Vérification…' : 'Activer'}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Éditeur du déroulé (admin) ---------- */
function DerouleEditor({ segments, counts, onClose, onSave }) {
  const [rows, setRows] = useState(() => segments.map((s) => ({ id: s.id, start: s.start, duration: String(s.duration), title: s.title })));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (i, k, v) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const valid = (x) => isTime(x.start) && Number(x.duration) >= 1 && Number(x.duration) <= 600;
  const add = () => setRows((r) => {
    const ends = r.filter(valid).map((x) => toMin(x.start) + Number(x.duration));
    const start = ends.length ? fromMin(Math.max(...ends)) : '17:00';
    return [...r, { id: null, start, duration: '10', title: '' }];
  });
  const remove = (i) => setRows((r) => r.filter((_, j) => j !== i));

  const ok = rows.filter(valid);
  const first = ok.length ? Math.min(...ok.map((x) => toMin(x.start))) : null;
  const last = ok.length ? Math.max(...ok.map((x) => toMin(x.start) + Number(x.duration))) : null;
  const sorted = [...ok].sort((a, b) => toMin(a.start) - toMin(b.start));
  const overlaps = new Set();
  sorted.forEach((x, i) => { if (i && toMin(x.start) < toMin(sorted[i - 1].start) + Number(sorted[i - 1].duration)) overlaps.add(x); });

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const bad = rows.findIndex((x) => !x.title.trim() || !valid(x));
    if (!rows.length) return setErr('Le déroulé doit compter au moins un moment.');
    if (bad >= 0) return setErr(`Moment ${bad + 1} : vérifiez l’heure, la durée (1 à 600 min) et le titre.`);
    setBusy(true);
    try {
      await onSave(rows.map((x) => ({ id: x.id, start: x.start, duration: Number(x.duration), title: x.title.trim() })));
      onClose();
    } catch (x) {
      setErr(x.message || 'Enregistrement impossible.');
      setBusy(false);
    }
  }

  return (
    <div className="modal">
      <div className="dr-scrim" onClick={onClose} />
      <form className="modal-card modal-wide" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="run-h" noValidate>
        <h2 id="run-h">Déroulé du 30 octobre</h2>
        <p className="hint">Modifiez l’heure, la durée et le titre de chaque moment. Le chantier rattaché prend le nouveau titre, ses actions restent en place.</p>
        <div className="seg-list">
          <div className="seg-row seg-headrow" aria-hidden="true"><span>Début</span><span>Durée</span><span>Titre du moment</span><span /></div>
          {rows.map((x, i) => {
            const n = x.id ? counts[x.id] || 0 : 0;
            return (
              <div className="seg-row" key={x.id || 'new' + i}>
                <label className="sr" htmlFor={`sg-t-${i}`}>Début du moment {i + 1}</label>
                <input className="inp" id={`sg-t-${i}`} type="time" step="60" value={x.start} onChange={(e) => set(i, 'start', e.target.value)} />
                <label className="sr" htmlFor={`sg-d-${i}`}>Durée en minutes</label>
                <span className="seg-dur"><input className="inp" id={`sg-d-${i}`} type="number" min="1" max="600" inputMode="numeric" value={x.duration} onChange={(e) => set(i, 'duration', e.target.value)} /><span>min</span></span>
                <label className="sr" htmlFor={`sg-l-${i}`}>Titre du moment</label>
                <input className="inp seg-title" id={`sg-l-${i}`} value={x.title} placeholder="Ex. : Visite du FabLab" onChange={(e) => set(i, 'title', e.target.value)} />
                <button type="button" className="btn btn-ghost seg-del" onClick={() => remove(i)} disabled={n > 0}
                  title={n ? `${n} action${n > 1 ? 's' : ''} rattachée${n > 1 ? 's' : ''} : déplacez-les avant de retirer ce moment` : 'Retirer ce moment'}>Retirer</button>
                {valid(x) && (
                  <span className="seg-note">
                    Fin {fmtTime(endOf({ start: x.start, duration: Number(x.duration) }))}
                    {n ? ` · ${n} action${n > 1 ? 's' : ''}` : ''}
                    {overlaps.has(x) ? ' · chevauche le moment précédent' : ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <button type="button" className="btn" onClick={add} style={{ justifySelf: 'start' }}>+ Ajouter un moment</button>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="modal-foot">
          <span className="seg-sum">{first != null ? `${fmtTime(fromMin(first))} → ${fmtTime(fromMin(last))} · ${last - first} min` : ''}</span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-accent" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le déroulé'}</button>
        </div>
      </form>
    </div>
  );
}
