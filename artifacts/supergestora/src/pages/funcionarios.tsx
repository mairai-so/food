import { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { ShieldOff, ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react';
import { lojaHeaders } from '@/lib/loja';

function getToken() { return window.localStorage.getItem('miar-owner-token') ?? ''; }

type Employee = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  phone?: string;
};

const ROLE_LABEL: Record<string, string> = {
  owner: 'Dono', manager: 'Gerente', cashier: 'Caixa',
  waiter: 'Garçom', cook: 'Cozinha', delivery: 'Entregador', custom: 'Outro',
};

export default function Funcionarios() {
  const [lista, setLista] = useState<Employee[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [alterando, setAlterando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch('/api/employees', { headers: { Authorization: `Bearer ${getToken()}`, ...lojaHeaders() } });
      if (r.ok) setLista(await r.json());
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const alternarAcesso = async (emp: Employee) => {
    setAlterando(emp.id);
    try {
      await fetch(`/api/employees/${emp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ active: !emp.active }),
      });
      setLista((prev) => prev.map((e) => (e.id === emp.id ? { ...e, active: !e.active } : e)));
    } finally {
      setAlterando(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <Link href="/painel" className="mb-4 inline-block text-sm text-slate-400 hover:text-slate-200">← Voltar</Link>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Funcionários</h1>
          <p className="text-sm text-slate-400">Bloqueie o acesso na hora — celular perdido, saída da equipe, o que for.</p>
        </div>
        <button onClick={() => void carregar()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100">
          <RefreshCw className={`h-5 w-5 ${carregando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-600/40 bg-amber-950/20 p-3 text-sm text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Ao bloquear, o acesso é cortado imediatamente no próximo uso do app — não precisa esperar o funcionário sair.</p>
      </div>

      <div className="space-y-2">
        {lista.map((emp) => (
          <div
            key={emp.id}
            className={`flex items-center justify-between rounded-xl border p-4 ${emp.active ? 'border-slate-800 bg-slate-900' : 'border-red-900/40 bg-red-950/20'}`}
          >
            <div>
              <p className="font-semibold text-slate-100">{emp.name}</p>
              <p className="text-sm text-slate-400">{ROLE_LABEL[emp.role] ?? emp.role}</p>
              {!emp.active && <p className="mt-1 text-xs font-medium text-red-400">Acesso bloqueado</p>}
            </div>
            <button
              onClick={() => void alternarAcesso(emp)}
              disabled={alterando === emp.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                emp.active
                  ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
              }`}
            >
              {emp.active ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              {alterando === emp.id ? 'Aguarde…' : emp.active ? 'Bloquear acesso' : 'Liberar acesso'}
            </button>
          </div>
        ))}
        {!carregando && lista.length === 0 && (
          <p className="py-8 text-center text-slate-500">Nenhum funcionário cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
