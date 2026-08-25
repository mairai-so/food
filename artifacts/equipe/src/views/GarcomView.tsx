import { useState, useEffect, useCallback } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { motion, AnimatePresence } from 'framer-motion';
import { UtensilsCrossed, Bell, CheckCircle2, RefreshCw, LogOut, AlertCircle, Eye, EyeOff } from 'lucide-react';


type Order = {
  id: string; customerName: string; restaurantName: string; status: string;
  total: number; createdAt: string; mode?: string;
};
type Alert = { id: string; tableNumber?: number; type: string; message: string; createdAt: string; resolved: boolean };

function elapsed(createdAt: string) {
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  return diff < 1 ? 'agora' : `${diff}min`;
}

function PinLogin({ onLogin }: { onLogin: (token: string, name: string) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/employee-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pin }),
      });
      if (!res.ok) { setError('PIN inválido.'); return; }
      const data = await res.json();
      onLogin(data.token ?? pin, data.name ?? 'Garçom');
    } catch { setError('Erro de conexão.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/20">
            <UtensilsCrossed className="h-8 w-8 text-sky-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Miar Garçom</h1>
          <p className="mt-1 text-sm text-slate-400">Atendimento e pedidos</p>
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
          <label className="mb-2 block text-sm font-medium text-slate-300">PIN de acesso</label>
          <div className="relative"><input
            type={showPin ? 'text' : 'password'} value={pin} onChange={e => setPin(e.target.value)} placeholder="••••••"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center text-2xl tracking-widest text-slate-100 focus:border-sky-500 focus:outline-none"
            autoFocus required
          />
          <button type="button" onClick={() => setShowPin((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}>{showPin ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="mt-4 w-full rounded-xl bg-sky-500 py-3 font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50">
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function WaiterBoard({ name, onLogout }: { name: string; onLogout: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const load = useCallback(async () => {
    const [ordersRes, alertsRes] = await Promise.all([
      fetch('/api/operational-workflow/orders'),
      fetch('/api/alerts'),
    ]);
    if (ordersRes.ok) {
      const data = await ordersRes.json();
      setOrders(data.filter((o: Order) => ['ready', 'delivering'].includes(o.status)));
    }
    if (alertsRes.ok) {
      const data = await alertsRes.json();
      setAlerts(data.filter((a: Alert) => !a.resolved));
    }
  }, []);

  useEffect(() => { void load(); const t = setInterval(() => void load(), 6000); return () => clearInterval(t); }, [load]);

  const resolveAlert = async (id: string) => {
    await fetch(`/api/alerts/${id}/resolve`, { method: 'POST' });
    await load();
  };

  const deliverOrder = async (id: string) => {
    await fetch(`/api/operational-workflow/orders/${id}/advance`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'cashier' }),
    });
    await load();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20">
            <UtensilsCrossed className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-sky-400">Miar</p>
            <p className="text-sm font-semibold">Garçom • {name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {alerts.length > 0 && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold">{alerts.length}</span>}
          <button onClick={() => void load()} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={onLogout} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="space-y-6 p-4 lg:p-6">
        {/* Alertas de mesa */}
        {alerts.length > 0 && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-red-400">
              <Bell className="h-4 w-4 animate-pulse" /> Chamadas ({alerts.length})
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {alerts.map(alert => (
                  <motion.div key={alert.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 50 }}
                    className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-400" />
                      <p className="font-semibold text-slate-100">{alert.tableNumber ? `Mesa ${alert.tableNumber}` : 'Chamada'}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{alert.message}</p>
                    <p className="mt-1 text-xs text-slate-500">{elapsed(alert.createdAt)}</p>
                    <button onClick={() => void resolveAlert(alert.id)}
                      className="mt-3 w-full rounded-xl bg-red-500 py-2 text-sm font-semibold text-white hover:bg-red-400">
                      Atender
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Pedidos prontos para servir */}
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Prontos para servir ({orders.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {orders.length === 0 && (
              <p className="col-span-full rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-500">
                Nenhum pedido pronto no momento
              </p>
            )}
            <AnimatePresence>
              {orders.map(order => (
                <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="rounded-2xl border border-emerald-500/20 bg-slate-900 p-4">
                  <p className="font-semibold text-slate-100">{order.customerName}</p>
                  <p className="text-sm text-slate-400">{order.restaurantName}</p>
                  <p className="mt-1 text-xs text-slate-500">{elapsed(order.createdAt)} • {order.mode ?? 'Mesa'}</p>
                  <p className="mt-2 font-semibold text-emerald-400">R$ {order.total.toFixed(2)}</p>
                  <button onClick={() => void deliverOrder(order.id)}
                    className="mt-3 w-full rounded-xl bg-emerald-500 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400">
                    Confirmar entrega
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('miar-garcom-token') ?? '');
  const [name, setName] = useState(() => localStorage.getItem('miar-garcom-name') ?? '');

  const onLogin = (t: string, n: string) => {
    localStorage.setItem('miar-garcom-token', t); localStorage.setItem('miar-garcom-name', n);
    setToken(t); setName(n);
  };
  const onLogout = () => { localStorage.removeItem('miar-garcom-token'); localStorage.removeItem('miar-garcom-name'); setToken(''); setName(''); };

  return (
    <>
      {token ? <WaiterBoard name={name} onLogout={onLogout} /> : <PinLogin onLogin={onLogin} />}
      <Toaster />
    </>
  );
}

export { App as default };
