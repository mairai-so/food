import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, ShoppingBag, Plus, Clock } from 'lucide-react';
import { apiGet, brl } from './api';
import type { TableWithSession } from './tipos';
import type { ContextoCaixa } from './CaixaFlutuante';

interface PedidoRetirada {
  id: string;
  customerName?: string;
  total: number;
  createdAt: string;
  status: string;
}

const corMesa: Record<string, string> = {
  free: 'border-slate-800 bg-slate-900',
  occupied: 'border-violet-600/50 bg-violet-950/40',
  paid: 'border-emerald-600/50 bg-emerald-950/40',
  reserved: 'border-amber-600/50 bg-amber-950/30',
  cleaning: 'border-slate-700 bg-slate-800/50',
};

function elapsed(createdAt: string) {
  const min = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  return min < 1 ? 'agora' : `${min}min`;
}

export default function PainelPrincipal({
  onAbrirCaixa,
}: {
  onAbrirCaixa: (ctx: ContextoCaixa) => void;
}) {
  const [mesas, setMesas] = useState<TableWithSession[]>([]);
  const [retiradas, setRetiradas] = useState<PedidoRetirada[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const [mesasRes, pedidosRes] = await Promise.all([
        apiGet<TableWithSession[]>('/tables/with-sessions'),
        apiGet<PedidoRetirada[] & { mode?: string; status?: string }[]>('/orders'),
      ]);
      setMesas(mesasRes);
      const pendentes = (pedidosRes as any[]).filter(
        (o) => o.mode === 'pickup' && o.status !== 'paid'
      );
      setRetiradas(pendentes);
    } catch {
      /* mantém tela anterior — polling tenta de novo */
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(), 6000);
    return () => clearInterval(t);
  }, [carregar]);

  const ocupadas = mesas.filter((m) => m.status !== 'free').length;

  if (carregando) {
    return <div className="flex flex-1 items-center justify-center text-slate-500">Carregando salão…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      {/* Retiradas aguardando pagamento */}
      {retiradas.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-400">
            <ShoppingBag className="h-4 w-4" /> Retiradas aguardando pagamento ({retiradas.length})
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {retiradas.map((p) => (
              <button
                key={p.id}
                onClick={() => onAbrirCaixa({ tipo: 'retirada', pedido: p })}
                className="flex min-w-[11rem] flex-col gap-1 rounded-xl border border-amber-600/50 bg-amber-950/30 px-4 py-3 text-left transition hover:border-amber-500"
              >
                <span className="truncate font-semibold text-slate-100">{p.customerName ?? 'Cliente'}</span>
                <span className="text-lg font-bold text-amber-300">{brl(p.total)}</span>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="h-3 w-3" /> {elapsed(p.createdAt)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Botão balcão */}
      <button
        onClick={() => onAbrirCaixa({ tipo: 'balcao' })}
        className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-600/60 bg-violet-950/20 py-3.5 font-semibold text-violet-300 transition hover:bg-violet-950/40"
      >
        <Plus className="h-5 w-5" /> Balcão — nova venda
      </button>

      {/* Mapa de mesas */}
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        <Users className="h-4 w-4" /> Mesas ({ocupadas}/{mesas.length} ocupadas)
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {mesas.map((mesa) => {
          const temAlerta = mesa.status === 'paid';
          return (
            <motion.button
              key={mesa.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => mesa.session && onAbrirCaixa({ tipo: 'mesa', mesa })}
              disabled={!mesa.session}
              className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${corMesa[mesa.status] ?? corMesa.free} ${!mesa.session ? 'opacity-60' : 'hover:brightness-125'}`}
            >
              {temAlerta && (
                <span className="absolute -right-1.5 -top-1.5 h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
              )}
              <span className="text-lg font-bold text-slate-100">Mesa {mesa.number}</span>
              {mesa.session ? (
                <>
                  <span className="text-sm text-slate-300">{mesa.session.guestCount} pessoa(s)</span>
                  <span className="font-semibold text-slate-100">{brl(mesa.session.pendingAmount)}</span>
                  {mesa.session.fullyPaid && (
                    <span className="text-xs font-medium text-emerald-400">pago — liberar</span>
                  )}
                </>
              ) : (
                <span className="text-sm text-slate-500 capitalize">{mesa.status === 'free' ? 'livre' : mesa.status}</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
