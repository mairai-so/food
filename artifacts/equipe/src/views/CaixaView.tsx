import { useState, useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { motion } from 'framer-motion';
import { Banknote, Eye, EyeOff } from 'lucide-react';
import { apiPost, setSessao, limparSessao, getToken } from '../caixa/api';
import BarraTurno from '../caixa/BarraTurno';
import PainelPrincipal from '../caixa/PainelPrincipal';
import CaixaFlutuante, { type ContextoCaixa } from '../caixa/CaixaFlutuante';
import PainelRecados from '../caixa/PainelRecados';


function PinLogin({ onLogin }: { onLogin: () => void }) {
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mostrarPin, setMostrarPin] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true); setErro('');
    try {
      const data = await apiPost<{ sessionToken: string; employee: { name: string } }>(
        '/auth/employee-login',
        { token: pin }
      );
      setSessao(data.sessionToken, data.employee?.name ?? 'Caixa');
      onLogin();
    } catch {
      setErro('PIN inválido.');
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
          <h1 className="text-2xl font-bold text-slate-100">Miar Caixa</h1>
          <p className="mt-1 text-sm text-slate-400">Mesas, retiradas e balcão</p>
        </div>
        <form onSubmit={entrar} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
          <label className="mb-2 block text-sm font-medium text-slate-300">PIN de acesso</label>
          <div className="relative"><input
            type={mostrarPin ? 'text' : 'password'} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••••"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center text-2xl tracking-widest text-slate-100 focus:border-violet-500 focus:outline-none"
            autoFocus required
          />
          <button type="button" onClick={() => setMostrarPin((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={mostrarPin ? 'Ocultar PIN' : 'Mostrar PIN'}>{mostrarPin ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
          {erro && <p className="mt-3 text-sm text-red-400">{erro}</p>}
          <button type="submit" disabled={carregando}
            className="mt-4 w-full rounded-xl bg-violet-500 py-3 font-semibold text-[#0d1b1a] transition hover:bg-violet-400 disabled:opacity-50">
            {carregando ? 'Verificando…' : 'Entrar no Caixa'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function CaixaApp({ onSair }: { onSair: () => void }) {
  const [contexto, setContexto] = useState<ContextoCaixa | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const concluir = () => {
    setContexto(null);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <BarraTurno onSair={onSair} />
      <PainelPrincipal key={refreshKey} onAbrirCaixa={setContexto} />
      {contexto && (
        <CaixaFlutuante contexto={contexto} onFechar={() => setContexto(null)} onConcluido={concluir} />
      )}
      <PainelRecados />
    </div>
  );
}

function App() {
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    if (getToken()) setLogado(true);
  }, []);

  return (
    <>
      {logado ? (
        <CaixaApp onSair={() => { limparSessao(); setLogado(false); }} />
      ) : (
        <PinLogin onLogin={() => setLogado(true)} />
      )}
      <Toaster />
    </>
  );
}

export { App as default };
