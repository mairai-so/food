import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Heart, HeartOff, Star, MapPin, Loader2, Zap, MessageCircle, QrCode } from 'lucide-react';
import { getFavorites, toggleFavorite, getHistory, getLoyalty } from '../lib/storage';
import type { Restaurant, FeedPost, UserProfile, ActiveOrder } from '../types';
import LeitorQR from '../components/LeitorQR';
import { useTranslation } from '../i18n/IdiomaContext';

const SEGMENT_COLORS: Record<string, { accent: string; bg: string; light: string }> = {
  churrascaria: { accent: 'text-red-400', bg: 'bg-red-500', light: 'bg-red-500/10' },
  pizzaria:     { accent: 'text-orange-400', bg: 'bg-orange-500', light: 'bg-orange-500/10' },
  bar:          { accent: 'text-violet-400', bg: 'bg-violet-500', light: 'bg-violet-500/10' },
  hamburgueria: { accent: 'text-amber-400', bg: 'bg-amber-500', light: 'bg-amber-500/10' },
  japones:      { accent: 'text-red-400', bg: 'bg-red-500', light: 'bg-red-500/10' },
  cafe:         { accent: 'text-yellow-400', bg: 'bg-yellow-500', light: 'bg-yellow-500/10' },
  italiana:     { accent: 'text-green-400', bg: 'bg-green-500', light: 'bg-green-500/10' },
  default:      { accent: 'text-emerald-400', bg: 'bg-emerald-500', light: 'bg-emerald-500/10' },
};
export function getColors(segment?: string) {
  return SEGMENT_COLORS[(segment ?? '').toLowerCase()] ?? SEGMENT_COLORS.default;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-800 ${className}`} />;
}

const FEED_EMOJI: Record<string, string> = { texto: '📣', imagem: '🖼️', video: '🎬', publicidade: '⭐' };

export default function Home({
  user, activeOrder, onSelectRestaurant, onOpenTracking, onRequireLogin, initialTab = 'rests',
}: {
  user: UserProfile | null;
  activeOrder: ActiveOrder | null;
  onSelectRestaurant: (r: Restaurant) => void;
  onOpenTracking: () => void;
  onRequireLogin: () => void;
  initialTab?: 'rests' | 'feed';
}) {
  const { t: traduzir } = useTranslation();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [search, setSearch] = useState('');
  const [lerQR, setLerQR] = useState(false);
  const [mesaLida, setMesaLida] = useState('');
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<string[]>(getFavorites());
  const [tab, setTab] = useState<'rests' | 'feed'>(initialTab);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const loyalty = getLoyalty();
  const history = getHistory();
  const lastOrder = history.length > 0 ? history[history.length - 1] : null;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/restaurants').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/feed').then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([rests, feedData]) => {
      setRestaurants(rests as Restaurant[]);
      setFeed(feedData as FeedPost[]);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (feed.length < 2) return;
    const interval = window.setInterval(() => {
      setFeaturedIndex(index => (index + 1) % feed.length);
    }, 4500);
    return () => window.clearInterval(interval);
  }, [feed.length]);

  const seg = (r: Restaurant) => r.segment ?? r.cuisine ?? '';
  const filtered = restaurants.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    seg(r).toLowerCase().includes(search.toLowerCase())
  );

  // Motor de Inteligencia de Demanda: toda busca vira sinal (achou ou nao).
  // Debounce simples pra nao disparar a cada tecla.
  useEffect(() => {
    const termo = search.trim();
    if (termo.length < 3) return;
    const t = setTimeout(() => {
      fetch('/api/demanda/sinal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termo,
          resultados: filtered.length,
          estado: filtered.length > 0 ? 'encontrada' : 'nao_encontrada',
        }),
      }).catch(() => {});
    }, 900);
    return () => clearTimeout(t);
  }, [search]);
  const favRests = restaurants.filter(r => favorites.includes(r.id));

  const handleToggleFav = (id: string) => {
    if (user?.isGuest) {
      onRequireLogin();
      return;
    }
    setFavorites(toggleFavorite(id));
  };
  const featuredPost = feed.length > 0 ? feed[featuredIndex % feed.length] : null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 pb-20">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold">
              {user?.isGuest ? 'Olá, visitante' : `Olá, ${user?.name?.split(' ')[0] ?? 'você'}! 👋`}
            </h1>
            <p className="text-xs text-slate-400">
              {loyalty.level !== 'bronze' && !user?.isGuest
                ? `${loyalty.level.charAt(0).toUpperCase() + loyalty.level.slice(1)} · ${loyalty.points} pts`
                : 'O que você tem vontade hoje?'}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={traduzir('busca.placeholder')}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none" />
        </div>

        {/* Ler QR da mesa */}
        <button
          onClick={() => setLerQR(true)}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-300"
        >
          <QrCode className="h-4 w-4" /> Ler QR da mesa
        </button>

        {mesaLida && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            Mesa lida: <span className="font-bold">{mesaLida}</span>
          </div>
        )}

        {/* Active order banner */}
        {activeOrder && (
          <button onClick={onOpenTracking}
            className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400 shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-emerald-300">Pedido em andamento</p>
              <p className="text-xs text-emerald-500">{activeOrder.restaurantName} · Toque para acompanhar</p>
            </div>
            <MessageCircle className="h-5 w-5 text-emerald-400 shrink-0" />
          </button>
        )}

        {/* Repeat last order */}
        {lastOrder && !activeOrder && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-3">
            <div className="text-xl">🔁</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-200">Repetir pedido</p>
              <p className="text-xs text-slate-400">{lastOrder.restaurantName} · R$ {lastOrder.total.toFixed(2)}</p>
            </div>
            <button
              onClick={() => {
                if (user?.isGuest) {
                  onRequireLogin();
                  return;
                }
                const r = restaurants.find(x => x.id === lastOrder.restaurantId);
                if (r) onSelectRestaurant(r);
              }}
              className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700">
              Ver →
            </button>
          </div>
        )}
      </div>

      {featuredPost && (
        <div className="px-4 pb-4">
          <button
            onClick={() => user?.isGuest ? onRequireLogin() : setTab('feed')}
            className="group relative w-full overflow-hidden rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-100 via-rose-50 to-cyan-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-orange-200/60 blur-2xl transition group-hover:scale-125" />
            <div className="relative">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="rounded-full bg-white/75 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-orange-700">
                  Agora no Miar
                </span>
                <span className="text-2xl">{featuredPost.emoji}</span>
              </div>
              <p className="text-xs font-semibold text-orange-700">{featuredPost.restaurantName}</p>
              <p className="mt-1 text-lg font-bold leading-tight text-slate-100">{featuredPost.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{featuredPost.content}</p>
              <p className="mt-4 text-xs font-semibold text-orange-700">
                {user?.isGuest ? 'Entre para ver o feed completo →' : 'Ver novidades →'}
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 px-4">
        {(['rests', 'feed'] as const).map(t => (
          <button key={t} onClick={() => {
            if (t === 'feed' && user?.isGuest) {
              onRequireLogin();
              return;
            }
            setTab(t);
          }}
            className={`mr-4 pb-2 text-sm font-medium transition
              ${tab === t ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
            {t === 'rests' ? '🍽️ Restaurantes' : '📰 Feed'}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">
        {tab === 'rests' && (
          <>
            {/* Favorites */}
            {!search && favRests.length > 0 && (
              <div className="mb-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">❤️ Favoritos</p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {favRests.map(r => {
                    const colors = getColors(seg(r));
                    return (
                      <button key={r.id} onClick={() => onSelectRestaurant(r)}
                        className={`flex min-w-[110px] flex-col items-center rounded-2xl border border-slate-800 ${colors.light} p-3 text-center`}>
                        <div className={`mb-1 flex h-8 w-8 items-center justify-center rounded-lg ${colors.bg}/20`}>
                          <Star className={`h-4 w-4 ${colors.accent}`} />
                        </div>
                        <p className="text-xs font-semibold leading-tight text-slate-100">{r.name}</p>
                        {seg(r) && <p className={`mt-0.5 text-[10px] capitalize ${colors.accent}`}>{seg(r)}</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              {search ? 'Resultados' : 'Todos'}
            </p>
            <div className="space-y-2">
              {loading && [1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              {!loading && filtered.length === 0 && search.trim().length >= 3 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
                  <p className="mb-1 font-semibold text-amber-300">
                    Ninguem em Ponta Pora tem "{search.trim()}" ainda
                  </p>
                  <p className="text-sm text-amber-200/70">
                    Anotamos o seu pedido. Se algum estabelecimento passar a oferecer, a gente te avisa.
                  </p>
                </div>
              )}
              {!loading && filtered.length === 0 && search.trim().length < 3 && (
                <p className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-500">
                  Nenhum restaurante encontrado
                </p>
              )}
              {!loading && filtered.map(r => {
                const colors = getColors(seg(r));
                const isFav = favorites.includes(r.id);
                return (
                  <motion.div key={r.id} whileHover={{ scale: 1.005 }}
                    className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
                    <button onClick={() => onSelectRestaurant(r)} className="flex flex-1 items-center gap-3 text-left">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors.bg}/20`}>
                        <Star className={`h-5 w-5 ${colors.accent}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-100">{r.name}</p>
                        {r.address && <p className="flex items-center gap-1 text-xs text-slate-400"><MapPin className="h-3 w-3" />{r.address}</p>}
                        {seg(r) && <p className={`text-xs font-medium capitalize ${colors.accent}`}>{seg(r)}</p>}
                      </div>
                    </button>
                    <button onClick={() => handleToggleFav(r.id)}
                      className={`rounded-lg p-2 transition ${isFav ? 'text-red-400' : 'text-slate-600 hover:text-red-400'}`}>
                      {isFav ? <Heart className="h-4 w-4 fill-current" /> : <HeartOff className="h-4 w-4" />}
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {tab === 'feed' && (
          <div className="space-y-3">
            {feed.length === 0 && !loading && (
              <p className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-500">
                Nenhuma publicação no momento
              </p>
            )}
            {loading && [1,2,3].map(i => <Skeleton key={i} className="h-28 w-full" />)}
              {feed.map(post => {
              const colors = getColors(post.segment);
              return (
                <button key={post.id} onClick={() => user?.isGuest ? onRequireLogin() : undefined}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${colors.light}`}>
                      {post.emoji || FEED_EMOJI[post.mediaType]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-semibold ${colors.accent}`}>{post.restaurantName}</p>
                        {post.mediaType === 'publicidade' && (
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${colors.light} ${colors.accent}`}>
                            Publicidade
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-100">{post.title}</p>
                      <p className="mt-0.5 text-sm text-slate-400">{post.content}</p>
                      {post.mediaType === 'imagem' && post.mediaUrl && (
                        <img src={post.mediaUrl} alt={post.title} className="mt-2 w-full rounded-xl object-cover" style={{ maxHeight: 220 }} />
                      )}
                      {post.mediaType === 'video' && post.mediaUrl && (
                        <video src={post.mediaUrl} controls className="mt-2 w-full rounded-xl" style={{ maxHeight: 220 }} />
                      )}
                      <p className="mt-2 text-xs text-slate-600">
                        {new Date(post.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {lerQR && (
        <LeitorQR
          onFechar={() => setLerQR(false)}
          onLido={(texto) => {
            // o QR da mesa carrega o numero dentro dele; extrai o numero se houver
            const m = texto.match(/mesa[^0-9]*(\d+)/i) || texto.match(/(\d+)/);
            setMesaLida(m ? m[1] : texto);
            setLerQR(false);
          }}
        />
      )}
    </div>
  );
}
