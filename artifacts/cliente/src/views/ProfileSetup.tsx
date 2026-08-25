import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { getUser, setUser, setSetupDone } from '../lib/storage';
import type { DiscoveryPreference } from '../types';

type Step = 'health' | 'goals' | 'dislikes' | 'likes' | 'discovery' | 'meat' | 'comm' | 'privacy' | 'done';
const STEPS: Step[] = ['health', 'goals', 'dislikes', 'likes', 'discovery', 'meat', 'comm', 'privacy', 'done'];

const DISCOVERY_OPTIONS: Array<{ value: DiscoveryPreference; label: string }> = [
  { value: 'speed', label: 'Rapidez' },
  { value: 'price', label: 'Menor preço' },
  { value: 'free_delivery', label: 'Entrega grátis' },
  { value: 'promotions', label: 'Promoções' },
  { value: 'distance', label: 'Menor distância' },
  { value: 'quality', label: 'Melhor avaliação' },
];

const HEALTH_CONDITIONS = [
  'Diabetes', 'Hipertensão', 'Doença celíaca', 'Intolerância à lactose',
  'Alergia ao glúten', 'Alergia a frutos do mar', 'Alergia a amendoim',
  'Colesterol alto', 'Doenças renais', 'Refluxo / Gastrite',
  'Síndrome do intestino irritável', 'Anemia', 'Hipotireoidismo',
  'Hipertireoidismo', 'Fenilcetonúria',
];
const NUTRITION_GOALS = [
  'Perda de peso', 'Ganho de massa muscular', 'Manutenção de peso',
  'Alimentação equilibrada', 'Performance esportiva', 'Redução de açúcar',
  'Redução de sódio', 'Mais proteína', 'Alimentação vegetariana',
  'Alimentação vegana', 'Melhorar hábitos', 'Academia',
];
const COMM_STYLES = [
  { value: 'amigavel', label: '😊 Comunicação amigável e descontraída' },
  { value: 'formal', label: '🎩 Comunicação formal e clássica' },
  { value: 'doutor', label: '👨‍⚕️ Me trate como Doutor/Doutora' },
  { value: 'objetiva', label: '⚡ Direto ao ponto, sem rodeios' },
  { value: 'detalhada', label: '📖 Quero explicações detalhadas' },
  { value: 'curta', label: '💬 Respostas curtas e rápidas' },
];

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
        ${active ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'}`}>
      {active && <Check className="h-3.5 w-3.5 shrink-0" />}
      {label}
    </button>
  );
}

export default function ProfileSetup({ onDone }: { onDone: () => void }) {
  const user = getUser()!;
  const [stepIdx, setStepIdx] = useState(0);
  const [showAccessibilityPrompt, setShowAccessibilityPrompt] = useState(false);
  const [accessibilityNeeds, setAccessibilityNeeds] = useState<string[]>([]);
  const step = STEPS[stepIdx];

  const [health, setHealth] = useState<string[]>(user.healthConditions);
  const [healthOther, setHealthOther] = useState(user.healthOther ?? '');
  const [goals, setGoals] = useState<string[]>(user.nutritionGoals);
  const [dislikes, setDislikes] = useState<string[]>(user.dislikedIngredients);
  const [dislikeInput, setDislikeInput] = useState('');
  const [likes, setLikes] = useState<string[]>(user.likedThings);
  const [discoveryPreferences, setDiscoveryPreferences] = useState<DiscoveryPreference[]>(user.discoveryPreferences ?? []);
  const [likeInput, setLikeInput] = useState('');
  const [meat, setMeat] = useState(user.meatPreference ?? '');
  const [comm, setComm] = useState(user.communicationStyle ?? 'amigavel');
  const [shareData, setShareData] = useState(user.shareDataWithRestaurants ?? true);
  const [aiMemory, setAiMemory] = useState(user.allowAIMemory);

  const toggle = <T,>(arr: T[], setArr: (a: T[]) => void, val: T) =>
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  const addTag = (arr: string[], setArr: (a: string[]) => void, val: string, setVal: (v: string) => void) => {
    if (!val.trim()) return;
    if (!arr.includes(val.trim())) setArr([...arr, val.trim()]);
    setVal('');
  };

  const save = async () => {
    const nextUser = {
      ...user,
      healthConditions: health, healthOther,
      nutritionGoals: goals,
      dislikedIngredients: dislikes, likedThings: likes,
      meatPreference: meat as any,
      communicationStyle: comm,
      shareDataWithRestaurants: shareData, allowAIMemory: aiMemory,
      discoveryPreferences,
    };
    setUser(nextUser);
    const token = localStorage.getItem('miar_client_token');
    if (token) {
      await fetch('/api/auth/client/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          shareDataWithRestaurants: nextUser.shareDataWithRestaurants,
          allowAIMemory: nextUser.allowAIMemory,
          discoveryPreferences,
          onboardingCompleted: true,
        }),
      }).catch(() => {});
    }
    setSetupDone();
    setShowAccessibilityPrompt(true);
  };

  const saveAccessibilityAndFinish = async () => {
    const token = localStorage.getItem('miar_client_token');
    if (token && accessibilityNeeds.length > 0) {
      try {
        await fetch('/api/client/accessibility-preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ dificuldades: accessibilityNeeds }),
        });
      } catch {
        // Não bloqueia o acesso por isso — a preferência pode ser enviada depois em Perfil.
      }
    }
    setShowAccessibilityPrompt(false);
    onDone();
  };

  const next = async () => {
    if (stepIdx < STEPS.length - 1) setStepIdx(s => s + 1);
    else await save();
  };
  const back = () => { if (stepIdx > 0) setStepIdx(s => s - 1); };
  const skip = async () => {
    setSetupDone();
    const token = localStorage.getItem('miar_client_token');
    if (token) {
      await fetch('/api/auth/client/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shareDataWithRestaurants: shareData, allowAIMemory: aiMemory, discoveryPreferences, onboardingCompleted: true }),
      }).catch(() => {});
    }
    setShowAccessibilityPrompt(true);
  };

  const progress = ((stepIdx) / (STEPS.length - 1)) * 100;

  if (showAccessibilityPrompt) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-5 py-8 text-slate-100">
        <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
          <h2 className="mb-2 text-2xl font-bold text-white">Quase lá!</h2>
          <p className="mb-6 text-sm text-slate-400">
            Você tem alguma dificuldade que queira nos contar, pra te atendermos melhor?
          </p>

          <div className="mb-6 space-y-2 text-left">
            {[
              { id: 'visual', label: 'Dificuldade visual' },
              { id: 'auditiva', label: 'Dificuldade auditiva' },
              { id: 'motora', label: 'Dificuldade motora / uso de cadeira de rodas' },
              { id: 'neurodivergencia', label: 'Neurodivergência (autismo, TDAH, outras)' },
              { id: 'outra', label: 'Outra' },
            ].map((opcao) => {
              const marcado = accessibilityNeeds.includes(opcao.id);
              return (
                <button
                  key={opcao.id}
                  type="button"
                  onClick={() => {
                    setAccessibilityNeeds((atual) =>
                      marcado ? atual.filter((d) => d !== opcao.id) : [...atual, opcao.id]
                    );
                  }}
                  aria-pressed={marcado}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    marcado
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-700 bg-slate-950 text-slate-300'
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                    marcado ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-600'
                  }`}>
                    {marcado && '✓'}
                  </span>
                  {opcao.label}
                </button>
              );
            })}
          </div>

          <p className="mb-6 text-xs text-slate-500">
            Essa informação é sensível e protegida — usada só pra melhorar seu atendimento, nunca compartilhada publicamente.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => void saveAccessibilityAndFinish()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-base font-semibold text-white hover:bg-emerald-400"
            >
              {accessibilityNeeds.length > 0 ? 'Salvar e continuar' : 'Continuar'}
            </button>
            <button
              onClick={() => void saveAccessibilityAndFinish()}
              className="w-full text-center text-sm text-slate-400 hover:text-slate-300"
            >
              Pular por agora
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {/* Progress */}
      <div className="h-1 bg-slate-800">
        <motion.div className="h-full bg-emerald-500" animate={{ width: `${progress}%` }} />
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={back} disabled={stepIdx === 0}
          className="rounded-lg p-2 text-slate-500 hover:text-slate-300 disabled:opacity-0">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-xs text-slate-500">{stepIdx + 1} / {STEPS.length}</p>
        <button onClick={skip} className="text-xs text-slate-500 hover:text-slate-300">Pular tudo</button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-24">
        <AnimatePresence mode="wait">
          {step === 'health' && (
            <motion.div key="health" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="mb-1 text-xl font-bold">Saúde</h2>
              <p className="mb-5 text-sm text-slate-400">Opcional. Ajuda a IA a fazer melhores recomendações.</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  ...HEALTH_CONDITIONS,
                  ...(user.gender === 'feminino' ? ['Gestante'] : []),
                ].map(c => <Toggle key={c} label={c} active={health.includes(c)} onClick={() => toggle(health, setHealth, c)} />)}
              </div>
              <input value={healthOther} onChange={e => setHealthOther(e.target.value)}
                placeholder="Outra condição (ex: hipertensão, diabetes...)"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
              <p className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-400">
                ℹ️ As informações de saúde têm finalidade exclusivamente informativa. Não substituem profissionais de saúde.
              </p>
            </motion.div>
          )}

          {step === 'goals' && (
            <motion.div key="goals" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="mb-1 text-xl font-bold">O que você está buscando?</h2>
              <p className="mb-5 text-sm text-slate-400">Objetivos com alimentação (opcional, múltiplos)</p>
              <div className="flex flex-wrap gap-2">
                {NUTRITION_GOALS.map(g => <Toggle key={g} label={g} active={goals.includes(g)} onClick={() => toggle(goals, setGoals, g)} />)}
              </div>
            </motion.div>
          )}

          {step === 'dislikes' && (
            <motion.div key="dislikes" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="mb-1 text-xl font-bold">O que você não gosta?</h2>
              <p className="mb-5 text-sm text-slate-400">Ingredientes ou alimentos que prefere evitar</p>
              <div className="mb-3 flex gap-2">
                <input value={dislikeInput} onChange={e => setDislikeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTag(dislikes, setDislikes, dislikeInput, setDislikeInput)}
                  placeholder="ex: cebola, mostarda, coentro..."
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
                <button onClick={() => addTag(dislikes, setDislikes, dislikeInput, setDislikeInput)}
                  className="rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white">+</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {dislikes.map(d => (
                  <span key={d} onClick={() => setDislikes(dislikes.filter(x => x !== d))}
                    className="cursor-pointer rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20">
                    {d} ✕
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'likes' && (
            <motion.div key="likes" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="mb-1 text-xl font-bold">O que você mais gosta?</h2>
              <p className="mb-5 text-sm text-slate-400">Preferências de gosto e preparo</p>
              <div className="mb-3 flex gap-2">
                <input value={likeInput} onChange={e => setLikeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTag(likes, setLikes, likeInput, setLikeInput)}
                  placeholder="ex: mais proteína, pouco sal, mais salada..."
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
                <button onClick={() => addTag(likes, setLikes, likeInput, setLikeInput)}
                  className="rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white">+</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {likes.map(l => (
                  <span key={l} onClick={() => setLikes(likes.filter(x => x !== l))}
                    className="cursor-pointer rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-400 hover:bg-emerald-500/20">
                    {l} ✕
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'discovery' && (
            <motion.div key="discovery" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="mb-1 text-xl font-bold">Sobre suas preferências de compra e entrega</h2>
              <p className="mb-5 text-sm text-slate-400">Marque todas as opções. Elas organizam os resultados, mas não escondem alternativas.</p>
              <div className="flex flex-wrap gap-2">
                {DISCOVERY_OPTIONS.map(({ value, label }) => (
                  <Toggle key={value} label={label} active={discoveryPreferences.includes(value)} onClick={() => toggle(discoveryPreferences, setDiscoveryPreferences, value)} />
                ))}
              </div>
            </motion.div>
          )}

          {step === 'meat' && (
            <motion.div key="meat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="mb-1 text-xl font-bold">Ponto da carne</h2>
              <p className="mb-5 text-sm text-slate-400">Preferência padrão (sempre editável no pedido)</p>
              <div className="space-y-2">
                {[{ v: 'mal-passada', l: '🩸 Mal passada' }, { v: 'ao-ponto', l: '🥩 Ao ponto' }, { v: 'bem-passada', l: '🍖 Bem passada' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setMeat(v)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition
                      ${meat === v ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'}`}>
                    {meat === v && <Check className="h-4 w-4 shrink-0" />}
                    <span>{l}</span>
                  </button>
                ))}
                <button onClick={() => setMeat('')}
                  className="text-xs text-slate-500 hover:text-slate-400">Sem preferência</button>
              </div>
            </motion.div>
          )}

          {step === 'comm' && (
            <motion.div key="comm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="mb-1 text-xl font-bold">Como quer ser tratado?</h2>
              <p className="mb-5 text-sm text-slate-400">Como a IA Miar vai se comunicar com você</p>
              <div className="space-y-2">
                {COMM_STYLES.map(({ value, label }) => (
                  <button key={value} onClick={() => setComm(value)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition
                      ${comm === value ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'}`}>
                    {comm === value && <Check className="h-4 w-4 shrink-0" />}
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'privacy' && (
            <motion.div key="privacy" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="mb-1 text-xl font-bold">Privacidade</h2>
              <p className="mb-5 text-sm text-slate-400">Você controla seus dados. Pode alterar a qualquer momento.</p>
              <div className="space-y-3">
                {[
                  { val: shareData, set: setShareData, title: 'Compartilhar preferências com restaurantes', desc: 'Permite que os estabelecimentos personalizem seu atendimento com base nas suas preferências autorizadas.' },
                  { val: aiMemory, set: setAiMemory, title: 'Memória da IA', desc: 'A IA usa seu histórico para melhorar recomendações futuras.' },
                ].map(({ val, set, title, desc }) => (
                  <div key={title} className="flex items-start gap-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-200">{title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
                    </div>
                    <button onClick={() => set(!val)}
                      className={`mt-0.5 h-6 w-11 rounded-full transition-colors ${val ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                      <div className={`h-5 w-5 translate-y-[0px] rounded-full bg-white shadow transition-transform ${val ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Informações médicas sensíveis nunca são compartilhadas automaticamente, mesmo com esta opção ativa.
              </p>
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center py-12 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-4xl">
                ✅
              </div>
              <h2 className="mb-2 text-2xl font-bold">Tudo pronto!</h2>
              <p className="mb-8 max-w-xs text-sm text-slate-400">
                Suas preferências foram salvas. A IA Miar vai usar essas informações para personalizar sua experiência.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950 p-4">
        <button onClick={next}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-base font-semibold text-white hover:bg-emerald-400">
          {step === 'done' ? 'Ir para o Miar' : 'Continuar'}
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
