import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { motion, AnimatePresence } from 'framer-motion';
import { Bike, MapPin, Package, CheckCircle2, Clock, LogOut, RefreshCw, Navigation, ToggleLeft, ToggleRight } from 'lucide-react';
import { IdiomaProvider, useTranslation } from './i18n/IdiomaContext';
import { ConfigFlutuante } from './i18n/ConfigFlutuante';

const queryClient = new QueryClient();

type Order = {
  id: string; customerName: string; restaurantName: string; address?: string; phone?: string;
  status: string; total: number; createdAt: string; mode?: string;
};

function elapsed(createdAt: string) {
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  return diff < 1 ? 'agora' : `${diff}min`;
}

function TokenLogin({ onLogin, initialError }: { onLogin: (token: string, name: string, remember: boolean) => void; initialError?: string }) {
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const [error, setError] = useState(initialError ?? '');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) { setError(t('auth.token.required')); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/employee-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? t('auth.token.invalid')); return;
      }
      const data = await res.json();
      // Servidor retorna { sessionToken, employee: { name, ... } }
      onLogin(data.sessionToken ?? token, data.employee?.name ?? 'Entregador', remember);
    } catch { setError(t('auth.error.connection')); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/20">
            <Bike className="h-8 w-8 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">{t('app.name')}</h1>
          <p className="mt-1 text-sm text-slate-400">{t('app.subtitle')}</p>
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
          <label className="mb-2 block text-sm font-medium text-slate-300">{t('auth.token.label')}</label>
          <input
            type="text" value={token} onChange={e => setToken(e.target.value)} placeholder={t('auth.token.placeholder')}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
            autoFocus required
          />
          <p className="mt-2 text-xs text-slate-500">{t('auth.token.helper')}</p>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="mt-4 w-full rounded-xl bg-orange-500 py-3 font-semibold text-white transition hover:bg-orange-400 disabled:opacity-50">
            {loading ? t('auth.button.verifying') : t('auth.button.enter')}
          </button>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-400"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Manter conectado neste aparelho</label>
        </form>
      </motion.div>
    </div>
  );
}

function DeliveryBoard({ token, name, onLogout }: { token: string; name: string; onLogout: () => void }) {
  const { t } = useTranslation();
  const [available, setAvailable] = useState<Order[]>([]);
  const [active, setActive] = useState<Order[]>([]);
  const [completed, setCompleted] = useState<Order[]>([]);
  const [isAvailable, setIsAvailable] = useState<boolean>(() => {
    const saved = localStorage.getItem('miar-entregador-disponivel');
    return saved === null ? true : saved === 'true';
  });

  const authHeaders = { 'Authorization': `Bearer ${token}` };

  const toggleAvailability = () => {
    setIsAvailable(prev => {
      const next = !prev;
      localStorage.setItem('miar-entregador-disponivel', String(next));
      return next;
    });
  };

  const load = useCallback(async () => {
    const res = await fetch('/api/operational-workflow/orders', { headers: authHeaders });
    if (!res.ok) return;
    const orders: Order[] = await res.json();
    setAvailable(orders.filter(o => o.status === 'ready' && o.mode === 'delivery'));
    setActive(orders.filter(o => o.status === 'delivering'));
    setCompleted(orders.filter(o => o.status === 'completed').slice(0, 5));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); const t = setInterval(() => void load(), 8000); return () => clearInterval(t); }, [load]);

  const accept = async (id: string) => {
    await fetch(`/api/operational-workflow/orders/${id}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ stage: 'delivery' }),
    });
    await load();
  };

  const delivered = async (id: string) => {
    await fetch(`/api/operational-workflow/orders/${id}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ stage: 'delivered' }),
    });
    await load();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/20">
            <Bike className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-orange-400">Miar</p>
            <p className="text-sm font-semibold">Entregador • {name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle disponibilidade */}
          <button
            onClick={toggleAvailability}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              isAvailable
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {isAvailable
              ? <><ToggleRight className="h-4 w-4" /> {t('delivery.available')}</>
              : <><ToggleLeft className="h-4 w-4" /> {t('delivery.unavailable')}</>
            }
          </button>
          <button onClick={() => void load()} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={onLogout} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      {/* Aviso de indisponível */}
      {!isAvailable && (
        <div className="mx-4 mt-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-center">
          <ToggleLeft className="mx-auto mb-2 h-8 w-8 text-slate-500" />
          <p className="font-semibold text-slate-300">{t('delivery.status.unavailable')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('delivery.hidden')}</p>
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3 text-center">
          <p className={`text-2xl font-bold ${isAvailable ? 'text-orange-400' : 'text-slate-500'}`}>
            {isAvailable ? available.length : '—'}
          </p>
          <p className="text-xs text-slate-400">{t('delivery.summary.available')}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3 text-center">
          <p className="text-2xl font-bold text-sky-400">{active.length}</p>
          <p className="text-xs text-slate-400">{t('delivery.summary.active')}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400">{completed.length}</p>
          <p className="text-xs text-slate-400">{t('delivery.summary.completed')}</p>
        </div>
      </div>

      <div className="space-y-6 px-4 pb-8">
        {/* Corridas disponíveis — só aparecem quando disponível */}
        {isAvailable && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-orange-400">
              <Package className="h-4 w-4" /> Corridas disponíveis
            </h2>
            <div className="space-y-3">
              {available.length === 0 && <p className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-500">{t('delivery.no.orders')}</p>}
              <AnimatePresence>
                {available.map(order => (
                  <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 50 }}
                    className="rounded-2xl border border-orange-500/20 bg-slate-900 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-100">{order.customerName}</p>
                        <p className="text-sm text-slate-400">{order.restaurantName}</p>
                      </div>
                      <div className="flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-400">
                        <Clock className="h-3 w-3" />{elapsed(order.createdAt)}
                      </div>
                    </div>
                    {order.address && (
                      <div className="mt-2 flex items-center gap-1 text-sm text-slate-400">
                        <MapPin className="h-3.5 w-3.5 text-orange-400" />{order.address}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xl font-bold text-orange-400">R$ {order.total.toFixed(2)}</p>
                      <button onClick={() => void accept(order.id)}
                        className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400">
                        <Navigation className="h-4 w-4" /> {t('delivery.accept')}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Em rota */}
        {active.length > 0 && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-sky-400">
              <Navigation className="h-4 w-4" /> Em rota
            </h2>
            <div className="space-y-3">
              {active.map(order => (
                <motion.div key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="rounded-2xl border border-sky-500/20 bg-slate-900 p-4">
                  <p className="font-semibold text-slate-100">{order.customerName}</p>
                  {order.address && <p className="mt-1 flex items-center gap-1 text-sm text-slate-400"><MapPin className="h-3.5 w-3.5 text-sky-400" />{order.address}</p>}
                  {order.phone && <p className="mt-1 text-sm text-slate-400">Tel: {order.phone}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xl font-bold text-sky-400">R$ {order.total.toFixed(2)}</p>
                    <button onClick={() => void delivered(order.id)}
                      className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Entregue
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Histórico recente */}
        {completed.length > 0 && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Entregues recentemente
            </h2>
            <div className="space-y-2">
              {completed.map(order => (
                <div key={order.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{order.customerName}</p>
                    <p className="text-xs text-slate-500">{elapsed(order.createdAt)}</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-400">R$ {order.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('miar-entregador-token') ?? sessionStorage.getItem('miar-entregador-token') ?? '');
  const [name, setName] = useState(() => localStorage.getItem('miar-entregador-name') ?? sessionStorage.getItem('miar-entregador-name') ?? '');
  // Corrigido (20/08/2026) — achado testando o convite de verdade: o
  // backend já gera o link com o token embutido (/entregador/?token=...),
  // mas essa tela nunca olhava pra URL, só pra localStorage/digitação
  // manual. Resultado: quem clicava no link de convite caía numa tela
  // pedindo pra digitar um token que nunca tinha visto em lugar nenhum.
  const [autoLoginStatus, setAutoLoginStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [autoLoginError, setAutoLoginError] = useState('');

  const onLogin = (t: string, n: string, remember: boolean) => {
    const storage = remember ? localStorage : sessionStorage;
    const otherStorage = remember ? sessionStorage : localStorage;
    otherStorage.removeItem('miar-entregador-token'); otherStorage.removeItem('miar-entregador-name');
    storage.setItem('miar-entregador-token', t); storage.setItem('miar-entregador-name', n);
    setToken(t); setName(n);
  };
  const onLogout = () => { localStorage.removeItem('miar-entregador-token'); localStorage.removeItem('miar-entregador-name'); setToken(''); setName(''); };

  useEffect(() => {
    if (token) return; // já logado, não precisa de auto-login
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (!urlToken) return;
    setAutoLoginStatus('loading');
    fetch('/api/auth/employee-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: urlToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? 'Convite inválido ou expirado.');
        }
        return res.json();
      })
      .then((data) => {
        onLogin(data.sessionToken ?? urlToken, data.employee?.name ?? 'Entregador');
        // Remove o token da URL depois de usado — evita reenviar convite
        // por engano se a página for recarregada ou o link for repassado.
        window.history.replaceState({}, '', window.location.pathname);
        setAutoLoginStatus('idle');
      })
      .catch((err) => {
        setAutoLoginStatus('error');
        setAutoLoginError(err instanceof Error ? err.message : 'Não foi possível entrar com esse convite.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (autoLoginStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        Entrando com seu convite...
      </div>
    );
  }

  return (
    <IdiomaProvider>
      <QueryClientProvider client={queryClient}>
        {token ? (
          <DeliveryBoard token={token} name={name} onLogout={onLogout} />
        ) : (
          <TokenLogin onLogin={onLogin} initialError={autoLoginStatus === 'error' ? autoLoginError : undefined} />
        )}
        <ConfigFlutuante />
        <Toaster />
      </QueryClientProvider>
    </IdiomaProvider>
  );
}

export default App;
