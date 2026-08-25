import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { lojaHeaders } from '@/lib/loja';
import {
  TrendingUp, TrendingDown, AlertTriangle, Settings, RefreshCw,
  ChevronDown, ChevronUp, Info, DollarSign, BarChart3, Calendar,
  CheckCircle, Clock, Loader2
} from 'lucide-react';

interface CostSettings {
  custoFixoMensal: number;
  margemAlvoPercent: number;
  frequenciaRelatorio: 'diario' | 'semanal' | 'quinzenal' | 'mensal' | 'desligado';
}

interface RentabilidadePrato {
  menuItemId: string;
  nome: string;
  precoVenda: number;
  custoIngredientes: number;
  ingredientesSemCusto: string[];
  custoFixoRateado: number;
  custoTotal: number;
  lucroReais: number;
  margemPercent: number;
  quantidadeVendidaPeriodo: number;
  alertaMargemBaixa: boolean;
  precoMinimoParaMargemAlvo: number | null;
}

interface RentabilidadeResponse {
  periodo: { desde: string; ate: string };
  estimativa: boolean;
  pratos: RentabilidadePrato[];
  semFichaTecnica: string[];
}

function getToken() { return window.localStorage.getItem('miar-owner-token') ?? ''; }

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const FREQ_LABELS: Record<string, string> = {
  diario: 'Diário', semanal: 'Semanal', quinzenal: 'Quinzenal',
  mensal: 'Mensal', desligado: 'Desligado',
};

function toDateInput(iso: string) { return iso.slice(0, 10); }
function startOfMonth() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function today() {
  const d = new Date(); return d.toISOString().slice(0, 10);
}

export default function RentabilidadePage() {
  const [data, setData] = useState<RentabilidadeResponse | null>(null);
  const [config, setConfig] = useState<CostSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [desde, setDesde] = useState(startOfMonth());
  const [ate, setAte] = useState(today());
  const [configForm, setConfigForm] = useState({ custoFixoMensal: '', margemAlvoPercent: '', frequenciaRelatorio: 'desligado' as string });
  const [expandedPrato, setExpandedPrato] = useState<string | null>(null);

  const loadConfig = async () => {
    setConfigLoading(true);
    try {
      const r = await fetch('/api/rentabilidade/config', { headers: { Authorization: `Bearer ${getToken()}` } });
      if (r.ok) {
        const c: CostSettings = await r.json();
        setConfig(c);
        setConfigForm({ custoFixoMensal: String(c.custoFixoMensal || ''), margemAlvoPercent: String(c.margemAlvoPercent || ''), frequenciaRelatorio: c.frequenciaRelatorio });
      }
    } finally { setConfigLoading(false); }
  };

  const loadRelatorio = async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ desde: new Date(desde).toISOString(), ate: new Date(ate + 'T23:59:59').toISOString() });
      const r = await fetch(`/api/rentabilidade/pratos?${params}`, { headers: { Authorization: `Bearer ${getToken()}`, ...lojaHeaders() } });
      if (r.ok) setData(await r.json());
      else { const e: any = await r.json(); setError(e.error ?? 'Erro ao carregar relatório'); }
    } catch { setError('Erro de conexão.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadConfig(); void loadRelatorio(); }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const body: Partial<CostSettings> = {
        custoFixoMensal: configForm.custoFixoMensal ? Number(configForm.custoFixoMensal) : 0,
        margemAlvoPercent: configForm.margemAlvoPercent ? Number(configForm.margemAlvoPercent) : 0,
        frequenciaRelatorio: configForm.frequenciaRelatorio as CostSettings['frequenciaRelatorio'],
      };
      const r = await fetch('/api/rentabilidade/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      if (r.ok) { await loadConfig(); setShowConfig(false); void loadRelatorio(); }
    } finally { setSaving(false); }
  };

  const totalLucro = data?.pratos.reduce((s, p) => s + p.lucroReais * p.quantidadeVendidaPeriodo, 0) ?? 0;
  const totalVendas = data?.pratos.reduce((s, p) => s + p.precoVenda * p.quantidadeVendidaPeriodo, 0) ?? 0;
  const margemGeral = totalVendas > 0 ? (totalLucro / totalVendas) * 100 : 0;
  const alertasPratos = data?.pratos.filter(p => p.alertaMargemBaixa).length ?? 0;

  const inp = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-6">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/painel" className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700 transition-colors">←</Link>
            <div>
              <p className="text-xs uppercase tracking-widest text-amber-400">Financeiro</p>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-400" /> Rentabilidade por Prato
              </h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowConfig(v => !v)}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
              <Settings className="h-4 w-4" /> Configurar
            </button>
            <button onClick={() => void loadRelatorio()} disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400 transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar
            </button>
          </div>
        </div>

        {/* Config panel */}
        {showConfig && (
          <div className="mb-6 rounded-2xl border border-amber-500/20 bg-slate-900 p-5">
            <h2 className="mb-4 font-semibold text-amber-300 flex items-center gap-2"><Settings className="h-4 w-4" /> Configurações Financeiras</h2>
            {configLoading ? <div className="text-sm text-slate-500">Carregando...</div> : (
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Custo fixo mensal (R$)</label>
                  <input type="number" min="0" value={configForm.custoFixoMensal}
                    onChange={e => setConfigForm(f => ({ ...f, custoFixoMensal: e.target.value }))}
                    placeholder="Ex: 5000" className={inp} />
                  <p className="mt-1 text-xs text-slate-500">Aluguel, salários, energia, etc.</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Margem-alvo (%)</label>
                  <input type="number" min="0" max="99" value={configForm.margemAlvoPercent}
                    onChange={e => setConfigForm(f => ({ ...f, margemAlvoPercent: e.target.value }))}
                    placeholder="Ex: 30" className={inp} />
                  <p className="mt-1 text-xs text-slate-500">Pratos abaixo ficam marcados em vermelho.</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Relatório automático</label>
                  <select value={configForm.frequenciaRelatorio}
                    onChange={e => setConfigForm(f => ({ ...f, frequenciaRelatorio: e.target.value }))}
                    className={inp}>
                    {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowConfig(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={() => void saveConfig()} disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400 transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Salvar
              </button>
            </div>
          </div>
        )}

        {/* Filtro de período */}
        <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400 flex items-center gap-1"><Calendar className="h-3 w-3" /> De</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Até</label>
            <input type="date" value={ate} onChange={e => setAte(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
          </div>
          <button onClick={() => void loadRelatorio()} disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-600 transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Aplicar
          </button>
          {data?.estimativa && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <Clock className="h-3.5 w-3.5" /> Estimativa — mês ainda não fechou
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
          </div>
        )}

        {data && (
          <>
            {/* Resumo */}
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-500/20 bg-slate-900 p-4">
                <p className="text-xs uppercase tracking-widest text-emerald-400 mb-1">Lucro total estimado</p>
                <p className="text-2xl font-bold text-emerald-300">{fmt(totalLucro)}</p>
                <p className="text-xs text-slate-500 mt-1">no período selecionado</p>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-slate-900 p-4">
                <p className="text-xs uppercase tracking-widest text-amber-400 mb-1">Margem geral</p>
                <p className={`text-2xl font-bold ${margemGeral >= (config?.margemAlvoPercent ?? 0) ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {fmtPct(margemGeral)}
                </p>
                {config && config.margemAlvoPercent > 0 && (
                  <p className="text-xs text-slate-500 mt-1">Alvo: {fmtPct(config.margemAlvoPercent)}</p>
                )}
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Alertas de margem</p>
                <p className={`text-2xl font-bold ${alertasPratos > 0 ? 'text-rose-300' : 'text-slate-300'}`}>
                  {alertasPratos} {alertasPratos === 1 ? 'prato' : 'pratos'}
                </p>
                <p className="text-xs text-slate-500 mt-1">abaixo da margem-alvo</p>
              </div>
            </div>

            {/* Pratos sem ficha técnica */}
            {data.semFichaTecnica.length > 0 && (
              <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-amber-400" />
                  <p className="text-sm font-medium text-amber-300">{data.semFichaTecnica.length} {data.semFichaTecnica.length === 1 ? 'prato sem' : 'pratos sem'} ficha técnica</p>
                  <Link href="/ficha-tecnica" className="ml-auto text-xs text-amber-400 underline hover:text-amber-300">Cadastrar →</Link>
                </div>
                <p className="text-xs text-slate-400 mb-2">Esses pratos não entram no cálculo de rentabilidade:</p>
                <div className="flex flex-wrap gap-2">
                  {data.semFichaTecnica.map(n => (
                    <span key={n} className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">{n}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de pratos */}
            {data.pratos.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 py-12 text-center">
                <BarChart3 className="mx-auto h-10 w-10 text-slate-600 mb-3" />
                <p className="text-slate-400">Nenhum prato vendido no período com ficha técnica cadastrada.</p>
                <Link href="/ficha-tecnica" className="mt-2 inline-block text-sm text-amber-400 underline hover:text-amber-300">Cadastrar ficha técnica →</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {data.pratos.map((p) => {
                  const expanded = expandedPrato === p.menuItemId;
                  const lucroTotal = p.lucroReais * p.quantidadeVendidaPeriodo;
                  return (
                    <div key={p.menuItemId}
                      className={`rounded-2xl border bg-slate-900 overflow-hidden transition-colors ${p.alertaMargemBaixa ? 'border-rose-500/30' : 'border-slate-800'}`}>
                      <button
                        className="w-full p-4 text-left flex items-center gap-4 hover:bg-slate-800/50 transition-colors"
                        onClick={() => setExpandedPrato(expanded ? null : p.menuItemId)}>
                        {/* Indicador de margem */}
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${p.alertaMargemBaixa ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                          {p.alertaMargemBaixa ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-100">{p.nome}</span>
                            {p.alertaMargemBaixa && (
                              <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-xs text-rose-300 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Margem baixa
                              </span>
                            )}
                            {p.ingredientesSemCusto.length > 0 && (
                              <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-xs text-amber-300 flex items-center gap-1">
                                <Info className="h-3 w-3" /> Custos incompletos
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                            <span>{p.quantidadeVendidaPeriodo} vendidos</span>
                            <span>Venda: {fmt(p.precoVenda)}</span>
                            <span>Custo: {fmt(p.custoTotal)}</span>
                            <span className={p.lucroReais >= 0 ? 'text-emerald-400' : 'text-rose-400'}>Lucro: {fmt(p.lucroReais)}</span>
                            <span className={`font-medium ${p.alertaMargemBaixa ? 'text-rose-400' : 'text-emerald-400'}`}>{fmtPct(p.margemPercent)}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-slate-200">{fmt(lucroTotal)}</p>
                          <p className="text-xs text-slate-500">lucro total</p>
                        </div>
                        {expanded ? <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />}
                      </button>

                      {expanded && (
                        <div className="border-t border-slate-800 px-4 pb-4 pt-3 grid sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Composição do custo</p>
                            <div className="space-y-1.5 text-sm">
                              <div className="flex justify-between"><span className="text-slate-400">Ingredientes</span><span>{fmt(p.custoIngredientes)}</span></div>
                              <div className="flex justify-between"><span className="text-slate-400">Custo fixo (rateio)</span><span>{fmt(p.custoFixoRateado)}</span></div>
                              <div className="flex justify-between font-medium border-t border-slate-800 pt-1.5"><span>Total por unidade</span><span>{fmt(p.custoTotal)}</span></div>
                              <div className="flex justify-between text-slate-400"><span>Preço de venda</span><span>{fmt(p.precoVenda)}</span></div>
                              <div className={`flex justify-between font-semibold ${p.lucroReais >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                <span>Lucro por unidade</span><span>{fmt(p.lucroReais)}</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Período</p>
                            <div className="space-y-1.5 text-sm">
                              <div className="flex justify-between"><span className="text-slate-400">Vendidos</span><span>{p.quantidadeVendidaPeriodo} un</span></div>
                              <div className="flex justify-between"><span className="text-slate-400">Receita total</span><span>{fmt(p.precoVenda * p.quantidadeVendidaPeriodo)}</span></div>
                              <div className={`flex justify-between font-semibold ${lucroTotal >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                <span>Lucro total</span><span>{fmt(lucroTotal)}</span>
                              </div>
                            </div>
                            {p.precoMinimoParaMargemAlvo != null && p.alertaMargemBaixa && (
                              <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                                <p className="text-xs text-amber-400 flex items-center gap-1">
                                  <DollarSign className="h-3.5 w-3.5" /> Preço mínimo para bater a margem-alvo
                                </p>
                                <p className="mt-1 text-lg font-bold text-amber-300">{fmt(p.precoMinimoParaMargemAlvo)}</p>
                              </div>
                            )}
                            {p.ingredientesSemCusto.length > 0 && (
                              <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
                                <p className="font-medium mb-1">Ingredientes sem custo cadastrado:</p>
                                <p className="text-slate-400">{p.ingredientesSemCusto.join(', ')}</p>
                                <Link href="/estoque" className="mt-1 inline-block underline hover:text-amber-200">Cadastrar custo no estoque →</Link>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
