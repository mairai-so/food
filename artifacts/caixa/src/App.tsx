import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { motion } from 'framer-motion';
import { Banknote, Eye, EyeOff, ShieldAlert, X } from 'lucide-react';
import { apiPost, setSessao, limparSessao, getToken } from './caixa/api';
import VanguardaCockpit from './caixa/VanguardaCockpit';
import PainelRecados from './caixa/PainelRecados';
import { CashCheckCamera } from './components/new-modules';
import { FloatingChat } from './components/FloatingChat';
import { IdiomaProvider, useTranslation } from './i18n/IdiomaContext';
import { ConfigFlutuante } from './i18n/ConfigFlutuante';
import { EmployeePasskeyPrompt } from './components/EmployeePasskeyPrompt';

const queryClient = new QueryClient();

function PinLogin({ onLogin }: { onLogin: () => void }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [remember, setRemember] = useState(true);
  const [mostrarPin, setMostrarPin] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) { setErro(t('auth.pin.required')); return; }
    setCarregando(true); setErro('');
    try {
      const data = await apiPost<{ sessionToken: string; employee: { name: string } }>(
        '/auth/employee-login',
        { token: pin },
      );
      setSessao(data.sessionToken, data.employee?.name ?? 'Caixa', remember);
      onLogin();
    } catch {
      setErro(t('auth.pin.invalid'));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/20">
            <Banknote className="h-8 w-8 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">{t('app.name')}</h1>
          <p className="mt-1 text-sm text-slate-400">{t('app.subtitle')}</p>
        </div>
        <form onSubmit={entrar} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
          <label className="mb-2 block text-sm font-medium text-slate-300">{t('auth.pin.label')}</label>
          <div className="relative">
          <input
            type={mostrarPin ? 'text' : 'password'} value={pin} onChange={(e) => setPin(e.target.value)} placeholder={t('auth.pin.placeholder')}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center text-2xl tracking-widest text-slate-100 focus:border-violet-500 focus:outline-none"
            autoFocus required
          />
          <button type="button" onClick={() => setMostrarPin((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={mostrarPin ? 'Ocultar PIN' : 'Mostrar PIN'}>
            {mostrarPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
          </div>
          {erro && <p className="mt-3 text-sm text-red-400">{erro}</p>}
          <button type="submit" disabled={carregando}
            className="mt-4 w-full rounded-xl bg-violet-500 py-3 font-semibold text-[#0d1b1a] transition hover:bg-violet-400 disabled:opacity-50">
            {carregando ? t('auth.button.verifying') : t('auth.button.enter')}
            <span className="sr-only">Entrar</span>
          </button>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            Manter conectado neste aparelho
          </label>
        </form>
      </motion.div>
    </div>
  );
}

function CaixaApp({ onSair }: { onSair: () => void }) {
  const { t } = useTranslation();
  const [mostrarConferencia, setMostrarConferencia] = useState(false);

  useEffect(() => {
    const id = setInterval(async () => {
      const token = getToken();
      if (!token) return;
      try {
        const r = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const { token: novoToken } = await r.json() as { token: string };
          localStorage.setItem('miar-caixa-token', novoToken);
        }
      } catch { /* retry no próximo ciclo */ }
    }, 90 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950">
      <VanguardaCockpit onSair={onSair} />
      <PainelRecados />

      <button
        onClick={() => setMostrarConferencia(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-amber-500 px-4 py-3 font-medium text-slate-950 shadow-lg transition hover:bg-amber-400"
      >
        <ShieldAlert className="h-5 w-5" />
        {t('checkout.button')}
      </button>

      {mostrarConferencia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">{t('checkout.title')}</h2>
              <button onClick={() => setMostrarConferencia(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <CashCheckCamera />
          </div>
        </div>
      )}

      <FloatingChat getToken={getToken} />
    </div>
  );
}

function App() {
  const [logado, setLogado] = useState(() => Boolean(localStorage.getItem('miar-caixa-token')));
  const [showPasskey, setShowPasskey] = useState(false);

  return (
    <IdiomaProvider>
      <QueryClientProvider client={queryClient}>
        {logado ? (
          <><CaixaApp onSair={() => { limparSessao(); setLogado(false); setShowPasskey(false); }} />
            {showPasskey && <EmployeePasskeyPrompt token={getToken()} onDone={() => { localStorage.setItem('miar-caixa-passkey-prompted', '1'); setShowPasskey(false); }} />}</>
        ) : (
          <PinLogin onLogin={() => { setLogado(true); if (!localStorage.getItem('miar-caixa-passkey-prompted')) setShowPasskey(true); }} />
        )}
        <ConfigFlutuante />
        <Toaster />
      </QueryClientProvider>
    </IdiomaProvider>
  );
}

export default App;
