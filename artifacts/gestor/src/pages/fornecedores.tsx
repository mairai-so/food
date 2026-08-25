import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Truck, Plus, Pencil, Trash2, Check, X, Phone, Mail } from 'lucide-react';

interface Supplier {
  id: string; restaurantId: string; name: string;
  contact: string; phone: string; email: string;
  category: string; notes: string; createdAt: string;
}

function getToken() { return window.localStorage.getItem('miar-owner-token') ?? ''; }

const CATEGORIES = ['Carnes', 'Grãos', 'Laticínios', 'Temperos', 'Bebidas', 'Descartáveis', 'Hortifruti', 'Geral', 'Outros'];

export default function FornecedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', contact: '', phone: '', email: '', category: 'Geral', notes: '' });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/fornecedores', { headers: { Authorization: `Bearer ${getToken()}` } });
      if (r.ok) setSuppliers(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const resetForm = () => { setForm({ name: '', contact: '', phone: '', email: '', category: 'Geral', notes: '' }); setEditId(null); };

  const startEdit = (s: Supplier) => {
    setForm({ name: s.name, contact: s.contact, phone: s.phone, email: s.email, category: s.category, notes: s.notes });
    setEditId(s.id);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const url = editId ? `/api/fornecedores/${editId}` : '/api/fornecedores';
      const method = editId ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      });
      if (r.ok) { await load(); setShowForm(false); resetForm(); }
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este fornecedor?')) return;
    await fetch(`/api/fornecedores/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
    await load();
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(filter.toLowerCase()) ||
    s.category.toLowerCase().includes(filter.toLowerCase()) ||
    s.contact.toLowerCase().includes(filter.toLowerCase())
  );

  const inp = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-6">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/painel" className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700 transition-colors">←</Link>
            <div>
              <p className="text-xs uppercase tracking-widest text-sky-400">Cadastros</p>
              <h1 className="text-xl font-semibold flex items-center gap-2"><Truck className="h-5 w-5 text-sky-400" /> Fornecedores</h1>
            </div>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 transition-colors">
            <Plus className="h-4 w-4" /> Novo fornecedor
          </button>
        </div>

        {/* Busca */}
        <input className={`${inp} mb-4`} placeholder="🔍 Buscar por nome, contato ou categoria..."
          value={filter} onChange={e => setFilter(e.target.value)} />

        {/* Formulário */}
        {showForm && (
          <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold">{editId ? 'Editar fornecedor' : 'Novo fornecedor'}</p>
              <button onClick={() => { setShowForm(false); resetForm(); }}><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={inp} placeholder="Nome do fornecedor *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <select className={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <input className={inp} placeholder="Nome do contato" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
              <input className={inp} placeholder="Telefone / WhatsApp" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <input className={`${inp} sm:col-span-2`} placeholder="E-mail" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <textarea className={`${inp} sm:col-span-2 resize-none`} rows={2} placeholder="Observações (prazo de entrega, condições de pagamento…)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={save} disabled={saving || !form.name}
                className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-sky-400 transition-colors">
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
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 py-12 text-center">
            <Truck className="mx-auto mb-3 h-8 w-8 text-slate-600" />
            <p className="text-slate-400">Nenhum fornecedor cadastrado.</p>
            <p className="mt-1 text-sm text-slate-500">Clique em "Novo fornecedor" para começar.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map(s => (
              <div key={s.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-100 truncate">{s.name}</p>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{s.category}</span>
                    </div>
                    {s.contact && <p className="mt-1 text-sm text-slate-400">{s.contact}</p>}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      {s.phone && (
                        <a href={`tel:${s.phone}`} className="flex items-center gap-1 hover:text-sky-400 transition-colors">
                          <Phone className="h-3 w-3" /> {s.phone}
                        </a>
                      )}
                      {s.email && (
                        <a href={`mailto:${s.email}`} className="flex items-center gap-1 hover:text-sky-400 transition-colors">
                          <Mail className="h-3 w-3" /> {s.email}
                        </a>
                      )}
                    </div>
                    {s.notes && <p className="mt-2 text-xs text-slate-500 line-clamp-2">{s.notes}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => startEdit(s)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => void remove(s.id)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
