import { useState, useEffect } from 'react';
import { ChevronLeft, TrendingUp, AlertCircle, Search } from 'lucide-react';

interface DemandTrend {
  term: string; count: number; state: string; lastSeen: string;
}

function useGetDemandTrends() {
  const [data, setData] = useState<DemandTrend[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  useEffect(() => {
    fetch('/api/demanda/painel')
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(d => { setData(d); setIsLoading(false); })
      .catch(e => { setError(e); setIsLoading(false); });
  }, []);
  return { data, isLoading, error };
}

export default function DemandTrends({
  onBack,
}: {
  onBack: () => void;
}) {
  const { data: trends, isLoading, error } = useGetDemandTrends();

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 pb-20">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur">
        <button onClick={onBack} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            Tendências de Demanda
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-sm text-emerald-300">
            Veja o que as pessoas estão buscando. Se você é um restaurante, aqui estão ótimas ideias do que oferecer!
          </p>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse h-20 w-full rounded-2xl bg-slate-800" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-400">
            <AlertCircle className="mx-auto mb-2 h-6 w-6" />
            <p>Erro ao carregar as tendências. Tente novamente mais tarde.</p>
          </div>
        )}

        {!isLoading && !error && trends?.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-500">
            <Search className="mx-auto mb-2 h-6 w-6 opacity-50" />
            <p>Ainda não há dados de demanda registrados.</p>
          </div>
        )}

        {!isLoading && !error && trends && trends.length > 0 && (
          <div className="space-y-3">
            {trends.map((trend) => (
              <div key={trend.term} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-slate-100 text-lg">"{trend.term}"</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {trend.count} {trend.count === 1 ? 'pessoa buscou' : 'pessoas buscaram'} isso
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {trend.state === 'nao_encontrada' ? (
                      <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
                        Ninguém oferece ainda
                      </span>
                    ) : (
                      <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                        Já encontrado
                      </span>
                    )}
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
