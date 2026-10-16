'use client';
import { useEffect, useState } from 'react';
import Squares from './Squares';

// Écran d'entrée : nom + code d'accès commun. Aucun compte, aucun email.
export default function Lock() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { const n = localStorage.getItem('matrixodc.name'); if (n) setName(n); } catch (e) {}
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const r = await fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, code })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || 'Connexion impossible.'); setBusy(false); return; }
      try { localStorage.setItem('matrixodc.name', name.trim()); } catch (e2) {}
      window.location.reload();
    } catch (e3) {
      setErr('Connexion impossible. Vérifiez votre réseau et réessayez.');
      setBusy(false);
    }
  }

  return (
    <div className="lock">
      <form className="lock-card" onSubmit={submit} autoComplete="off">
        <Squares />
        <div className="wordmark">Matrix<b>ODC</b></div>
        <p className="lock-sub">Outil de pilotage ODC. Saisissez votre nom et le code reçu avec le lien.</p>
        <label htmlFor="lk-name">Votre nom</label>
        <input className="inp" id="lk-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom Nom" autoComplete="name" />
        <label htmlFor="lk-code">Code d’accès</label>
        <input className="inp code" id="lk-code" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" spellCheck={false} />
        {err && <p className="lock-err" role="alert">{err}</p>}
        <button className="btn btn-accent" style={{ height: 44 }} disabled={busy} type="submit">{busy ? 'Connexion…' : 'Entrer'}</button>
        <p className="lock-foot">Votre nom apparaît dans l’historique des mises à jour.</p>
      </form>
    </div>
  );
}
