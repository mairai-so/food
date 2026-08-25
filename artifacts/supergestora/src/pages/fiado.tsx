// Multi-loja (15/08/2026): Fiado é por conta do restaurante, não por loja —
// não usa lojaHeaders(). Tela nova: o backend (routes/fiado.ts) já existia
// desde antes, sem nenhuma tela que o usasse.
import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { HandCoins, Plus, Check, X, Clock } from 'lucide-react';

interface FiadoRegistro {
  id: string;
  clientAccountId: string;
  clientName: string;
  valorTotal: number;
  valorPago: number;
  saldoAberto: number;
  diasEmAberto: number;
  criadoEm: string;
  quitadoEm?: string;
}

function getToken() { return window.localStorage.getItem('miar-owner-token') ?? ''; }
function brl(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

export default function FiadoPage() {
  const [registros, setRegistros] = useState<FiadoRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ clientAccountId: '', clientName: '', valorTotal: '' });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [pagamentoAberto, setPagamentoAberto] = useState<string | null>(null);
  const [valorPagamento, setValorPagamento] = useState('');
  const [mostrarQuitados, setMostrarQuitados] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/fiado', { headers: { Authorization: `Bearer ${getToken()}` } });
      if (r.ok) setRegistros(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const registrar = async () => {
    setErro('');
    if (!form.clientAccountId.trim() || !form.clientName.trim() || !form.valorTotal) {
      setErro('Preencha cliente e valor.');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/fiado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          clientAccountId: form.clientAccountId.trim(),
          clientName: form.clientName.trim(),
          valorTotal: Number(form.valorTotal),
        }),
      });
      if (!r.ok) { const e = await r.json(); setErro(e.error ?? 'Erro ao registrar'); return; }
      setForm({ clientAccountId: '', clientName: '', valorTotal: '' });
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  };

  const registrarPagamento = async (id: string) => {
    if (!valorPagamento || Number(valorPagamento) <= 0) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/fiado/${id}/pagamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ valor: Number(valorPagamento) }),
      });
      if (r.ok) { setPagamentoAberto(null); setValorPagamento(''); await load(); }
    } finally { setSaving(false); }
  };

  const abertos = registros.filter((r) => !r.quitadoEm);
  const quitados = registros.filter((r) => r.quitadoEm);
  const totalEmAberto = abertos.reduce((s, r) => s + r.saldoAberto, 0);
  const visiveis = mostrarQuitados ? quitados : abertos;

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/painel" className="text-sm text-slate-400 hover:text-slate-200">← Voltar</Link>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold"><HandCoins className="h-6 w-6 text-emerald-400" /> Fiado</h1>
          </div>
          <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950">
            <Plus className="h-4 w-4" /> Novo fiado
          </button>
        </div>

        <div className="mb-4 rounded-xl bg-slate-900 px-4 py-3">
          <span className="text-slate-400">Total em aberto</span>
          <div className="text-2xl font-bold text-amber-400">{brl(totalEmAberto)}</div>
        </div>

        {showForm && (
          <div className="mb-4 space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <input placeholder="ID do cadastro do cliente (clientAccountId)" value={form.clientAccountId}
              onChange={(e) => setForm({ ...form, clientAccountId: e.target.value })}
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm" />
            <input placeholder="Nome do cliente" value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm" />
            <input placeholder="Valor total (R$)" type="number" value={form.valorTotal}
              onChange={(e) => setForm({ ...form, valorTotal: e.target.value })}
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm" />
            {erro && <p className="text-sm text-red-400">{erro}</p>}
            <div className="flex gap-2">
              <button onClick={registrar} disabled={saving} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Registrar'}
              </button>
              <button onClick={() => setShowForm(false)} className="rounded-lg bg-slate-800 px-4 py-2 text-sm">Cancelar</button>
            </div>
          </div>
        )}

        <div className="mb-3 flex gap-2 text-sm">
          <button onClick={() => setMostrarQuitados(false)} className={`rounded-lg px-3 py-1.5 ${!mostrarQuitados ? 'bg-slate-800 text-slate-100' : 'text-slate-500'}`}>
            Em aberto ({abertos.length})
          </button>
          <button onClick={() => setMostrarQuitados(true)} className={`rounded-lg px-3 py-1.5 ${mostrarQuitados ? 'bg-slate-800 text-slate-100' : 'text-slate-500'}`}>
            Quitados ({quitados.length})
          </button>
        </div>

        {loading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : visiveis.length === 0 ? (
          <p className="text-slate-500">Nenhum registro aqui.</p>
        ) : (
          <div className="space-y-2">
            {visiveis.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{r.clientName}</div>
                    <div className="text-xs text-slate-500">
                      Total {brl(r.valorTotal)} · Pago {brl(r.valorPago)}
                      {!r.quitadoEm && <> · <Clock className="inline h-3 w-3" /> {r.diasEmAberto}d em aberto</>}
                    </div>
                  </div>
                  <div className="text-right">
                    {r.quitadoEm ? (
                      <span className="flex items-center gap-1 text-sm text-emerald-400"><Check className="h-4 w-4" /> Quitado</span>
                    ) : (
                      <span className="text-lg font-bold text-amber-400">{brl(r.saldoAberto)}</span>
                    )}
                  </div>
                </div>

                {!r.quitadoEm && (
                  pagamentoAberto === r.id ? (
                    <div className="mt-3 flex gap-2">
                      <input type="number" placeholder="Valor recebido" value={valorPagamento}
                        onChange={(e) => setValorPagamento(e.target.value)}
                        className="w-32 rounded-lg bg-slate-800 px-3 py-1.5 text-sm" />
                      <button onClick={() => registrarPagamento(r.id)} disabled={saving} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950">
                        Confirmar
                      </button>
                      <button onClick={() => { setPagamentoAberto(null); setValorPagamento(''); }} className="rounded-lg bg-slate-800 p-1.5">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setPagamentoAberto(r.id)} className="mt-3 text-sm text-emerald-400 hover:underline">
                      Registrar pagamento
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
