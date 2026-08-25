// Central de Lojas (15/08/2026) — a peça que faltava no Multi-Loja: uma
// visão de verdade com as N lojas da conta lado a lado, cada uma com seus
// próprios números (mesas, pedidos, faturamento do dia, caixa, estoque).
// Complementa a Central de Comando (que é o painel de apps/iframes) sem
// substituir ela — são duas telas com propósitos diferentes.
import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Store, Table2, ShoppingBag, DollarSign, AlertTriangle, CircleDot } from 'lucide-react';

interface ResumoLoja {
  lojaId: string;
  nome: string;
  endereco?: string;
  mesasOcupadas: number;
  totalMesas: number;
  pedidosAbertos: number;
  faturamentoHoje: number;
  caixaAberto: boolean;
  alertasEstoque: number;
}

function getToken() { return window.localStorage.getItem('miar-owner-token') ?? ''; }
function brl(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

export default function CentralDeLojas() {
  const [lojas, setLojas] = useState<ResumoLoja[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    fetch('/api/dashboard/lojas', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error('Erro ao carregar lojas');
        return r.json();
      })
      .then(setLojas)
      .catch(() => setErro('Não foi possível carregar o resumo das lojas.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <Link href="/painel" className="text-sm text-slate-400 hover:text-slate-200">← Voltar</Link>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <Store className="h-6 w-6 text-emerald-400" /> Central de Lojas
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Visão lado a lado de todas as lojas ativas da sua conta. Cada cartão mostra os números
          daquela loja especificamente — nunca misturados com as demais.
        </p>

        {loading ? (
          <p className="mt-6 text-slate-500">Carregando...</p>
        ) : erro ? (
          <p className="mt-6 text-rose-400">{erro}</p>
        ) : lojas.length === 0 ? (
          <p className="mt-6 text-slate-500">Nenhuma loja ativa encontrada.</p>
        ) : lojas.length === 1 ? (
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
            Sua conta tem só uma loja ativa hoje ({lojas[0].nome}). Esta tela ganha mais valor
            quando você cadastrar mais lojas — pode fazer isso pelo seletor de loja no topo do
            Gestor.
          </div>
        ) : null}

        {lojas.length > 0 && (
          <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(lojas.length, 4)}, minmax(240px, 1fr))` }}>
            {lojas.map((loja) => (
              <div key={loja.lojaId} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{loja.nome}</div>
                    {loja.endereco && <div className="text-xs text-slate-500">{loja.endereco}</div>}
                  </div>
                  <span className="flex items-center gap-1 text-xs">
                    <CircleDot className={`h-3 w-3 ${loja.caixaAberto ? 'text-emerald-400' : 'text-slate-600'}`} />
                    {loja.caixaAberto ? 'Caixa aberto' : 'Caixa fechado'}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-400"><Table2 className="h-3.5 w-3.5" /> Mesas</span>
                    <span>{loja.mesasOcupadas}/{loja.totalMesas} ocupadas</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-400"><ShoppingBag className="h-3.5 w-3.5" /> Pedidos abertos</span>
                    <span>{loja.pedidosAbertos}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-400"><DollarSign className="h-3.5 w-3.5" /> Faturamento hoje</span>
                    <span className="font-semibold text-emerald-400">{brl(loja.faturamentoHoje)}</span>
                  </div>
                  {loja.alertasEstoque > 0 && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-amber-950/40 px-2 py-1.5 text-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {loja.alertasEstoque} {loja.alertasEstoque === 1 ? 'item' : 'itens'} de estoque baixo
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
