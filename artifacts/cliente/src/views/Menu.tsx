import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, Plus, Minus, Trash2, ChevronLeft, AlertTriangle, X, Loader2, ChefHat, Bike, Store } from 'lucide-react';
import { lsGet, lsSet, cartKey, getClientToken } from '../lib/storage';
import type { Restaurant, MenuItem, CartItem, StockAlert, OrderMode } from '../types';
import { getColors } from './Home';
import PagamentoPix from '../components/PagamentoPix';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-800 ${className}`} />;
}

export default function Menu({
  restaurant, tableId, tableToken, guestId, onBack, onOrderPlaced, isGuest, onRequireLogin, onOpenReservation,
}: {
  restaurant: Restaurant;
  tableId?: string;
  tableToken?: string;
  guestId?: string;
  onBack: () => void;
  onOrderPlaced: (orderId: string, mode: OrderMode, items: CartItem[], total: number) => void;
  isGuest: boolean;
  onRequireLogin: () => void;
  onOpenReservation?: () => void;
}) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCartState] = useState<CartItem[]>(() => lsGet(cartKey(restaurant.id), []));
  const [search, setSearch] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [showModeModal, setShowModeModal] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [showPix, setShowPix] = useState(false);
  const [pixModeSelection, setPixModeSelection] = useState(false);
  const [pixMode, setPixMode] = useState<OrderMode>('dine-in');
  const colors = getColors(restaurant.segment ?? restaurant.cuisine);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/restaurants/${restaurant.id}/menu`)
      .then(r => r.ok ? r.json() : []).then((d: MenuItem[]) => { setMenu(d); setLoading(false); })
      .catch(() => setLoading(false));
    fetch(`/api/restaurants/${restaurant.id}/stock-alerts`)
      .then(r => r.ok ? r.json() : []).then(setStockAlerts).catch(() => {});
  }, [restaurant.id]);

  const setCart = (c: CartItem[]) => { setCartState(c); lsSet(cartKey(restaurant.id), c); };

  const addItem = useCallback((item: MenuItem) => {
    if (isGuest) {
      onRequireLogin();
      return;
    }
    setCartState(prev => {
      const existing = prev.find(c => c.id === item.id);
      const next = existing
        ? prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
        : [...prev, { ...item, qty: 1, note: '' }];
      lsSet(cartKey(restaurant.id), next); return next;
    });
  }, [isGuest, onRequireLogin, restaurant.id]);

  const removeItem = useCallback((id: string) => {
    setCartState(prev => {
      const existing = prev.find(c => c.id === id);
      if (!existing) return prev;
      const next = existing.qty <= 1 ? prev.filter(c => c.id !== id) : prev.map(c => c.id === id ? { ...c, qty: c.qty - 1 } : c);
      lsSet(cartKey(restaurant.id), next); return next;
    });
  }, [restaurant.id]);

  const updateNote = (id: string, note: string) => setCart(cart.map(c => c.id === id ? { ...c, note } : c));

  const totalItems = cart.reduce((s, c) => s + c.qty, 0);
  const totalPrice = cart.reduce((s, c) => s + c.qty * c.price, 0);
  const categories = [...new Set(menu.map(m => m.category ?? 'Cardápio'))];
  const filtered = menu.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

  const checkout = async (mode: OrderMode, paymentMethod?: string, paymentId?: string) => {
    if (isGuest) {
      onRequireLogin();
      return;
    }
    if (!cart.length) return;
    if (mode === 'dine-in' && tableToken && !guestId) {
      setSuccess('A sessão da mesa ainda está a abrir. Aguarde um instante e tente novamente.');
      return;
    }
    setOrdering(true);
    setShowModeModal(false);
    try {
      // Inclui o token do cliente (se autenticado) para o servidor ligar o
      // pedido à conta real em client_accounts via clientAccountId.
      const clientToken = getClientToken();
      const orderHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (clientToken) orderHeaders['Authorization'] = `Bearer ${clientToken}`;

      const itemsSnap = [...cart]; const totalSnap = totalPrice;
      const isQrSessionOrder = mode === 'dine-in' && Boolean(tableToken && guestId) && !paymentMethod && !paymentId;
      const res = isQrSessionOrder
        ? await fetch(`/api/tables/by-token/${encodeURIComponent(tableToken!)}/session/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guestId, items: cart.map(c => ({ menuItemId: c.id, quantity: c.qty, notes: c.note || undefined })) }),
          })
        : await fetch('/api/orders', {
            method: 'POST',
            headers: orderHeaders,
            body: JSON.stringify({
              restaurantId: restaurant.id,
              items: cart.map(c => ({ menuItemId: c.id, quantity: c.qty, notes: c.note || undefined })),
              mode,
              ...(mode === 'pickup' && vehiclePlate.trim() ? { vehiclePlate: vehiclePlate.trim() } : {}),
              ...(mode === 'dine-in' && tableId ? { tableId } : {}),
              ...(paymentMethod ? { paymentMethod } : {}),
              ...(paymentId ? { paymentId } : {}),
            }),
          });
      if (res.ok) {
        const order = await res.json() as { id?: string; orderId?: string };
        const resolvedOrderId = order.orderId ?? order.id;
        if (!resolvedOrderId) {
          setSuccess('O servidor não confirmou a criação do pedido. O carrinho foi mantido.');
          return;
        }
        setCart([]); setShowCart(false);
        setVehiclePlate('');
        onOrderPlaced(resolvedOrderId, mode, itemsSnap, totalSnap);
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setSuccess(data.error ?? 'Não foi possível registrar o pedido. O carrinho foi mantido.');
      }
    } catch {
      setSuccess('Não foi possível conectar ao servidor. O pedido não foi criado.');
    } finally { setOrdering(false); }
  };

  const selectMode = (mode: OrderMode, paymentMethod?: string) => {
    if (pixModeSelection && !paymentMethod) {
      setPixMode(mode);
      setPixModeSelection(false);
      setShowModeModal(false);
      setShowPix(true);
      return;
    }
    void checkout(mode, paymentMethod);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur">
        <button onClick={onBack} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></button>
        <div className="flex-1">
          <p className="font-semibold">{restaurant.name}</p>
          {(restaurant.segment ?? restaurant.cuisine) &&
            <p className={`text-xs capitalize ${colors.accent}`}>{restaurant.segment ?? restaurant.cuisine}</p>}
        </div>
        {onOpenReservation && (
          <button onClick={onOpenReservation}
            aria-label="Reservar mesa"
            className="mr-2 flex items-center gap-1.5 rounded-xl border border-orange-400/60 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-300 hover:bg-orange-500/20 transition-colors">
            Reservar
          </button>
        )}
        <button onClick={() => isGuest ? onRequireLogin() : setShowCart(true)}
          className={`relative flex items-center gap-2 rounded-xl ${colors.bg} px-4 py-2 text-sm font-semibold text-white`}>
          <ShoppingCart className="h-4 w-4" />
          {totalItems > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-950">{totalItems}</span>
          )}
          R$ {totalPrice.toFixed(2)}
        </button>
      </header>

      {stockAlerts.length > 0 && (
        <div className="mx-4 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <p className="text-xs font-semibold text-amber-300">⚠️ Ingredientes com validade próxima</p>
              <p className="text-xs text-amber-400/80">{stockAlerts.map(a => `${a.name} (${a.daysLeft}d)`).join(' · ')}</p>
              <p className="mt-0.5 text-[10px] text-amber-500/70">Todos dentro do prazo e seguros para consumo. A cozinha priorizará o uso.</p>
            </div>
          </div>
        </div>
      )}

      {success && <div className="mx-4 mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">{success}</div>}

      <div className="p-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar no cardápio..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none" />
        </div>

        {loading && <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>}

        {!loading && categories.map(cat => {
          const items = filtered.filter(m => (m.category ?? 'Cardápio') === cat);
          if (!items.length) return null;
          return (
            <div key={cat} className="mb-6">
              <h2 className={`mb-3 text-xs font-semibold uppercase tracking-widest ${colors.accent}`}>
                {cat} <span className="text-slate-600">({items.length})</span>
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map(item => {
                  const inCart = cart.find(c => c.id === item.id);
                  return (
                    <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-slate-100">{item.name}</p>
                          {item.description && <p className="mt-0.5 text-xs text-slate-400">{item.description}</p>}
                          <p className={`mt-1 font-semibold ${colors.accent}`}>R$ {item.price.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {inCart && (
                            <>
                              <button onClick={() => removeItem(item.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700">
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="min-w-[1.5rem] text-center text-sm font-semibold">{inCart.qty}</span>
                            </>
                          )}
                          <button onClick={() => addItem(item)}
                            className={`flex h-7 w-7 items-center justify-center rounded-lg ${colors.bg} text-white hover:opacity-90`}>
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!loading && filtered.length === 0 && (
          <p className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-500">Nenhum item encontrado</p>
        )}
      </div>

      {/* Mode modal */}
      <AnimatePresence>
        {showModeModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-slate-950/80 backdrop-blur" onClick={() => { setShowModeModal(false); setPixModeSelection(false); }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="w-full rounded-t-3xl border-t border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <p className="mb-1 text-lg font-semibold">Como vai receber o pedido?</p>
              <p className="mb-5 text-sm text-slate-400">
                {pixModeSelection ? 'Escolha a forma de recebimento antes de pagar com Pix' : 'Escolha a forma de recebimento'}
              </p>
              <label className="mb-4 block text-sm text-slate-300">
                Placa do veículo para retirada
                <input value={vehiclePlate} onChange={(event) => setVehiclePlate(event.target.value.toUpperCase())}
                  placeholder="ABC1D34" maxLength={8}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base tracking-widest text-white focus:border-amber-400 focus:outline-none" />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => selectMode('dine-in')} disabled={ordering}
                  className="flex flex-col items-center gap-2 rounded-2xl border-2 border-emerald-500 bg-emerald-500/10 p-4 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50">
                  <ChefHat className="h-7 w-7" />
                  <span className="font-semibold text-sm">Na mesa</span>
                  <span className="text-xs text-slate-400">Salão / balcão</span>
                </button>
                <button onClick={() => selectMode('delivery')} disabled={ordering}
                  className="flex flex-col items-center gap-2 rounded-2xl border-2 border-violet-500 bg-violet-500/10 p-4 text-violet-400 hover:bg-violet-500/20 disabled:opacity-50">
                  <Bike className="h-7 w-7" />
                  <span className="font-semibold text-sm">Delivery</span>
                  <span className="text-xs text-slate-400">Entrega em casa</span>
                </button>
                <button onClick={() => selectMode('pickup', pixModeSelection ? undefined : 'no_caixa')} disabled={ordering || !vehiclePlate.trim()}
                  className="flex flex-col items-center gap-2 rounded-2xl border-2 border-amber-500 bg-amber-500/10 p-4 text-amber-400 hover:bg-amber-500/20 disabled:opacity-50">
                  <Store className="h-7 w-7" />
                  <span className="font-semibold text-sm">Retirar</span>
                  <span className="text-xs text-slate-400">Pagar no caixa</span>
                </button>
              </div>
              {ordering && <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</div>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart drawer */}
      <AnimatePresence>
        {showCart && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-slate-950/80 backdrop-blur" onClick={() => setShowCart(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t border-slate-800 bg-slate-900 p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Seu pedido</h3>
                <button onClick={() => setShowCart(false)} className="rounded-lg bg-slate-800 p-2"><X className="h-4 w-4" /></button>
              </div>
              {stockAlerts.length > 0 && (
                <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" /> ATENÇÃO: ingredientes próximos do vencimento neste pedido
                  </p>
                  <p className="mt-0.5 text-[11px] text-amber-500/70">{stockAlerts.map(a => a.name).join(', ')} — dentro do prazo e seguros.</p>
                </div>
              )}
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-slate-100">{item.name}</p>
                        <p className={`text-sm font-semibold ${colors.accent}`}>R$ {(item.price * item.qty).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => removeItem(item.id)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800"><Minus className="h-3 w-3" /></button>
                        <span className="min-w-[1.5rem] text-center text-sm font-semibold">{item.qty}</span>
                        <button onClick={() => addItem(item)} className={`flex h-7 w-7 items-center justify-center rounded-lg ${colors.bg} text-white`}><Plus className="h-3 w-3" /></button>
                        <button onClick={() => setCart(cart.filter(c => c.id !== item.id))} className="ml-1 text-slate-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                    <input value={item.note} onChange={e => updateNote(item.id, e.target.value)}
                      placeholder="Observação (sem cebola, bem passado…)"
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:border-emerald-500 focus:outline-none" />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="font-medium text-slate-300">Total</span>
                <span className={`text-xl font-bold ${colors.accent}`}>R$ {totalPrice.toFixed(2)}</span>
              </div>
              <button onClick={() => { setShowCart(false); setPixModeSelection(false); setShowModeModal(true); }} disabled={!cart.length}
                className={`mt-4 w-full rounded-xl ${colors.bg} py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50`}>
                Continuar →
              </button>
              <button onClick={() => { if (isGuest) { onRequireLogin(); return; } setShowCart(false); setPixModeSelection(true); setShowModeModal(true); }} disabled={!cart.length}
                className="mt-2 w-full rounded-xl border border-emerald-500 py-3 font-semibold text-emerald-400 transition hover:bg-emerald-500/10 disabled:opacity-50">
                Pagar com Pix
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {showPix && (
        <PagamentoPix
          valor={totalPrice}
          descricao={`Pedido ${restaurant.name}`}
          onFechar={() => setShowPix(false)}
          onPago={(paymentId) => {
            setShowPix(false);
            void checkout(pixMode, 'pix', paymentId);
          }}
        />
      )}
    </div>
  );
}
