// artifacts/gestor/src/pages/socios.tsx
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, UserPlus, ShieldCheck, Trash2, Crown, KeyRound } from 'lucide-react';

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? '';
}

async function api(path: string, body?: any, method = 'GET') {
  const r = await fetch(`/api/${path}`, {
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

type Gestor = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  voceMesmo: boolean;
};

export default function Socios() {
  const [, setLocation] = useLocation();
  const [gestores, setGestores] = useState<Gestor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    const { ok, data } = await api('gestores');
    if (ok && Array.isArray(data)) setGestores(data);
    setCarregando(false);
  };

  useEffect(() => { void carregar(); }, []);

  const cadastrar = async () => {
    setErro(null);
    setOkMsg(null);
    if (!nome.trim() || !email.trim() || senha.length < 6) {
      setErro('Preencha nome, e-mail e uma senha de ao menos 6 caracteres.');
      return;
    }
    setSalvando(true);
    const { ok, data } = await api('gestores', { name: nome, email, password: senha }, 'POST');
    setSalvando(false);
    if (!ok) {
      setErro(data?.error ?? 'Não foi possível cadastrar.');
      return;
    }
    setOkMsg(`${nome.trim()} agora tem acesso de gestor.`);
    setNome('');
    setEmail('');
    setSenha('');
    await carregar();
  };

  const revogar = async (g: Gestor) => {
    const { ok, data } = await api(`gestores/${g.id}`, undefined, 'DELETE');
    if (!ok) {
      setErro(data?.error ?? 'Não foi possível revogar.');
      return;
    }
    await carregar();
  };

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

        <header className="mb-7">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
            <Crown size={20} />
          </div>
          <h1 className="text-3xl font-bold">Sócios e gestores</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Sócio é gestor. Quem você cadastra aqui entra no app do gestor com senha própria e tem
            a mesma autonomia que você: comanda, executa e libera funções. Toda ação fica na caixa
            preta no nome de quem fez.
          </p>
        </header>

        {/* Cadastro */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <UserPlus size={16} className="text-violet-400" />
            Cadastrar novo gestor
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs text-slate-500">Nome</span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                data-testid="input-socio-nome"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm outline-none focus:border-violet-500"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-slate-500">E-mail de acesso</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-socio-email"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm outline-none focus:border-violet-500"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-slate-500">Senha inicial</span>
              <input
                type="text"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                data-testid="input-socio-senha"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm outline-none focus:border-violet-500"
              />
            </label>
          </div>

          {erro && (
            <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {erro}
            </p>
          )}
          {okMsg && (
            <p className="mt-3 rounded-xl border border-violet-500/40 bg-violet-500/10 px-3.5 py-2.5 text-sm text-violet-200">
              {okMsg}
            </p>
          )}

          <button
            type="button"
            onClick={cadastrar}
            disabled={salvando}
            data-testid="button-cadastrar-socio"
            className="mt-4 flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-violet-400 disabled:opacity-60"
          >
            <KeyRound size={15} />
            {salvando ? 'Cadastrando' : 'Dar acesso de gestor'}
          </button>
        </div>

        {/* Lista */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Gestores com acesso</h2>
          {carregando ? (
            <p className="text-sm text-slate-500">Carregando.</p>
          ) : (
            <div className="space-y-2">
              {gestores.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                      <ShieldCheck size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">
                        {g.name}
                        {g.voceMesmo && (
                          <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                            você
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-500">{g.email}</p>
                    </div>
                  </div>
                  {!g.voceMesmo && (
                    <button
                      type="button"
                      onClick={() => revogar(g)}
                      data-testid={`button-revogar-gestor-${g.id}`}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-2 text-xs text-red-300 hover:border-red-500/40"
                    >
                      <Trash2 size={13} />
                      Revogar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
