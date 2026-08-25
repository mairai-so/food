// artifacts/gestor/src/pages/registro-protegido.tsx
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft, ShieldCheck, Lock, Eye, EyeOff, AlertTriangle, Check, X,
  KeyRound, FileText, BellRing, BellOff, ScrollText,
} from 'lucide-react';

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? '';
}

async function api(path: string, body?: any, method = 'POST') {
  const r = await fetch(`/api/registro/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

type Tipo = { id: string; nome: string; descricao: string; alertaPadrao: boolean };
type Evento = {
  seq: number; actorName: string; actorRole: string; tipo: string;
  descricao: string; timestamp: string;
};

export default function RegistroProtegido() {
  const [, setLocation] = useLocation();
  const [carregando, setCarregando] = useState(true);
  const [configurado, setConfigurado] = useState(false);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [alertas, setAlertas] = useState<Record<string, boolean>>({});

  // fase: intro (primeiro uso) | criar | painel
  const [fase, setFase] = useState<'intro' | 'criar' | 'painel'>('intro');

  const carregarStatus = async () => {
    setCarregando(true);
    const { ok, data } = await api('status', undefined, 'GET');
    if (ok) {
      setConfigurado(!!data.configurado);
      setTipos(data.tipos ?? []);
      setAlertas(data.alertas ?? {});
      setFase(data.configurado ? 'painel' : 'intro');
    }
    setCarregando(false);
  };

  useEffect(() => { void carregarStatus(); }, []);

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100">
        <p className="text-sm text-slate-500">Carregando.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-3xl">
        <button
          type="button"
          onClick={() => setLocation('/painel')}
          className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft size={15} />
          Voltar ao painel
        </button>

        {fase === 'intro' && !configurado && (
          <Intro
            onAtivar={() => setFase('criar')}
            onDepois={async () => { await api('pular'); setLocation('/painel'); }}
          />
        )}

        {fase === 'criar' && (
          <CriarSenha
            onPronto={() => carregarStatus()}
            onCancelar={() => setFase('intro')}
          />
        )}

        {fase === 'painel' && (
          <Painel tipos={tipos} alertas={alertas} setAlertas={setAlertas} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Primeiro uso — explica em linguagem clara
// ─────────────────────────────────────────────────────────────────────────────
function Intro({ onAtivar, onDepois }: { onAtivar: () => void; onDepois: () => void }) {
  return (
    <div>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
        <ShieldCheck size={22} />
      </div>
      <h1 className="text-3xl font-bold">Registro protegido</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        Este é o seu livro de tudo o que acontece no sistema: quem abriu mesa, quem fechou caixa,
        quem entrou fora do horário, quem mexeu no estoque. Serve para quando alguém reclamar
        e você precisar mostrar exatamente o que aconteceu e com qual pessoa.
      </p>

      <div className="mt-6 space-y-3">
        <Item icon={ScrollText} titulo="Grava sempre, sozinho"
          texto="Todo evento importante fica gravado automaticamente. Isso não desliga. É o que te protege." />
        <Item icon={Lock} titulo="Só você abre"
          texto="O registro fica atrás de uma segunda senha que só você cria. Nem funcionário, nem suporte, nem ninguém lê sem ela." />
        <Item icon={ShieldCheck} titulo="À prova de adulteração"
          texto="Cada linha é selada e ligada na anterior. Se alguém tentar apagar ou mudar algo por fora, o sistema acusa que foi mexido." />
        <Item icon={BellRing} titulo="Alertas do seu jeito"
          texto="Você escolhe, um por um, o que te avisa na hora. Excluir mesa, subir foto no estoque no lugar da IA, login fora do horário, abrir mesa. Liga e desliga cada um." />
        <Item icon={KeyRound} titulo="Nunca fica trancado pra você"
          texto="Se esquecer a segunda senha, você redefine com a sua senha principal de gestor. O registro é seu, sempre." />
      </div>

      <div className="mt-7 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200/90">
        Se você desligar um alerta e algo acontecer sem aviso, a responsabilidade é sua. O registro
        continua gravando de qualquer forma, mas o aviso na hora só existe se você deixar ligado.
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onAtivar}
          data-testid="button-ativar-registro"
          className="rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-violet-400"
        >
          Entendi, ativar agora
        </button>
        <button
          type="button"
          onClick={onDepois}
          data-testid="button-registro-depois"
          className="rounded-xl border border-slate-700 px-5 py-3 text-sm text-slate-300 hover:border-slate-600"
        >
          Fazer isso depois
        </button>
      </div>
    </div>
  );
}

function Item({ icon: Icon, titulo, texto }: { icon: typeof Lock; titulo: string; texto: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-violet-300">
        <Icon size={16} />
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-100">{titulo}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{texto}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Criar a segunda senha
// ─────────────────────────────────────────────────────────────────────────────
function CriarSenha({ onPronto, onCancelar }: { onPronto: () => void; onCancelar: () => void }) {
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);

  const salvar = async () => {
    setErro(null);
    if (senha.length < 6) { setErro('Use ao menos 6 caracteres.'); return; }
    if (senha !== conf) { setErro('As senhas não coincidem.'); return; }
    setSalvando(true);
    const { ok, data } = await api('definir-senha', { senha });
    setSalvando(false);
    if (!ok) { setErro(data?.error ?? 'Não foi possível criar a senha.'); return; }
    onPronto();
  };

  return (
    <div>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
        <KeyRound size={22} />
      </div>
      <h1 className="text-3xl font-bold">Crie a segunda senha</h1>
      <p className="mt-2 max-w-xl text-sm text-slate-400">
        Ela é diferente da sua senha de gestor e serve só para abrir o registro. Guarde bem. Se
        esquecer, dá para redefinir com a sua senha principal.
      </p>

      <div className="mt-6 max-w-sm space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-xs text-slate-500">Segunda senha</span>
          <div className="relative"><input
            type={mostrarSenha ? 'text' : 'password'}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            data-testid="input-segunda-senha"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm outline-none focus:border-violet-500"
          />
          <button type="button" onClick={() => setMostrarSenha((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Mostrar ou ocultar senha">{mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-slate-500">Confirme a segunda senha</span>
          <div className="relative"><input
            type={mostrarConfirmacao ? 'text' : 'password'}
            value={conf}
            onChange={(e) => setConf(e.target.value)}
            data-testid="input-confirma-senha"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm outline-none focus:border-violet-500"
          />
          <button type="button" onClick={() => setMostrarConfirmacao((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Mostrar ou ocultar confirmação">{mostrarConfirmacao ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
        </label>

        {erro && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
            {erro}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            data-testid="button-salvar-segunda-senha"
            className="rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-violet-400 disabled:opacity-60"
          >
            {salvando ? 'Salvando' : 'Criar e ativar'}
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm text-slate-300 hover:border-slate-600"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Painel: pede a segunda senha, mostra eventos + integridade + alertas
// ─────────────────────────────────────────────────────────────────────────────
function Painel({
  tipos, alertas, setAlertas,
}: {
  tipos: Tipo[];
  alertas: Record<string, boolean>;
  setAlertas: (a: Record<string, boolean>) => void;
}) {
  const [senha, setSenha] = useState('');
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [integridade, setIntegridade] = useState<{ integro: boolean; quebrouEm: number | null; total: number } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const abrir = async () => {
    setErro(null);
    setCarregando(true);
    const { ok, data } = await api('abrir', { senha, limit: 200 });
    setCarregando(false);
    if (!ok) { setErro(data?.error ?? 'Segunda senha incorreta.'); return; }
    setEventos(data.eventos ?? []);
    setIntegridade(data.integridade ?? null);
    setAberto(true);
  };

  const alternarAlerta = async (tipo: string) => {
    const proximo = !alertas[tipo];
    const { ok, data } = await api('alertas', { senha, tipo, ativo: proximo }, 'PATCH');
    if (ok) setAlertas({ ...alertas, [tipo]: data.ativo });
    else setErro(data?.error ?? 'Não foi possível alterar o alerta.');
  };

  if (!aberto) {
    return (
      <div>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
          <Lock size={22} />
        </div>
        <h1 className="text-3xl font-bold">Registro protegido</h1>
        <p className="mt-2 text-sm text-slate-400">Digite a segunda senha para abrir.</p>

        <div className="mt-6 max-w-sm space-y-3">
          <div className="relative"><input
            type={mostrarSenha ? 'text' : 'password'}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') abrir(); }}
            placeholder="Segunda senha"
            data-testid="input-abrir-registro"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm outline-none focus:border-violet-500"
          />
          <button type="button" onClick={() => setMostrarSenha((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Mostrar ou ocultar senha">{mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
          {erro && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {erro}
            </p>
          )}
          <button
            type="button"
            onClick={abrir}
            disabled={carregando}
            data-testid="button-abrir-registro"
            className="flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-violet-400 disabled:opacity-60"
          >
            <Eye size={15} />
            {carregando ? 'Abrindo' : 'Abrir registro'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Registro protegido</h1>

      {/* Integridade */}
      {integridade && (
        <div
          className={`mt-5 flex items-center gap-3 rounded-xl border p-4 text-sm ${
            integridade.integro
              ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
              : 'border-red-500/50 bg-red-500/10 text-red-300'
          }`}
        >
          {integridade.integro ? <Check size={17} /> : <AlertTriangle size={17} />}
          {integridade.integro ? (
            <span>Corrente íntegra. {integridade.total} eventos, nenhum sinal de adulteração.</span>
          ) : (
            <span>Atenção: a corrente foi quebrada no evento {integridade.quebrouEm}. Algo foi alterado por fora do sistema.</span>
          )}
        </div>
      )}

      {/* Alertas individuais */}
      <section className="mt-7">
        <h2 className="text-lg font-semibold">Alertas na hora</h2>
        <p className="mt-1 text-sm text-slate-400">
          Ligue o aviso imediato só para o que te importa. Gravação continua para todos.
        </p>
        <div className="mt-4 space-y-2">
          {tipos.map((tipo) => {
            const ativo = !!alertas[tipo.id];
            return (
              <div
                key={tipo.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100">{tipo.nome}</p>
                  <p className="text-xs text-slate-500">{tipo.descricao}</p>
                </div>
                <button
                  type="button"
                  onClick={() => alternarAlerta(tipo.id)}
                  data-testid={`toggle-alerta-${tipo.id}`}
                  aria-pressed={ativo}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    ativo
                      ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {ativo ? <BellRing size={14} /> : <BellOff size={14} />}
                  {ativo ? 'Avisar' : 'Silencioso'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Eventos */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Últimos eventos</h2>
        {eventos.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
            Nada registrado ainda.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {eventos.map((ev) => (
              <div
                key={ev.seq}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-100">{ev.descricao}</p>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs tabular-nums text-slate-400">
                    #{ev.seq}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {ev.actorName} · {ev.actorRole} ·{' '}
                  {new Date(ev.timestamp).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
