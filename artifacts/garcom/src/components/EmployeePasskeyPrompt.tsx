import { useState } from 'react';
import { Fingerprint, Loader2, ShieldCheck } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';

export function EmployeePasskeyPrompt({ token, onDone }: { token: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const activate = async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/auth/passkeys/employee/register/options', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json() as { options?: Parameters<typeof startRegistration>[0]['optionsJSON']; requestId?: string; error?: string };
      if (!response.ok || !data.options || !data.requestId) throw new Error(data.error ?? 'Não foi possível preparar a biometria.');
      const credential = await startRegistration({ optionsJSON: data.options });
      const verified = await fetch('/api/auth/passkeys/employee/register/verify', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ requestId: data.requestId, response: credential }) });
      if (!verified.ok) throw new Error('Não foi possível ativar a biometria.');
      onDone();
    } catch (activationError) { setError(activationError instanceof Error ? activationError.message : 'Biometria cancelada.'); }
    finally { setLoading(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-sm rounded-2xl bg-slate-900 p-6 text-slate-100 shadow-2xl"><Fingerprint className="mb-4 text-sky-300" size={28} /><h2 className="text-xl font-bold">Ative a biometria</h2><p className="mt-2 text-sm text-slate-400">Use a biometria ou o PIN do dispositivo no próximo acesso.</p>{error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}<button type="button" onClick={() => void activate()} disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 font-semibold text-slate-950 disabled:opacity-60">{loading ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />} {loading ? 'Ativando...' : 'Ativar agora'}</button><button type="button" onClick={onDone} disabled={loading} className="mt-2 w-full py-2 text-sm text-slate-400">Agora não</button></div></div>;
}
