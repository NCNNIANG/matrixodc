import { cookies } from 'next/headers';
import { COOKIE, readToken, configProblem } from '@/lib/session';
import { listAll } from '@/lib/store';
import Lock from '@/components/Lock';
import MatrixApp from '@/components/MatrixApp';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const missing = configProblem();
  if (missing.length) {
    return (
      <div className="lock">
        <div className="lock-card">
          <div className="wordmark">Matrix<b>ODC</b></div>
          <p className="lock-sub">Configuration incomplète. Ajoutez dans Vercel, rubrique Environment Variables : {missing.join(', ')}. Puis relancez le déploiement.</p>
        </div>
      </div>
    );
  }
  const session = readToken(cookies().get(COOKIE)?.value);
  if (!session) return <Lock />;
  let initial = { actions: [], activity: [] };
  let dbError = false;
  try {
    initial = await listAll();
  } catch (e) {
    console.error(e);
    dbError = true;
  }
  return <MatrixApp initial={initial} session={session} dbError={dbError} />;
}
