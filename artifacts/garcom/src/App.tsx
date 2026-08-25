import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { motion, AnimatePresence } from 'framer-motion';
import { UtensilsCrossed, Bell, CheckCircle2, RefreshCw, LogOut, AlertCircle, Plus, X, Minus, ChefHat, Loader2, Eye, EyeOff } from 'lucide-react';
import SeletorLoja from './components/SeletorLoja';
import { FloatingChat } from '@/components/FloatingChat';
import { IdiomaProvider, useTranslation } from './i18n/IdiomaContext';
import { ConfigFlutuante } from './i18n/ConfigFlutuante';

const queryClient = new QueryClient();

type Order = {
  id: string; customerName: string; restaurantName: string; status: string;
  total: number; createdAt: string; mode?: string;
};
type Alert = { id: string; tableNumber?: number; type: string; message: string; createdAt: string; resolved: boolean };
type TableWithSession = { id: string; number: number; status: string; session?: { id: string } };
type MenuItem = { id: string; name: string; price: number; category?: string; available?: boolean };
type CartItem = { menuItem: MenuItem; qty: number };

function elapsed(createdAt: string) {
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  return diff < 1 ? 'agora' : `${diff}min`;
}

// Le o companyId de dentro do JWT sem depender de round-trip ao servidor.
// So le o payload (nao verifica assinatura) — a autorizacao de verdade
// sempre acontece no backend em cada rota protegida; isso e so pra montar
// a URL certa no frontend em vez de um restaurantId fixo tipo 'rest-1'.
function companyIdFromToken(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.companyId ?? '';
  } catch {
    return '';
  }
}

function PinLogin({ onLogin }: { onLogin: (token: string, name: string, remember: boolean) => void }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showPin, setShowPin] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) { setError(t('auth.pin.required')); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/employee-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pin }),
      });
      if (!res.ok) { setError(t('auth.pin.invalid')); return; }
      const data = await res.json();
      onLogin(data.sessionToken ?? pin, data.employee?.name ?? 'Garçom', remember);
    } catch { setError(t('auth.error.connection')); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/20">
            <UtensilsCrossed className="h-8 w-8 text-sky-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">{t('app.name')}</h1>
          <p className="mt-1 text-sm text-slate-400">{t('app.subtitle')}</p>
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
          <label className="mb-2 block text-sm font-medium text-slate-300">{t('auth.pin.label')}</label>
          <div className="relative">
          <input
            type={showPin ? 'text' : 'password'} value={pin} onChange={e => setPin(e.target.value)} placeholder={t('auth.pin.placeholder')}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center text-2xl tracking-widest text-slate-100 focus:border-sky-500 focus:outline-none"
            autoFocus required
          />
          <button type="button" onClick={() => setShowPin((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}>
            {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="mt-4 w-full rounded-xl bg-sky-500 py-3 font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50">
            {loading ? t('auth.button.verifying') : t('auth.button.enter')}
            <span className="sr-only">Entrar</span>
          </button>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-400"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Manter conectado neste aparelho</label>
        </form>
      </motion.div>
    </div>
  );
}

function NewOrderModal({ token, initialTable, onClose, onCreated }: { token: string; initialTable?: TableWithSession | null; onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const [tables, setTables] = useState<TableWithSession[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableWithSession | null>(initialTable ?? null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [pixPaymentId, setPixPaymentId] = useState('');
  const [pixQrBase64, setPixQrBase64] = useState('');
  const [pixCopyPaste, setPixCopyPaste] = useState('');
  const [pixError, setPixError] = useState('');

  useEffect(() => {
    const headers = { 'Authorization': `Bearer ${token}` };
    const companyId = companyIdFromToken(token);
    Promise.all([
      fetch('/api/tables/with-sessions', { headers }).then(r => r.ok ? r.json() : []),
      fetch(`/api/restaurants/${companyId}/menu`).then(r => r.ok ? r.json() : []),
    ]).then(([t, m]: [TableWithSession[], MenuItem[]]) => {
      // Mostrar todas as mesas (livre ou ocupada — garçom pode abrir pedido em qualquer status)
      setTables(t);
      setMenu(m.filter(item => item.available !== false));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  const addItem = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id);
      if (existing) return prev.map(c => c.menuItem.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { menuItem: item, qty: 1 }];
    });
  };

  const removeItem = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === itemId);
      if (!existing) return prev;
      if (existing.qty <= 1) return prev.filter(c => c.menuItem.id !== itemId);
      return prev.map(c => c.menuItem.id === itemId ? { ...c, qty: c.qty - 1 } : c);
    });
  };

  const total = cart.reduce((s, c) => s + c.menuItem.price * c.qty, 0);
  const filteredMenu = menu.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
  const categories = [...new Set(filteredMenu.map(m => m.category ?? t('menu.label')))] ;

  const createOrder = async (paymentId: string) => {
    setSending(true); setError('');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          restaurantId: companyIdFromToken(token),
          tableId: selectedTable!.id,
          mode: 'dine-in',
          paymentMethod: 'pix',
          paymentId,
          items: cart.map(c => ({ menuItemId: c.menuItem.id, quantity: c.qty })),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Erro ao criar pedido.');
        return;
      }
      onCreated();
      onClose();
    } catch { setError('Erro de conexão.'); }
    finally { setSending(false); }
  };

  useEffect(() => {
    if (!pixPaymentId) return;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/pix/status/${pixPaymentId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) return;
        const data = await response.json() as { status?: string };
        if (data.status === 'approved') {
          clearInterval(timer);
          await createOrder(pixPaymentId);
        }
      } catch {
        // Mantém o QR aberto para o cliente tentar pagar novamente.
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [pixPaymentId, token]);

  const submit = async () => {
    if (!selectedTable) { setError(t('error.select.table')); return; }
    if (!cart.length) { setError(t('error.cart.empty')); return; }
    if (pixPaymentId) return;
    setSending(true); setError(''); setPixError('');
    try {
      const res = await fetch('/api/pix/cobrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount: total, description: `Pedido presencial Garçom - Mesa ${selectedTable.number}` }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setPixError(d.error ?? d.detalhe ?? 'Não foi possível gerar o Pix.');
        return;
      }
      const data = await res.json() as { paymentId?: string; status?: string; qrBase64?: string; copiaECola?: string };
      if (!data.paymentId || (data.status !== 'pending' && data.status !== 'approved')) {
        setPixError('O provedor não retornou uma cobrança Pix válida.');
        return;
      }
      setPixPaymentId(String(data.paymentId));
      setPixQrBase64(data.qrBase64 ?? '');
      setPixCopyPaste(data.copiaECola ?? '');
      if (data.status === 'approved') await createOrder(String(data.paymentId));
    } catch { setPixError('Erro de conexão ao gerar o Pix.'); }
    finally { setSending(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end bg-slate-950/80 backdrop-blur" onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }}
        onClick={e => e.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col rounded-t-3xl border-t border-slate-800 bg-slate-900 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-sky-400" />
            <h2 className="text-lg font-semibold">{t('order.new')}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-sky-400" /></div>
          ) : (
            <>
              {/* Seleção de mesa */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{t('table.label')}</p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {tables.map(t => (
                    <button key={t.id} onClick={() => setSelectedTable(t)}
                      className={`rounded-xl border py-3 text-sm font-semibold transition ${
                        selectedTable?.id === t.id
                          ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-sky-500/50'
                      }`}>
                      {t.number}
                      <span className={`ml-1 text-[10px] ${t.status === 'occupied' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {t.status === 'occupied' ? '●' : '○'}
                      </span>
                    </button>
                  ))}
                  {tables.length === 0 && <p className="col-span-full text-sm text-slate-500">{t('table.empty')}</p>}
                </div>
              </div>

              {/* Busca de itens */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{t('menu.label')}</p>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('menu.search')}
                  className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm focus:border-sky-500 focus:outline-none" />
                <div className="space-y-4">
                  {categories.map(cat => {
                    const items = filteredMenu.filter(m => (m.category ?? 'Cardápio') === cat);
                    if (!items.length) return null;
                    return (
                      <div key={cat}>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{cat}</p>
                        <div className="space-y-1.5">
                          {items.map(item => {
                            const inCart = cart.find(c => c.menuItem.id === item.id);
                            return (
                              <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
                                <div className="flex-1 min-w-0 mr-2">
                                  <p className="text-sm font-medium text-slate-100 truncate">{item.name}</p>
                                  <p className="text-xs text-sky-400">R$ {item.price.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {inCart ? (
                                    <>
                                      <button onClick={() => removeItem(item.id)}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700">
                                        <Minus className="h-3 w-3" />
                                      </button>
                                      <span className="min-w-[1.5rem] text-center text-sm font-semibold">{inCart.qty}</span>
                                    </>
                                  ) : null}
                                  <button onClick={() => addItem(item)}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400">
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {filteredMenu.length === 0 && <p className="text-sm text-slate-500">{t('menu.empty')}</p>}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 p-4 space-y-2">
          {cart.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{cart.reduce((s, c) => s + c.qty, 0)} {t('item.count')}</span>
              <span className="font-bold text-sky-400">{t('menu.total')}: R$ {total.toFixed(2)}</span>
            </div>
          )}
          {pixPaymentId && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <p className="font-semibold text-emerald-300">Fechamento manual • Pix</p>
              <p className="mt-1 text-xs text-slate-400">Cliente: escaneie o QR para pagar R$ {total.toFixed(2)}</p>
              {pixQrBase64 && <img src={`data:image/png;base64,${pixQrBase64}`} alt="QR Code Pix do pedido presencial" className="mx-auto mt-3 h-48 w-48 rounded-xl bg-white p-2" />}
              {pixCopyPaste && <p className="mt-3 break-all rounded-lg bg-slate-950 p-2 text-[10px] text-slate-400">{pixCopyPaste}</p>}
              <p className="mt-3 text-xs text-amber-300">Aguardando confirmação do pagamento...</p>
            </div>
          )}
          {pixError && <p className="text-sm text-red-400">{pixError}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={() => void submit()} disabled={sending || !cart.length || !selectedTable || Boolean(pixPaymentId)}
            className="w-full rounded-xl bg-sky-500 py-3 font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50">
            {sending ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Gerando QR Pix...</span> : 'Gerar QR Pix e fechar pedido'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function WaiterBoard({ token, name, onLogout }: { token: string; name: string; onLogout: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [tables, setTables] = useState<TableWithSession[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [preSelectedTable, setPreSelectedTable] = useState<TableWithSession | null>(null);

  const load = useCallback(async () => {
    const headers = { 'Authorization': `Bearer ${token}` };
    const [ordersRes, alertsRes, tablesRes] = await Promise.all([
      fetch('/api/operational-workflow/orders', { headers }),
      fetch('/api/alerts', { headers }),
      fetch('/api/tables/with-sessions', { headers }),
    ]);
    if (ordersRes.ok) {
      const data = await ordersRes.json();
      setOrders(data.filter((o: Order) => ['ready', 'delivering'].includes(o.status)));
    }
    if (alertsRes.ok) {
      const data = await alertsRes.json();
      setAlerts(data.filter((a: Alert) => !a.resolved));
    }
    if (tablesRes.ok) {
      setTables(await tablesRes.json());
    }
  }, [token]);

  const abrirPedidoNaMesa = (t: TableWithSession) => {
    setPreSelectedTable(t);
    setShowNewOrder(true);
  };

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
          <SeletorLoja />
          {alerts.length > 0 && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold">{alerts.length}</span>}
          <button onClick={() => { setPreSelectedTable(null); setShowNewOrder(true); }}
            className="flex items-center gap-1.5 rounded-xl bg-sky-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400">
            <Plus className="h-4 w-4" /> Novo pedido
          </button>
          <button onClick={() => void load()} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={onLogout} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      {successMessage && (
        <div role="status" aria-live="polite" className="mx-4 mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 lg:mx-6">
          {successMessage}
        </div>
      )}

      <div className="space-y-6 p-4 lg:p-6">
        {/* CORRIGIDO 30/07/2026: mapa de mesas voltou pra tela principal —
            antes só era visível dentro do modal de "Novo pedido". */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">
            Mesas ({tables.length})
          </h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {tables.map(t => {
              const cor = t.status === 'occupied' || t.session
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : t.status === 'paid'
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400';
              return (
                <button
                  key={t.id}
                  onClick={() => abrirPedidoNaMesa(t)}
                  className={`rounded-xl border px-2 py-3 text-center transition hover:brightness-125 ${cor}`}
                >
                  <span className="block text-lg font-bold leading-none">{t.number}</span>
                  <span className="mt-1 block text-[10px] uppercase tracking-wide opacity-80">
                    {t.status === 'occupied' || t.session ? 'ocupada' : t.status === 'paid' ? 'paga' : 'livre'}
                  </span>
                </button>
              );
            })}
            {tables.length === 0 && <p className="col-span-full text-sm text-slate-500">Nenhuma mesa cadastrada.</p>}
          </div>
        </div>

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
                    className={`rounded-2xl border p-4 ${
                      alert.type === 'bill_request'
                        ? 'border-amber-500/40 bg-amber-500/10'
                        : 'border-red-500/30 bg-red-500/10'
                    }`}>
                    <div className="flex items-center gap-2">
                      <AlertCircle className={`h-5 w-5 ${alert.type === 'bill_request' ? 'text-amber-400' : 'text-red-400'}`} />
                      <p className="font-semibold text-slate-100">
                        {alert.type === 'bill_request'
                          ? `Conta solicitada — ${alert.tableNumber ? `Mesa ${alert.tableNumber}` : 'Mesa'}`
                          : alert.tableNumber ? `Mesa ${alert.tableNumber}` : 'Chamada'}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{alert.message}</p>
                    <p className="mt-1 text-xs text-slate-500">{elapsed(alert.createdAt)}</p>
                    <button onClick={() => void resolveAlert(alert.id)}
                      className={`mt-3 w-full rounded-xl py-2 text-sm font-semibold text-white ${
                        alert.type === 'bill_request'
                          ? 'bg-amber-500 hover:bg-amber-400'
                          : 'bg-red-500 hover:bg-red-400'
                      }`}>
                      {alert.type === 'bill_request' ? 'Levar a máquina' : 'Atender'}
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

      <AnimatePresence>
        {showNewOrder && (
          <NewOrderModal
            token={token}
            initialTable={preSelectedTable}
            onClose={() => { setShowNewOrder(false); setPreSelectedTable(null); }}
            onCreated={() => { setSuccessMessage('Pedido confirmado'); void load(); }}
          />
        )}
      </AnimatePresence>

      {/* Chat da MIAR sempre presente — flutuante (29/07/2026) */}
      <FloatingChat getToken={() => token} />
    </div>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('miar-garcom-token') ?? sessionStorage.getItem('miar-garcom-token') ?? '');
  const [name, setName] = useState(() => localStorage.getItem('miar-garcom-name') ?? sessionStorage.getItem('miar-garcom-name') ?? '');

  const onLogin = (t: string, n: string, remember: boolean) => {
    const storage = remember ? localStorage : sessionStorage;
    const otherStorage = remember ? sessionStorage : localStorage;
    otherStorage.removeItem('miar-garcom-token'); otherStorage.removeItem('miar-garcom-name');
    storage.setItem('miar-garcom-token', t); storage.setItem('miar-garcom-name', n);
    setToken(t); setName(n);
  };
  const onLogout = () => { localStorage.removeItem('miar-garcom-token'); localStorage.removeItem('miar-garcom-name'); setToken(''); setName(''); };

  // Renova o token automaticamente a cada 90 minutos (token dura 2h).
  useEffect(() => {
    const id = setInterval(async () => {
      const current = localStorage.getItem('miar-garcom-token');
      if (!current) return;
      try {
        const r = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { Authorization: `Bearer ${current}` },
        });
        if (r.ok) {
          const { token: novoToken } = await r.json() as { token: string };
          localStorage.setItem('miar-garcom-token', novoToken);
          setToken(novoToken);
        }
      } catch { /* retry no próximo ciclo */ }
    }, 90 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <IdiomaProvider>
      <QueryClientProvider client={queryClient}>
        {token ? <WaiterBoard token={token} name={name} onLogout={onLogout} /> : <PinLogin onLogin={onLogin} />}
        <ConfigFlutuante />
        <Toaster />
      </QueryClientProvider>
    </IdiomaProvider>
  );
}

export default App;
