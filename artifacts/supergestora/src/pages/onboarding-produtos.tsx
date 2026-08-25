// artifacts/gestor/src/pages/onboarding-produtos.tsx
// Tela de onboarding: escolha de como cadastrar produtos/cardápio.
import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Database, PenLine, Sparkles, Clock } from 'lucide-react';

export default function OnboardingProdutos() {
  const [, setLocation] = useLocation();
  const [aplicandoPreset, setAplicandoPreset] = useState(false);
  const [erroPreset, setErroPreset] = useState<string | null>(null);

  const aplicarModeloEstoque = async () => {
    setAplicandoPreset(true);
    setErroPreset(null);
    try {
      const segmentId = window.localStorage.getItem('miar-onboarding-segment-id');
      if (!segmentId) {
        setLocation('/estoque');
        return;
      }
      const response = await fetch('/api/onboarding/apply-preset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${window.localStorage.getItem('miar-owner-token') ?? ''}`,
        },
        body: JSON.stringify({ segmentId, replace: false }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? 'Não foi possível aplicar o modelo de estoque.');
      }
      window.localStorage.removeItem('miar-onboarding-segment-id');
      setLocation('/estoque');
    } catch (error: unknown) {
      setErroPreset(error instanceof Error ? error.message : 'Não foi possível aplicar o modelo de estoque.');
    } finally {
      setAplicandoPreset(false);
    }
  };

  const opcoes = [
    {
      id: 'estoque',
      icon: Database,
      titulo: 'Usar modelo de estoque do sistema',
      descricao:
        'Importamos os itens típicos do seu segmento como ponto de partida. Você ajusta nomes, preços e categorias depois.',
      cor: 'violet',
      acao: () => void aplicarModeloEstoque(),
    },
    {
      id: 'manual',
      icon: PenLine,
      titulo: 'Fazer manualmente',
      descricao:
        'Cadastre cada produto na hora, digitando nome, preço e categoria. Bom para quem já tem a lista pronta.',
      cor: 'blue',
      acao: () => setLocation('/estoque'),
    },
    {
      id: 'ia',
      icon: Sparkles,
      titulo: 'Fazer através da IA ao vivo',
      descricao:
        'A MIAR conversa com você por voz ou texto e monta o cardápio enquanto você fala. Leva menos de 5 minutos.',
      cor: 'emerald',
    },
    {
      id: 'depois',
      icon: Clock,
      titulo: 'Fazer depois',
      descricao:
        'Pule o cadastro de produtos por enquanto. Você já pode acessar o painel e voltar aqui quando quiser.',
      cor: 'slate',
      // CORRIGIDO 30/07/2026: antes ia pra /onboarding/usuarios, que fazia
      // sentido quando usuários era o último passo. Agora usuários é o
      // passo 2 do fluxo linear (segmento -> usuários -> estabelecimento ->
      // produtos), então "fazer depois" aqui, no último passo, vai pro painel.
      acao: () => setLocation('/painel'),
    },
  ];

  const corClasses: Record<string, { borda: string; bg: string; icone: string; badge: string; }> = {
    violet: {
      borda: 'border-violet-500/40 hover:border-violet-400/70',
      bg: 'hover:bg-violet-500/[0.06]',
      icone: 'bg-violet-500/15 text-violet-400',
      badge: 'bg-violet-500/20 text-violet-300',
    },
    blue: {
      borda: 'border-blue-500/40 hover:border-blue-400/70',
      bg: 'hover:bg-blue-500/[0.06]',
      icone: 'bg-blue-500/15 text-blue-400',
      badge: 'bg-blue-500/20 text-blue-300',
    },
    emerald: {
      borda: 'border-emerald-500/40 hover:border-emerald-400/70',
      bg: 'hover:bg-emerald-500/[0.06]',
      icone: 'bg-emerald-500/15 text-emerald-400',
      badge: 'bg-emerald-500/20 text-emerald-300',
    },
    slate: {
      borda: 'border-slate-700 hover:border-slate-600',
      bg: 'hover:bg-slate-800/40',
      icone: 'bg-slate-700 text-slate-400',
      badge: 'bg-slate-700 text-slate-400',
    },
  };

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-2xl">
        <button
          type="button"
          onClick={() => setLocation('/onboarding/estabelecimento')}
          className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={15} />
          Voltar
        </button>

        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-violet-400">
            Passo 3
          </p>
          <h1 className="mt-2 text-3xl font-bold">Como quer cadastrar os produtos?</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Seu cardápio e estoque precisam de produtos para funcionar. Escolha o caminho que
            funciona melhor pra você agora.
          </p>
        </header>

        <div className="space-y-3">
          {opcoes.map((op) => {
            const c = corClasses[op.cor];
            const Icon = op.icon;
            return (
              <button
                key={op.id}
                type="button"
                onClick={op.acao}
                disabled={aplicandoPreset}
                aria-busy={op.id === 'estoque' && aplicandoPreset}
                className={`w-full rounded-2xl border ${c.borda} bg-slate-900/60 ${c.bg} p-5 text-left transition-all duration-150 disabled:cursor-wait disabled:opacity-60`}
              >
                <div className="flex items-start gap-4">
                  <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${c.icone}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-semibold text-slate-100">
                      {op.id === 'estoque' && aplicandoPreset ? 'Aplicando modelo de estoque…' : op.titulo}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">{op.descricao}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {erroPreset && (
          <p role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {erroPreset}
          </p>
        )}
      </div>
    </div>
  );
}
