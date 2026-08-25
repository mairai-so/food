import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import {
  ChefHat, Plus, Trash2, Check, AlertTriangle, Loader2,
  ChevronDown, ChevronUp, Search, Package
} from 'lucide-react';

interface StockItem {
  id: string; name: string; category: string; unit: string; unitCost?: number;
}

interface FichaTecnicaItem {
  stockItemId: string; quantidadePorUnidade: number;
}

interface MenuItem {
  id: string; name: string; category: string; price: number; available: boolean;
  fichaTecnica?: FichaTecnicaItem[];
}

function getToken() { return window.localStorage.getItem('miar-owner-token') ?? ''; }
const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function FichaTecnicaPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editFicha, setEditFicha] = useState<Record<string, FichaTecnicaItem[]>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [menuR, stockR] = await Promise.all([
        fetch('/api/restaurants/me/menu-completo', { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch('/api/stock', { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [menuData, stockData] = await Promise.all([menuR.json(), stockR.json()]);
      setMenuItems(Array.isArray(menuData) ? menuData : []);
      setStockItems(Array.isArray(stockData) ? stockData : []);
      // pré-preenche o estado de edição com as fichas já cadastradas
      const initial: Record<string, FichaTecnicaItem[]> = {};
      for (const m of (Array.isArray(menuData) ? menuData : [])) {
        initial[m.id] = m.fichaTecnica?.length ? [...m.fichaTecnica] : [];
      }
      setEditFicha(initial);
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const addIngredient = (menuItemId: string) => {
    setEditFicha(f => ({
      ...f,
      [menuItemId]: [...(f[menuItemId] ?? []), { stockItemId: '', quantidadePorUnidade: 0 }],
    }));
  };

  const removeIngredient = (menuItemId: string, idx: number) => {
    setEditFicha(f => ({ ...f, [menuItemId]: (f[menuItemId] ?? []).filter((_, i) => i !== idx) }));
  };

  const updateIngredient = (menuItemId: string, idx: number, field: keyof FichaTecnicaItem, value: string | number) => {
    setEditFicha(f => {
      const list = [...(f[menuItemId] ?? [])];
      list[idx] = { ...list[idx], [field]: field === 'quantidadePorUnidade' ? Number(value) : value };
      return { ...f, [menuItemId]: list };
    });
  };

  const saveFicha = async (menuItemId: string) => {
    const ficha = editFicha[menuItemId] ?? [];
    // valida
    for (const ing of ficha) {
      if (!ing.stockItemId) { setError(e => ({ ...e, [menuItemId]: 'Selecione o ingrediente em todos os itens.' })); return; }
      if (ing.quantidadePorUnidade <= 0) { setError(e => ({ ...e, [menuItemId]: 'Quantidade por prato precisa ser maior que zero.' })); return; }
    }
    setSaving(menuItemId);
    setError(e => ({ ...e, [menuItemId]: '' }));
    try {
      const r = await fetch(`/api/menu-items/${menuItemId}/ficha-tecnica`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ fichaTecnica: ficha }),
      });
      if (r.ok) {
        await load();
        setSaved(menuItemId);
        setTimeout(() => setSaved(s => s === menuItemId ? null : s), 2000);
      } else {
        const e: any = await r.json();
        setError(err => ({ ...err, [menuItemId]: e.error ?? 'Erro ao salvar' }));
      }
    } finally { setSaving(null); }
  };

  const calcCustoFicha = (menuItemId: string) => {
    const ficha = editFicha[menuItemId] ?? [];
    let total = 0; let incompleto = false;
    for (const ing of ficha) {
      const stock = stockItems.find(s => s.id === ing.stockItemId);
      if (!stock || typeof stock.unitCost !== 'number') { incompleto = true; continue; }
      total += stock.unitCost * ing.quantidadePorUnidade;
    }
    return { total, incompleto };
  };

  const filtered = menuItems.filter(m =>
    m.name.toLowerCase().includes(filter.toLowerCase()) ||
    m.category.toLowerCase().includes(filter.toLowerCase())
  );

  const comFicha = menuItems.filter(m => m.fichaTecnica?.length).length;

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-6">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/painel" className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700 transition-colors">←</Link>
            <div>
              <p className="text-xs uppercase tracking-widest text-violet-400">Cardápio</p>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-violet-400" /> Ficha Técnica
              </h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-violet-300">{comFicha}/{menuItems.length}</p>
            <p className="text-xs text-slate-500">pratos com ficha</p>
          </div>
        </div>

        {/* Info */}
        <div className="mb-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 text-sm text-violet-300">
          <p>A ficha técnica vincula cada prato aos ingredientes e quantidades usados. Ela alimenta a <strong>baixa automática de estoque</strong> ao confirmar pedido e o <strong>cálculo de rentabilidade por prato</strong>.</p>
        </div>

        {/* Busca */}
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Buscar prato por nome ou categoria..."
            className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none" />
        </div>

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 py-12 text-center">
            <ChefHat className="mx-auto h-10 w-10 text-slate-600 mb-3" />
            <p className="text-slate-400">Nenhum prato encontrado. Cadastre pratos no cardápio primeiro.</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map(item => {
            const isExpanded = expanded === item.id;
            const ficha = editFicha[item.id] ?? [];
            const temFicha = (item.fichaTecnica?.length ?? 0) > 0;
            const { total: custoPrevisto, incompleto } = calcCustoFicha(item.id);

            return (
              <div key={item.id} className={`rounded-2xl border bg-slate-900 overflow-hidden ${temFicha ? 'border-violet-500/20' : 'border-slate-800'}`}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : item.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-800/50 transition-colors">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${temFicha ? 'bg-violet-500/15 text-violet-300' : 'bg-slate-800 text-slate-500'}`}>
                    <ChefHat className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-100">{item.name}</span>
                      <span className="text-xs text-slate-500">{item.category}</span>
                      {temFicha ? (
                        <span className="rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-xs text-violet-300 flex items-center gap-1">
                          <Check className="h-3 w-3" /> {item.fichaTecnica!.length} ingrediente{item.fichaTecnica!.length !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                          Sem ficha
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">Preço: {fmt(item.price)}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-800 p-4">
                    {/* Preview de custo */}
                    {ficha.length > 0 && (
                      <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm">
                        <Package className="h-4 w-4 text-violet-400 shrink-0" />
                        <span className="text-slate-400">Custo estimado por prato:</span>
                        <span className={`font-semibold ${incompleto ? 'text-amber-300' : 'text-violet-300'}`}>
                          {fmt(custoPrevisto)}{incompleto && ' (incompleto — faltam custos no estoque)'}
                        </span>
                      </div>
                    )}

                    {/* Lista de ingredientes */}
                    <div className="space-y-2 mb-3">
                      {ficha.length === 0 && (
                        <p className="text-sm text-slate-500 py-2 text-center">Nenhum ingrediente. Adicione abaixo.</p>
                      )}
                      {ficha.map((ing, idx) => {
                        const stock = stockItems.find(s => s.id === ing.stockItemId);
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <select
                              value={ing.stockItemId}
                              onChange={e => updateIngredient(item.id, idx, 'stockItemId', e.target.value)}
                              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-violet-500 focus:outline-none">
                              <option value="">— Selecionar ingrediente —</option>
                              {stockItems.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.unit}){s.unitCost != null ? ` — ${fmt(s.unitCost)}/${s.unit}` : ''}</option>
                              ))}
                            </select>
                            <div className="flex items-center gap-1">
                              <input
                                type="number" min="0.001" step="0.001"
                                value={ing.quantidadePorUnidade || ''}
                                onChange={e => updateIngredient(item.id, idx, 'quantidadePorUnidade', e.target.value)}
                                placeholder="Qtd"
                                className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-violet-500 focus:outline-none" />
                              <span className="text-xs text-slate-500 w-8">{stock?.unit ?? ''}</span>
                            </div>
                            <button onClick={() => removeIngredient(item.id, idx)}
                              className="rounded-lg border border-slate-700 p-2 text-slate-500 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {error[item.id] && (
                      <div className="mb-3 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                        <AlertTriangle className="h-3.5 w-3.5" /> {error[item.id]}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button onClick={() => addIngredient(item.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors">
                        <Plus className="h-4 w-4" /> Adicionar ingrediente
                      </button>
                      <button onClick={() => void saveFicha(item.id)} disabled={saving === item.id}
                        className="flex items-center gap-1.5 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-[#0d1b1a] hover:bg-violet-400 transition-colors disabled:opacity-50">
                        {saving === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : saved === item.id ? <Check className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                        {saved === item.id ? 'Salvo!' : 'Salvar ficha'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
