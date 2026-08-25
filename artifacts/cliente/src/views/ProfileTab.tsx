import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Star, Clock, Repeat, Leaf, Settings, ChevronRight, Camera, Send, Bot, Loader2, LogOut, X, MapPin } from 'lucide-react';
import { getUser, setUser, getHistory, getLoyalty, markRated, lsGet, lsSet, getClientToken, getSavedAddresses, setSavedAddresses } from '../lib/storage';
import type { UserProfile, HistoryRecord, LoyaltyData, ChatMsg, SavedAddress } from '../types';
import { SeletorIdioma } from '../i18n/SeletorIdioma';

// Sincroniza o perfil de artista com o servidor — sem isso, o dado fica só
// no celular e nenhum estabelecimento consegue ver, o que quebra o
// propósito inteiro do MIAR Apoia (conectar os dois lados).
async function sincronizarPerfilArtista(user: UserProfile) {
  const token = getClientToken();
  if (!token || !user.ehArtista || !user.nivelArtista) return;
  try {
    await fetch('/api/miar-apoia/perfil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nome: user.name,
        nivel: user.nivelArtista,
        area: user.areaArtista,
        areaOutro: user.areaArtistaOutro,
        desejaConvitesTrabalho: user.desejaConvitesTrabalho,
        desejaMensagensEventos: user.desejaMensagensEventos,
        contato: user.phone,
      }),
    });
  } catch {
    // Fica salvo localmente mesmo se a sincronização falhar — tenta de
    // novo na próxima alteração do perfil.
  }
}

type Section = 'main' | 'history' | 'loyalty' | 'nutrition' | 'prefs' | 'addresses';

const LEVEL_COLORS: Record<string, { color: string; bg: string }> = {
  bronze:   { color: 'text-amber-600', bg: 'bg-amber-600/10' },
  prata:    { color: 'text-slate-300', bg: 'bg-slate-300/10' },
  ouro:     { color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  diamante: { color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
};
const LEVEL_NEXT: Record<string, { next: string; threshold: number }> = {
  bronze:   { next: 'Prata', threshold: 150 },
  prata:    { next: 'Ouro', threshold: 500 },
  ouro:     { next: 'Diamante', threshold: 2000 },
  diamante: { next: 'Diamante', threshold: 2000 },
};

function NutritionChat({ user }: { user: UserProfile }) {
  const [messages, setMessages] = useState<ChatMsg[]>([{
    role: 'assistant',
    content: `Olá${user.isGuest ? '' : ', ' + user.name.split(' ')[0]}! Sou a IA de nutrição do Miar 🥗\nPosso te ajudar com informações sobre calorias, proteínas, carboidratos, e sugestões baseadas nos seus objetivos. Pode me enviar também uma foto de uma refeição para análise estimada.`,
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const buildContext = () => {
    const parts: string[] = [
      'Você é a assistente nutricional do Miar AI/FOOD. Responda em português de forma amigável e informativa.',
      'IMPORTANTE: Sempre deixe claro quando uma informação é estimada ou aproximada. Nunca substitua avaliação médica ou nutricional profissional.',
    ];
    if (user.nutritionGoals.length) parts.push(`Objetivos do usuário: ${user.nutritionGoals.join(', ')}`);
    if (user.healthConditions.length) parts.push(`Condições de saúde informadas: ${user.healthConditions.join(', ')}`);
    if (user.dislikedIngredients.length) parts.push(`Não gosta de: ${user.dislikedIngredients.join(', ')}`);
    return parts.join('\n');
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const newMsgs: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'system', content: buildContext() }, ...newMsgs] }),
      });
      const d = await res.json() as { message: string };
      setMessages(prev => [...prev, { role: 'assistant', content: d.message }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Desculpe, houve um erro. Tente novamente.' }]);
    } finally { setLoading(false); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }
  };

  const analyzePhoto = async (file: File) => {
    setAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const userMsg: ChatMsg = { role: 'user', content: '📷 [Foto de refeição enviada para análise]' };
      setMessages(prev => [...prev, userMsg]);
      try {
        const res = await fetch('/api/food-analysis', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });
        const d = await res.json() as { message: string };
        setMessages(prev => [...prev, { role: 'assistant', content: d.message ?? 'Não foi possível analisar a imagem.' }]);
      } catch {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Não foi possível analisar a imagem no momento.' }]);
      } finally {
        setAnalyzing(false);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex h-[65vh] flex-col">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
        <Bot className="h-3.5 w-3.5 text-emerald-400" />
        <span>IA Nutricional · respostas são estimativas informativas, não substituem nutricionistas</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                <Bot className="h-3.5 w-3.5 text-emerald-400" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-line
              ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-100 rounded-bl-sm'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {(loading || analyzing) && (
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
              <Bot className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="flex gap-1 rounded-2xl bg-slate-800 px-4 py-3">
              {[0,1,2].map(j => <div key={j} className="h-2 w-2 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: `${j * 0.15}s` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="mt-3 flex gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && void analyzePhoto(e.target.files[0])} />
        <button onClick={() => fileRef.current?.click()} disabled={analyzing}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 disabled:opacity-50">
          <Camera className="h-4 w-4" />
        </button>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void send()}
          placeholder="Pergunte sobre nutrição..."
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
        <button onClick={() => void send()} disabled={!input.trim() || loading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function ProfileTab({
  onEditProfile, onLogout,
}: {
  onEditProfile: () => void;
  onLogout: () => void;
}) {
  const [section, setSection] = useState<Section>('main');
  const [history, setHistory] = useState<HistoryRecord[]>(() => getHistory());
  const [addresses, setAddresses] = useState<SavedAddress[]>(() => getSavedAddresses());
  const [addressLabel, setAddressLabel] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [, forcarAtualizacao] = useState(0);
  const user = getUser();
  // getUser/setUser são leitura/escrita direta no localStorage, sem
  // reatividade — sem isso, um clique salva o dado mas a tela não
  // reflete a mudança até algo mais forçar um re-render por acaso.
  const atualizarUsuario = (parcial: Partial<UserProfile>) => {
    if (!user) return;
    const atualizado = { ...user, ...parcial };
    setUser(atualizado);
    void sincronizarPerfilArtista(atualizado);
    forcarAtualizacao((n) => n + 1);
  };
  const loyalty = getLoyalty();
  const levelInfo = LEVEL_COLORS[loyalty.level] ?? LEVEL_COLORS.bronze;
  const nextInfo = LEVEL_NEXT[loyalty.level];
  const progress = loyalty.level === 'diamante' ? 100 : Math.min(100, (loyalty.totalSpent / nextInfo.threshold) * 100);

  if (!user) return null;

  const sectionTitle: Record<Section, string> = {
    main: 'Meu perfil', history: '🕐 Histórico', loyalty: '⭐ Fidelidade',
    nutrition: '🥗 Nutrição', prefs: '⚙️ Preferências', addresses: '📍 Meus endereços',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Section header */}
      {section !== 'main' && (
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur">
          <button onClick={() => setSection('main')} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700">←</button>
          <p className="font-semibold">{sectionTitle[section]}</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {section === 'main' && (
          <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 pt-6">
            {/* User card */}
            <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-2xl">
                  {user.isGuest ? '👤' : user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold">{user.name}</p>
                  {!user.isGuest && <p className="text-xs text-slate-400">{user.email}</p>}
                  {user.isGuest && <p className="text-xs text-amber-400">Conta de visitante · Crie uma conta para salvar tudo</p>}
                </div>
                <button onClick={onEditProfile} className="rounded-lg p-2 text-slate-500 hover:text-slate-300">
                  <Settings className="h-5 w-5" />
                </button>
              </div>
              {/* Loyalty badge */}
              <div className={`mt-4 flex items-center gap-3 rounded-xl ${levelInfo.bg} p-3`}>
                <Star className={`h-5 w-5 ${levelInfo.color}`} />
                <div className="flex-1">
                  <p className={`text-sm font-semibold capitalize ${levelInfo.color}`}>{loyalty.level}</p>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800">
                    <div className={`h-full rounded-full bg-emerald-500 transition-all`} style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <p className="text-lg font-bold text-slate-100">{loyalty.points} <span className="text-xs font-normal text-slate-400">pts</span></p>
              </div>
            </div>

            {/* Menu */}
            <div className="space-y-2">
              {[
                { section: 'history' as const, icon: '🕐', label: 'Histórico de pedidos', sub: `${history.length} pedido${history.length !== 1 ? 's' : ''}` },
                { section: 'loyalty' as const, icon: '⭐', label: 'Fidelidade e pontos', sub: `${loyalty.points} pts · ${loyalty.level}` },
                { section: 'nutrition' as const, icon: '🥗', label: 'Nutrição com IA', sub: 'Calorias, proteínas, análise de foto' },
                { section: 'prefs' as const, icon: '⚙️', label: 'Preferências', sub: 'Saúde, alimentação, IA' },
                { section: 'addresses' as const, icon: '📍', label: 'Meus endereços', sub: `${addresses.length} endereço${addresses.length === 1 ? '' : 's'} salvo${addresses.length === 1 ? '' : 's'}` },
              ].map(({ section: s, icon, label, sub }) => (
                <button key={s} onClick={() => setSection(s)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800">
                  <span className="text-xl">{icon}</span>
                  <div className="flex-1">
                    <p className="font-medium text-slate-100">{label}</p>
                    <p className="text-xs text-slate-500">{sub}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </button>
              ))}
              <button onClick={onLogout}
                className="flex w-full items-center gap-4 rounded-2xl border border-red-900/20 bg-red-900/5 p-4 text-left hover:bg-red-900/10">
                <LogOut className="h-5 w-5 text-red-400" />
                <p className="font-medium text-red-400">{user.isGuest ? 'Criar conta / Entrar' : 'Sair da conta'}</p>
              </button>
            </div>
          </motion.div>
        )}

        {section === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-4 pt-4">
            {history.length === 0 && (
              <p className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-500">
                Você ainda não fez nenhum pedido
              </p>
            )}
            <div className="space-y-3">
              {[...history].reverse().map(rec => (
                <div key={rec.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-100">{rec.restaurantName}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(rec.createdAt).toLocaleString('pt-BR')} · {rec.mode === 'delivery' ? '🛵' : '🪑'}
                      </p>
                    </div>
                    <p className="font-semibold text-emerald-400">R$ {rec.total.toFixed(2)}</p>
                  </div>
                  <div className="mt-2 space-y-0.5">
                    {rec.items.map((it, i) => (
                      <p key={i} className="text-xs text-slate-500">{it.quantity}x {it.name}</p>
                    ))}
                  </div>
                  {rec.rated && <p className="mt-2 text-xs text-emerald-400/70">✅ Avaliado</p>}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {section === 'loyalty' && (
          <motion.div key="loyalty" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-4 pt-4">
            <div className={`mb-4 rounded-2xl ${levelInfo.bg} border border-slate-800 p-6 text-center`}>
              <p className={`text-4xl font-bold ${levelInfo.color} mb-1`}>{loyalty.points}</p>
              <p className="text-sm text-slate-400">pontos acumulados</p>
              <p className={`mt-2 text-lg font-semibold capitalize ${levelInfo.color}`}>Nível {loyalty.level}</p>
              {loyalty.level !== 'diamante' && (
                <p className="mt-1 text-xs text-slate-500">
                  Faltam R$ {(nextInfo.threshold - loyalty.totalSpent).toFixed(2)} para {nextInfo.next}
                </p>
              )}
              <div className="mt-3 h-2 w-full rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Como funciona</p>
            <div className="space-y-2">
              {[
                { level: 'Bronze', req: 'Início', benefit: '1 ponto por R$ 1 gasto' },
                { level: 'Prata', req: 'R$ 150 gastos', benefit: '+ Acesso antecipado a promoções' },
                { level: 'Ouro', req: 'R$ 500 gastos', benefit: '+ Prioridade no atendimento' },
                { level: 'Diamante', req: 'R$ 2.000 gastos', benefit: '+ Benefícios exclusivos e cashback' },
              ].map(({ level, req, benefit }) => (
                <div key={level} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <Star className={`h-4 w-4 shrink-0 ${LEVEL_COLORS[level.toLowerCase()]?.color ?? 'text-slate-500'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-200">{level}</p>
                    <p className="text-xs text-slate-500">{req} · {benefit}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {section === 'nutrition' && (
          <motion.div key="nutrition" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-4 pt-4">
            <NutritionChat user={user} />
          </motion.div>
        )}

        {section === 'prefs' && (
          <motion.div key="prefs" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-4 pt-4 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Idioma</p>
              <p className="mb-3 text-xs text-slate-400">Escolha o idioma deste app. É só para você — cada pessoa escolhe o próprio, independente do estabelecimento.</p>
              <SeletorIdioma />
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-slate-500">
                <span>Artista?</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-emerald-500"
                  checked={!!user.ehArtista}
                  onChange={(e) => atualizarUsuario({ ehArtista: e.target.checked })}
                />
              </label>
              <p className="mt-1 mb-3 text-xs text-slate-400">Parte do MIAR Apoia — comerciantes podem apoiar artistas e atletas locais.</p>
              {user.ehArtista && (
                <div className="space-y-3">
                  <div>
                    <p className="mb-1.5 text-xs text-slate-400">Você é profissional ou amador?</p>
                    <div className="flex gap-2">
                      {(['profissional', 'amador'] as const).map((nivel) => (
                        <button
                          key={nivel}
                          type="button"
                          onClick={() => atualizarUsuario({ nivelArtista: nivel })}
                          className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium capitalize transition ${
                            user.nivelArtista === nivel
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                              : 'border-slate-700 text-slate-400 hover:border-slate-500'
                          }`}
                        >
                          {nivel}
                        </button>
                      ))}
                    </div>
                  </div>

                  {user.nivelArtista === 'profissional' && (
                    <>
                      <div>
                        <p className="mb-1.5 text-xs text-slate-400">Qual área?</p>
                        <select
                          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                          value={user.areaArtista ?? ''}
                          onChange={(e) => atualizarUsuario({ areaArtista: e.target.value as UserProfile['areaArtista'] })}
                        >
                          <option value="">Selecione</option>
                          <option value="musica">Música</option>
                          <option value="stand-up">Stand-up</option>
                          <option value="teatro">Teatro</option>
                          <option value="danca">Dança</option>
                          <option value="artes-visuais">Artes visuais</option>
                          <option value="outro">Outro</option>
                        </select>
                        {user.areaArtista === 'outro' && (
                          <input
                            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                            placeholder="Qual?"
                            value={user.areaArtistaOutro ?? ''}
                            onChange={(e) => atualizarUsuario({ areaArtistaOutro: e.target.value })}
                          />
                        )}
                      </div>
                      <label className="flex items-center justify-between text-xs text-slate-300">
                        <span>Deseja receber convites de trabalho?</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-emerald-500"
                          checked={!!user.desejaConvitesTrabalho}
                          onChange={(e) => atualizarUsuario({ desejaConvitesTrabalho: e.target.checked })}
                        />
                      </label>
                      <label className="flex items-start justify-between gap-3 text-xs text-slate-300">
                        <span>Quer agregar o App Artista ao seu perfil de Cliente? (mesmo login, perfil profissional completo)</span>
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
                          checked={!!user.desejaAgregarAppArtista}
                          onChange={(e) => atualizarUsuario({ desejaAgregarAppArtista: e.target.checked })}
                        />
                      </label>
                    </>
                  )}

                  {user.nivelArtista === 'amador' && (
                    <label className="flex items-center justify-between text-xs text-slate-300">
                      <span>Deseja receber mensagens sobre eventos?</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-emerald-500"
                        checked={!!user.desejaMensagensEventos}
                        onChange={(e) => atualizarUsuario({ desejaMensagensEventos: e.target.checked })}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
            {user.healthConditions.length > 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Saúde</p>
                <div className="flex flex-wrap gap-2">
                  {user.healthConditions.map(c => <span key={c} className="rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300">{c}</span>)}
                  {user.healthOther && <span className="rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300">{user.healthOther}</span>}
                </div>
              </div>
            )}
            {user.nutritionGoals.length > 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Objetivos</p>
                <div className="flex flex-wrap gap-2">
                  {user.nutritionGoals.map(g => <span key={g} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-xs text-emerald-400">{g}</span>)}
                </div>
              </div>
            )}
            {user.dislikedIngredients.length > 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Não gosta de</p>
                <div className="flex flex-wrap gap-2">
                  {user.dislikedIngredients.map(d => <span key={d} className="rounded-xl border border-red-500/20 bg-red-500/5 px-2.5 py-1 text-xs text-red-400">{d}</span>)}
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Estilo de comunicação da IA</p>
              <p className="text-sm text-slate-300 capitalize">{user.communicationStyle}</p>
            </div>
            <button onClick={onEditProfile}
              className="w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20">
              Editar preferências →
            </button>
          </motion.div>
        )}

        {section === 'addresses' && (
          <motion.div key="addresses" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3 px-4 pt-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="mb-1 text-sm font-semibold">Adicionar endereço</p>
              <p className="mb-4 text-xs text-slate-500">Use apelidos como Casa da mãe, Trabalho ou qualquer nome que ajude você.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={addressLabel} onChange={e => setAddressLabel(e.target.value)} placeholder="Apelido" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm" />
                <input value={addressCity} onChange={e => setAddressCity(e.target.value)} placeholder="Cidade" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm" />
                <input value={addressStreet} onChange={e => setAddressStreet(e.target.value)} placeholder="Rua / avenida" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm" />
                <input value={addressNumber} onChange={e => setAddressNumber(e.target.value)} placeholder="Número" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm" />
                <input value={addressNeighborhood} onChange={e => setAddressNeighborhood(e.target.value)} placeholder="Bairro" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm sm:col-span-2" />
              </div>
              <button type="button" disabled={!addressLabel.trim() || !addressCity.trim() || !addressStreet.trim() || !addressNumber.trim() || !addressNeighborhood.trim()} onClick={() => {
                const nextAddress: SavedAddress = { id: crypto.randomUUID(), label: addressLabel.trim(), city: addressCity.trim(), street: addressStreet.trim(), number: addressNumber.trim(), neighborhood: addressNeighborhood.trim(), state: '', isDefault: addresses.length === 0 };
                const next = [...addresses, nextAddress];
                setAddresses(next); setSavedAddresses(next);
                const token = getClientToken();
                if (token) void fetch('/api/auth/client/addresses', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ addresses: next }) });
                setAddressLabel(''); setAddressCity(''); setAddressStreet(''); setAddressNumber(''); setAddressNeighborhood('');
              }} className="mt-3 w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white disabled:opacity-40">Salvar endereço</button>
            </div>
            {addresses.map(address => (
              <div key={address.id} className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
                <div className="flex-1"><p className="font-semibold">{address.label}{address.isDefault ? ' · padrão' : ''}</p><p className="text-sm text-slate-400">{address.street}, {address.number} · {address.neighborhood}, {address.city}</p></div>
                <button type="button" aria-label={`Excluir ${address.label}`} onClick={() => { const next = addresses.filter(item => item.id !== address.id); setAddresses(next); setSavedAddresses(next); const token = getClientToken(); if (token) void fetch('/api/auth/client/addresses', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ addresses: next }) }); }} className="text-xs text-red-400">Excluir</button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
