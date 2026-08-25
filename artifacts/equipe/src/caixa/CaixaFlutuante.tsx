import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Banknote, CreditCard, QrCode, Check, Minus, Plus, Trash2 } from 'lucide-react';
import { apiGet, apiPost, apiPatch, brl, getOperador } from './api';
import type { TableWithSession, MenuItemLite, CartLine } from './tipos';

type Metodo = 'cash' | 'card' | 'pix';

// O que abriu o caixa flutuante: uma mesa, uma retirada ou uma venda de balcão nova.
export type ContextoCaixa =
  | { tipo: 'mesa'; mesa: TableWithSession }
  | { tipo: 'retirada'; pedido: { id: string; customerName?: string; total: number } }
  | { tipo: 'balcao' };

export default function CaixaFlutuante({
  contexto,
  onFechar,
  onConcluido,
}: {
  contexto: ContextoCaixa;
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const operador = getOperador();
  const [metodo, setMetodo] = useState<Metodo>('pix');
  const [recebido, setRecebido] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);

  // Balcão: catálogo + carrinho
  const [menu, setMenu] = useState<MenuItemLite[]>([]);
  const [carrinho, setCarrinho] = useState<CartLine[]>([]);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (contexto.tipo === 'balcao') {
      // Corrigido (15/08/2026) — buscava sempre o cardápio da conta demo
      // 'rest-1' fixo, então o Caixa embutido no App Equipe nunca mostrava
      // o cardápio real do restaurante logado. Mesma correção já aplicada
      // no Caixa standalone; essa é uma cópia separada do componente que
      // tinha ficado pra trás. Rota autenticada resolve pelo token, com
      // suporte a multi-loja via x-loja-id (injetado pelo apiGet agora).
      apiGet<{ menuItems?: MenuItemLite[] } | MenuItemLite[]>('/restaurants/me/menu-completo')
        .then((r) => setMenu(Array.isArray(r) ? r : r.menuItems ?? []))
        .catch(() => setMenu([]));
    }
  }, [contexto.tipo]);

  const totalBalcao = carrinho.reduce((s, l) => s + l.price * l.qty, 0);
  const total =
    contexto.tipo === 'mesa'
      ? contexto.mesa.session?.pendingAmount ?? 0
      : contexto.tipo === 'retirada'
      ? contexto.pedido.total
      : totalBalcao;

  const troco = metodo === 'cash' && recebido ? Math.max(0, Number(recebido) - total) : 0;

  const addItem = (item: MenuItemLite) => {
    setCarrinho((prev) => {
      const i = prev.findIndex((l) => l.itemId === item.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, { itemId: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  };
  const alterarQtd = (itemId: string, delta: number) => {
    setCarrinho((prev) =>
      prev
        .map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  };

  const registrarNoTurno = useCallback(
    async (tableNumber?: number, orderId?: string) => {
      const tipoMov =
        metodo === 'cash' ? 'sale_cash' : metodo === 'card' ? 'sale_card' : 'sale_pix';
      const result = await apiPost<{ ok?: boolean }>('/cashier/session/sale', {
        type: tipoMov,
        amount: total,
        operatorName: operador,
        orderId,
        tableNumber,
        receivedAmount: metodo === 'cash' ? Number(recebido || total) : undefined,
        changeGiven: metodo === 'cash' ? troco : undefined,
      });
      if (result.ok !== true) {
        throw new Error('Não há turno de caixa aberto para registrar este pagamento.');
      }
    },
    [metodo, total, recebido, troco, operador]
  );

  const confirmarMesa = async () => {
    if (contexto.tipo !== 'mesa') return;
    const mesa = contexto.mesa;
    if (!mesa.session) return;
    setProcessando(true);
    setErro('');
    try {
      const pendentes = mesa.session.guests.filter((g) => !g.paid && g.amount > 0);
      for (const g of pendentes) {
        await apiPost(`/tables/by-token/${mesa.qrToken}/session/pay`, {
          guestId: g.id,
          method: metodo,
          markedByStaff: true,
        });
      }
      await registrarNoTurno(mesa.number);
      setOk(true);
      setTimeout(onConcluido, 900);
    } catch {
      setErro('Não foi possível registrar o pagamento no turno. Verifique se há um turno aberto.');
    } finally {
      setProcessando(false);
    }
  };

  const liberarMesa = async () => {
    if (contexto.tipo !== 'mesa') return;
    setProcessando(true);
    try {
      await apiPost(`/tables/by-token/${contexto.mesa.qrToken}/session/close`, { force: true });
      await apiPost(`/recados/mesa/${contexto.mesa.number}/fechar`, {});
      setOk(true);
      setTimeout(onConcluido, 700);
    } catch {
      setErro('Não foi possível liberar a mesa.');
    } finally {
      setProcessando(false);
    }
  };

  const confirmarRetirada = async () => {
    if (contexto.tipo !== 'retirada') return;
    setProcessando(true);
    setErro('');
    try {
      await apiPatch(`/orders/${contexto.pedido.id}/status`, { status: 'paid' });
      await registrarNoTurno(undefined, contexto.pedido.id);
      setOk(true);
      setTimeout(onConcluido, 900);
    } catch {
      setErro('Não foi possível registrar o pagamento no turno. Verifique se há um turno aberto.');
    } finally {
      setProcessando(false);
    }
  };

  const confirmarBalcao = async () => {
    if (contexto.tipo !== 'balcao' || carrinho.length === 0) return;
    setProcessando(true);
    setErro('');
    try {
      const pedido = await apiPost<{ id: string }>('/orders', {
        tableId: 'balcao',
        tableNumber: 0,
        mode: 'pickup',
        items: carrinho.map((l) => ({ name: l.name, quantity: l.qty, price: l.price })),
        total: totalBalcao,
        customerName: 'Balcão',
      });
      await apiPatch(`/orders/${pedido.id}/status`, { status: 'paid' });
      await registrarNoTurno(undefined, pedido.id);
      setOk(true);
      setTimeout(onConcluido, 900);
    } catch {
      setErro('Não foi possível registrar a venda no turno. Verifique se há um turno aberto.');
    } finally {
      setProcessando(false);
    }
  };

  const titulo =
    contexto.tipo === 'mesa'
      ? `Mesa ${contexto.mesa.number}`
      : contexto.tipo === 'retirada'
      ? `Retirada — ${contexto.pedido.customerName ?? 'Cliente'}`
      : 'Balcão — nova venda';

  const menuFiltrado = menu.filter((m) =>
    m.name.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl border border-slate-800 bg-slate-900 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-100">{titulo}</h2>
          <button onClick={onFechar} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {ok ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                <Check className="h-8 w-8 text-emerald-400" />
              </div>
              <p className="font-semibold text-slate-100">Pagamento registrado</p>
            </div>
          ) : (
            <>
              {contexto.tipo === 'balcao' && (
                <div className="mb-4">
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar produto…"
                    className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                  />
                  <div className="mb-3 grid max-h-40 grid-cols-2 gap-2 overflow-y-auto">
                    {menuFiltrado.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => addItem(item)}
                        className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-left text-sm text-slate-100 hover:border-violet-500"
                      >
                        <div className="truncate font-medium">{item.name}</div>
                        <div className="text-xs text-slate-400">{brl(item.price)}</div>
                      </button>
                    ))}
                  </div>
                  {carrinho.length > 0 && (
                    <div className="space-y-2 rounded-xl border border-slate-800 p-3">
                      {carrinho.map((l) => (
                        <div key={l.itemId} className="flex items-center justify-between text-sm">
                          <span className="flex-1 truncate text-slate-200">{l.name}</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => alterarQtd(l.itemId, -1)} className="rounded bg-slate-800 p-1 text-slate-300"><Minus className="h-3 w-3" /></button>
                            <span className="w-5 text-center text-slate-100">{l.qty}</span>
                            <button onClick={() => alterarQtd(l.itemId, 1)} className="rounded bg-slate-800 p-1 text-slate-300"><Plus className="h-3 w-3" /></button>
                            <button onClick={() => alterarQtd(l.itemId, -l.qty)} className="rounded p-1 text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                          <span className="w-16 text-right font-medium text-slate-100">{brl(l.price * l.qty)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {contexto.tipo === 'mesa' && contexto.mesa.session && (
                <div className="mb-4 space-y-1.5">
                  {contexto.mesa.session.guests.map((g) => (
                    <div key={g.id} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2 text-sm">
                      <span className="text-slate-200">{g.name}</span>
                      <span className={g.paid ? 'text-emerald-400' : 'text-slate-100'}>
                        {brl(g.amount)} {g.paid && '· pago'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-800/60 px-4 py-3">
                <span className="text-slate-300">Total</span>
                <span className="text-2xl font-bold text-slate-100">{brl(total)}</span>
              </div>

              {contexto.tipo !== 'mesa' || !contexto.mesa.session?.fullyPaid ? (
                <>
                  <div className="mb-3 grid grid-cols-3 gap-2">
                    <button onClick={() => setMetodo('pix')} className={`flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-semibold ${metodo === 'pix' ? 'bg-violet-500 text-[#0d1b1a]' : 'bg-slate-800 text-slate-300'}`}>
                      <QrCode className="h-5 w-5" /> Pix
                    </button>
                    <button onClick={() => setMetodo('card')} className={`flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-semibold ${metodo === 'card' ? 'bg-violet-500 text-[#0d1b1a]' : 'bg-slate-800 text-slate-300'}`}>
                      <CreditCard className="h-5 w-5" /> Cartão
                    </button>
                    <button onClick={() => setMetodo('cash')} className={`flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-semibold ${metodo === 'cash' ? 'bg-violet-500 text-[#0d1b1a]' : 'bg-slate-800 text-slate-300'}`}>
                      <Banknote className="h-5 w-5" /> Dinheiro
                    </button>
                  </div>

                  {metodo === 'cash' && (
                    <div className="mb-3">
                      <input
                        type="number"
                        value={recebido}
                        onChange={(e) => setRecebido(e.target.value)}
                        placeholder="Valor recebido"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                      />
                      {Number(recebido) > 0 && (
                        <p className="mt-1.5 text-sm text-slate-400">Troco: <span className="font-semibold text-slate-100">{brl(troco)}</span></p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="mb-3 text-center text-sm text-emerald-400">Mesa já paga — só falta liberar.</p>
              )}

              {erro && <p className="mb-3 text-sm text-red-400">{erro}</p>}
            </>
          )}
        </div>

        {!ok && (
          <div className="border-t border-slate-800 p-4">
            {contexto.tipo === 'mesa' && contexto.mesa.session?.fullyPaid ? (
              <button
                onClick={() => void liberarMesa()}
                disabled={processando}
                className="w-full rounded-xl bg-emerald-500 py-3.5 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {processando ? 'Liberando…' : 'Liberar mesa'}
              </button>
            ) : (
              <button
                onClick={() =>
                  void (contexto.tipo === 'mesa'
                    ? confirmarMesa()
                    : contexto.tipo === 'retirada'
                    ? confirmarRetirada()
                    : confirmarBalcao())
                }
                disabled={
                  processando ||
                  total <= 0 ||
                  (contexto.tipo === 'balcao' && carrinho.length === 0) ||
                  (metodo === 'cash' && Number(recebido) < total)
                }
                className="w-full rounded-xl bg-violet-500 py-3.5 font-semibold text-[#0d1b1a] transition hover:bg-violet-400 disabled:opacity-50"
              >
                {processando ? 'Confirmando…' : `Confirmar ${brl(total)}`}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
