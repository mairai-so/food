import { useEffect, useState } from 'react';
import { ArrowLeft, Clock3, MapPin, Search, Star, Tag, Truck, X } from 'lucide-react';
import { getClientToken, getSavedAddresses } from '../lib/storage';
import type { Restaurant, SavedAddress, SearchResult, UserProfile } from '../types';

type Sort = 'relevance' | 'distance' | 'free_delivery' | 'quality' | 'price' | 'speed' | 'promotions';

const CRITERIA: Array<{ value: Sort; label: string; color: string; icon: typeof MapPin }> = [
  { value: 'distance', label: 'Distância', color: 'cyan', icon: MapPin },
  { value: 'free_delivery', label: 'Entrega grátis', color: 'violet', icon: Truck },
  { value: 'quality', label: 'Qualidade', color: 'amber', icon: Star },
  { value: 'price', label: 'Preço', color: 'emerald', icon: Tag },
  { value: 'speed', label: 'Rapidez', color: 'orange', icon: Clock3 },
  { value: 'promotions', label: 'Promoção', color: 'rose', icon: Tag },
];

const COLOR_CLASSES: Record<string, string> = {
  cyan: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300',
  violet: 'border-violet-400/40 bg-violet-400/10 text-violet-300',
  amber: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  emerald: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  orange: 'border-orange-400/40 bg-orange-400/10 text-orange-300',
  rose: 'border-rose-400/40 bg-rose-400/10 text-rose-300',
};

export default function SearchView({ user, onBack, onSelectRestaurant }: {
  user: UserProfile | null;
  onBack: () => void;
  onSelectRestaurant: (restaurant: Restaurant) => void;
}) {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [sort, setSort] = useState<Sort>('relevance');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [addresses] = useState<SavedAddress[]>(getSavedAddresses());
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = async () => {
    setLoading(true);
    setSearched(true);
    const params = new URLSearchParams({ q: query, sort });
    if (location.trim()) params.set('location', location.trim());
    try {
      const token = getClientToken();
      const response = await fetch(`/api/search?${params}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
      const data = await response.json() as { results?: SearchResult[] };
      setResults(data.results ?? []);
      if (query.trim().length >= 3) {
        void fetch('/api/demanda/sinal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ termo: query.trim(), regiao: location.trim() || undefined, resultados: data.results?.length ?? 0, estado: (data.results?.length ?? 0) > 0 ? 'encontrada' : 'nao_encontrada' }) });
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void runSearch(); }, [sort]);

  const selectAddress = (address: SavedAddress) => {
    setLocation(`${address.street}, ${address.number} - ${address.neighborhood}, ${address.city}`);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-28 pt-4 text-slate-100">
      <header className="mb-5 flex items-center gap-3">
        <button onClick={onBack} aria-label="Voltar" className="rounded-xl bg-slate-900 p-2 text-slate-300"><ArrowLeft className="h-5 w-5" /></button>
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">MIAR AI/FOOD</p><h1 className="text-2xl font-bold">Encontrar</h1></div>
      </header>

      <section className="mb-5 space-y-3">
        <form onSubmit={(event) => { event.preventDefault(); void runSearch(); }} className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Produto, restaurante, categoria ou intenção" aria-label="Pesquisar" className="w-full rounded-2xl border border-slate-700 bg-slate-900 py-4 pl-11 pr-11 text-sm outline-none focus:border-emerald-400" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Limpar pesquisa" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"><X className="h-4 w-4" /></button>}
        </form>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-400" />
          <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Cidade, bairro ou endereço de destino" aria-label="Localização da pesquisa" className="w-full rounded-xl border border-slate-800 bg-slate-900 py-3 pl-10 pr-3 text-sm outline-none focus:border-cyan-400" />
        </div>
        {addresses.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {addresses.map(address => <button key={address.id} type="button" onClick={() => selectAddress(address)} className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300">{address.label}</button>)}
          </div>
        )}
      </section>

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Classificar por</p><select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300"><option value="relevance">Relevância</option><option value="distance">Distância</option><option value="quality">Avaliação</option><option value="price">Menor preço</option><option value="speed">Rapidez</option><option value="free_delivery">Entrega grátis</option><option value="promotions">Promoção</option></select></div>
        <div className="flex gap-2 overflow-x-auto pb-1">{CRITERIA.map(({ value, label, color, icon: Icon }) => <button key={value} type="button" onClick={() => setSort(value)} className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${sort === value ? COLOR_CLASSES[color] : 'border-slate-700 bg-slate-900 text-slate-400'}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div>
      </section>

      <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">{searched ? `${results.length} resultado${results.length === 1 ? '' : 's'}` : 'Descubra opções'}</p>{location && <p className="max-w-[55%] truncate text-xs text-slate-500"><MapPin className="mr-1 inline h-3 w-3" />{location}</p>}</div>
      {loading && <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-500">Buscando opções confirmadas...</div>}
      {!loading && searched && results.length === 0 && <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6 text-center text-sm text-amber-200">Nenhuma opção confirmada para esta pesquisa ainda. O sinal foi registrado para orientar novas ofertas.</div>}
      <div className="space-y-3">{!loading && results.map(({ restaurant, matchingItems, highlights }) => <article key={restaurant.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><button onClick={() => onSelectRestaurant(restaurant)} className="w-full text-left"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-100">{restaurant.name}</h2><p className="mt-1 text-xs text-slate-400">{restaurant.cuisine} · {restaurant.address}</p></div><span className="flex items-center gap-1 text-sm text-amber-300"><Star className="h-4 w-4 fill-current" />{(restaurant.rating ?? 0).toFixed(1)}</span></div><div className="mt-3 flex flex-wrap gap-1.5">{highlights.map(highlight => { const criterion = CRITERIA.find(item => item.value === highlight); return criterion ? <span key={highlight} className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${COLOR_CLASSES[criterion.color]}`}>{criterion.label}</span> : null; })}</div>{matchingItems.length > 0 && <p className="mt-3 text-xs text-emerald-300">Encontrado no cardápio: {matchingItems.slice(0, 3).map(item => item.name).join(', ')}</p>}<p className="mt-3 text-xs text-slate-500">{(restaurant.distance ?? 0).toFixed(1)} km · {(restaurant.waitTime ?? 0) > 0 ? `${restaurant.waitTime} min estimados` : 'tempo não informado'} · {restaurant.openNow ? 'Aberto agora' : 'Fechado agora'}</p></button></article>)}</div>
    </main>
  );
}
