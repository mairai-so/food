import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { setAuthTokenGetter, setAuthTokenSetter, startTokenRefreshLoop } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import Board from '@/pages/board';
import Settings from '@/pages/settings';
import { IdiomaProvider } from './i18n/IdiomaContext';
import { Eye, EyeOff } from 'lucide-react';

const queryClient = new QueryClient();
const KITCHEN_TOKEN_KEY = 'miar-cozinha-token';
const KITCHEN_NAME_KEY = 'miar-cozinha-name';

setAuthTokenGetter(() => {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(KITCHEN_TOKEN_KEY) ?? window.sessionStorage.getItem(KITCHEN_TOKEN_KEY) ?? '';
});

function PinLogin({ onLogin }: { onLogin: (token: string, name: string, remember: boolean) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showPin, setShowPin] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = pin.trim();
    if (!value) {
      setError('Informe o PIN da Cozinha.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/employee-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? 'PIN inválido.');
        return;
      }
      if (data.role && !['cook', 'kitchen'].includes(data.role)) {
        setError('Este PIN não pertence à equipe da Cozinha.');
        return;
      }
      const sessionToken = data.sessionToken ?? '';
      if (!sessionToken) {
        setError('A sessão da Cozinha não foi criada.');
        return;
      }
      onLogin(sessionToken, data.employee?.name ?? 'Cozinha', remember);
    } catch {
      setError('Falha de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black tracking-tight">Cozinha MIAR</h1>
          <p className="mt-2 text-sm text-muted-foreground">Entre com o PIN da equipe de cozinha.</p>
        </div>
        <form onSubmit={submit}>
          <label className="mb-2 block text-sm font-semibold" htmlFor="kitchen-pin">PIN</label>
          <div className="relative">
          <input
            id="kitchen-pin"
            type={showPin ? 'text' : 'password'}
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full rounded-xl border bg-background px-4 py-3 text-center text-2xl tracking-[0.35em] outline-none focus:border-primary"
            placeholder="••••••"
            required
          />
          <button type="button" onClick={() => setShowPin((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}>
            {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? 'A verificar…' : 'Entrar'}
            <span className="sr-only">Entrar</span>
          </button>
          <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            Manter conectado neste aparelho
          </label>
        </form>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Board} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [token, setToken] = useState(() => window.localStorage.getItem(KITCHEN_TOKEN_KEY) ?? window.sessionStorage.getItem(KITCHEN_TOKEN_KEY) ?? '');
  const [name, setName] = useState(() => window.localStorage.getItem(KITCHEN_NAME_KEY) ?? window.sessionStorage.getItem(KITCHEN_NAME_KEY) ?? '');

  useEffect(() => {
    setAuthTokenSetter((nextToken) => {
      if (!nextToken) return;
      window.localStorage.setItem(KITCHEN_TOKEN_KEY, nextToken);
      setToken(nextToken);
    });
    const stopRefresh = startTokenRefreshLoop({ refreshUrl: '/api/auth/refresh' });
    return () => {
      stopRefresh();
      setAuthTokenSetter(null);
    };
  }, []);

  const onLogin = (nextToken: string, nextName: string, remember: boolean) => {
    const storage = remember ? window.localStorage : window.sessionStorage;
    const otherStorage = remember ? window.sessionStorage : window.localStorage;
    otherStorage.removeItem(KITCHEN_TOKEN_KEY); otherStorage.removeItem(KITCHEN_NAME_KEY);
    storage.setItem(KITCHEN_TOKEN_KEY, nextToken);
    storage.setItem(KITCHEN_NAME_KEY, nextName);
    setToken(nextToken);
    setName(nextName);
  };

  const onLogout = () => {
    window.localStorage.removeItem(KITCHEN_TOKEN_KEY);
    window.localStorage.removeItem(KITCHEN_NAME_KEY);
    setToken('');
    setName('');
    queryClient.clear();
  };

  return (
    <IdiomaProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {token ? (
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
          ) : (
            <PinLogin onLogin={onLogin} />
          )}
          {token && <div className="sr-only">Sessão activa: {name}</div>}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </IdiomaProvider>
  );
}

export default App;
