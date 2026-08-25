import { useState } from 'react';
import { Fingerprint, Loader2, ShieldCheck } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';

export default function PasskeyPrompt({ token, onDone }: { token: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activate = async () => {
    setLoading(true);
    setError('');
    try {
      const optionsResponse = await fetch('/api/auth/passkeys/client/register/options', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const optionsData = await optionsResponse.json() as { options?: Parameters<typeof startRegistration>[0]['optionsJSON']; requestId?: string; error?: string };
      if (!optionsResponse.ok || !optionsData.options || !optionsData.requestId) throw new Error(optionsData.error ?? 'Não foi possível preparar a biometria.');
      const credential = await startRegistration({ optionsJSON: optionsData.options });
      const verifyResponse = await fetch('/api/auth/passkeys/client/register/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId: optionsData.requestId, response: credential }),
      });
      if (!verifyResponse.ok) {
        const data = await verifyResponse.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Não foi possível ativar a biometria.');
      }
      onDone();
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : 'Biometria cancelada.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-stone-900 shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600"><Fingerprint size={25} /></div>
        <h2 className="text-xl font-bold">Ative a biometria</h2>
        <p className="mt-2 text-sm text-stone-500">Entre mais rápido usando a biometria ou o PIN do seu dispositivo.</p>
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button type="button" onClick={() => void activate()} disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 font-semibold text-white disabled:opacity-60">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck size={17} />}
          {loading ? 'Ativando...' : 'Ativar agora'}
        </button>
        <button type="button" onClick={onDone} disabled={loading} className="mt-2 w-full py-2 text-sm text-stone-500 hover:text-stone-800">Agora não</button>
      </div>
    </div>
  );
}
