import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft, Wifi, WifiOff, Cloud, Server, CheckCircle, XCircle,
  Copy, Loader2, ChefHat, CreditCard, Bike, Users, Monitor, RefreshCw,
} from 'lucide-react';
import QRCode from 'qrcode';
import { setBaseUrl } from '@workspace/api-client-react';

// ─── Persistência ─────────────────────────────────────────────────────────────

const LS_SERVER = 'miar:local-server';
const LS_MODE   = 'miar:mode';

function getStoredServer() { return localStorage.getItem(LS_SERVER) ?? ''; }
function getStoredMode(): 'cloud' | 'local' {
  return (localStorage.getItem(LS_MODE) as 'cloud' | 'local') ?? 'cloud';
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ServerInfo {
  name: string;
  version: string;
  hostname: string;
  ips: string[];
  port: number;
  timestamp: string;
}

const APPS = [
  { id: 'caixa',      nome: 'Caixa',       icon: CreditCard, porta: 5174, desc: 'PDV · pagamentos' },
  { id: 'cozinha',    nome: 'Cozinha',      icon: ChefHat,    porta: 5175, desc: 'Pedidos · preparo' },
  { id: 'garcom',     nome: 'Garçom',       icon: Users,      porta: 5177, desc: 'Atendimento de mesa' },
  { id: 'entregador', nome: 'Entregador',   icon: Bike,       porta: 5176, desc: 'Delivery · retirada' },
  { id: 'gestor',     nome: 'Gestor',       icon: Monitor,    porta: 5173, desc: 'Administração' },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function pingServer(url: string): Promise<ServerInfo | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const token = window.localStorage.getItem('miar-owner-token') ?? '';
    const r = await fetch(`${url.replace(/\/$/, '')}/api/network/info`, {
      signal: ctrl.signal,
      mode: 'cors',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return r.json() as Promise<ServerInfo>;
  } catch { return null; }
}

async function makeQr(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 192,
    margin: 1,
    color: { dark: '#E2E8F0', light: '#0F172A' },
    errorCorrectionLevel: 'M',
  });
}

function extractHostname(url: string): string {
  try { return new URL(url).hostname; }
  catch { return url; }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function RedeLocal() {
  const [, setLocation] = useLocation();

  const [mode,        setMode]        = useState<'cloud' | 'local'>(getStoredMode);
  const [serverInput, setServerInput] = useState(getStoredServer);
  const [serverUrl,   setServerUrl]   = useState(getStoredServer);
  const [serverInfo,  setServerInfo]  = useState<ServerInfo | null>(null);
  const [testing,     setTesting]     = useState(false);
  const [testResult,  setTestResult]  = useState<'ok' | 'fail' | null>(null);
  const [latency,     setLatency]     = useState<number | null>(null);
  const [qrMap,       setQrMap]       = useState<Record<string, string>>({});
  const [copied,      setCopied]      = useState<string | null>(null);

  const serverHost = serverUrl ? extractHostname(serverUrl) : '';

  // Gera QR codes quando o servidor local está configurado
  useEffect(() => {
    if (!serverUrl || mode !== 'local') return;
    const enc = encodeURIComponent(serverUrl);
    const entries = APPS.map(async app => {
      const appUrl = `http://${serverHost}:${app.porta}?_miar_server=${enc}`;
      const qr = await makeQr(appUrl);
      return [app.id, qr] as const;
    });
    Promise.all(entries).then(pairs => setQrMap(Object.fromEntries(pairs)));
  }, [serverUrl, mode, serverHost]);

  // Verifica o servidor ao entrar em modo local (se já configurado)
  const pingRef = useRef(false);
  useEffect(() => {
    if (mode !== 'local' || !serverUrl || pingRef.current) return;
    pingRef.current = true;
    pingServer(serverUrl).then(info => { if (info) setServerInfo(info); });
  }, [mode, serverUrl]);

  // Testa conectividade
  const handleTest = useCallback(async () => {
    const url = serverInput.trim();
    if (!url) return;
    setTesting(true);
    setTestResult(null);
    const t0 = Date.now();
    const info = await pingServer(url);
    const elapsed = Date.now() - t0;
    setTesting(false);
    if (info) {
      setTestResult('ok');
      setLatency(elapsed);
      setServerInfo(info);
      setServerUrl(url);
      localStorage.setItem(LS_SERVER, url);
      setBaseUrl(url);
    } else {
      setTestResult('fail');
    }
  }, [serverInput]);

  // Troca de modo
  const switchMode = (m: 'cloud' | 'local') => {
    setMode(m);
    localStorage.setItem(LS_MODE, m);
    if (m === 'cloud') {
      setBaseUrl(null);
    } else if (serverUrl) {
      setBaseUrl(serverUrl);
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">

      {/* Cabeçalho */}
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button onClick={() => setLocation('/painel')}
            className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold">Rede local</h1>
            <p className="text-[11px] text-slate-500">Servidor dentro do restaurante · sem internet</p>
          </div>
          {/* Badge de status */}
          {mode === 'local' && serverInfo ? (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-400">
              <Wifi size={11} /> Online · {latency != null ? `${latency}ms` : '—'}
            </span>
          ) : mode === 'local' ? (
            <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-400">
              <WifiOff size={11} /> Não configurado
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-400">
              <Cloud size={11} /> Nuvem
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-8 px-4 pt-6">

        {/* ── Modo de operação ── */}
        <section>
          <Label>Modo de operação</Label>
          <div className="grid grid-cols-2 gap-3">
            <ModeCard
              active={mode === 'cloud'}
              onClick={() => switchMode('cloud')}
              icon={<Cloud size={22} />}
              title="Nuvem"
              desc="Servidor em nuvem. Requer internet."
              color="sky"
            />
            <ModeCard
              active={mode === 'local'}
              onClick={() => switchMode('local')}
              icon={<Server size={22} />}
              title="Local"
              desc="PC dentro do restaurante. Sem internet."
              color="emerald"
            />
          </div>
        </section>

        {/* ── Configuração do servidor local ── */}
        {mode === 'local' && (
          <>
            <section>
              <Label>Endereço do servidor</Label>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={serverInput}
                    onChange={e => setServerInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleTest()}
                    placeholder="http://192.168.1.100:5000"
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    onClick={handleTest}
                    disabled={testing || !serverInput.trim()}
                    className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                  >
                    {testing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Testar
                  </button>
                </div>

                {testResult === 'ok' && serverInfo && (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                    <CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                    <div className="text-xs leading-relaxed">
                      <p className="font-semibold text-emerald-300">Servidor encontrado — {latency}ms</p>
                      <p className="text-slate-400 mt-0.5">
                        {serverInfo.hostname} · {serverInfo.ips.join(' / ')}
                      </p>
                    </div>
                  </div>
                )}

                {testResult === 'fail' && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                    <XCircle size={15} className="mt-0.5 shrink-0 text-red-400" />
                    <div className="text-xs">
                      <p className="font-semibold text-red-300">Servidor não encontrado</p>
                      <p className="text-slate-400 mt-0.5">
                        Verifique se o IP está correto, o servidor está ligado e na mesma rede Wi-Fi.
                      </p>
                    </div>
                  </div>
                )}

                {serverInfo && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { k: 'Hostname', v: serverInfo.hostname },
                      { k: 'Porta API', v: String(serverInfo.port) },
                      { k: 'IPs na rede', v: serverInfo.ips.join(' · ') || '—' },
                    ].map(({ k, v }) => (
                      <div key={k} className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{k}</p>
                        <p className="text-xs text-slate-200 mt-1 truncate font-mono">{v}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-2 text-[11px] text-slate-600 leading-relaxed">
                IP fixo do servidor na rede interna. No Windows: ipconfig. No Linux/Mac: ifconfig ou ip addr.
              </p>
            </section>

            {/* ── QR codes por dispositivo ── */}
            {serverUrl && (
              <section>
                <Label>Configurar dispositivos via QR</Label>
                <p className="mb-4 text-xs text-slate-500 leading-relaxed">
                  Cada tablet ou celular escaneia o QR do seu app. O servidor local é configurado
                  automaticamente — sem digitar nada.
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {APPS.map(app => {
                    const Icon = app.icon;
                    const appUrl = `http://${serverHost}:${app.porta}?_miar_server=${encodeURIComponent(serverUrl)}`;
                    return (
                      <div key={app.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 flex flex-col items-center">
                        <div className="mb-3 flex items-center gap-2 self-start">
                          <Icon size={14} className="text-slate-400" />
                          <div>
                            <p className="text-sm font-semibold leading-none">{app.nome}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{app.desc}</p>
                          </div>
                        </div>

                        {qrMap[app.id] ? (
                          <img
                            src={qrMap[app.id]}
                            alt={`QR ${app.nome}`}
                            className="rounded-xl mb-3"
                            style={{ width: 128, height: 128 }}
                          />
                        ) : (
                          <div className="flex h-32 w-32 items-center justify-center rounded-xl border border-slate-800 mb-3">
                            <Loader2 size={20} className="animate-spin text-slate-600" />
                          </div>
                        )}

                        <p className="font-mono text-[9px] text-slate-600 mb-2 text-center break-all leading-relaxed">
                          :{app.porta}
                        </p>

                        <button
                          onClick={() => copy(appUrl, app.id)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-1.5 text-[11px] text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors"
                        >
                          {copied === app.id
                            ? <><CheckCircle size={11} className="text-emerald-400" /> Copiado!</>
                            : <><Copy size={11} /> Copiar URL</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Instruções ── */}
            <section>
              <Label>Como montar o servidor local</Label>
              <div className="rounded-2xl border border-slate-800 divide-y divide-slate-800/60">
                {[
                  {
                    n: '1',
                    t: 'Hardware recomendado',
                    d: 'Qualquer PC dedicado ou mini PC (Intel NUC, Beelink, GMKtec) na rede do restaurante. Mínimo: 4GB RAM, 60GB SSD. Raspberry Pi 4/5 também funciona.',
                  },
                  {
                    n: '2',
                    t: 'Instalar dependências',
                    d: 'Node.js 20+ e PostgreSQL 15+. No Ubuntu/Debian: sudo apt install -y nodejs npm postgresql. Instale o pnpm depois: npm i -g pnpm.',
                  },
                  {
                    n: '3',
                    t: 'Rodar o servidor',
                    d: 'Clone o repositório, rode pnpm install e depois pnpm --filter @workspace/api-server run dev. O servidor sobe na porta 5000.',
                  },
                  {
                    n: '4',
                    t: 'IP fixo no roteador',
                    d: 'No painel do roteador, reserve o IP do servidor pelo MAC address. Ex: 192.168.1.100. Assim o IP não muda nunca — nem após reiniciar.',
                  },
                  {
                    n: '5',
                    t: 'Conectar todos os dispositivos',
                    d: 'Digite o IP acima, clique em Testar. Depois escaneie os QR codes em cada tablet. Pronto — caixa, cozinha e garçom funcionam sem internet.',
                  },
                ].map(({ n, t, d }) => (
                  <div key={n} className="flex gap-4 p-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-bold text-slate-400">
                      {n}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{t}</p>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed">{d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ── Modo nuvem: explicação ── */}
        {mode === 'cloud' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center">
            <Cloud size={32} className="mx-auto mb-3 text-sky-400/60" />
            <p className="text-sm font-semibold text-slate-200">Modo nuvem ativo</p>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              Todos os dados passam pelo servidor em nuvem. Requer conexão com internet.
              Para operar 100% offline, mude para modo local e configure um servidor
              dentro do restaurante.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
      {children}
    </p>
  );
}

function ModeCard({ active, onClick, icon, title, desc, color }: {
  active: boolean; onClick: () => void; icon: React.ReactNode;
  title: string; desc: string; color: 'sky' | 'emerald';
}) {
  const colors = {
    sky:     active ? 'border-sky-500/50 bg-sky-500/10'     : 'border-slate-800 bg-slate-900/50 hover:border-slate-700',
    emerald: active ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700',
  };
  const iconColor = {
    sky:     active ? 'text-sky-400'     : 'text-slate-600',
    emerald: active ? 'text-emerald-400' : 'text-slate-600',
  };
  const titleColor = {
    sky:     active ? 'text-sky-300'     : 'text-slate-300',
    emerald: active ? 'text-emerald-300' : 'text-slate-300',
  };

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${colors[color]}`}
    >
      <span className={iconColor[color]}>{icon}</span>
      <div>
        <p className={`text-sm font-semibold ${titleColor[color]}`}>{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
    </button>
  );
}
