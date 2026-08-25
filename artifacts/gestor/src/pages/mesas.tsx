import { useEffect, useMemo, useState } from 'react';
import { Copy, Loader2, Plus, Printer, QrCode, RefreshCw, Table2, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';
import { Link } from 'wouter';

type TableStatus = 'free' | 'occupied' | 'reserved' | 'cleaning' | 'paid' | string;

type TableRecord = {
  id: string;
  number: number;
  seats: number;
  status: TableStatus;
  qrToken: string;
  exitQrToken?: string;
};

function authHeaders(): HeadersInit {
  const token = window.localStorage.getItem('miar-owner-token') ?? window.sessionStorage.getItem('miar-owner-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function statusLabel(status: TableStatus): string {
  return {
    free: 'Livre',
    occupied: 'Ocupada',
    reserved: 'Reservada',
    cleaning: 'Limpeza',
    paid: 'Paga / aguardando saída',
  }[status] ?? status;
}

function statusClass(status: TableStatus): string {
  return {
    free: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    occupied: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    reserved: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    cleaning: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    paid: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  }[status] ?? 'border-slate-700 bg-slate-800 text-slate-300';
}

function publicClientUrl(qrToken: string): string {
  const configured = window.localStorage.getItem('miar-client-public-url')?.trim();
  const base = configured || window.location.origin;
  return `${base.replace(/\/$/, '')}/cliente?qr=${encodeURIComponent(qrToken)}`;
}

export default function Mesas() {
  const [tables, setTables] = useState<TableRecord[]>([]);
  const [selected, setSelected] = useState<TableRecord | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [number, setNumber] = useState('');
  const [seats, setSeats] = useState('4');
  const [publicBase, setPublicBase] = useState(() => window.localStorage.getItem('miar-client-public-url') ?? window.location.origin);

  const clientUrl = useMemo(() => selected ? publicClientUrl(selected.qrToken) : '', [selected, publicBase]);

  const loadTables = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/tables', { headers: authHeaders() });
      if (!response.ok) throw new Error(`Não foi possível carregar as mesas (HTTP ${response.status}).`);
      const data = await response.json() as TableRecord[];
      setTables(Array.isArray(data) ? data.sort((a, b) => a.number - b.number) : []);
      setSelected((current) => current ? data.find((table) => table.id === current.id) ?? null : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as mesas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadTables(); }, []);

  useEffect(() => {
    let cancelled = false;
    if (!selected) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(publicClientUrl(selected.qrToken), {
      width: 420,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    }).catch(() => {
      if (!cancelled) setQrDataUrl('');
    });
    return () => { cancelled = true; };
  }, [selected, publicBase]);

  const createTable = async (event: React.FormEvent) => {
    event.preventDefault();
    const tableNumberMatch = number.match(/\d+/);
    const tableNumber = tableNumberMatch ? Number(tableNumberMatch[0]) : Number.NaN;
    const tableSeats = Number(seats);
    if (!Number.isInteger(tableNumber) || tableNumber <= 0 || !Number.isInteger(tableSeats) || tableSeats <= 0) {
      setError('Informe um número de mesa e uma quantidade de lugares válidos.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ number: tableNumber, seats: tableSeats }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string } & Partial<TableRecord>;
      if (!response.ok) throw new Error(payload.error || `Não foi possível criar a mesa (HTTP ${response.status}).`);
      const created = payload as TableRecord;
      setTables((current) => [...current, created].sort((a, b) => a.number - b.number));
      setSelected(created);
      setNumber('');
      setNotice(`Mesa ${created.number} criada. O QR já está pronto para imprimir.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar a mesa.');
    } finally {
      setSaving(false);
    }
  };

  const deleteTable = async (table: TableRecord) => {
    if (!window.confirm(`Excluir a Mesa ${table.number}? Esta ação não pode ser desfeita.`)) return;
    setError('');
    try {
      const response = await fetch(`/api/tables/${encodeURIComponent(table.id)}`, { method: 'DELETE', headers: authHeaders() });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || `Não foi possível excluir a mesa (HTTP ${response.status}).`);
      setTables((current) => current.filter((item) => item.id !== table.id));
      setSelected((current) => current?.id === table.id ? null : current);
      setNotice(`Mesa ${table.number} excluída.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível excluir a mesa.');
    }
  };

  const savePublicBase = (value: string) => {
    const normalized = value.trim().replace(/\/$/, '') || window.location.origin;
    window.localStorage.setItem('miar-client-public-url', normalized);
    setPublicBase(normalized);
    setNotice('Endereço público do Cliente salvo neste dispositivo.');
  };

  const copyUrl = async () => {
    if (!clientUrl) return;
    try {
      await navigator.clipboard.writeText(clientUrl);
      setNotice('URL do QR copiada.');
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione a URL manualmente.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">Salão e atendimento</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold"><Table2 size={24} /> Mesas e QR</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">Crie as mesas e imprima o QR que abre o cardápio do Cliente já vinculado à mesa correta.</p>
          </div>
          <Link href="/painel" className="rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">← Painel</Link>
        </div>

        <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400" htmlFor="client-public-url">Endereço público do Cliente</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input id="client-public-url" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400" value={publicBase} onChange={(event) => setPublicBase(event.target.value)} onBlur={(event) => savePublicBase(event.target.value)} />
            <button type="button" onClick={() => savePublicBase(publicBase)} className="rounded-xl bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700">Salvar endereço</button>
          </div>
          <p className="mt-2 text-xs text-slate-500">O QR será formado como <code>/cliente?qr=TOKEN</code>. Se o Cliente estiver em outro endereço/porta, informe a base pública dele aqui.</p>
        </div>

        {(error || notice) && <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${error ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>{error || notice}</div>}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-semibold">Mesas cadastradas</h2>
              <button type="button" onClick={() => void loadTables()} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs hover:bg-slate-700"><RefreshCw size={14} /> Atualizar</button>
            </div>
            {loading ? <div className="flex items-center gap-2 py-8 text-sm text-slate-400"><Loader2 className="animate-spin" size={18} /> Carregando mesas...</div> : tables.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">Nenhuma mesa cadastrada ainda.</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{tables.map((table) => <div key={table.id} className={`rounded-2xl border p-4 transition ${selected?.id === table.id ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-800 bg-slate-950/60'}`}>
              <div className="flex items-start justify-between gap-3"><div><p className="text-lg font-semibold">Mesa {table.number}</p><p className="text-xs text-slate-500">{table.seats} lugares</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(table.status)}`}>{statusLabel(table.status)}</span></div>
              <div className="mt-4 flex gap-2"><button type="button" onClick={() => setSelected(table)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"><QrCode size={15} /> Ver QR Code</button><button type="button" onClick={() => void deleteTable(table)} className="rounded-xl border border-rose-500/30 px-3 py-2 text-rose-300 hover:bg-rose-500/10" aria-label={`Excluir Mesa ${table.number}`}><Trash2 size={15} /></button></div>
            </div>)}</div>}
          </section>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <h2 className="font-semibold">Nova Mesa</h2>
            <form onSubmit={createTable} className="mt-4 space-y-3">
              <label className="block text-xs text-slate-400">Número<input className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400" type="text" inputMode="numeric" value={number} onChange={(event) => setNumber(event.target.value)} placeholder="Número ou Mesa 1" /></label>
              <label className="block text-xs text-slate-400">Lugares<input className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400" type="number" min="1" value={seats} onChange={(event) => setSeats(event.target.value)} /></label>
              <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"><Plus size={17} /> {saving ? 'Criando...' : 'Nova Mesa — Criar e gerar QR Code'}</button>
            </form>
          </aside>
        </div>

        {selected && <section className="mt-5 rounded-2xl border border-emerald-500/30 bg-white p-5 text-slate-900 print-area">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">QR público do Cliente</p><h2 className="mt-1 text-2xl font-bold">Mesa {selected.number}</h2><p className="mt-1 text-sm text-slate-600">Escaneie para abrir o cardápio já vinculado a esta mesa.</p></div><div className="no-print flex gap-2"><button type="button" onClick={() => void copyUrl()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"><Copy size={16} /> Copiar URL</button><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700"><Printer size={16} /> Imprimir</button></div></div>
          <div className="mt-5 grid items-center gap-5 md:grid-cols-[auto_minmax(0,1fr)]"><div className="rounded-2xl border border-slate-200 bg-white p-3">{qrDataUrl ? <img src={qrDataUrl} alt={`QR da Mesa ${selected.number}`} className="h-64 w-64" /> : <div className="flex h-64 w-64 items-center justify-center text-sm text-slate-500">Gerando QR...</div>}</div><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">URL vinculada</p><p className="mt-2 break-all rounded-xl bg-slate-100 p-3 font-mono text-xs text-slate-700">{clientUrl}</p><p className="mt-3 text-sm text-slate-600">O token é único da mesa. O Cliente consulta a API e envia o <strong>tableId real</strong> no pedido de salão.</p></div></div>
        </section>}
      </div>
      <style>{`@media print { body { background: white !important; } body > * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } .print-area { position: absolute; inset: 0; margin: 0; border: 0 !important; } .no-print { display: none !important; } }`}</style>
    </div>
  );
}
