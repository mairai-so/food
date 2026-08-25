import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, DollarSign, CheckCircle2, XCircle, Loader2, Music, ChevronLeft } from 'lucide-react';
import { getClientToken } from '../lib/storage';

type StatusEvento = 'convidado' | 'confirmado' | 'recusado' | 'concluido' | 'cancelado';

interface EventoArtista {
  id: string;
  restaurantId: string;
  restaurantName: string;
  titulo: string;
  data: string;
  cache?: number;
  couvertParaArtista?: number;
  contrato?: string;
  status: StatusEvento;
}

interface ConsumoArtista {
  id: string;
  restaurantId: string;
  eventoId?: string;
  descricao: string;
  valor: number;
  cortesia: boolean;
  criadoEm: string;
}

const STATUS_LABEL: Record<StatusEvento, string> = {
  convidado: 'Convite recebido',
  confirmado: 'Confirmado',
  recusado: 'Recusado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const STATUS_COLOR: Record<StatusEvento, string> = {
  convidado: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  confirmado: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  recusado: 'bg-slate-700/40 text-slate-400 border-slate-600/30',
  concluido: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  cancelado: 'bg-red-500/15 text-red-400 border-red-500/30',
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatMoney(v?: number) {
  if (v === undefined || v === null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function EspacoArtista({ onBack }: { onBack: () => void }) {
  const [eventos, setEventos] = useState<EventoArtista[]>([]);
  const [consumos, setConsumos] = useState<ConsumoArtista[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'agenda' | 'consumo'>('agenda');

  const token = getClientToken();

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [evRes, coRes] = await Promise.all([
        fetch('/api/miar-apoia/eventos', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/miar-apoia/consumo', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!evRes.ok) throw new Error('Não consegui carregar sua agenda.');
      if (!coRes.ok) throw new Error('Não consegui carregar seu consumo.');
      setEventos(await evRes.json());
      setConsumos(await coRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const responder = async (id: string, status: 'confirmado' | 'recusado') => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/miar-apoia/eventos/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Não consegui atualizar. Tenta de novo.');
      const atualizado = await res.json();
      setEventos((prev) => prev.map((e) => (e.id === id ? atualizado : e)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar.');
    } finally {
      setUpdatingId(null);
    }
  };

  const totalCache = eventos
    .filter((e) => e.status === 'concluido')
    .reduce((acc, e) => acc + (e.cache ?? 0), 0);
  const totalConsumoNaoCortesia = consumos
    .filter((c) => !c.cortesia)
    .reduce((acc, c) => acc + c.valor, 0);

  return (
    <div className="min-h-screen bg-slate-950 pb-24 text-slate-100">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <button onClick={onBack} className="rounded-full p-1.5 hover:bg-slate-800">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <Music className="h-5 w-5 text-emerald-400" />
        <div>
          <h1 className="text-sm font-semibold">Espaço do Artista</h1>
          <p className="text-[11px] text-slate-500">Agenda, cachê e consumo — parte do MIAR Apoia</p>
        </div>
      </header>

      <div className="flex gap-2 border-b border-slate-800 px-4 pt-3">
        <button
          onClick={() => setSubTab('agenda')}
          className={`rounded-t-lg px-3 py-2 text-xs font-medium transition ${
            subTab === 'agenda'
              ? 'border-b-2 border-emerald-400 text-emerald-400'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Agenda de Eventos
        </button>
        <button
          onClick={() => setSubTab('consumo')}
          className={`rounded-t-lg px-3 py-2 text-xs font-medium transition ${
            subTab === 'consumo'
              ? 'border-b-2 border-emerald-400 text-emerald-400'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Cachê &amp; Consumo
        </button>
      </div>

      <main className="mx-auto max-w-lg px-4 py-4">
        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {!loading && subTab === 'agenda' && (
          <div className="space-y-3">
            {eventos.length === 0 && !error && (
              <p className="py-10 text-center text-xs text-slate-500">
                Nenhum convite ainda. Quando um estabelecimento te chamar pra um evento, aparece aqui.
              </p>
            )}
            {eventos.map((ev) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{ev.titulo}</p>
                    <p className="text-[11px] text-slate-500">{ev.restaurantName}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[ev.status]}`}
                  >
                    {STATUS_LABEL[ev.status]}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" /> {formatDate(ev.data)}
                  </span>
                  {ev.cache !== undefined && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" /> Cachê: {formatMoney(ev.cache)}
                    </span>
                  )}
                  {ev.couvertParaArtista !== undefined && (
                    <span>Couvert: {formatMoney(ev.couvertParaArtista)}</span>
                  )}
                </div>

                {ev.contrato && (
                  <p className="mt-2 rounded-lg bg-slate-800/50 p-2 text-[11px] text-slate-400">
                    {ev.contrato}
                  </p>
                )}

                {ev.status === 'convidado' && (
                  <div className="mt-3 flex gap-2">
                    <button
                      disabled={updatingId === ev.id}
                      onClick={() => responder(ev.id, 'confirmado')}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"
                    >
                      {updatingId === ev.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Confirmar
                    </button>
                    <button
                      disabled={updatingId === ev.id}
                      onClick={() => responder(ev.id, 'recusado')}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-2 text-xs font-medium text-slate-300 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Recusar
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {!loading && subTab === 'consumo' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-[11px] text-slate-500">Cachê recebido (eventos concluídos)</p>
                <p className="mt-1 text-lg font-semibold text-emerald-400">{formatMoney(totalCache)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-[11px] text-slate-500">Consumo a descontar</p>
                <p className="mt-1 text-lg font-semibold text-amber-400">{formatMoney(totalConsumoNaoCortesia)}</p>
              </div>
            </div>

            <div className="space-y-2">
              {consumos.length === 0 && (
                <p className="py-10 text-center text-xs text-slate-500">
                  Nenhum consumo registrado ainda.
                </p>
              )}
              {consumos.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
                >
                  <div>
                    <p className="text-xs text-slate-200">{c.descricao}</p>
                    <p className="text-[10px] text-slate-500">{formatDate(c.criadoEm)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium">{formatMoney(c.valor)}</p>
                    {c.cortesia && (
                      <span className="text-[10px] text-emerald-400">cortesia</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
