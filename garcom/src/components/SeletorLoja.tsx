import { useEffect, useState } from 'react';
import { Store } from 'lucide-react';

interface Loja {
  id: string;
  nome: string;
  padrao: boolean;
}

const CHAVE = 'miar-loja-ativa-id';

/**
 * Multi-loja (14/08/2026) — seletor de loja pro garçom. Só cria loja no
 * Gestor (é decisão do dono); aqui o garçom só escolhe em qual das lojas
 * já cadastradas ele está trabalhando neste turno. Mesmo padrão do
 * SeletorLoja do Caixa, adaptado pro fetch direto que o Garçom já usa.
 */
export default function SeletorLoja() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    fetch('/api/lojas')
      .then((r) => (r.ok ? r.json() : []))
      .then(setLojas)
      .catch(() => setLojas([]));
  }, []);

  if (lojas.length <= 1) return null;

  const ativaId = localStorage.getItem(CHAVE);
  const ativa = lojas.find((l) => l.id === ativaId) ?? lojas[0];

  function trocar(id: string) {
    localStorage.setItem(CHAVE, id);
    setAberto(false);
    window.location.reload();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
      >
        <Store className="h-3.5 w-3.5" />
        {ativa?.nome ?? 'Loja'}
      </button>
      {aberto && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-xl">
          {lojas.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => trocar(l.id)}
              className={`block w-full rounded-md px-2 py-1.5 text-left text-xs ${l.id === ativaId ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              {l.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
