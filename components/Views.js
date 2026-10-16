'use client';
import { useMemo, useRef, useState } from 'react';
import { ST, STMAP, PRIOMAP, MILESTONES, ROLE_LABELS, fmtTime, endOf, toMin } from '@/lib/constants';
import { todayISO, addDays, fmtDate, fmtRel, isLate, isSoon, byDue, plural, trunc, needsName } from '@/lib/format';

/* ---------- Petits éléments ---------- */
export const Pill = ({ st }) => <span className="pill" style={{ '--c': `var(--${st})` }}>{STMAP[st].l}</span>;
export const Prio = ({ p }) => (p === 'normale' ? null : <span className={`prio prio-${p}`}>{PRIOMAP[p].l}</span>);
export const Due = ({ a }) => {
  const late = isLate(a);
  return <span className={`due${late ? ' late' : ''}`}>{fmtDate(a.due)}{late ? ' · en retard' : ''}</span>;
};
const ownerTxt = (a) => a.owner || 'À désigner';
const Dot = ({ c }) => <span className="dot" style={{ '--c': `var(--${c})` }} />;

/* ---------- Vue 360 ---------- */
export function Vue360({ actions, activity, W, isAdmin, onEditRun, onJump, onOpen }) {
  const all = actions;
  const total = all.length;
  const count = (k) => all.filter((a) => a.status === k).length;
  const done = count('done'), doing = count('doing'), blocked = count('blocked');
  const late = all.filter(isLate);
  const soon = all.filter(isSoon).sort(byDue);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const t = todayISO();

  const matrix = useMemo(() => {
    const rows = W.list.map((w) => {
      const xs = all.filter((a) => a.ws === w.k);
      const c = {};
      ST.forEach((s) => { c[s.k] = xs.filter((a) => a.status === s.k).length; });
      return { w, xs, c };
    }).filter((r) => r.xs.length);
    const max = Math.max(1, ...rows.flatMap((r) => ST.map((s) => r.c[s.k])));
    return { rows, max };
  }, [all, W]);

  const segs = W.segments;
  const runStart = segs[0]?.start;
  const runEnd = segs.length ? segs.map(endOf).reduce((a, b) => (toMin(b) > toMin(a) ? b : a)) : null;
  const runMin = runStart && runEnd ? toMin(runEnd) - toMin(runStart) : 0;

  const blockedList = all.filter((a) => a.status === 'blocked').sort(byDue);
  const lateList = late.filter((a) => a.status !== 'blocked').sort(byDue);

  const owners = useMemo(() => {
    const m = new Map();
    all.forEach((a) => {
      const k = a.owner || '';
      if (!m.has(k)) m.set(k, { open: 0, blocked: 0, late: 0 });
      const o = m.get(k);
      if (a.status !== 'done') o.open++;
      if (a.status === 'blocked') o.blocked++;
      if (isLate(a)) o.late++;
    });
    return [...m.entries()].sort((a, b) => b[1].open - a[1].open || a[0].localeCompare(b[0], 'fr'));
  }, [all]);

  const Li = ({ a, c }) => (
    <button type="button" className="li" onClick={() => onOpen(a.id)}>
      <Dot c={c} />
      <span>
        <span className="li-t">{a.title}</span>
        <span className="li-s">{W.map[a.ws]?.l} · {ownerTxt(a)} · <Due a={a} /></span>
        {a.status === 'blocked' && a.blocker && <span className="li-b">Bloqué : {a.blocker}</span>}
      </span>
    </button>
  );

  return (
    <div className="stack">
      <div className="kpis">
        <button type="button" className="kpi" onClick={() => onJump({})}>
          <span className="kpi-l" style={{ '--c': 'var(--done)' }}>Avancement</span>
          <span className="kpi-v">{pct}<small>%</small></span>
          <span className="bar"><i style={{ width: pct + '%' }} /></span>
          <span className="kpi-s">{done} / {plural(total, 'action faite', 'actions faites')}</span>
        </button>
        <button type="button" className="kpi" onClick={() => onJump({ status: 'doing' })}>
          <span className="kpi-l" style={{ '--c': 'var(--doing)' }}>In Progress</span>
          <span className="kpi-v">{doing}</span>
          <span className="kpi-s">en cours de traitement</span>
        </button>
        <button type="button" className={`kpi${blocked ? ' alert' : ''}`} onClick={() => onJump({ status: 'blocked' })}>
          <span className="kpi-l" style={{ '--c': 'var(--blocked)' }}>Blocked</span>
          <span className="kpi-v">{blocked}</span>
          <span className="kpi-s">{blocked ? 'à débloquer en priorité' : 'aucun blocage'}</span>
        </button>
        <button type="button" className={`kpi${late.length ? ' alert' : ''}`} onClick={() => onJump({ when: 'late' })}>
          <span className="kpi-l" style={{ '--c': 'var(--accent)' }}>En retard</span>
          <span className="kpi-v">{late.length}</span>
          <span className="kpi-s">échéance dépassée</span>
        </button>
        <button type="button" className="kpi" onClick={() => onJump({ when: 'soon' })}>
          <span className="kpi-l" style={{ '--c': 'var(--todo)' }}>Sous 48 h</span>
          <span className="kpi-v">{soon.length}</span>
          <span className="kpi-s">à boucler d’ici {fmtDate(addDays(t, 2))}</span>
        </button>
      </div>

      <section>
        <div className="run-head">
          <h2 className="sec-h">Déroulé du 30 octobre {runStart && <span>{fmtTime(runStart)} → {fmtTime(runEnd)} · {runMin} minutes · avancement par moment</span>}</h2>
          {isAdmin && <button type="button" className="btn btn-ghost run-edit" onClick={onEditRun}>Modifier le déroulé</button>}
        </div>
        <div className="run">
          {segs.map((sg) => {
            const xs = all.filter((a) => a.ws === sg.id);
            const d = xs.filter((a) => a.status === 'done').length;
            const b = xs.filter((a) => a.status === 'blocked').length;
            const p = xs.length ? Math.round((d / xs.length) * 100) : 0;
            return (
              <button type="button" key={sg.id} className="run-seg" style={{ '--m': sg.duration }} onClick={() => onJump({ ws: sg.id })}>
                <span className="run-t">{fmtTime(sg.start)} <small>{sg.duration} min</small></span>
                <span className="run-l">{sg.title}</span>
                <span className="bar"><i style={{ width: p + '%' }} /></span>
                <span className="run-n">{d}/{xs.length}{b ? <> · <em>{plural(b, 'bloquée', 'bloquées')}</em></> : null}</span>
              </button>
            );
          })}
        </div>
        {runStart && <div className="run-axis" aria-hidden="true"><span>{fmtTime(runStart)}</span><span>{fmtTime(runEnd)}</span></div>}
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2 className="sec-h">Matrice chantiers × statuts <span>cliquez une case pour ouvrir les actions</span></h2>
          <div className="mx-wrap">
            <table className="mx">
              <thead>
                <tr>
                  <th scope="col">Chantier</th>
                  {ST.map((s) => <th scope="col" key={s.k}><Dot c={s.k} />{s.l}</th>)}
                  <th scope="col">Avancement</th>
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map(({ w, xs, c }) => {
                  const p = Math.round((c.done / xs.length) * 100);
                  return (
                    <tr key={w.k}>
                      <th scope="row" className="mx-ws"><button type="button" onClick={() => onJump({ ws: w.k })}>{w.l}</button></th>
                      {ST.map((s) => {
                        const v = c[s.k];
                        const a = v ? 0.14 + (0.42 * v) / matrix.max : 0;
                        return (
                          <td key={s.k}>
                            <button type="button" className={`mx-c${v ? '' : ' is-zero'}`} style={{ '--c': `var(--${s.k})`, '--a': a.toFixed(2) }}
                              disabled={!v} tabIndex={v ? 0 : -1} aria-label={`${v} ${s.l}, ${w.l}`}
                              onClick={() => v && onJump({ ws: w.k, status: s.k })}>{v || '·'}</button>
                          </td>
                        );
                      })}
                      <td><div className="mx-p"><span className="bar"><i style={{ width: p + '%' }} /></span><span>{p}%</span></div></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td />
                  {ST.map((s) => <td key={s.k}>{count(s.k)}</td>)}
                  <td style={{ textAlign: 'left', paddingLeft: 14 }}>{pct}% global</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="panel">
          <h2 className="sec-h">Points d’attention <span>{plural(blockedList.length, 'blocage', 'blocages')} · {lateList.length} en retard</span></h2>
          {blockedList.length || lateList.length ? (
            <>
              <div className="list">
                {blockedList.slice(0, 8).map((a) => <Li key={a.id} a={a} c="blocked" />)}
                {lateList.slice(0, 8).map((a) => <Li key={a.id} a={a} c="accent" />)}
              </div>
              {blockedList.length > 8 && <button type="button" className="more" onClick={() => onJump({ status: 'blocked' })}>Voir les {blockedList.length} blocages</button>}
              {lateList.length > 8 && <button type="button" className="more" onClick={() => onJump({ when: 'late' })}>Voir les {late.length} actions en retard</button>}
            </>
          ) : <p className="none">Aucun blocage ni retard. Rien ne demande d’arbitrage pour l’instant.</p>}
        </section>
      </div>

      <div className="grid-4">
        <section className="panel">
          <h2 className="sec-h">Échéances sous 48 h <span>{soon.length}</span></h2>
          {soon.length ? (
            <>
              <div className="list">{soon.slice(0, 10).map((a) => <Li key={a.id} a={a} c={a.status} />)}</div>
              {soon.length > 10 && <button type="button" className="more" onClick={() => onJump({ when: 'soon' })}>Voir les {soon.length} actions</button>}
            </>
          ) : <p className="none">Aucune échéance dans les 48 prochaines heures.</p>}
        </section>

        <section className="panel">
          <h2 className="sec-h">Charge par porteur</h2>
          <table className="tbl">
            <thead><tr><th scope="col">Porteur</th><th scope="col">Ouvertes</th><th scope="col">Bloquées</th><th scope="col">Retard</th></tr></thead>
            <tbody>
              {owners.map(([k, o]) => (
                <tr key={k || '_'}>
                  <td>{k ? <button type="button" onClick={() => onJump({ owner: k })}>{k}</button> : 'À désigner'}</td>
                  <td>{o.open}</td>
                  <td className={o.blocked ? 'hot' : ''}>{o.blocked}</td>
                  <td className={o.late ? 'hot' : ''}>{o.late}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2 className="sec-h">Jalons</h2>
          <div className="ms">
            {MILESTONES.map(([d, l, key]) => {
              const st = d < t ? 'past' : d === t ? 'today' : '';
              return [
                <span key={d + 'd'} className="d">{fmtDate(d)}</span>,
                <span key={d + 'm'} className={`m ${st}`} />,
                <span key={d + 't'} className={`t ${st}${key ? ' key' : ''}`}>{key && runStart ? `${l} ${fmtTime(runStart)}` : l}</span>
              ];
            })}
          </div>
        </section>

        <section className="panel">
          <h2 className="sec-h">Activité récente</h2>
          {activity.length ? (
            <div className="list">
              {activity.slice(0, 8).map((e) => {
                const exists = e.action_id && all.some((a) => a.id === e.action_id);
                const body = (
                  <>
                    <Dot c="todo" />
                    <span>
                      <span className="li-t">{e.action_title ? trunc(e.action_title, 80) : e.what}</span>
                      <span className="li-s">{e.who || 'Un membre'} · {e.action_title ? e.what + ' · ' : ''}{fmtRel(e.at)}</span>
                    </span>
                  </>
                );
                return exists
                  ? <button type="button" key={e.id} className="li" onClick={() => onOpen(e.action_id)}>{body}</button>
                  : <div key={e.id} className="li">{body}</div>;
              })}
            </div>
          ) : <p className="none">Les mises à jour de l’équipe s’afficheront ici.</p>}
        </section>
      </div>
    </div>
  );
}

/* ---------- Kanban ---------- */
export function Kanban({ items, W, canDrag, onOpen, onStatus }) {
  const dragId = useRef(null);
  const [over, setOver] = useState('');
  const [dragging, setDragging] = useState('');
  return (
    <div className="board-wrap">
      <div className="board">
        {ST.map((s) => {
          const list = items.filter((a) => a.status === s.k).sort(byDue);
          return (
            <section key={s.k} className="col" style={{ '--c': `var(--${s.k})` }} aria-label={s.l}>
              <header className="col-h"><Dot c={s.k} /><h3>{s.l}</h3><span className="col-n">{list.length}</span></header>
              <div
                className={`col-b${over === s.k ? ' over' : ''}`}
                onDragOver={(e) => { if (!dragId.current) return; e.preventDefault(); setOver(s.k); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(''); }}
                onDrop={(e) => { e.preventDefault(); const id = dragId.current; dragId.current = null; setOver(''); setDragging(''); if (id) onStatus(id, s.k); }}
              >
                {list.length ? list.map((a) => (
                  <article
                    key={a.id}
                    className={`card${dragging === a.id ? ' dragging' : ''}`}
                    draggable={canDrag}
                    tabIndex={0}
                    aria-label={a.title}
                    onDragStart={(e) => { dragId.current = a.id; setDragging(a.id); try { e.dataTransfer.setData('text/plain', a.id); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} }}
                    onDragEnd={() => { dragId.current = null; setDragging(''); setOver(''); }}
                    onClick={(e) => { if (e.target.closest('select')) return; onOpen(a.id); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) { e.preventDefault(); onOpen(a.id); } }}
                  >
                    <div className="card-top"><span className="tag">{W.map[a.ws]?.l}</span><Prio p={a.prio} /></div>
                    <p className="card-t">{a.title}</p>
                    {a.status === 'blocked' && a.blocker && <p className="card-b">Bloqué : {a.blocker}</p>}
                    <div className="card-m"><span className="owner">{ownerTxt(a)}</span><Due a={a} /></div>
                    <label className="sr" htmlFor={`cs-${a.id}`}>Statut de l’action</label>
                    <select className="card-st" id={`cs-${a.id}`} value={a.status} onChange={(e) => onStatus(a.id, e.target.value)}>
                      {ST.map((x) => <option key={x.k} value={x.k}>{x.l}</option>)}
                    </select>
                  </article>
                )) : <p className="col-empty">Aucune action</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Checklist ---------- */
export function Checklist({ items, all, W, collapsed, onToggleGroup, onOpen, onStatus, onReset }) {
  const groups = W.list.map((w) => {
    const list = items.filter((a) => a.ws === w.k).sort(byDue);
    if (!list.length) return null;
    const allW = all.filter((a) => a.ws === w.k);
    const d = allW.filter((a) => a.status === 'done').length;
    const p = Math.round((d / allW.length) * 100);
    const open = !collapsed.has(w.k);
    return (
      <section className="grp" key={w.k}>
        <button type="button" className="grp-h" aria-expanded={open} onClick={() => onToggleGroup(w.k)}>
          <span className="chev" aria-hidden="true" />
          <span className="grp-l">{w.l}</span>
          <span className="grp-n">{d}/{allW.length}{list.length !== allW.length ? ` · ${list.length} affichées` : ''}</span>
          <span className="bar"><i style={{ width: p + '%' }} /></span>
        </button>
        {open && (
          <ul className="rows">
            {list.map((a) => (
              <li key={a.id} className={`row st-${a.status}`}>
                <span className="chk">
                  <input type="checkbox" id={`ck-${a.id}`} checked={a.status === 'done'} aria-label={`Marquer comme fait : ${a.title}`}
                    onChange={(e) => onStatus(a.id, e.target.checked ? 'done' : 'todo')} />
                  <span className="box" aria-hidden="true" />
                </span>
                <button type="button" className="row-b" onClick={() => onOpen(a.id)}>
                  <span className="row-t">{a.title}</span>
                  {a.status === 'blocked' && a.blocker && <span className="row-bl">Bloqué : {a.blocker}</span>}
                  <span className="row-m"><Prio p={a.prio} /><span>{ownerTxt(a)}</span><Due a={a} />{a.note ? <span>Note</span> : null}</span>
                </button>
                <Pill st={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }).filter(Boolean);
  if (!groups.length) {
    return (
      <div className="state">
        <h2>Aucune action ne correspond</h2>
        <p>Modifiez la recherche ou effacez les filtres.</p>
        <button className="btn" type="button" onClick={onReset}>Effacer les filtres</button>
      </div>
    );
  }
  return <div>{groups}</div>;
}

/* ---------- Affectation (admin) ---------- */
const ROLES = new Set(ROLE_LABELS);
export function Affectation({ all, items, W, onOwner, onDue, onReplace, onOpen }) {
  const [drafts, setDrafts] = useState({});
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const m = new Map();
    all.forEach((a) => { if (a.owner) m.set(a.owner, (m.get(a.owner) || 0) + 1); });
    return m;
  }, [all]);
  const roles = [...counts.keys()].sort((a, b) => (ROLES.has(b) - ROLES.has(a)) || a.localeCompare(b, 'fr'));
  const fromValue = roles.includes(from) ? from : (roles.find((r) => ROLES.has(r)) || roles[0] || '');
  const toName = all.filter(needsName).length;

  async function replace() {
    if (busy) return;
    setBusy(true);
    const ok = await onReplace(fromValue, to.trim());
    setBusy(false);
    if (ok) { setTo(''); setFrom(''); }
  }

  function commitOwner(a) {
    const v = drafts[a.id];
    if (v === undefined) return;
    setDrafts((d) => { const n = { ...d }; delete n[a.id]; return n; });
    if (v.trim() !== a.owner) onOwner(a.id, v.trim());
  }

  const groups = W.list.map((w) => {
    const list = items.filter((a) => a.ws === w.k).sort(byDue);
    if (!list.length) return null;
    return (
      <section key={w.k}>
        <h3 className="as-gh">{w.l} <span>{list.length}</span></h3>
        <ul className="as-rows">
          {list.map((a) => (
            <li key={a.id} className={`as-row${needsName(a) ? ' is-role' : ''}`}>
              <button type="button" className="as-t" onClick={() => onOpen(a.id)}>{a.title}</button>
              <label className="sr" htmlFor={`ao-${a.id}`}>Porteur de l’action</label>
              <input className="inp as-owner" id={`ao-${a.id}`} list="owners-dl" placeholder="Nom du porteur" autoComplete="off"
                value={drafts[a.id] ?? a.owner}
                onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
                onBlur={() => commitOwner(a)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
              <label className="sr" htmlFor={`ad-${a.id}`}>Échéance</label>
              <input className="inp as-due" id={`ad-${a.id}`} type="date" value={a.due || ''}
                onChange={(e) => { const v = e.target.value; if (v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v)) onDue(a.id, v); }} />
              <Pill st={a.status} />
            </li>
          ))}
        </ul>
      </section>
    );
  }).filter(Boolean);

  return (
    <div className="stack" style={{ gap: 8 }}>
      <section className="panel as-tools">
        <p className="as-sum"><strong>{all.length - toName}</strong> / {all.length} actions ont un porteur nommé · {plural(toName, 'action encore affectée', 'actions encore affectées')} à un rôle</p>
        <h2 className="sec-h" style={{ margin: '6px 0 0' }}>Remplacer un rôle par un nom <span>sur toutes ses actions en une fois</span></h2>
        <div className="tools-row">
          <label className="sr" htmlFor="rp-from">Rôle ou porteur actuel</label>
          <select className="inp" id="rp-from" value={fromValue} onChange={(e) => setFrom(e.target.value)}>
            {roles.map((r) => <option key={r} value={r}>{r} ({counts.get(r)})</option>)}
          </select>
          <span className="arrow" aria-hidden="true">→</span>
          <label className="sr" htmlFor="rp-to">Nom du porteur</label>
          <input className="inp" id="rp-to" list="owners-dl" placeholder="Prénom Nom du porteur" autoComplete="off" value={to}
            onChange={(e) => setTo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); replace(); } }} />
          <button className="btn btn-accent" type="button" onClick={replace} disabled={busy || !to.trim() || !fromValue}>{busy ? 'Remplacement…' : 'Remplacer partout'}</button>
        </div>
        <p className="hint">Pour une action précise, saisissez le porteur dans sa ligne ; l’enregistrement se fait en quittant le champ.</p>
      </section>
      {groups.length ? groups : <p className="none">Aucune action ne correspond aux filtres.</p>}
    </div>
  );
}
