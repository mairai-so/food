/**
 * miar-intro.tsx — Manual interativo da MIAR
 * "Como treinar sua IA e o que ela é capaz de fazer"
 *
 * Uma experiência editorial completa que transforma o gestor
 * num parceiro de verdade da MIAR desde o primeiro acesso.
 */

import { useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { useLocation } from 'wouter';
import {
  Brain, Target, TrendingUp, Users, MessageCircle,
  CheckCircle, XCircle, AlertCircle, Zap, Star,
  ChevronDown, ChevronRight, ArrowRight, Mic,
  Paperclip, Search, Bell, BarChart2, BookOpen,
  Heart, Shield, Clock, RefreshCw, Lightbulb,
  ArrowLeft,
} from 'lucide-react';

// ─── Animação de entrada por scroll ──────────────────────────────────────────

function FadeIn({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Dados do manual ──────────────────────────────────────────────────────────

const PILLARS = [
  {
    icon: Heart,
    color: 'from-rose-500/20 to-rose-600/10 border-rose-500/30',
    accent: '#00A86B',
    label: 'Retenção',
    subtitle: 'Cuide de quem já te escolheu',
    desc: 'A MIAR detecta clientes que sumiram e sugere como reconquistá-los antes que virem clientes do concorrente.',
    example: '"O João não pede há 3 semanas. Quer que eu prepare uma mensagem personalizada pra ele?"',
  },
  {
    icon: Target,
    color: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    accent: '#f59e0b',
    label: 'Aquisição',
    subtitle: 'Entenda por que não vêm',
    desc: 'Analisa o que o concorrente tem que você não tem, e sugere como diferenciar — não copiar.',
    example: '"O restaurante a 800m tem bowl proteico e está em alta. Seu cardápio tem algo parecido?"',
  },
  {
    icon: TrendingUp,
    color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
    accent: '#66e3f2',
    label: 'Inovação',
    subtitle: 'Fique à frente do mercado',
    desc: 'Pesquisa tendências gastronômicas, novidades do setor e o que está engajando nas redes — filtrado pro seu perfil.',
    example: '"\'Bowl proteico\' cresceu 240% no Google essa semana. Você quer que eu sugira como aproveitar?"',
  },
  {
    icon: Users,
    color: 'from-violet-500/20 to-violet-600/10 border-violet-500/30',
    accent: '#a78bfa',
    label: 'Pessoas',
    subtitle: 'Desenvolva seu time',
    desc: 'Cria conteúdo de treinamento semanal personalizado pro seu restaurante — com seus pratos, seus protocolos, sua linguagem.',
    example: '"Treinamento de sexta: atendimento ao cliente. Tempo: 15min. Posso gerar o conteúdo agora?"',
  },
];

const CAPABILITIES = [
  { icon: BarChart2, text: 'Analisa pedidos, faturamento e horários de pico', ok: true },
  { icon: Heart, text: 'Detecta clientes inativos e sugere reconquista', ok: true },
  { icon: Search, text: 'Pesquisa concorrentes e identifica gaps', ok: true },
  { icon: TrendingUp, text: 'Monitora tendências gastronômicas em tempo real', ok: true },
  { icon: BookOpen, text: 'Cria treinamentos semanais para a equipe', ok: true },
  { icon: Bell, text: 'Envia alertas proativos toda manhã', ok: true },
  { icon: Star, text: 'Analisa quais pratos vender mais e quais reformular', ok: true },
  { icon: MessageCircle, text: 'Sugere campanhas e promoções baseadas em dados', ok: true },
  { icon: Shield, text: 'Age sozinha sem sua aprovação', ok: false },
  { icon: Brain, text: 'Lê a mente dos clientes sem dados', ok: false },
  { icon: Zap, text: 'Prevê o futuro com 100% de certeza', ok: false },
];

const TIPS = [
  {
    icon: '🎯',
    title: 'Seja específico',
    bad: '"Me fala sobre meus clientes"',
    good: '"Quais clientes que pedem toda semana não vieram nos últimos 14 dias?"',
    why: 'Quanto mais específico, mais precisa a análise.',
  },
  {
    icon: '🧠',
    title: 'Dê contexto do seu negócio',
    bad: '"O que está em alta?"',
    good: '"Sou um restaurante asiático em SP. O que está em alta pra meu perfil essa semana?"',
    why: 'A MIAR usa seu contexto pra filtrar o que é relevante pra você.',
  },
  {
    icon: '📊',
    title: 'Peça comparações',
    bad: '"Meu cardápio está bom?"',
    good: '"Compara meus pratos mais vendidos com o que o Fusion Express tem que eu não tenho"',
    why: 'Comparações geram insights que análises isoladas não revelam.',
  },
  {
    icon: '⏰',
    title: 'Use ela toda manhã',
    bad: 'Abrir o app só quando tem problema',
    good: 'Abrir o briefing diário às 8h antes de começar o expediente',
    why: 'A MIAR vira hábito. Hábito vira vantagem competitiva.',
  },
  {
    icon: '✅',
    title: 'Aprove as sugestões',
    bad: 'Ignorar as sugestões que aparecem',
    good: 'Clicar em Aprovar, Modificar ou Recusar — toda resposta a ensina',
    why: 'Cada aprovação ou recusa torna a MIAR mais precisa pro seu negócio.',
  },
];

const EXAMPLES = [
  {
    label: 'Análise de cliente inativo',
    messages: [
      { role: 'user', text: 'O Carlos não pede faz tempo. O que aconteceu?' },
      { role: 'miar', text: 'Carlos fez 12 pedidos entre março e junho, média de 1 por semana. Parou exatamente quando você retirou o Yakisoba do cardápio — o prato que ele mais pedia. Quer que eu prepare uma mensagem pra avisar que o prato voltou?' },
    ],
  },
  {
    label: 'Pesquisa de concorrente',
    messages: [
      { role: 'user', text: 'Por que o Fusion Express está cheio e eu não?' },
      { role: 'miar', text: 'Eles têm 3 vantagens sobre você agora: abrem às 11h (você às 12h), têm combo executivo R$28 (seu mínimo é R$35) e aparecem primeiro no iFood pra "almoço asiático". Quer atacar qual primeiro? Posso preparar uma estratégia de preço sem reduzir sua margem.' },
    ],
  },
  {
    label: 'Treinamento de equipe',
    messages: [
      { role: 'user', text: 'Minha equipe está com dificuldade no atendimento. Cria um treinamento.' },
      { role: 'miar', text: 'Criado! Módulo de 15min: "Atendimento que fideliza no seu restaurante". Inclui os 3 erros mais comuns na sua categoria, simulação de conflito com cliente e 5 frases que aumentam recompra. Quero enviar pro WhatsApp da equipe agora?' },
    ],
  },
];

// ─── Componentes ──────────────────────────────────────────────────────────────

function PillarCard({ p, index }: { p: typeof PILLARS[0]; index: number }) {
  const Icon = p.icon;
  return (
    <FadeIn delay={index * 0.1}>
      <div className={`rounded-2xl border bg-gradient-to-br p-5 ${p.color} h-full flex flex-col gap-3`}>
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-2.5" style={{ backgroundColor: p.accent + '22' }}>
            <Icon size={20} style={{ color: p.accent }} />
          </div>
          <div>
            <p className="font-bold text-slate-100">{p.label}</p>
            <p className="text-xs text-slate-400">{p.subtitle}</p>
          </div>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{p.desc}</p>
        <div className="mt-auto rounded-xl bg-slate-900/60 px-3 py-2.5 text-xs text-slate-400 italic border border-slate-700/50">
          {p.example}
        </div>
      </div>
    </FadeIn>
  );
}

function TipCard({ tip, index }: { tip: typeof TIPS[0]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <FadeIn delay={index * 0.08}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left rounded-2xl border border-slate-700/60 bg-slate-900/80 p-4 hover:border-slate-600 transition-all"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{tip.icon}</span>
          <span className="font-semibold text-slate-200 flex-1">{tip.title}</span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={16} className="text-slate-500" />
          </motion.span>
        </div>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3">
                <p className="text-xs font-bold text-rose-400 mb-1.5 flex items-center gap-1">
                  <XCircle size={12} /> Evite
                </p>
                <p className="text-xs text-slate-300 italic">"{tip.bad}"</p>
              </div>
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                <p className="text-xs font-bold text-emerald-400 mb-1.5 flex items-center gap-1">
                  <CheckCircle size={12} /> Prefira
                </p>
                <p className="text-xs text-slate-300 italic">"{tip.good}"</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 flex items-start gap-2">
              <Lightbulb size={12} className="mt-0.5 text-amber-400 shrink-0" />
              {tip.why}
            </p>
          </motion.div>
        )}
      </button>
    </FadeIn>
  );
}

function ExampleChat({ ex }: { ex: typeof EXAMPLES[0] }) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/60 flex items-center gap-2">
        <div className="size-2 rounded-full bg-[#00A86B]" />
        <span className="text-xs font-semibold text-slate-400">{ex.label}</span>
      </div>
      <div className="p-4 space-y-3">
        {ex.messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'miar' && (
              <div className="size-7 rounded-full bg-gradient-to-br from-[#00A86B] to-[#00E6F2] flex items-center justify-center shrink-0 mt-0.5">
                <Brain size={14} className="text-white" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-[#00A86B]/20 border border-[#00A86B]/30 text-slate-200 rounded-tr-sm'
                : 'bg-slate-800 border border-slate-700 text-slate-300 rounded-tl-sm'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function MIARIntroPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {/* Botão voltar */}
      <button
        onClick={() => navigate('/painel')}
        className="fixed top-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 backdrop-blur-md px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft size={15} />
        Painel
      </button>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center min-h-[90vh] px-6 text-center overflow-hidden">

        {/* Glow de fundo */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[500px] rounded-full bg-[#00A86B]/8 blur-[120px]" />
          <div className="absolute top-2/3 left-1/3 size-[300px] rounded-full bg-[#66e3f2]/6 blur-[100px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 max-w-3xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 rounded-full border border-[#00A86B]/30 bg-[#00A86B]/10 px-4 py-1.5 text-sm text-[#00A86B] mb-6"
          >
            <Brain size={14} />
            Manual da MIAR · Inteligência de Negócio
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-tight mb-6">
            Sua parceira.{' '}
            <span className="bg-gradient-to-r from-[#00A86B] to-[#00E6F2] bg-clip-text text-transparent">
              Não um chatbot.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 leading-relaxed mb-10 max-w-2xl mx-auto">
            A MIAR cresce junto com o seu restaurante. Ela lembra de tudo,
            pesquisa o mercado por você, treina sua equipe e avisa quando
            algo precisa da sua atenção — antes que vire problema.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/mia')}
              className="flex items-center gap-2 rounded-2xl bg-[#00A86B] px-7 py-3.5 font-bold text-white shadow-lg shadow-[#00A86B]/25 hover:bg-[#00E6F2] transition-colors"
            >
              Começar a conversar com a MIAR
              <ArrowRight size={18} />
            </motion.button>
            <button
              onClick={() => document.getElementById('como-treinar')?.scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-7 py-3.5 font-semibold text-slate-300 hover:border-slate-600 transition-colors"
            >
              Ver o manual completo
              <ChevronDown size={18} />
            </button>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <ChevronDown size={24} className="text-slate-600" />
        </motion.div>
      </section>

      {/* ── O QUE É A MIAR ───────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <FadeIn>
          <div className="rounded-3xl border border-[#00A86B]/20 bg-gradient-to-br from-[#00A86B]/8 to-transparent p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#00A86B] mb-3">A filosofia</p>
                <h2 className="text-3xl md:text-4xl font-black mb-5 leading-tight">
                  A MIAR não é uma ferramenta.<br />
                  <span className="text-slate-400">É uma relação.</span>
                </h2>
                <p className="text-slate-400 leading-relaxed">
                  Ferramentas você usa quando precisa e esquece. Parceiras você consulta todo dia,
                  compartilha preocupações, celebra vitórias junto. É isso que a MIAR quer ser
                  para o seu restaurante.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  { icon: RefreshCw, text: 'Aprende com cada conversa que você tem' },
                  { icon: Bell, text: 'Avisa proativamente, sem você precisar perguntar' },
                  { icon: Shield, text: 'Age apenas com a sua aprovação — sempre' },
                  { icon: Clock, text: 'Disponível 24h, 7 dias por semana' },
                  { icon: Brain, text: 'Memória persistente do seu negócio e dos seus clientes' },
                ].map(({ icon: Icon, text }, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-slate-900/60 border border-slate-800 px-4 py-3">
                    <Icon size={16} className="text-[#00A86B] shrink-0" />
                    <span className="text-sm text-slate-300">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── OS 4 PILARES ─────────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-[#66e3f2] mb-3">Os 4 pilares</p>
            <h2 className="text-3xl md:text-4xl font-black">Em que a MIAR trabalha por você</h2>
          </div>
        </FadeIn>
        <div className="grid md:grid-cols-2 gap-4">
          {PILLARS.map((p, i) => <PillarCard key={i} p={p} index={i} />)}
        </div>
      </section>

      {/* ── COMO ELA FUNCIONA ─────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-[#00A86B] mb-3">O fluxo</p>
            <h2 className="text-3xl md:text-4xl font-black">Como a MIAR funciona</h2>
          </div>
        </FadeIn>
        <div className="flex flex-col md:flex-row items-center gap-4 justify-center">
          {[
            { step: '1', title: 'Análise noturna', desc: 'Toda noite a MIAR analisa seus dados internos: pedidos, clientes, cardápio, caixa.' },
            { step: '2', title: 'Pesquisa externa', desc: 'Ela cruza com o mercado: tendências, concorrentes, novidades do setor.' },
            { step: '3', title: 'Briefing às 8h', desc: 'De manhã você recebe um painel com alertas, oportunidades e sugestões prontas.' },
            { step: '4', title: 'Você aprova', desc: 'Cada sugestão tem um botão: Aprovar, Modificar ou Recusar. A MIAR nunca age sozinha.' },
          ].map((item, i) => (
            <FadeIn key={i} delay={i * 0.1} className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <div className="size-12 rounded-2xl bg-gradient-to-br from-[#00A86B] to-[#00E6F2] flex items-center justify-center font-black text-white text-lg shrink-0">
                  {item.step}
                </div>
                <div className="mt-3 text-center max-w-[160px]">
                  <p className="font-bold text-slate-200 text-sm mb-1">{item.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
              {i < 3 && <ChevronRight size={20} className="text-slate-700 hidden md:block shrink-0" />}
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── COMO TREINAR SUA MIAR ─────────────────────────────────────── */}
      <section id="como-treinar" className="px-6 py-20 max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-[#66e3f2] mb-3">O manual</p>
            <h2 className="text-3xl md:text-4xl font-black mb-4">Como treinar a sua MIAR</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              A MIAR aprende com você. Quanto mais contexto você der,
              mais precisa e útil ela se torna.
            </p>
          </div>
        </FadeIn>
        <div className="space-y-3">
          {TIPS.map((tip, i) => <TipCard key={i} tip={tip} index={i} />)}
        </div>
      </section>

      {/* ── EXEMPLOS REAIS ────────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-[#00A86B] mb-3">Na prática</p>
            <h2 className="text-3xl md:text-4xl font-black">Exemplos de conversas reais</h2>
          </div>
        </FadeIn>
        <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-4">
          {EXAMPLES.map((ex, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <ExampleChat ex={ex} />
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── O QUE ELA PODE E NÃO PODE ────────────────────────────────── */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-[#66e3f2] mb-3">Honestidade antes de tudo</p>
            <h2 className="text-3xl md:text-4xl font-black">O que a MIAR pode fazer</h2>
            <p className="text-slate-400 mt-3 max-w-xl mx-auto">
              Preferimos ser honestos sobre as capacidades. Uma parceira confiável
              é melhor que uma que promete o impossível.
            </p>
          </div>
        </FadeIn>
        <div className="grid md:grid-cols-2 gap-3">
          {CAPABILITIES.map(({ icon: Icon, text, ok }, i) => (
            <FadeIn key={i} delay={i * 0.04}>
              <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                ok
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : 'border-slate-700/40 bg-slate-900/40 opacity-60'
              }`}>
                {ok
                  ? <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                  : <XCircle size={16} className="text-slate-600 shrink-0" />
                }
                <Icon size={15} className={ok ? 'text-slate-400 shrink-0' : 'text-slate-700 shrink-0'} />
                <span className={`text-sm ${ok ? 'text-slate-300' : 'text-slate-600'}`}>{text}</span>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── COMO USAR O CHAT ─────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <FadeIn>
          <div className="rounded-3xl border border-[#66e3f2]/20 bg-gradient-to-br from-[#66e3f2]/5 to-transparent p-8 md:p-12">
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-widest text-[#66e3f2] mb-3">A interface</p>
              <h2 className="text-3xl font-black">Recursos do chat MIAR</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Mic, title: 'Voz feminina exclusiva', desc: 'A MIAR tem voz de mulher — sempre. Nenhuma voz masculina é permitida no sistema.' },
                { icon: Paperclip, title: 'Anexos e imagens', desc: 'Mande fotos de notas fiscais, cardápios de concorrentes ou qualquer documento.' },
                { icon: BookOpen, title: 'Pastas e conversas', desc: 'Organize suas conversas em pastas por tema: Fornecedores, Clientes, Estoque...' },
                { icon: Clock, title: 'Timestamp HH:MM:SS', desc: 'Cada conversa tem horário exato — facilita encontrar aquela conversa específica.' },
                { icon: MessageCircle, title: 'Narração de texto', desc: 'Selecione qualquer trecho e a MIAR narra apenas aquele pedaço. Perfeito para revisão.' },
                { icon: RefreshCw, title: 'Memória persistente', desc: 'A MIAR lembra de tudo que você contou — fornecedores, metas, problemas, decisões.' },
              ].map(({ icon: Icon, title, desc }, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg p-2 bg-[#66e3f2]/10">
                      <Icon size={16} className="text-[#66e3f2]" />
                    </div>
                    <span className="font-bold text-slate-200 text-sm">{title}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed pl-9">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── DICA ESPECIAL PARA NEURODIVERGENTES ──────────────────────── */}
      <section className="px-6 py-10 max-w-5xl mx-auto">
        <FadeIn>
          <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6 md:p-8 flex gap-5 items-start">
            <div className="shrink-0 mt-1 size-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertCircle size={18} className="text-amber-400" />
            </div>
            <div>
              <p className="font-bold text-amber-300 mb-2">Dica especial: encontre qualquer conversa pelo horário</p>
              <p className="text-sm text-slate-400 leading-relaxed">
                Toda conversa mostra o timestamp completo — hora, minuto e segundo.
                Se você lembra que teve uma ideia "perto das 14h de quarta", é só olhar os horários
                e a conversa estará lá. Organize em pastas por tema pra facilitar ainda mais.
              </p>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────── */}
      <section className="px-6 py-32 text-center">
        <FadeIn>
          <div className="relative max-w-2xl mx-auto">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="size-[400px] rounded-full bg-[#00A86B]/10 blur-[80px]" />
            </div>
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-black mb-5">
                Pronto para começar?
              </h2>
              <p className="text-slate-400 mb-10 text-lg">
                A MIAR está esperando. Apresente o seu restaurante pra ela e
                deixe a parceria crescer.
              </p>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/mia')}
                className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#00A86B] to-[#00E6F2] px-10 py-4 text-lg font-black text-white shadow-2xl shadow-[#00A86B]/30 hover:shadow-[#00A86B]/50 transition-shadow"
              >
                <Brain size={22} />
                Abrir o chat da MIAR
                <ArrowRight size={22} />
              </motion.button>
              <p className="mt-5 text-xs text-slate-600">
                Você pode voltar a este manual a qualquer momento pelo menu principal
              </p>
            </div>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}
