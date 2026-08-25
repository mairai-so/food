import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Banknote, CreditCard, QrCode, Check, Minus, Plus, Trash2 } from 'lucide-react';
import { apiGet, apiPost, apiPatch, brl, getOperador } from './api';
import type { TableWithSession, MenuItemLite, CartLine } from './tipos';

type Metodo = 'cash' | 'debit' | 'credit' | 'voucher' | 'pix' | 'app';
type VoucherBrand = 'alelo' | 'vr' | 'sodexo' | 'ticket' | 'outro';

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
  const [voucherBrand, setVoucherBrand] = useState<VoucherBrand>('alelo');
  const [recebido, setRecebido] = useState('');
  const [providerPaymentId, setProviderPaymentId] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);

  // Balcão: catálogo + carrinho
  const [menu, setMenu] = useState<MenuItemLite[]>([]);
  const [carrinho, setCarrinho] = useState<CartLine[]>([]);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (contexto.tipo === 'balcao') {
      // Corrigido (15/08): buscava sempre o cardápio da conta demo 'rest-1'
      // fixo, então o balcão nunca mostrava o cardápio real do restaurante
      // logado. Rota autenticada resolve pelo token, já com suporte a
      // multi-loja (x-loja-id é injetado automaticamente pelo apiGet).
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
      const tipoMovPorMetodo: Record<Metodo, string> = {
        cash: 'sale_cash', debit: 'sale_debit', credit: 'sale_credit',
        voucher: 'sale_voucher', pix: 'sale_pix', app: 'sale_app',
      };
      const tipoMov = tipoMovPorMetodo[metodo];
      const result = await apiPost<{ ok?: boolean }>('/cashier/session/sale', {
        type: tipoMov,
        amount: total,
        operatorName: operador,
        orderId,
        tableNumber,
        receivedAmount: metodo === 'cash' ? Number(recebido || total) : undefined,
        changeGiven: metodo === 'cash' ? troco : undefined,
        voucherBrand: metodo === 'voucher' ? voucherBrand : undefined,
        providerPaymentId: metodo === 'app' ? providerPaymentId.trim() : undefined,
      });
      if (result.ok !== true) {
        throw new Error('Não há turno de caixa aberto para registrar este pagamento.');
      }
    },
    [metodo, total, recebido, troco, operador, voucherBrand, providerPaymentId]
  );

  const confirmarPagamentoApp = async () => {
    if (metodo !== 'app') return;
    const paymentId = providerPaymentId.trim();
    if (!paymentId) throw new Error('Informe o ID do pagamento confirmado pelo App.');
    const status = await apiGet<{ status?: string }>(`/pix/status/${encodeURIComponent(paymentId)}`);
    if (status.status !== 'approved') throw new Error(`Pagamento pelo App ainda não está aprovado: ${status.status ?? 'sem estado'}.`);
  };

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
      await confirmarPagamentoApp();
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
      await confirmarPagamentoApp();
      const pedido = await apiPost<{ id: string }>('/orders', {
        mode: 'pickup',
        // O servidor deriva restaurantId pela sessão autenticada do Caixa.
        // O contrato principal recebe apenas referências reais do cardápio.
        items: carrinho.map((l) => ({ menuItemId: l.itemId, quantity: l.qty })),
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
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                <Check className="h-8 w-8 text-emerald-400" />
              </div>
              <p className="font-semibold text-slate-100">Pagamento registrado</p>
              <div className="w-full rounded-2xl border border-slate-700 bg-slate-800 p-4 text-sm text-slate-300 space-y-2 mt-2">
                <div className="flex justify-between"><span className="text-slate-400">Local</span><span>{titulo}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Forma</span><span>{{ pix: 'Pix', debit: 'Débito', credit: 'Crédito', voucher: `Vale (${voucherBrand})`, cash: 'Dinheiro', app: 'Pagamento pelo App' }[metodo]}</span></div>
                <div className="flex justify-between font-bold text-slate-100"><span>Total</span><span>{brl(total)}</span></div>
                {metodo === 'cash' && troco > 0 && (
                  <div className="flex justify-between text-emerald-400"><span>Troco</span><span>{brl(troco)}</span></div>
                )}
                <div className="flex justify-between text-slate-500 text-xs"><span>Horário</span><span>{new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span></div>
              </div>
              <button onClick={() => window.print()}
                className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-800 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition">
                🖨️ Imprimir / Compartilhar
              </button>
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
                    <button onClick={() => setMetodo('debit')} className={`flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-semibold ${metodo === 'debit' ? 'bg-violet-500 text-[#0d1b1a]' : 'bg-slate-800 text-slate-300'}`}>
                      <CreditCard className="h-5 w-5" /> Débito
                    </button>
                    <button onClick={() => setMetodo('credit')} className={`flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-semibold ${metodo === 'credit' ? 'bg-violet-500 text-[#0d1b1a]' : 'bg-slate-800 text-slate-300'}`}>
                      <CreditCard className="h-5 w-5" /> Crédito
                    </button>
                    <button onClick={() => setMetodo('voucher')} className={`flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-semibold ${metodo === 'voucher' ? 'bg-violet-500 text-[#0d1b1a]' : 'bg-slate-800 text-slate-300'}`}>
                      <CreditCard className="h-5 w-5" /> Vale
                    </button>
                    <button onClick={() => setMetodo('cash')} className={`flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-semibold ${metodo === 'cash' ? 'bg-violet-500 text-[#0d1b1a]' : 'bg-slate-800 text-slate-300'}`}>
                      <Banknote className="h-5 w-5" /> Dinheiro
                    </button>
                    <button onClick={() => setMetodo('app')} className={`flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-semibold ${metodo === 'app' ? 'bg-violet-500 text-[#0d1b1a]' : 'bg-slate-800 text-slate-300'}`}>
                      <QrCode className="h-5 w-5" /> App
                    </button>
                  </div>

                  {metodo === 'voucher' && (
                    <div className="mb-3 grid grid-cols-5 gap-1.5">
                      {(['alelo', 'vr', 'sodexo', 'ticket', 'outro'] as VoucherBrand[]).map((b) => (
                        <button
                          key={b}
                          onClick={() => setVoucherBrand(b)}
                          className={`rounded-lg py-2 text-[10px] font-semibold uppercase ${voucherBrand === b ? 'bg-violet-500 text-[#0d1b1a]' : 'bg-slate-800 text-slate-400'}`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  )}

                  {metodo === 'app' && (
                    <div className="mb-3">
                      <input
                        value={providerPaymentId}
                        onChange={(e) => setProviderPaymentId(e.target.value)}
                        placeholder="ID do pagamento confirmado no App"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                      />
                      <p className="mt-1.5 text-xs text-slate-500">O servidor consulta o provedor. Sem estado aprovado, a conta não é marcada como paga.</p>
                    </div>
                  )}

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
                  (metodo === 'cash' && Number(recebido) < total) ||
                  (metodo === 'app' && !providerPaymentId.trim())
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
