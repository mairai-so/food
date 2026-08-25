/**
 * jornada-configuracao.tsx
 * A jornada guiada de configuração do restaurante no Miar Gestor.
 * 6 etapas: Unidades → Segmentos → Modo de cardápio → Cardápio → Equipe → Lançamento
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ArrowLeft, Check, Plus, Trash2, Mic2,
  MousePointerClick, Eraser, Loader2, CheckCircle2,
  Rocket, Store, ShieldCheck, UserPlus, X, ChevronDown,
} from 'lucide-react';
import { SEGMENTOS, RECURSOS_ESTAB } from './onboarding-estabelecimento';
import { FUNCOES, PERFIL_FUNCOES } from '@/lib/funcoes';

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? '';
}
function authH() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}

// ─── Tipos ─────────────────────────────────────────────────────────────────────

type Etapa = 'unidades' | 'segmentos' | 'modo' | 'cardapio' | 'equipe' | 'lancamento';
type ModoCardapio = 'marcar' | 'eliminar' | 'ia';

type ItemCardapio = { categoria: string; nome: string; preco: string; marcado: boolean };

type Membro = {
  uid: string;
  nome: string;
  email: string;
  telefone: string;
  pin: string;
  perfil: string;
  recursos: string[];
};

const PERFIS_PRONTOS: Record<string, { label: string; emoji: string; recursos: string[] }> = {
  garcom:      { label: 'Garçom',       emoji: '🍽️',  recursos: PERFIL_FUNCOES.garcom },
  cozinha:     { label: 'Cozinha',      emoji: '👨‍🍳',  recursos: PERFIL_FUNCOES.cozinha },
  caixa:       { label: 'Caixa',        emoji: '💳',  recursos: PERFIL_FUNCOES.caixa },
  entregador:  { label: 'Entregador',   emoji: '🛵',  recursos: PERFIL_FUNCOES.entregador },
  gerente:     { label: 'Gerente',      emoji: '🗂️',  recursos: PERFIL_FUNCOES.gerente },
  total:       { label: 'Sócio',         emoji: '🔑',  recursos: PERFIL_FUNCOES.total },
};

function novoMembro(): Membro {
  return {
    uid: Math.random().toString(36).slice(2, 10),
    nome: '', email: '', telefone: '',
    pin: '', perfil: 'garcom',
    recursos: [...PERFIL_FUNCOES.garcom],
  };
}

const SEGMENTO_EMOJI: Record<string, string> = {
  pizzaria: '🍕', churrascaria: '🥩', restaurante: '🍽️', bar: '🍺',
  japones: '🍱', hamburgueria: '🍔', cafeteria: '☕', padaria: '🥖',
  sorveteria: '🍦', marmitaria: '📦', pastelaria: '🥟',
  'food-truck': '🚚', adega: '🍷', 'drive-thru-bebidas': '🥤', outros: '✨',
};

// ─── Layout shell ───────────────────────────────────────────────────────────────

const ETAPAS: { id: Etapa; label: string }[] = [
  { id: 'unidades',  label: 'Unidades'  },
  { id: 'segmentos', label: 'Negócio'   },
  { id: 'modo',      label: 'Cardápio'  },
  { id: 'cardapio',  label: 'Itens'     },
  { id: 'equipe',    label: 'Equipe'    },
  { id: 'lancamento',label: 'Lançar'   },
];

function ProgressoBar({ etapa }: { etapa: Etapa }) {
  const idx = ETAPAS.findIndex((e) => e.id === etapa);
  return (
    <div className="mb-8">
      <div className="flex items-center gap-1.5">
        {ETAPAS.map((e, i) => (
          <div key={e.id} className="flex flex-1 flex-col items-center gap-1">
            <div className={`h-1 w-full rounded-full transition-all duration-500 ${
              i < idx ? 'bg-violet-500' : i === idx ? 'bg-violet-400' : 'bg-slate-800'
            }`} />
            <span className={`hidden text-[10px] font-medium sm:block transition-colors ${
              i <= idx ? 'text-violet-400' : 'text-slate-700'
            }`}>{e.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Titulo({ supra, titulo, sub }: { supra: string; titulo: string; sub?: string }) {
  return (
    <header className="mb-7">
      <p className="text-xs font-semibold uppercase tracking-[0.34em] text-violet-400">{supra}</p>
      <h1 className="mt-2 text-3xl font-bold">{titulo}</h1>
      {sub && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{sub}</p>}
    </header>
  );
}

function BtnPrimario({ onClick, loading, disabled, children, full }: {
  onClick?: () => void; loading?: boolean; disabled?: boolean; children: React.ReactNode; full?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={loading || disabled}
      className={`flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-[#0d1b1a] transition hover:bg-violet-500 disabled:opacity-50 ${full ? 'w-full' : ''}`}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

function BtnSecundario({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 rounded-2xl border border-slate-700 px-6 py-3.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white">
      {children}
    </button>
  );
}

function Rodape({ onVoltar, onAvancar, loading, disabled, avancarLabel = 'Continuar' }: {
  onVoltar?: () => void; onAvancar?: () => void; loading?: boolean; disabled?: boolean; avancarLabel?: string;
}) {
  return (
    <div className="mt-10 flex items-center justify-between gap-4">
      {onVoltar
        ? <BtnSecundario onClick={onVoltar}><ArrowLeft className="h-4 w-4" /> Voltar</BtnSecundario>
        : <div />
      }
      {onAvancar && (
        <BtnPrimario onClick={onAvancar} loading={loading} disabled={disabled}>
          {avancarLabel} <ArrowRight className="h-4 w-4" />
        </BtnPrimario>
      )}
    </div>
  );
}

// ─── Etapa 1: Quantas unidades ──────────────────────────────────────────────────

function EtapaUnidades({ onNext }: { onNext: (n: number) => void }) {
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const opcoes = [
    { n: 1, label: '1 unidade',     sub: 'Só uma casa' },
    { n: 2, label: '2 unidades',    sub: 'Dois endereços' },
    { n: 3, label: '3 unidades',    sub: 'Três locais' },
    { n: 4, label: '4 ou mais',     sub: 'Rede / franquia' },
  ];
  return (
    <div>
      <Titulo supra="Etapa 1 de 6" titulo="Quantas unidades você tem?" sub="Cada unidade vai ter seu próprio painel, cardápio e equipe. Você sempre pode adicionar mais depois." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {opcoes.map(({ n, label, sub }) => (
          <button key={n} type="button" onClick={() => setSelecionado(n)}
            className={`group flex flex-col items-center rounded-3xl border py-8 px-4 text-center transition-all ${
              selecionado === n
                ? 'border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10'
                : 'border-slate-800 bg-slate-900/60 hover:border-violet-700/60 hover:bg-violet-500/[0.04]'
            }`}>
            <span className="mb-3 text-4xl font-black tabular-nums text-slate-100">{n === 4 ? '4+' : n}</span>
            <span className="text-sm font-semibold text-slate-200">{label}</span>
            <span className="mt-1 text-xs text-slate-500">{sub}</span>
            {selecionado === n && <Check className="mt-3 h-4 w-4 text-violet-400" />}
          </button>
        ))}
      </div>
      <Rodape onAvancar={() => selecionado && onNext(selecionado)} disabled={!selecionado} />
    </div>
  );
}

// ─── Etapa 2: Segmentos (multi-select) ─────────────────────────────────────────

function EtapaSegmentos({ onNext, onBack }: { onNext: (ids: string[]) => void; onBack: () => void }) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelecionados((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  return (
    <div>
      <Titulo supra="Etapa 2 de 6" titulo="Qual é o seu negócio?"
        sub="Selecione um ou mais segmentos. Churrascaria que também vende cerveja e tem bar? Marca os dois." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SEGMENTOS.map((seg) => {
          const ativo = selecionados.has(seg.id);
          return (
            <button key={seg.id} type="button" onClick={() => toggle(seg.id)}
              className={`group flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                ativo
                  ? 'border-violet-500 bg-violet-500/10 shadow-md shadow-violet-500/10'
                  : 'border-slate-800 bg-slate-900/60 hover:border-violet-700/50 hover:bg-violet-500/[0.04]'
              }`}>
              <span className="text-3xl">{SEGMENTO_EMOJI[seg.id] ?? '🍴'}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-100">{seg.nome}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{seg.descricao}</p>
              </div>
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                ativo ? 'border-violet-500 bg-violet-500' : 'border-slate-700'
              }`}>
                {ativo && <Check className="h-3 w-3 text-white" />}
              </div>
            </button>
          );
        })}
      </div>
      {selecionados.size > 0 && (
        <p className="mt-4 text-sm text-violet-400">
          {selecionados.size} segmento{selecionados.size > 1 ? 's' : ''} selecionado{selecionados.size > 1 ? 's' : ''} ·{' '}
          {[...selecionados].map((id) => SEGMENTOS.find((s) => s.id === id)?.nome).filter(Boolean).join(', ')}
        </p>
      )}
      <Rodape onVoltar={onBack} onAvancar={() => selecionados.size > 0 && onNext([...selecionados])} disabled={selecionados.size === 0} />
    </div>
  );
}

// ─── Etapa 3: Modo de cardápio ──────────────────────────────────────────────────

function EtapaModo({ onNext, onBack }: { onNext: (m: ModoCardapio) => void; onBack: () => void }) {
  const [selecionado, setSelecionado] = useState<ModoCardapio | null>(null);
  const opcoes: Array<{ id: ModoCardapio; emoji: string; titulo: string; descricao: string; destaque?: boolean }> = [
    {
      id: 'ia',
      emoji: '🎤',
      titulo: 'Contar para a IA',
      descricao: 'Descreva seu cardápio do seu jeito — texto livre, como se estivesse falando com alguém. A IA monta a lista.',
      destaque: true,
    },
    {
      id: 'marcar',
      emoji: '✅',
      titulo: 'Marcar o que tenho',
      descricao: 'Veja a lista típica do seu segmento e marque só o que você já serve.',
    },
    {
      id: 'eliminar',
      emoji: '🗑️',
      titulo: 'Eliminar o que não tenho',
      descricao: 'Começa com tudo marcado. Você desmarca o que não quer.',
    },
  ];
  return (
    <div>
      <Titulo supra="Etapa 3 de 6" titulo="Como quer montar seu cardápio?"
        sub="Escolha o jeito que faz mais sentido para você." />
      <div className="grid gap-4 sm:grid-cols-3">
        {opcoes.map((op) => (
          <button key={op.id} type="button" onClick={() => setSelecionado(op.id)}
            className={`group flex flex-col items-start rounded-3xl border p-6 text-left transition-all ${
              selecionado === op.id
                ? 'border-violet-500 bg-violet-500/10 shadow-xl shadow-violet-500/10'
                : op.destaque
                ? 'border-violet-800/60 bg-violet-900/10 hover:border-violet-500/60 hover:bg-violet-500/[0.07]'
                : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
            }`}>
            <div className="mb-4 flex items-center justify-between w-full">
              <span className="text-3xl">{op.emoji}</span>
              {op.destaque && <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-violet-300 uppercase tracking-wider">Recomendado</span>}
            </div>
            <p className="text-base font-bold text-slate-100">{op.titulo}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{op.descricao}</p>
            {selecionado === op.id && (
              <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-violet-400">
                <Check className="h-3.5 w-3.5" /> Selecionado
              </div>
            )}
          </button>
        ))}
      </div>
      <Rodape onVoltar={onBack} onAvancar={() => selecionado && onNext(selecionado)} disabled={!selecionado} />
    </div>
  );
}

// ─── Etapa 4a: Cardápio por IA ──────────────────────────────────────────────────

function CardapioIA({ segmentoIds, onConfirm, onBack }: {
  segmentoIds: string[]; onConfirm: (itens: ItemCardapio[]) => void; onBack: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [processando, setProcessando] = useState(false);
  const [itens, setItens] = useState<ItemCardapio[] | null>(null);
  const [erro, setErro] = useState('');
  const [phase, setPhase] = useState<'input' | 'processing' | 'review'>('input');
  const nomeSegmentos = segmentoIds.map((id) => SEGMENTOS.find((s) => s.id === id)?.nome).filter(Boolean).join(', ');

  const processar = async () => {
    if (!texto.trim()) return;
    setProcessando(true);
    setErro('');
    setPhase('processing');
    try {
      const prompt = `Você é um assistente de configuração de restaurante. Analise a descrição abaixo de um(a) ${nomeSegmentos} e extraia todos os itens do cardápio mencionados. Retorne SOMENTE um JSON válido no formato: [{"categoria":"Nome da Categoria","nome":"Nome do Item"}]. Sem texto antes ou depois do JSON. Agrupe itens similares na mesma categoria. Se não houver categoria clara, use "Cardápio".

Descrição: ${texto}`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Erro na IA.');

      const reply = data.message ?? '';
      const jsonMatch = reply.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('A IA não retornou o formato esperado. Tente novamente.');

      const parsed: Array<{ categoria: string; nome: string }> = JSON.parse(jsonMatch[0]);
      setItens(parsed.map((p) => ({ categoria: p.categoria, nome: p.nome, preco: '', marcado: true })));
      setPhase('review');
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Falha ao processar.');
      setPhase('input');
    } finally {
      setProcessando(false);
    }
  };

  const toggleItem = (i: number) => {
    setItens((prev) => prev?.map((item, idx) => idx === i ? { ...item, marcado: !item.marcado } : item) ?? null);
  };

  const setPreco = (i: number, v: string) => {
    setItens((prev) => prev?.map((item, idx) => idx === i ? { ...item, preco: v.replace(/[^\d.,]/g, '') } : item) ?? null);
  };

  if (phase === 'processing') {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-5xl"
        >⭐</motion.div>
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-100">A IA está montando seu cardápio…</p>
          <p className="mt-1 text-sm text-slate-500">Isso leva alguns segundos.</p>
        </div>
      </div>
    );
  }

  if (phase === 'review' && itens) {
    const marcados = itens.filter((i) => i.marcado);
    const categorias = [...new Set(itens.map((i) => i.categoria))];
    return (
      <div>
        <div className="mb-5 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4">
          <p className="text-sm font-semibold text-violet-300">🎉 A IA encontrou {itens.length} itens.</p>
          <p className="mt-1 text-xs text-slate-400">Desmarque o que não quer. Coloque os preços agora ou depois.</p>
        </div>
        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {categorias.map((cat) => (
            <div key={cat}>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">{cat}</p>
              <div className="space-y-1.5">
                {itens.map((item, i) => item.categoria !== cat ? null : (
                  <div key={i} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${item.marcado ? 'border-slate-700 bg-slate-900/60' : 'border-slate-800/40 opacity-40'}`}>
                    <button type="button" onClick={() => toggleItem(i)}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${item.marcado ? 'border-violet-500 bg-violet-500' : 'border-slate-600'}`}>
                      {item.marcado && <Check className="h-3 w-3 text-white" />}
                    </button>
                    <span className="flex-1 text-sm text-slate-200">{item.nome}</span>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <span>R$</span>
                      <input value={item.preco} onChange={(e) => setPreco(i, e.target.value)}
                        placeholder="—" inputMode="decimal"
                        className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Rodape
          onVoltar={() => setPhase('input')}
          onAvancar={() => onConfirm(marcados)}
          avancarLabel={`Confirmar ${marcados.length} itens`}
          disabled={marcados.length === 0}
        />
      </div>
    );
  }

  return (
    <div>
      <Titulo supra="Etapa 4 de 6 · Modo IA" titulo="Conte seu cardápio do seu jeito"
        sub={`Pode ser rápido ou detalhado. Quanto mais você detalhar, mais itens a IA reconhece. Segmento: ${nomeSegmentos}`} />
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-violet-400">
          <Mic2 className="h-4 w-4" /> Descreva em texto livre
        </div>
        <textarea
          value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder={`Exemplo:\n"Tenho uma churrascaria. Cortes: picanha, maminha, costela, linguiça, coração de frango. Acompanhamentos: arroz, feijão, farofa, vinagrete, pão de alho. Bebidas: água, refri, cerveja long neck, chopp, caipirinha. Sobremesa: pudim e sorvete."`}
          rows={10}
          className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-violet-500 transition-colors"
        />
        <p className="mt-2 text-right text-xs text-slate-600">{texto.length} caracteres</p>
      </div>
      {erro && <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">{erro}</p>}
      <Rodape onVoltar={onBack} onAvancar={() => void processar()} loading={processando} disabled={texto.trim().length < 10} avancarLabel="Processar com IA ✨" />
    </div>
  );
}

// ─── Etapa 4b: Cardápio manual (marcar / eliminar) ─────────────────────────────

function CardapioManual({ segmentoIds, modo, onConfirm, onBack }: {
  segmentoIds: string[]; modo: 'marcar' | 'eliminar';
  onConfirm: (itens: ItemCardapio[]) => void; onBack: () => void;
}) {
  const todosItens = (): ItemCardapio[] => {
    const base: ItemCardapio[] = [];
    segmentoIds.forEach((sid) => {
      const seg = SEGMENTOS.find((s) => s.id === sid);
      if (!seg) return;
      seg.categorias.forEach((cat) => {
        cat.itens.forEach((nome) => {
          const chave = `${cat.nome}::${nome}`;
          if (!base.find((b) => b.categoria === cat.nome && b.nome === nome)) {
            base.push({ categoria: cat.nome, nome, preco: '', marcado: modo === 'eliminar' });
          }
        });
      });
    });
    return base;
  };

  const [itens, setItens] = useState<ItemCardapio[]>(() => todosItens());
  const [busca, setBusca] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('');

  const toggle = (i: number) => setItens((p) => p.map((it, idx) => idx === i ? { ...it, marcado: !it.marcado } : it));
  const setPreco = (i: number, v: string) => setItens((p) => p.map((it, idx) => idx === i ? { ...it, preco: v.replace(/[^\d.,]/g, '') } : it));
  const addItem = () => {
    const nome = novoNome.trim();
    const cat = novaCategoria.trim() || 'Outros';
    if (!nome) return;
    setItens((p) => [...p, { categoria: cat, nome, preco: '', marcado: true }]);
    setNovoNome(''); setNovaCategoria('');
  };

  const categorias = [...new Set(itens.map((i) => i.categoria))];
  const termo = busca.toLowerCase();
  const filtrado = termo ? itens.map((it, i) => ({ it, i })).filter(({ it }) => it.nome.toLowerCase().includes(termo) || it.categoria.toLowerCase().includes(termo)) : null;

  const marcados = itens.filter((i) => i.marcado);

  return (
    <div>
      <Titulo supra={`Etapa 4 de 6 · ${modo === 'marcar' ? 'Marcar o que tenho' : 'Eliminar o que não tenho'}`}
        titulo={modo === 'marcar' ? 'Marque o que você já serve' : 'Desmarque o que você não tem'}
        sub="Os preços são seus — nenhum vem preenchido. Pode deixar em branco e completar depois." />
      <div className="mb-4 flex flex-wrap gap-2">
        <input value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar item…"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-violet-500 min-w-32" />
        <button type="button" onClick={() => setItens((p) => p.map((it) => ({ ...it, marcado: true })))}
          className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-white">Marcar tudo</button>
        <button type="button" onClick={() => setItens((p) => p.map((it) => ({ ...it, marcado: false })))}
          className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-white">Desmarcar tudo</button>
      </div>

      <div className="max-h-[55vh] overflow-y-auto space-y-5 pr-1">
        {(filtrado
          ? [{ cat: 'Resultados', list: filtrado }]
          : categorias.map((cat) => ({ cat, list: itens.map((it, i) => ({ it, i })).filter(({ it }) => it.categoria === cat) }))
        ).map(({ cat, list }) => (
          <div key={cat}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{cat}</p>
              {!filtrado && (
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setItens((p) => p.map((it) => it.categoria === cat ? { ...it, marcado: true } : it))}
                    className="text-[10px] text-violet-500 hover:text-violet-300">+ tudo</button>
                  <button type="button"
                    onClick={() => setItens((p) => p.map((it) => it.categoria === cat ? { ...it, marcado: false } : it))}
                    className="text-[10px] text-slate-600 hover:text-slate-400">− tudo</button>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              {list.map(({ it, i }) => (
                <div key={i} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${it.marcado ? 'border-slate-700 bg-slate-900/60' : 'border-slate-800/30 opacity-35'}`}>
                  <button type="button" onClick={() => toggle(i)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${it.marcado ? 'border-violet-500 bg-violet-500' : 'border-slate-600'}`}>
                    {it.marcado && <Check className="h-3 w-3 text-white" />}
                  </button>
                  <span className="flex-1 text-sm text-slate-200">{it.nome}</span>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <span>R$</span>
                    <input value={it.preco} onChange={(e) => setPreco(i, e.target.value)}
                      placeholder="—" inputMode="decimal"
                      className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Adicionar item */}
      <div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-4">
        <p className="mb-3 text-xs font-semibold text-slate-500">Adicionar item personalizado</p>
        <div className="flex flex-wrap gap-2">
          <input value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)}
            placeholder="Categoria"
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-violet-500 w-36" />
          <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder="Nome do item"
            className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-violet-500 min-w-32" />
          <button type="button" onClick={addItem}
            className="flex items-center gap-1 rounded-xl bg-violet-600/20 px-4 py-2 text-sm text-violet-300 hover:bg-violet-600/30">
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>
      </div>

      {marcados.length > 0 && (
        <p className="mt-3 text-sm text-violet-400">{marcados.length} item{marcados.length !== 1 ? 's' : ''} selecionado{marcados.length !== 1 ? 's' : ''}</p>
      )}

      <Rodape onVoltar={onBack} onAvancar={() => onConfirm(marcados)} disabled={marcados.length === 0} avancarLabel={`Confirmar ${marcados.length} itens`} />
    </div>
  );
}

// ─── Etapa 5: Equipe ────────────────────────────────────────────────────────────

function EtapaEquipe({ onNext, onBack }: { onNext: (membros: Membro[]) => void; onBack: () => void }) {
  const [membros, setMembros] = useState<Membro[]>([novoMembro()]);
  const [ativo, setAtivo] = useState(0);
  const [expandPermissoes, setExpandPermissoes] = useState(false);

  const atual = membros[ativo];
  const patch = (campos: Partial<Membro>) =>
    setMembros((lista) => lista.map((m, i) => i === ativo ? { ...m, ...campos } : m));
  const aplicarPerfil = (perfilId: string) =>
    patch({ perfil: perfilId, recursos: [...(PERFIS_PRONTOS[perfilId]?.recursos ?? [])] });
  const toggleRecurso = (id: string) => {
    if (!atual) return;
    const recursos = atual.recursos.includes(id)
      ? atual.recursos.filter((r) => r !== id)
      : [...atual.recursos, id];
    patch({ recursos, perfil: 'personalizado' });
  };

  const adicionar = () => { setMembros((l) => [...l, novoMembro()]); setAtivo(membros.length); };
  const remover = (i: number) => { if (membros.length === 1) return; setMembros((l) => l.filter((_, idx) => idx !== i)); setAtivo((a) => (a >= i && a > 0 ? a - 1 : a)); };

  return (
    <div>
      <Titulo supra="Etapa 5 de 6" titulo="Monte sua equipe"
        sub="Adicione os membros que vão usar o MIAR. Cada cargo já vem com as permissões certas — ajuste o que quiser." />

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* Lista de membros */}
        <aside className="space-y-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Equipe ({membros.length})
            </p>
            <div className="space-y-1.5">
              {membros.map((m, i) => (
                <div key={m.uid} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${i === ativo ? 'border-violet-500/60 bg-violet-500/10' : 'border-transparent bg-slate-800/40 hover:bg-slate-800/70'}`}>
                  <button type="button" onClick={() => setAtivo(i)} className="flex-1 text-left">
                    <p className="truncate text-sm font-medium text-slate-100">{m.nome || 'Novo membro'}</p>
                    <p className="truncate text-xs text-slate-500">
                      {PERFIS_PRONTOS[m.perfil]?.emoji ?? '👤'} {PERFIS_PRONTOS[m.perfil]?.label ?? 'Personalizado'}
                    </p>
                  </button>
                  {membros.length > 1 && (
                    <button type="button" onClick={() => remover(i)} className="text-slate-600 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={adicionar}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 py-2.5 text-sm text-slate-400 hover:border-slate-600 hover:text-slate-200">
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </div>
        </aside>

        {/* Formulário */}
        <div className="space-y-4">
          {/* Dados */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <UserPlus className="h-4 w-4 text-violet-400" /> Dados
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Nome completo', key: 'nome', type: 'text', placeholder: '' },
                { label: 'PIN (4–6 dígitos)', key: 'pin', type: 'text', placeholder: '' },
                { label: 'E-mail', key: 'email', type: 'email', placeholder: 'opcional' },
                { label: 'Telefone', key: 'telefone', type: 'tel', placeholder: 'opcional' },
              ].map(({ label, key, type, placeholder }) => (
                <label key={key} className="block">
                  <span className="mb-1.5 block text-xs text-slate-500">{label}</span>
                  <input
                    type={type}
                    value={(atual as unknown as Record<string, string>)[key] ?? ''}
                    onChange={(e) => {
                      const val = key === 'pin' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value;
                      patch({ [key]: val } as Partial<Membro>);
                    }}
                    placeholder={placeholder}
                    inputMode={key === 'pin' ? 'numeric' : undefined}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm outline-none focus:border-violet-500"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Cargo */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <ShieldCheck className="h-4 w-4 text-violet-400" /> Cargo
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(PERFIS_PRONTOS).map(([id, perfil]) => (
                <button key={id} type="button" onClick={() => aplicarPerfil(id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${atual?.perfil === id ? 'border-violet-500 bg-violet-500/15 text-violet-200' : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'}`}>
                  <span>{perfil.emoji}</span> {perfil.label}
                </button>
              ))}
            </div>

            {/* Permissões colapsáveis */}
            <button type="button" onClick={() => setExpandPermissoes((p) => !p)}
              className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition">
              <span>Ajustar permissões individuais ({atual?.recursos.length ?? 0} marcadas)</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${expandPermissoes ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {expandPermissoes && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-4 space-y-3">
                    {FUNCOES.map((grupo) => (
                      <div key={grupo.id}>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">{grupo.grupo}</p>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {grupo.funcoes.map((funcao) => {
                            const ativado = atual?.recursos.includes(funcao.id) ?? false;
                            return (
                              <label key={funcao.id} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition ${ativado ? 'border-violet-500/40 bg-violet-500/5' : 'border-slate-800'}`}>
                                <input type="checkbox" checked={ativado} onChange={() => toggleRecurso(funcao.id)}
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-violet-500" />
                                <span>
                                  <span className="block text-xs text-slate-200">{funcao.nome}</span>
                                  <span className="block text-[10px] text-slate-600">{funcao.detalhe}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <Rodape onVoltar={onBack} onAvancar={() => onNext(membros)} avancarLabel="Confirmar equipe" />
    </div>
  );
}

// ─── Etapa 6: Lançamento ────────────────────────────────────────────────────────

function EtapaLancamento({ unidades, segmentoIds, itens, membros, salvando }: {
  unidades: number; segmentoIds: string[]; itens: ItemCardapio[]; membros: Membro[]; salvando: boolean;
}) {
  const segNomes = segmentoIds.map((id) => `${SEGMENTO_EMOJI[id] ?? '🍴'} ${SEGMENTOS.find((s) => s.id === id)?.nome ?? id}`).join('  ');
  return (
    <div className="flex flex-col items-center text-center py-8">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-violet-500/15 text-5xl"
      >
        🚀
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="text-3xl font-black tracking-tight text-slate-100">
        Seu MIAR está no ar!
      </motion.h1>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="mt-3 max-w-lg text-sm leading-relaxed text-slate-400">
        Tudo configurado. Você montou seu restaurante em minutos. Pode ajustar qualquer detalhe a qualquer hora no painel.
      </motion.p>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="mt-8 grid w-full max-w-sm gap-3 text-left">
        {[
          { emoji: '🏪', label: `${unidades} unidade${unidades !== 1 ? 's' : ''}` },
          { emoji: '🍴', label: segNomes },
          { emoji: '📋', label: `${itens.length} item${itens.length !== 1 ? 's' : ''} no cardápio` },
          { emoji: '👥', label: `${membros.length} membro${membros.length !== 1 ? 's' : ''} na equipe` },
        ].map(({ emoji, label }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <span className="text-xl">{emoji}</span>
            <span className="text-sm text-slate-200">{label}</span>
            <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-violet-400" />
          </div>
        ))}
      </motion.div>

      {salvando && (
        <div className="mt-8 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Salvando configurações…
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────────

export default function JornadaConfiguracao() {
  const [, setLocation] = useLocation();
  const [etapa, setEtapa] = useState<Etapa>('unidades');
  const [direction, setDirection] = useState(1);

  // Estado acumulado
  const [unidades, setUnidades] = useState<number>(1);
  const [segmentoIds, setSegmentoIds] = useState<string[]>([]);
  const [modo, setModo] = useState<ModoCardapio>('ia');
  const [itensCardapio, setItensCardapio] = useState<ItemCardapio[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [salvando, setSalvando] = useState(false);

  const ir = (prox: Etapa, dir = 1) => { setDirection(dir); setEtapa(prox); };

  const salvarTudo = async (membrosFinais: Membro[], itensFinais: ItemCardapio[]) => {
    setSalvando(true);
    ir('lancamento');
    try {
      // Salva cardápio
      if (itensFinais.length > 0) {
        await fetch('/api/onboarding/estabelecimento', {
          method: 'POST',
          headers: authH(),
          body: JSON.stringify({
            // restaurantId NAO vai daqui — o backend deriva do dono autenticado.
            segmentId: segmentoIds[0] ?? 'outros',
            features: [],
            items: itensFinais.map((it) => ({
              category: it.categoria,
              name: it.nome,
              price: it.preco ? Number(it.preco.replace(',', '.')) : null,
            })),
          }),
        });
      }
      // Salva equipe
      const validos = membrosFinais.filter((m) => m.nome.trim() && m.pin.trim());
      if (validos.length > 0) {
        await fetch('/api/employees/bulk', {
          method: 'POST',
          headers: authH(),
          body: JSON.stringify({
            // restaurantId NAO vai daqui — o backend deriva do dono autenticado.
            employees: validos.map((m) => ({
              name: m.nome, email: m.email || null,
              phone: m.telefone || null, pin: m.pin,
              role: m.perfil, permissions: m.recursos,
            })),
          }),
        });
      }
    } catch { /* erros não travam o lançamento */ }
    finally { setSalvando(false); }
    // Redireciona para cadastro de usuários antes da Central
    setTimeout(() => setLocation('/onboarding/usuarios'), 2000);
  };

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? -40 : 40 }),
  };

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-10 pb-28 text-slate-100">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20">
              <span className="text-base">🍽</span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-violet-400">Miar</p>
              <p className="text-sm font-semibold leading-none">Configuração</p>
            </div>
          </div>
          {etapa !== 'lancamento' && (
            <button type="button" onClick={() => setLocation('/central-comando')}
              className="rounded-full border border-slate-800 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition">
              Fazer depois →
            </button>
          )}
        </div>

        <ProgressoBar etapa={etapa} />

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={etapa}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: 'easeInOut' }}
          >
            {etapa === 'unidades' && (
              <EtapaUnidades onNext={(n) => { setUnidades(n); ir('segmentos'); }} />
            )}
            {etapa === 'segmentos' && (
              <EtapaSegmentos
                onNext={(ids) => { setSegmentoIds(ids); ir('modo'); }}
                onBack={() => ir('unidades', -1)}
              />
            )}
            {etapa === 'modo' && (
              <EtapaModo
                onNext={(m) => { setModo(m); ir('cardapio'); }}
                onBack={() => ir('segmentos', -1)}
              />
            )}
            {etapa === 'cardapio' && modo === 'ia' && (
              <CardapioIA
                segmentoIds={segmentoIds}
                onConfirm={(itens) => { setItensCardapio(itens); ir('equipe'); }}
                onBack={() => ir('modo', -1)}
              />
            )}
            {etapa === 'cardapio' && modo !== 'ia' && (
              <CardapioManual
                segmentoIds={segmentoIds}
                modo={modo}
                onConfirm={(itens) => { setItensCardapio(itens); ir('equipe'); }}
                onBack={() => ir('modo', -1)}
              />
            )}
            {etapa === 'equipe' && (
              <EtapaEquipe
                onNext={(m) => { setMembros(m); void salvarTudo(m, itensCardapio); }}
                onBack={() => ir('cardapio', -1)}
              />
            )}
            {etapa === 'lancamento' && (
              <EtapaLancamento
                unidades={unidades}
                segmentoIds={segmentoIds}
                itens={itensCardapio}
                membros={membros}
                salvando={salvando}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
