import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { AlertCircle, CheckCircle2, MessageSquareText, RefreshCw } from 'lucide-react';

interface ComplaintRow {
  id: string;
  user_id?: string;
  order_id?: string;
  restaurant_id?: string;
  restaurant_name?: string;
  type?: string;
  description?: string;
  status?: string;
  staff_response?: string;
  created_at?: string;
}

const STATUS_LABEL: Record<string, string> = {
  aberta: 'Aberta',
  em_analise: 'Em análise',
  resolvida: 'Resolvida',
  encerrada: 'Encerrada',
};

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? '';
}

export default function ComplaintsPage() {
  const [rows, setRows] = useState<ComplaintRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'aberta' | 'em_analise' | 'resolvida' | 'encerrada'>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/complaints/admin/all', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Não foi possível carregar as reclamações.');
      }
      const data = await r.json() as ComplaintRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as reclamações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((row) => row.status === filter);
  }, [filter, rows]);

  const updateStatus = async (row: ComplaintRow, status: string) => {
    if (!row.id) return;
    const response = window.prompt('Resposta do SAC para o cliente:', row.staff_response ?? '') ?? row.staff_response ?? '';
    setSavingId(row.id);
    setError('');

    try {
      const r = await fetch(`/api/complaints/${row.id}/respond`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ status, response }),
      });

      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Não foi possível atualizar a reclamação.');
      }

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar a reclamação.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link href="/painel" className="mb-3 inline-block text-sm text-slate-400 hover:text-slate-200">← Voltar</Link>
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-400">SAC</p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold">
              <MessageSquareText className="h-5 w-5 text-amber-400" /> Reclamações e feedback
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {(['all', 'aberta', 'em_analise', 'resolvida', 'encerrada'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                filter === value
                  ? 'border-amber-400 bg-amber-500/10 text-amber-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
              }`}
            >
              {value === 'all' ? 'Todas' : STATUS_LABEL[value]}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
            Carregando reclamações...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
            Nenhuma reclamação neste filtro.
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredRows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm text-slate-400">
                      {row.restaurant_name ?? 'Restaurante'} · {row.type ?? 'outro'} · {row.order_id ? `Pedido ${row.order_id}` : 'Sem pedido'}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : 'Data indisponível'}
                    </div>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200">
                    {STATUS_LABEL[row.status ?? 'aberta'] ?? row.status ?? 'Aberta'}
                  </span>
                </div>

                <div className="mb-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-200">
                  {row.description ?? 'Sem descrição informada.'}
                </div>

                <div className="mb-4 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-300">
                  <div className="mb-1 text-xs uppercase tracking-[0.2em] text-slate-500">Resposta do SAC</div>
                  {row.staff_response ? row.staff_response : 'Ainda sem resposta registrada.'}
                </div>

                <div className="flex flex-wrap gap-2">
                  {(['aberta', 'em_analise', 'resolvida', 'encerrada'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={savingId === row.id}
                      onClick={() => void updateStatus(row, status)}
                      className={`rounded-lg border px-3 py-2 text-sm transition ${
                        row.status === status
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                          : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500'
                      } ${savingId === row.id ? 'cursor-wait opacity-70' : ''}`}
                    >
                      {STATUS_LABEL[status]}
                    </button>
                  ))}
                </div>

                {row.status === 'resolvida' && (
                  <div className="mt-3 inline-flex items-center gap-2 text-sm text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> Processo em resolução
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
