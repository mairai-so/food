import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Package, Plus, Pencil, Trash2, AlertTriangle, Check, X } from 'lucide-react';
import { lojaHeaders } from '@/lib/loja';

interface StockItem {
  id: string; name: string; category: string;
  quantity: number; unit: string; minQuantity: number;
  expiresAt?: string; alertDaysBefore: number;
  lastCountedAt: string; updatedAt: string;
  unitCost?: number; // custo por unidade — base do cálculo de rentabilidade (30/07/2026)
  lojaId?: string; // "todas" = compartilhado entre lojas (15/08/2026)
}

function getToken() { return window.localStorage.getItem('miar-owner-token') ?? ''; }

const UNITS = ['kg', 'g', 'L', 'mL', 'un', 'cx', 'pacote', 'saco', 'garrafa', 'lata', 'fardo'];
const CATEGORIES = ['Carnes', 'Grãos', 'Laticínios', 'Temperos', 'Bebidas', 'Descartáveis', 'Hortifruti', 'Outros'];

export default function EstoquePage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', category: 'Carnes', quantity: '', unit: 'kg', minQuantity: '', expiresAt: '', unitCost: '', compartilhado: false });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      // Multi-loja (14/08/2026): x-loja-id filtra pro estoque da loja ativa.
      const r = await fetch('/api/stock', { headers: { Authorization: `Bearer ${getToken()}`, ...lojaHeaders() } });
      if (r.ok) setItems(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const resetForm = () => { setForm({ name: '', category: 'Carnes', quantity: '', unit: 'kg', minQuantity: '', expiresAt: '', unitCost: '', compartilhado: false }); setEditId(null); };

  const startEdit = (item: StockItem) => {
    setForm({
      name: item.name, category: item.category,
      quantity: String(item.quantity), unit: item.unit,
      minQuantity: String(item.minQuantity),
      expiresAt: item.expiresAt ? item.expiresAt.slice(0, 10) : '',
      unitCost: item.unitCost != null ? String(item.unitCost) : '',
      compartilhado: item.lojaId === 'todas',
    });
    setEditId(item.id);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name || !form.quantity) return;
    setSaving(true);
    try {
      const body = {
        name: form.name, category: form.category,
        quantity: Number(form.quantity), unit: form.unit,
        minQuantity: Number(form.minQuantity || 0),
        expiresAt: form.expiresAt || undefined,
        unitCost: form.unitCost ? Number(form.unitCost) : undefined,
        compartilhado: form.compartilhado,
      };
      const url = editId ? `/api/stock/${editId}` : '/api/stock';
      const method = editId ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...lojaHeaders() },
        body: JSON.stringify(body),
      });
      if (r.ok) { await load(); setShowForm(false); resetForm(); }
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este item do estoque?')) return;
    await fetch(`/api/stock/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}`, ...lojaHeaders() } });
    await load();
  };

  const isLow = (item: StockItem) => item.quantity <= item.minQuantity;
  const isExpiring = (item: StockItem) => {
    if (!item.expiresAt) return false;
    const days = (new Date(item.expiresAt).getTime() - Date.now()) / 86400000;
    return days <= item.alertDaysBefore;
  };

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(filter.toLowerCase()) ||
    i.category.toLowerCase().includes(filter.toLowerCase())
  );

  const lowCount = items.filter(isLow).length;
  const expiringCount = items.filter(isExpiring).length;

  const inp = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-6">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/painel" className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700 transition-colors">←</Link>
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-400">Gestão</p>
              <h1 className="text-xl font-semibold flex items-center gap-2"><Package className="h-5 w-5 text-emerald-400" /> Estoque</h1>
            </div>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 transition-colors">
            <Plus className="h-4 w-4" /> Novo item
          </button>
        </div>

        {/* Alertas */}
        {(lowCount > 0 || expiringCount > 0) && (
          <div className="mb-4 flex flex-wrap gap-3">
            {lowCount > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                {lowCount} {lowCount === 1 ? 'item abaixo' : 'itens abaixo'} do mínimo
              </div>
            )}
            {expiringCount > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
                <AlertTriangle className="h-4 w-4" />
                {expiringCount} {expiringCount === 1 ? 'item vencendo' : 'itens vencendo'} em breve
              </div>
            )}
          </div>
        )}

        {/* Busca */}
        <input className={`${inp} mb-4`} placeholder="🔍 Buscar por nome ou categoria..."
          value={filter} onChange={e => setFilter(e.target.value)} />

        {/* Formulário */}
        {showForm && (
          <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold">{editId ? 'Editar item' : 'Novo item'}</p>
              <button onClick={() => { setShowForm(false); resetForm(); }}><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={inp} placeholder="Nome do item *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <select className={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <input className={inp} type="number" min="0" step="0.1" placeholder="Quantidade *" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              <select className={inp} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
              <input className={inp} type="number" min="0" step="0.1" placeholder="Quantidade mínima (alerta)" value={form.minQuantity} onChange={e => setForm(f => ({ ...f, minQuantity: e.target.value }))} />
              <input className={inp} type="number" min="0" step="0.01" placeholder="Custo por unidade (R$) — pra rentabilidade" value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))} />
              <input className={inp} type="date" placeholder="Vencimento (opcional)" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
              <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.compartilhado}
                  onChange={e => setForm(f => ({ ...f, compartilhado: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-emerald-500"
                />
                Item compartilhado entre todas as lojas (mesmo saldo, descontado igual não importa qual loja vendeu)
              </label>
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={save} disabled={saving || !form.name || !form.quantity}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50 hover:bg-emerald-400 transition-colors">
                <Check className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => { setShowForm(false); resetForm(); }}
                className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <p className="text-center text-slate-500 py-12">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-500 py-12">Nenhum item encontrado.</p>
        ) : (
          <div className="space-y-2">
            {/* Agrupado por categoria */}
            {CATEGORIES.filter(cat => filtered.some(i => i.category === cat)).map(cat => (
              <div key={cat}>
                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-widest text-slate-500">{cat}</p>
                <div className="space-y-2">
                  {filtered.filter(i => i.category === cat).map(item => (
                    <div key={item.id} className={`flex items-center justify-between gap-4 rounded-xl border p-3 transition-colors
                      ${isLow(item) ? 'border-amber-500/30 bg-amber-500/5' : isExpiring(item) ? 'border-rose-500/30 bg-rose-500/5' : 'border-slate-800 bg-slate-900/60'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-slate-100 truncate">{item.name}</p>
                          {isLow(item) && <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300">estoque baixo</span>}
                          {isExpiring(item) && !isLow(item) && <span className="shrink-0 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] text-rose-300">vencendo</span>}
                          {item.lojaId === 'todas' && <span className="shrink-0 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-300">todas as lojas</span>}
                        </div>
                        <p className="text-xs text-slate-400">
                          <span className={item.quantity <= item.minQuantity ? 'text-amber-400 font-semibold' : 'text-slate-300'}>
                            {item.quantity} {item.unit}
                          </span>
                          {item.minQuantity > 0 && <span className="text-slate-500"> · mín. {item.minQuantity} {item.unit}</span>}
                          {item.expiresAt && <span className="text-slate-500"> · vence {new Date(item.expiresAt).toLocaleDateString('pt-BR')}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => startEdit(item)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => void remove(item.id)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
