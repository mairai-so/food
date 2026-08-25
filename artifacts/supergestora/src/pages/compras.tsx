import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { lojaHeaders } from '@/lib/loja';
import { ShoppingCart, Sparkles, Send, ChevronDown, ChevronUp, Loader2, AlertCircle, PackageCheck, AlertTriangle, Check } from 'lucide-react';

interface PurchaseItem {
  nome: string; categoria: string; quantidade: number; unidade: string;
  precoEstimado: number; fornecedorSugerido: string; prioridade: 'alta' | 'media' | 'baixa';
  stockItemId?: string | null; quantidadeRecebida?: number | null;
}
interface Divergencia { nome: string; esperado: number; recebido: number; diferenca: number; unidade: string; }
interface PurchaseList {
  id: string; titulo: string; resumo: string; itens: PurchaseItem[];
  totalEstimado: number; observacoes: string; userRequest: string; createdAt: string;
  recebimentoStatus?: 'aguardando' | 'parcial' | 'completo';
}

function getToken() { return window.localStorage.getItem('miar-owner-token') ?? ''; }

const SUGESTOES = [
  'Gere a lista com base no estoque baixo',
  'Preciso de carnes para o fim de semana',
  'O que está faltando para o próximo turno?',
  'Lista de bebidas e descartáveis',
  'Revisão completa de estoque',
];

const PRIORITY_STYLE: Record<string, string> = {
  alta: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  media: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  baixa: 'bg-slate-800 text-slate-400 border-slate-700',
};

const STATUS_LABEL: Record<string, string> = {
  aguardando: 'Aguardando recebimento', parcial: 'Recebimento parcial', completo: 'Recebimento concluído',
};
const STATUS_STYLE: Record<string, string> = {
  aguardando: 'text-slate-400', parcial: 'text-amber-400', completo: 'text-emerald-400',
};

export default function ComprasPage() {
  const [lists, setLists] = useState<PurchaseList[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [recebimentoMode, setRecebimentoMode] = useState<string | null>(null);
  const [recebimentos, setRecebimentos] = useState<Record<string, Record<number, string>>>({});
  const [sendingRecebimento, setSendingRecebimento] = useState(false);
  const [recebimentoResult, setRecebimentoResult] = useState<{ listId: string; divergencias: Divergencia[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/compras', { headers: { Authorization: `Bearer ${getToken()}`, ...lojaHeaders() } });
      if (r.ok) setLists(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const generate = async (request?: string) => {
    const req = request ?? input.trim();
    if (!req) return;
    setGenerating(true); setError('');
    try {
      const r = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...lojaHeaders() },
        body: JSON.stringify({ request: req }),
      });
      if (r.ok) {
        const list = await r.json() as PurchaseList;
        setLists(prev => [list, ...prev]);
        setExpanded(list.id); setInput('');
      } else {
        const e: any = await r.json();
        setError(e.error ?? 'Erro ao gerar lista');
      }
    } catch { setError('Erro de conexão. Verifique se as chaves de IA estão configuradas.'); }
    finally { setGenerating(false); }
  };

  const initRecebimento = (list: PurchaseList) => {
    // pré-preenche com quantidades já recebidas (se houver), ou vazio
    const init: Record<number, string> = {};
    list.itens.forEach((item, i) => {
      init[i] = item.quantidadeRecebida != null ? String(item.quantidadeRecebida) : '';
    });
    setRecebimentos(r => ({ ...r, [list.id]: init }));
    setRecebimentoMode(list.id);
    setRecebimentoResult(null);
  };

  const confirmarRecebimento = async (listId: string, itens: PurchaseItem[]) => {
    const qtds = recebimentos[listId] ?? {};
    const recebidos = Object.entries(qtds)
      .filter(([, v]) => v !== '' && !isNaN(Number(v)))
      .map(([i, v]) => ({ indice: Number(i), quantidadeRecebida: Number(v) }));

    if (recebidos.length === 0) { setError('Informe pelo menos uma quantidade recebida.'); return; }
    setSendingRecebimento(true); setError('');
    try {
      const r = await fetch(`/api/compras/${listId}/receber`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...lojaHeaders() },
        body: JSON.stringify({ recebidos }),
      });
      if (r.ok) {
        const res: any = await r.json();
        setRecebimentoResult({ listId, divergencias: res.divergencias ?? [] });
        setRecebimentoMode(null);
        await load();
      } else {
        const e: any = await r.json();
        setError(e.error ?? 'Erro ao confirmar recebimento');
      }
    } finally { setSendingRecebimento(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-6">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link href="/painel" className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700 transition-colors">←</Link>
          <div>
            <p className="text-xs uppercase tracking-widest text-violet-400">Miar Ária</p>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-violet-400" /> Assistente de Compras
            </h1>
          </div>
        </div>

        {/* Input de IA */}
        <div className="mb-4 rounded-2xl border border-violet-500/20 bg-slate-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <p className="text-sm font-medium text-violet-300">O que você precisa comprar?</p>
          </div>
          <div className="flex gap-2">
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void generate()}
              placeholder="Ex: preciso de carnes para o fim de semana..."
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
              disabled={generating} />
            <button onClick={() => void generate()} disabled={generating || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500 text-[#0d1b1a] disabled:opacity-40 hover:bg-violet-400 transition-colors">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGESTOES.map(s => (
              <button key={s} onClick={() => void generate(s)} disabled={generating}
                className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300 transition-colors disabled:opacity-40">
                {s}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* Resultado de recebimento */}
        {recebimentoResult && (
          <div className={`mb-4 rounded-2xl border p-4 ${recebimentoResult.divergencias.length > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
            <div className="flex items-center gap-2 mb-2">
              {recebimentoResult.divergencias.length > 0 ? <AlertTriangle className="h-4 w-4 text-amber-400" /> : <Check className="h-4 w-4 text-emerald-400" />}
              <span className="font-medium text-sm">{recebimentoResult.divergencias.length > 0 ? `${recebimentoResult.divergencias.length} divergência(s) encontrada(s)` : 'Recebimento confirmado sem divergências!'}</span>
            </div>
            {recebimentoResult.divergencias.length > 0 && (
              <div className="space-y-1">
                {recebimentoResult.divergencias.map((d, i) => (
                  <div key={i} className="text-xs text-slate-300 flex gap-2">
                    <span className="text-slate-500">•</span>
                    <span><strong>{d.nome}</strong>: esperado {d.esperado} {d.unidade}, recebido {d.recebido} {d.unidade}
                      <span className={d.diferenca < 0 ? 'text-rose-400' : 'text-emerald-400'}> ({d.diferenca > 0 ? '+' : ''}{d.diferenca} {d.unidade})</span>
                    </span>
                  </div>
                ))}
                <p className="text-xs text-slate-500 mt-2">Apenas o recebido foi dado entrada no estoque. As diferenças ficaram registradas.</p>
              </div>
            )}
          </div>
        )}

        {/* Listas */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
        ) : lists.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 py-12 text-center">
            <ShoppingCart className="mx-auto h-8 w-8 text-slate-600 mb-3" />
            <p className="text-slate-400">Nenhuma lista gerada ainda.</p>
            <p className="text-sm text-slate-500 mt-1">Use o campo acima para gerar sua primeira lista.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lists.map(list => {
              const isExpanded = expanded === list.id;
              const isRecebimentoOpen = recebimentoMode === list.id;
              return (
                <div key={list.id} className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                  <button
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-800/40 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : list.id)}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-100 leading-snug">{list.titulo}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{list.resumo}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span>{list.itens.length} {list.itens.length === 1 ? 'item' : 'itens'}</span>
                        <span>R$ {list.totalEstimado.toFixed(2)}</span>
                        <span>{new Date(list.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        {list.recebimentoStatus && (
                          <span className={STATUS_STYLE[list.recebimentoStatus]}>
                            {STATUS_LABEL[list.recebimentoStatus]}
                          </span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400 mt-1" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 mt-1" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-800 p-4">
                      {/* Itens da lista */}
                      <div className="space-y-2 mb-4">
                        {list.itens.map((item, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm text-slate-100">{item.nome}</p>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${PRIORITY_STYLE[item.prioridade]}`}>{item.prioridade}</span>
                                {item.quantidadeRecebida != null && (
                                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${item.quantidadeRecebida === item.quantidade ? 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10' : 'text-amber-300 border-amber-500/20 bg-amber-500/10'}`}>
                                    recebido: {item.quantidadeRecebida} {item.unidade}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">{item.categoria} · {item.fornecedorSugerido}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold text-slate-200">{item.quantidade} {item.unidade}</p>
                              <p className="text-xs text-slate-500">~R$ {item.precoEstimado.toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between rounded-xl bg-violet-500/10 border border-violet-500/20 px-4 py-2.5 mb-3">
                        <p className="text-sm font-medium text-violet-300">Total estimado</p>
                        <p className="text-lg font-bold text-violet-200">R$ {list.totalEstimado.toFixed(2)}</p>
                      </div>

                      {list.observacoes && (
                        <p className="mb-3 text-xs text-slate-400 italic">{list.observacoes}</p>
                      )}

                      {/* Botão de conferência de recebimento */}
                      {!isRecebimentoOpen && list.recebimentoStatus !== 'completo' && (
                        <button onClick={() => initRecebimento(list)}
                          className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300 hover:bg-emerald-500/15 transition-colors w-full justify-center">
                          <PackageCheck className="h-4 w-4" /> Confirmar recebimento
                        </button>
                      )}
                      {list.recebimentoStatus === 'completo' && (
                        <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-sm text-emerald-400">
                          <Check className="h-4 w-4" /> Recebimento já confirmado
                        </div>
                      )}
                    </div>
                  )}

                  {/* Painel de recebimento */}
                  {isRecebimentoOpen && (
                    <div className="border-t border-slate-700 bg-slate-950/60 p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <PackageCheck className="h-4 w-4 text-emerald-400" />
                        <h3 className="font-medium text-emerald-300 text-sm">Conferência de Recebimento</h3>
                        <span className="text-xs text-slate-500 ml-auto">Informe o que chegou de verdade</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-3">Só o que for confirmado aqui entra no estoque. Diferenças ficam registradas como pendência.</p>

                      <div className="space-y-2 mb-4">
                        {list.itens.map((item, i) => (
                          <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-100">{item.nome}</p>
                              <p className="text-xs text-slate-500">Esperado: {item.quantidade} {item.unidade}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="number" min="0" step="any"
                                value={(recebimentos[list.id] ?? {})[i] ?? ''}
                                onChange={e => setRecebimentos(r => ({
                                  ...r,
                                  [list.id]: { ...(r[list.id] ?? {}), [i]: e.target.value },
                                }))}
                                placeholder={String(item.quantidade)}
                                className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 text-right focus:border-emerald-500 focus:outline-none" />
                              <span className="text-xs text-slate-500 w-8">{item.unidade}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {error && (
                        <div className="mb-3 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                          <AlertTriangle className="h-3.5 w-3.5" /> {error}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button onClick={() => { setRecebimentoMode(null); setError(''); }}
                          className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-400 hover:bg-slate-800 transition-colors">
                          Cancelar
                        </button>
                        <button onClick={() => void confirmarRecebimento(list.id, list.itens)} disabled={sendingRecebimento}
                          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-medium text-slate-950 hover:bg-emerald-400 transition-colors disabled:opacity-50">
                          {sendingRecebimento ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Confirmar entrada no estoque
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
