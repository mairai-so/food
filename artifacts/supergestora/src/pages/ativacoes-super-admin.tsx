import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, Eye, EyeOff, LogIn, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';

const apiBaseUrl = 'https://miar-api-deyq.onrender.com';
const biometricCredentialKey = 'miar-supergestora-biometric';
const supergestoraTokenKey = 'miar-supergestora-token';

function canUseBiometric(): boolean {
  return window.isSecureContext && typeof window.PublicKeyCredential !== 'undefined' && typeof navigator.credentials?.create === 'function';
}

interface PendingRegistration {
  id: string;
  owner_name: string;
  phone: string;
  code: string;
  company_name: string;
  email: string;
  expires_at: string;
  created_at: string;
}

export default function AtivacoesSuperAdmin() {
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [token, setToken] = useState(() => window.localStorage.getItem(supergestoraTokenKey) ?? window.sessionStorage.getItem(supergestoraTokenKey));
  const [loading, setLoading] = useState(() => Boolean(window.localStorage.getItem(supergestoraTokenKey) ?? window.sessionStorage.getItem(supergestoraTokenKey)));
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [useBiometric, setUseBiometric] = useState(false);

  const loadRegistrations = async (authToken = token) => {
    if (!authToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/pending-owner-registrations`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.status === 401) {
        window.localStorage.removeItem(supergestoraTokenKey);
        window.sessionStorage.removeItem(supergestoraTokenKey);
        setToken(null);
        setLoading(false);
        return;
      }
      if (!response.ok) throw new Error(response.status === 403 ? 'Acesso restrito ao super-admin.' : `Não foi possível carregar as ativações (HTTP ${response.status}).`);
      setRegistrations(await response.json() as PendingRegistration[]);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as ativações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRegistrations();
  }, [token]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginLoading(true);
    setError('');
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json() as { token?: string; error?: string };
      if (!response.ok || !data.token) throw new Error(data.error ?? 'E-mail ou senha inválidos.');
      const storage = rememberDevice || useBiometric ? window.localStorage : window.sessionStorage;
      const otherStorage = storage === window.localStorage ? window.sessionStorage : window.localStorage;
      otherStorage.removeItem(supergestoraTokenKey);
      storage.setItem(supergestoraTokenKey, data.token);
      setToken(data.token);
      setPassword('');
      if (useBiometric && canUseBiometric()) {
        try {
          const credential = await navigator.credentials.create({
            publicKey: {
              challenge: crypto.getRandomValues(new Uint8Array(32)),
              rp: { name: 'MIAR Supergestora' },
              user: { id: crypto.getRandomValues(new Uint8Array(16)), name: email.trim(), displayName: email.trim() },
              pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
              authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
              timeout: 60000,
              attestation: 'none',
            },
          });
          if (credential) window.localStorage.setItem(biometricCredentialKey, credential.id);
        } catch {
          setError('Login realizado, mas a biometria não foi ativada neste dispositivo.');
        }
      }
      await loadRegistrations(data.token);
    } catch (loginError: unknown) {
      setError(loginError instanceof Error ? loginError.message : 'Não foi possível entrar.');
    } finally {
      setLoginLoading(false);
    }
  };

  const copyCode = async (registration: PendingRegistration) => {
    await navigator.clipboard.writeText(registration.code);
    setCopiedId(registration.id);
    window.setTimeout(() => setCopiedId(''), 1600);
  };

  return (
    <main translate="no" className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/painel" className="mb-3 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
              <ArrowLeft size={16} /> Voltar ao painel
            </Link>
            <h1 className="text-2xl font-semibold">Pedidos de ativação pendentes</h1>
            <p className="mt-1 text-sm text-slate-400">Confira o cadastro e envie o código manualmente pelo seu WhatsApp.</p>
          </div>
          {token && <button type="button" onClick={() => void loadRegistrations()} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
            <RefreshCw size={15} /> Atualizar
          </button>}
        </div>

        {!token ? (
          <form onSubmit={handleLogin} className="mx-auto max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-300"><LogIn size={20} /></div>
              <div>
                <h2 className="text-lg font-semibold">Entrar na Supergestora</h2>
                <p className="text-sm text-slate-400">Use o e-mail autorizado da plataforma.</p>
              </div>
            </div>
            <label className="mb-3 block text-sm text-slate-300">
              E-mail
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400" />
            </label>
            <label className="mb-4 block text-sm text-slate-300">
              Senha
              <div className="relative mt-1"><input type={showPassword ? 'text' : 'password'} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-slate-100 outline-none focus:border-emerald-400" /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
            </label>
            <label className="mb-3 flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={rememberDevice} onChange={(event) => setRememberDevice(event.target.checked)} className="h-4 w-4 accent-emerald-500" />
              Continuar logado neste dispositivo
            </label>
            {canUseBiometric() && <label className="mb-4 flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={useBiometric} onChange={(event) => setUseBiometric(event.target.checked)} className="h-4 w-4 accent-emerald-500" />
              Ativar desbloqueio por biometria
            </label>}
            {error && <p className="mb-4 rounded-lg border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">{error}</p>}
            <button type="submit" disabled={loginLoading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60">
              <LogIn size={16} /> {loginLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : error && !loading ? <p className="mb-4 rounded-lg border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">{error}</p> : loading ? <p className="text-sm text-slate-400">Carregando ativações...</p> : registrations.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">Nenhum pedido pendente.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">WhatsApp</th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Criado em</th>
                  <th className="px-4 py-3">Expira em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {registrations.map((registration) => (
                  <tr key={registration.id} className="align-middle">
                    <td className="px-4 py-3"><div className="font-medium">{registration.owner_name}</div><div className="text-xs text-slate-500">{registration.email}</div></td>
                    <td className="px-4 py-3">{registration.company_name}</td>
                    <td className="px-4 py-3">{registration.phone}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="font-mono text-lg tracking-[0.2em] text-emerald-300">{registration.code}</span><button type="button" onClick={() => void copyCode(registration)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" title="Copiar código" aria-label="Copiar código">{copiedId === registration.id ? <Check size={16} /> : <Copy size={16} />}</button></div></td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">{new Date(registration.created_at).toLocaleString('pt-BR')}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">{new Date(registration.expires_at).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
