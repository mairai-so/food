// artifacts/gestor/src/pages/onboarding-usuarios.tsx
import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Plus, Trash2, UserPlus, ShieldCheck, Save } from 'lucide-react';
import { FUNCOES, TODAS_FUNCOES, PERFIL_FUNCOES } from '@/lib/funcoes';

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? '';
}

// Lista mestra de funções (fonte única). Adapta os nomes para esta tela.

type Recurso = { id: string; nome: string; detalhe: string };
type GrupoRecurso = { id: string; grupo: string; recursos: Recurso[] };

export const RECURSOS: GrupoRecurso[] = FUNCOES.map((g) => ({
  id: g.id,
  grupo: g.grupo,
  recursos: g.funcoes.map((f) => ({ id: f.id, nome: f.nome, detalhe: f.detalhe })),
}));

const TODOS_IDS = TODAS_FUNCOES;

// ─────────────────────────────────────────────────────────────────────────────
// Perfis prontos, espelhando os artifacts do monorepo
// ─────────────────────────────────────────────────────────────────────────────
const PERFIS: Record<string, { nome: string; recursos: string[] }> = {
  garcom: {
    nome: 'Garçom',
    recursos: PERFIL_FUNCOES.garcom,
  },
  cozinha: {
    nome: 'Cozinha',
    recursos: PERFIL_FUNCOES.cozinha,
  },
  caixa: {
    nome: 'Caixa',
    recursos: PERFIL_FUNCOES.caixa,
  },
  entregador: {
    nome: 'Entregador',
    recursos: PERFIL_FUNCOES.entregador,
  },
  gerente: {
    nome: 'Gerente',
    recursos: PERFIL_FUNCOES.gerente,
  },
  total: {
    nome: 'Sócio',
    recursos: PERFIL_FUNCOES.total,
  },
};

type Usuario = {
  uid: string;
  nome: string;
  email: string;
  telefone: string;
  pin: string;
  perfil: string;
  recursos: string[];
};

function novoUsuario(): Usuario {
  return {
    uid: Math.random().toString(36).slice(2, 10),
    nome: '',
    email: '',
    telefone: '',
    pin: '',
    perfil: 'garcom',
    recursos: [...PERFIS.garcom.recursos],
  };
}

export default function OnboardingUsuarios() {
  const [, setLocation] = useLocation();
  const [usuarios, setUsuarios] = useState<Usuario[]>([novoUsuario()]);
  const [ativo, setAtivo] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const atual = usuarios[ativo];

  const totalMarcado = useMemo(() => atual?.recursos.length ?? 0, [atual]);

  const patch = (campos: Partial<Usuario>) => {
    setUsuarios((lista) =>
      lista.map((u, i) => (i === ativo ? { ...u, ...campos } : u)),
    );
  };

  const aplicarPerfil = (perfilId: string) => {
    patch({ perfil: perfilId, recursos: [...(PERFIS[perfilId]?.recursos ?? [])] });
  };

  const alternarRecurso = (recursoId: string) => {
    if (!atual) return;
    const marcado = atual.recursos.includes(recursoId);
    const proximos = marcado
      ? atual.recursos.filter((r) => r !== recursoId)
      : [...atual.recursos, recursoId];
    patch({ recursos: proximos, perfil: 'personalizado' });
  };

  const alternarGrupo = (grupo: GrupoRecurso) => {
    if (!atual) return;
    const ids = grupo.recursos.map((r) => r.id);
    const todosMarcados = ids.every((id) => atual.recursos.includes(id));
    const proximos = todosMarcados
      ? atual.recursos.filter((r) => !ids.includes(r))
      : Array.from(new Set([...atual.recursos, ...ids]));
    patch({ recursos: proximos, perfil: 'personalizado' });
  };

  const adicionar = () => {
    setUsuarios((lista) => [...lista, novoUsuario()]);
    setAtivo(usuarios.length);
    setOkMsg(null);
  };

  const remover = (indice: number) => {
    if (usuarios.length === 1) return;
    setUsuarios((lista) => lista.filter((_, i) => i !== indice));
    setAtivo((a) => (a >= indice && a > 0 ? a - 1 : a));
  };

  const salvar = async () => {
    setErro(null);
    setOkMsg(null);

    const invalido = usuarios.find((u) => !u.nome.trim() || !u.pin.trim());
    if (invalido) {
      setErro('Cada usuário precisa de nome e PIN.');
      return;
    }

    setSalvando(true);
    try {
      const response = await fetch('/api/employees/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          // restaurantId NAO vai daqui — o backend deriva do dono autenticado
          // (req.owner.companyId), nunca confia em valor mandado pelo cliente.
          employees: usuarios.map((u) => ({
            name: u.nome,
            email: u.email || null,
            phone: u.telefone || null,
            pin: u.pin,
            role: u.perfil,
            permissions: u.recursos,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErro(data.error ?? 'Não foi possível salvar a equipe.');
        return;
      }
      setOkMsg(`${usuarios.length} usuário(s) salvos.`);
      setTimeout(() => setLocation('/onboarding/estabelecimento'), 900);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Falha de conexão.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-6xl">
        <button
          type="button"
          onClick={() => setLocation('/bem-vindo')}
          className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
          data-testid="button-voltar-usuarios"
        >
          <ArrowLeft size={15} />
          Voltar
        </button>

        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-violet-400">
            Passo 1
          </p>
          <h1 className="mt-2 text-3xl font-bold">Cadastrar usuários</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Escolha um perfil pronto e ajuste o que quiser. O que não estiver marcado não abre para
            a pessoa, nem por link direto.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          {/* Coluna da equipe */}
          <aside className="space-y-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Equipe ({usuarios.length})
              </p>
              <div className="space-y-1.5">
                {usuarios.map((u, i) => (
                  <div
                    key={u.uid}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${
                      i === ativo
                        ? 'border-violet-500/60 bg-violet-500/10'
                        : 'border-transparent bg-slate-800/40 hover:bg-slate-800/70'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setAtivo(i)}
                      className="flex-1 text-left"
                      data-testid={`button-usuario-${i}`}
                    >
                      <p className="truncate text-sm font-medium text-slate-100">
                        {u.nome || 'Novo usuário'}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {PERFIS[u.perfil]?.nome ?? 'Personalizado'} · {u.recursos.length} recursos
                      </p>
                    </button>
                    {usuarios.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remover(i)}
                        aria-label="Remover usuário"
                        className="text-slate-600 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={adicionar}
                data-testid="button-adicionar-usuario"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 py-2.5 text-sm text-slate-400 hover:border-slate-600 hover:text-slate-200"
              >
                <Plus size={14} />
                Adicionar usuário
              </button>
            </div>
          </aside>

          {/* Coluna do formulário */}
          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
                <UserPlus size={16} className="text-violet-400" />
                Dados da pessoa
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs text-slate-500">Nome completo</span>
                  <input
                    value={atual?.nome ?? ''}
                    onChange={(e) => patch({ nome: e.target.value })}
                    data-testid="input-usuario-nome"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm outline-none focus:border-violet-500"
                    placeholder=""
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-slate-500">PIN de acesso</span>
                  <input
                    value={atual?.pin ?? ''}
                    onChange={(e) =>
                      patch({ pin: e.target.value.replace(/\D/g, '').slice(0, 6) })
                    }
                    inputMode="numeric"
                    data-testid="input-usuario-pin"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm tabular-nums outline-none focus:border-violet-500"
                    placeholder=""
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-slate-500">E-mail</span>
                  <input
                    value={atual?.email ?? ''}
                    onChange={(e) => patch({ email: e.target.value })}
                    data-testid="input-usuario-email"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm outline-none focus:border-violet-500"
                    placeholder=""
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-slate-500">Telefone</span>
                  <input
                    value={atual?.telefone ?? ''}
                    onChange={(e) => patch({ telefone: e.target.value })}
                    data-testid="input-usuario-telefone"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm outline-none focus:border-violet-500"
                    placeholder=""
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <ShieldCheck size={16} className="text-violet-400" />
                  Permissões
                </div>
                <span className="text-xs text-slate-500">
                  {totalMarcado} de {TODOS_IDS.length} recursos
                </span>
              </div>

              <div className="mb-5 flex flex-wrap gap-2">
                {Object.entries(PERFIS).map(([id, perfil]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => aplicarPerfil(id)}
                    data-testid={`button-perfil-${id}`}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      atual?.perfil === id
                        ? 'border-violet-500 bg-violet-500/15 text-violet-200'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                    }`}
                  >
                    {perfil.nome}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {RECURSOS.map((grupo) => {
                  const ids = grupo.recursos.map((r) => r.id);
                  const marcadosNoGrupo = ids.filter((id) =>
                    atual?.recursos.includes(id),
                  ).length;
                  return (
                    <div
                      key={grupo.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          {grupo.grupo}
                        </p>
                        <button
                          type="button"
                          onClick={() => alternarGrupo(grupo)}
                          className="text-xs text-violet-400 hover:text-violet-300"
                        >
                          {marcadosNoGrupo === ids.length ? 'Desmarcar tudo' : 'Marcar tudo'}
                        </button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {grupo.recursos.map((recurso) => {
                          const marcado = atual?.recursos.includes(recurso.id) ?? false;
                          return (
                            <label
                              key={recurso.id}
                              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                                marcado
                                  ? 'border-violet-500/50 bg-violet-500/[0.08]'
                                  : 'border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={marcado}
                                onChange={() => alternarRecurso(recurso.id)}
                                data-testid={`checkbox-recurso-${recurso.id}`}
                                className="mt-0.5 h-4 w-4 shrink-0 accent-violet-500"
                              />
                              <span>
                                <span className="block text-sm text-slate-200">{recurso.nome}</span>
                                <span className="block text-xs leading-snug text-slate-500">
                                  {recurso.detalhe}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {erro && (
              <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {erro}
              </p>
            )}
            {okMsg && (
              <p className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
                {okMsg}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                data-testid="button-salvar-usuarios"
                className="flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-violet-400 disabled:opacity-60"
              >
                <Save size={15} />
                {salvando ? 'Salvando' : 'Salvar e continuar'}
              </button>
              <button
                type="button"
                onClick={() => setLocation('/onboarding/estabelecimento')}
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm text-slate-300 hover:border-slate-600"
              >
                Pular para o estabelecimento
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
