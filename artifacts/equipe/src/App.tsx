/**
 * MIAR AI/FOOD — App Único da Equipe
 *
 * Um só app, sem nome fixo. O funcionário entra com o PIN.
 * O sistema lê o papel (role) e as permissões (permissions) que o
 * proprietário configurou pra aquela pessoa — e monta a interface
 * exatamente com o que ela precisa, nada a mais.
 *
 * Cozinheiro → vê a cozinha.
 * Garçom    → vê as mesas e pedidos.
 * Caixa     → vê o caixa e as mesas pra cobrar.
 * Gerente   → vê tudo que tiver permissão.
 * Cargo customizado → vê só o que o dono marcou.
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Utensils } from 'lucide-react';
import { FloatingChat } from '@/components/FloatingChat';
import { IdiomaProvider, useTranslation } from './i18n/IdiomaContext';
import { ConfigFlutuante } from './i18n/ConfigFlutuante';

const queryClient = new QueryClient();

// Views carregadas sob demanda — só o que o cargo usa
const CozinhaView   = lazy(() => import('./views/CozinhaView'));
const GarcomView    = lazy(() => import('./views/GarcomView'));
const CaixaView     = lazy(() => import('./views/CaixaView'));

interface EmployeeSession {
  token: string;
  name: string;
  role: string;
  permissions: Record<string, boolean>;
}

const ROLE_LABEL: Record<string, string> = {
  cook:     'Cozinha',
  waiter:   'Garçom',
  cashier:  'Caixa',
  manager:  'Gerência',
  delivery: 'Entregador',
  owner:    'Proprietário',
  custom:   'Equipe',
};

// ─── Login ────────────────────────────────────────────────────────────────────

function PinLogin({ onLogin }: { onLogin: (s: EmployeeSession) => void }) {
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
      const res = await fetch('/api/auth/employee-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pin }),
      });
      if (!res.ok) { setErro(t('auth.pin.invalid')); return; }
      const data = await res.json();
      const session: EmployeeSession = {
        token: data.sessionToken,
        name: data.employee?.name ?? 'Equipe',
        role: data.role ?? data.employee?.role ?? 'custom',
        permissions: data.employee?.permissions ?? {},
      };
      const storage = remember ? localStorage : sessionStorage;
      const otherStorage = remember ? sessionStorage : localStorage;
      otherStorage.removeItem('miar-equipe-token'); otherStorage.removeItem('miar-equipe-session');
      storage.setItem('miar-equipe-token', session.token);
      storage.setItem('miar-equipe-session', JSON.stringify(session));
      onLogin(session);
    } catch { setErro('Não foi possível conectar. Tenta de novo.'); }
    finally { setCarregando(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/20">
            <Utensils className="h-8 w-8 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">{t('app.title')}</h1>
          <p className="mt-1 text-sm text-slate-400">{t('app.subtitle')}</p>
        </div>
        <form onSubmit={entrar} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
          <div className="relative"><input
            type={mostrarPin ? 'text' : 'password'}
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="••••••"
            autoFocus required
            className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center text-2xl tracking-widest text-slate-100 focus:border-violet-500 focus:outline-none"
          />
          <button type="button" onClick={() => setMostrarPin((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={mostrarPin ? 'Ocultar PIN' : 'Mostrar PIN'}>{mostrarPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>
          {erro && <p className="mb-3 text-sm text-red-400 text-center">{erro}</p>}
          <button
            type="submit" disabled={carregando}
            className="w-full rounded-xl bg-violet-500 py-3 font-semibold text-[#0d1b1a] transition hover:bg-violet-400 disabled:opacity-50"
          >
            {carregando ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : t('auth.button.enter')}
          </button>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-400"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Manter conectado neste aparelho</label>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Roteador de interface por permissão ──────────────────────────────────────

function InterfaceRouter({ session, onSair }: { session: EmployeeSession; onSair: () => void }) {
  const { t } = useTranslation();
  const p = session.permissions;

  // Determina a interface principal pelo que o funcionário pode ver
  // Prioridade: cozinha → caixa → garçom → tela genérica
  const temCozinha = p.viewKitchen;
  const temCaixa   = p.viewCashier || p.closeCashier;
  const temMesas   = p.viewTables;

  // Gerente/owner: pode navegar entre as que tem acesso
  const modulos = [
    temCozinha && { id: 'cozinha', label: 'Cozinha' },
    temCaixa   && { id: 'caixa',   label: 'Caixa'   },
    temMesas   && { id: 'mesas',   label: 'Mesas'   },
  ].filter(Boolean) as { id: string; label: string }[];

  const [ativo, setAtivo] = useState(modulos[0]?.id ?? 'sem-acesso');

  if (modulos.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-400 gap-4">
        <Utensils className="h-12 w-12 text-slate-700" />
        <p className="text-sm">{t('module.no.access')}</p>
        <p className="text-xs">{t('module.no.access.help')}</p>
        <button onClick={onSair} className="mt-4 rounded-xl bg-slate-800 px-6 py-2 text-sm text-slate-300 hover:bg-slate-700">
          {t('common.sair')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {/* Barra de cargo — aparece só se tiver mais de um módulo */}
      {modulos.length > 1 && (
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2">
          <span className="text-xs text-slate-400">
            {session.name} · {ROLE_LABEL[session.role] ?? 'Equipe'}
          </span>
          <div className="flex gap-1">
            {modulos.map(m => (
              <button
                key={m.id}
                onClick={() => setAtivo(m.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  ativo === m.id ? 'bg-violet-500 text-[#0d1b1a]' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {m.label}
              </button>
            ))}
            <button onClick={onSair} className="ml-2 rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-800">
              Sair
            </button>
          </div>
        </div>
      )}

      {/* Interface ativa */}
      <Suspense fallback={
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      }>
        {ativo === 'cozinha' && <CozinhaView />}
        {ativo === 'caixa'   && <CaixaView />}
        {ativo === 'mesas'   && <GarcomView />}
      </Suspense>

      {/* Chat da MIAR flutuante (29/07/2026) — NÃO aparece no módulo Cozinha,
          que já tem a MIAR por voz, "VIP", sempre presente sem depender de
          chave. Nos outros módulos, só aparece se o gestor liberou a
          permissão useMiaChat pro cargo/pessoa. */}
      {ativo !== 'cozinha' && p.useMiaChat && (
        <FloatingChat getToken={() => session.token} />
      )}
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

function App() {
  const [session, setSession] = useState<EmployeeSession | null>(() => {
    const raw = localStorage.getItem('miar-equipe-session');
    if (raw) { try { return JSON.parse(raw); } catch { /* corrompida */ } }
    return null; // exige login por PIN
  });

  // Renova o token automaticamente a cada 90 minutos (token dura 2h).
  useEffect(() => {
    const id = setInterval(async () => {
      const current = localStorage.getItem('miar-equipe-token');
      if (!current) return;
      try {
        const r = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { Authorization: `Bearer ${current}` },
        });
        if (r.ok) {
          const { token: novoToken } = await r.json() as { token: string };
          localStorage.setItem('miar-equipe-token', novoToken);
          setSession(prev => prev ? { ...prev, token: novoToken } : prev);
        }
      } catch { /* retry no próximo ciclo */ }
    }, 90 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const sair = () => {
    localStorage.removeItem('miar-equipe-token');
    localStorage.removeItem('miar-equipe-session');
    setSession(null);
  };

  return (
    <IdiomaProvider>
      <QueryClientProvider client={queryClient}>
        {session
          ? <InterfaceRouter session={session} onSair={sair} />
          : <PinLogin onLogin={setSession} />
        }
        <ConfigFlutuante />
      </QueryClientProvider>
    </IdiomaProvider>
  );
}

export default App;
