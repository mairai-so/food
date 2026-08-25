import { ForgotPassword } from './components/ForgotPassword';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, MessageCircle, ArrowLeft, Monitor, Moon, Sun, ChevronDown, Languages } from 'lucide-react';
import { useGetAuthStatus, useGetMe, useLoginOwner, setAuthTokenGetter, setAuthTokenSetter, startTokenRefreshLoop } from '@workspace/api-client-react';
import { CashierView, ClientExperience, KitchenView } from '@/components/operational-views';
import { StockAuditCamera, SegmentOnboarding, BarcodePanel, MarketingPanel } from '@/components/new-modules';
import { FloatingChat } from '@/components/FloatingChat';
import { LojaSwitcher } from '@/components/LojaSwitcher';
import { InstallPrompt } from '@/components/InstallPrompt';
import { IdiomaProvider, useTranslation } from './i18n/IdiomaContext';
import { ConfigFlutuante } from './i18n/ConfigFlutuante';
import PasskeyPrompt from './components/PasskeyPrompt';
import { IDIOMA_LABEL, IDIOMA_BANDEIRA, IDIOMAS_GLOBAIS, type Idioma } from './i18n/traducoes';
import PosCadastro from '@/pages/pos-cadastro';
import AtivacoesSuperAdmin from '@/pages/ativacoes-super-admin';
import OnboardingUsuarios from '@/pages/onboarding-usuarios';
import JornadaConfiguracao from '@/pages/jornada-configuracao';
import OnboardingEstabelecimento from '@/pages/onboarding-estabelecimento';
import OnboardingProdutos from '@/pages/onboarding-produtos';
import ConviteEntregador from '@/pages/convite-entregador';
import RegistroProtegido from '@/pages/registro-protegido';
import Socios from '@/pages/socios';
import CentralComando from '@/pages/central-comando';
import Funcionarios from '@/pages/funcionarios';
import Seguranca from '@/pages/seguranca';
import RedeLocal from '@/pages/rede-local';
import Compras from '@/pages/compras';
import Fornecedores from '@/pages/fornecedores';
import Estoque from '@/pages/estoque';
import FiadoPage from '@/pages/fiado';
import SegurancaRede from '@/pages/seguranca-rede';
import CentralDeLojas from '@/pages/central-de-lojas';
import LandingPage from '@/pages/landing';
import CameraLocal from '@/pages/camera-local';
import DriveThruPage from '@/pages/drive-thru';
import FeedInterno from '@/pages/feed-interno';
import MuralEmpregos from '@/pages/mural-empregos';
import PublicarFeed from '@/pages/publicar-feed';
import ComplaintsPage from '@/pages/complaints';
import MotorDemanda from '@/pages/motor-demanda';
import MiaPage from '@/pages/mia';
import MIARIntroPage from '@/pages/miar-intro';
import Rentabilidade from '@/pages/rentabilidade';
import FichaTecnica from '@/pages/ficha-tecnica';
import Catalogo from '@/pages/catalogo';
import AtalhosPage from '@/pages/atalhos';
import Mesas from '@/pages/mesas';
import MinhaIa from '@/pages/minha-ia';
import TermosPage from '@/pages/termos';
import PrivacidadePage from '@/pages/privacidade';
import MiarEdita from '@/pages/miar-edita';

const queryClient = new QueryClient();

function getStoredToken() {
  return window.localStorage.getItem('miar-owner-token') ?? window.sessionStorage.getItem('miar-owner-token');
}

function storeAuthToken(token: string, remember = true) {
  window.localStorage.removeItem('miar-owner-token');
  window.sessionStorage.removeItem('miar-owner-token');
  (remember ? window.localStorage : window.sessionStorage).setItem('miar-owner-token', token);
}

type ApiPayload = Record<string, unknown>;

async function readApiResponse(response: Response, fallbackMessage: string): Promise<ApiPayload> {
  const raw = await response.text();
  let payload: ApiPayload = {};

  if (raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        payload = parsed as ApiPayload;
      }
    } catch {
      if (!response.ok) {
        throw new Error(`${fallbackMessage} (resposta inválida do servidor)`);
      }
      throw new Error('O servidor retornou uma resposta inválida.');
    }
  }

  if (!response.ok) {
    const serverError = typeof payload.error === 'string' ? payload.error : '';
    throw new Error(serverError || `${fallbackMessage} (HTTP ${response.status})`);
  }

  return payload;
}

type ThemeMode = 'light' | 'dark' | 'system';

function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem('miar-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const isDark = mode === 'dark' || (mode === 'system' && media.matches);
      root.classList.toggle('dark', isDark);
      root.classList.toggle('light', !isDark);
      body.classList.toggle('dark', isDark);
      body.classList.toggle('light', !isDark);
      root.style.colorScheme = isDark ? 'dark' : 'light';
    };
    apply();
    const onChange = () => apply();
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, [mode]);

  const changeMode = (next: ThemeMode) => {
    window.localStorage.setItem('miar-theme', next);
    setMode(next);
  };

  return { mode, changeMode };
}

function ThemeToggle() {
  const { mode, changeMode } = useThemeMode();
  const { t } = useTranslation();
  const options: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
    { value: 'light', label: t('tema.claro'), icon: Sun },
    { value: 'dark', label: t('tema.escuro'), icon: Moon },
    { value: 'system', label: t('tema.sistema'), icon: Monitor },
  ];

  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 p-1" aria-label={t('config.idioma_titulo')}>
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          aria-label={`Tema ${label}`}
          title={label}
          onClick={() => changeMode(value)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            mode === value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
        >
          <Icon size={13} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

function InitialLanguagePrompt() {
  const { idioma, setIdioma, t } = useTranslation();
  const [open, setOpen] = useState(() => {
    try { return window.localStorage.getItem('miar-idioma-prompt-seen') !== '1'; }
    catch { return true; }
  });
  const choose = (next: Idioma) => {
    setIdioma(next);
    try { window.localStorage.setItem('miar-idioma-prompt-seen', '1'); } catch { /* segue em memória */ }
    setOpen(false);
  };

  return (
    <div
      className={open ? 'fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm' : 'hidden'}
      role="dialog"
      aria-hidden={!open}
      aria-modal={open}
      aria-labelledby="idioma-inicial-titulo"
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
            <Languages size={22} />
          </div>
          <div>
            <h2 id="idioma-inicial-titulo" className="text-xl font-semibold text-slate-100">{t('idioma.prompt.titulo')}</h2>
            <p className="mt-1 text-sm text-slate-400">{t('idioma.prompt.subtitulo')}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(IDIOMA_LABEL) as Idioma[]).slice(0, 4).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm transition hover:border-emerald-400 hover:bg-emerald-500/10 ${option === idioma ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200' : 'border-slate-700 text-slate-200'}`}
            >
              <span className="text-xl" aria-hidden="true">{IDIOMA_BANDEIRA[option]}</span>
              <span>{IDIOMA_LABEL[option]}</span>
            </button>
          ))}
          <div className="col-span-2 border-t border-slate-800 pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Outros idiomas · catálogo global</p>
            <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1" aria-label="Outros idiomas disponíveis globalmente">
              {IDIOMAS_GLOBAIS.map((option) => (
                <div
                  key={option.codigo}
                  title="Tradução completa ainda não disponível neste app"
                  className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 px-3 py-3 text-left text-sm text-slate-500"
                  aria-disabled="true"
                >
                  <span className="text-xl grayscale" aria-hidden="true">{option.bandeira}</span>
                  <span>{option.nome}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-600">Os quatro idiomas acima são os idiomas completos deste app.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function useCompanyLogo() {
  const [logo, setLogo] = useState(() => window.localStorage.getItem('miar-company-logo') ?? '');
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'miar-company-logo') setLogo(e.newValue ?? '');
    };
    window.addEventListener('storage', onStorage);
    // Poll for changes within the same tab (uploads happen in same tab)
    const id = setInterval(() => {
      const current = window.localStorage.getItem('miar-company-logo') ?? '';
      setLogo((prev) => (prev !== current ? current : prev));
    }, 500);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(id); };
  }, []);
  return logo;
}

function AuthShell({ children, headerCenter }: { children: React.ReactNode; headerCenter?: React.ReactNode }) {
  useEffect(() => {
    const id = setInterval(async () => {
      const token = getStoredToken();
      if (!token) return;
      try {
        const r = await fetch('/api/auth/refresh', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          const { token: novoToken } = await r.json() as { token: string };
          const persistent = window.localStorage.getItem('miar-owner-token') !== null;
          storeAuthToken(novoToken, persistent);
        }
      } catch { /* o próximo ciclo tenta novamente */ }
    }, 90 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen w-full flex-col px-0 py-0">
        <header className="grid min-h-[88px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b border-slate-800 bg-slate-900/90 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3 justify-self-start">
            <div className="flex h-14 w-44 shrink-0 items-center overflow-hidden rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 shadow-lg shadow-emerald-950/20 sm:h-16 sm:w-56">
              <img src="/branding/logo.svg" alt="MIAR AI/FOOD Gestora" className="h-full w-full object-contain object-left" />
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-slate-500">Gestor</p>
            </div>
          </div>
          <div className="min-w-0 justify-self-center">{headerCenter}</div>
          <div className="flex shrink-0 items-center gap-2 justify-self-end">
            <LojaSwitcher />
            <MiaVisibilityToggle />
            <ThemeToggle />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

/** Botão pequeno pra reativar o chat da MIAR depois que o usuário fechou pelo X do avatar. */
function MiaVisibilityToggle() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('miar-chat-dismissed') === '1');
  if (!dismissed) return null; // só aparece quando a MIAR está escondida
  return (
    <button
      onClick={() => {
        localStorage.removeItem('miar-chat-dismissed');
        setDismissed(false);
        window.dispatchEvent(new Event('miar-chat-visibility-changed'));
      }}
      className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
      title="Reativar o chat flutuante da MIAR"
    >
      Mostrar MIAR
    </button>
  );
}

function formatCpf(value: string) {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function validateCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (check !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  return check === parseInt(digits[10]);
}

function validateCnpj(cnpj: string) {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    let pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += parseInt(d[len - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(d[12]) && calc(13) === parseInt(d[13]);
}

function formatCnpj(v: string) {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function formatCep(v: string) {
  return v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
}

const brazilianStates = [
  ['AC', 'Acre'], ['AL', 'Alagoas'], ['AP', 'Amapá'], ['AM', 'Amazonas'],
  ['BA', 'Bahia'], ['CE', 'Ceará'], ['DF', 'Distrito Federal'], ['ES', 'Espírito Santo'],
  ['GO', 'Goiás'], ['MA', 'Maranhão'], ['MT', 'Mato Grosso'], ['MS', 'Mato Grosso do Sul'],
  ['MG', 'Minas Gerais'], ['PA', 'Pará'], ['PB', 'Paraíba'], ['PR', 'Paraná'],
  ['PE', 'Pernambuco'], ['PI', 'Piauí'], ['RJ', 'Rio de Janeiro'], ['RN', 'Rio Grande do Norte'],
  ['RS', 'Rio Grande do Sul'], ['RO', 'Rondônia'], ['RR', 'Roraima'], ['SC', 'Santa Catarina'],
  ['SP', 'São Paulo'], ['SE', 'Sergipe'], ['TO', 'Tocantins'],
] as const;

const countryOptions = [
  { code: 'BR', name: 'Brasil', flag: '🇧🇷' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'BO', name: 'Bolívia', flag: '🇧🇴' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CO', name: 'Colômbia', flag: '🇨🇴' },
  { code: 'PY', name: 'Paraguai', flag: '🇵🇾' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪' },
  { code: 'UY', name: 'Uruguai', flag: '🇺🇾' },
  { code: 'OTHER', name: 'Outro país', flag: '🌍' },
] as const;

// Forca da senha: 0 fraca -> 4 forte
function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}


// Idioma escolhido no cadastro vira o padrão do estabelecimento — todo
// funcionário/cliente que entrar sem ter escolhido o próprio idioma ainda
// herda esse valor (ver IdiomaContext.tsx de cada app). Sempre salva,
// mesmo se for português (que já é o default do banco), pra deixar
// explícito que foi escolha consciente, não valor esquecido.
async function salvarIdiomaPadrao(token: string, idiomaPadrao: Idioma) {
  try {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ idiomaPadrao }),
    });
  } catch {
    // Não bloqueia o cadastro por isso — dono ajusta depois em Configurações.
  }
}

// Apoio social voluntário — só salva se o dono ligou a chave. Vai somar
// na cobrança mensal quando o gateway de pagamento existir; por enquanto
// só fica registrado, pronto pra quando essa peça for construída.
async function salvarApoioSocial(token: string, apoioSocial: { ativo: boolean; tipo: 'fixo' | 'percentual'; valor: number }) {
  if (!apoioSocial.ativo) return;
  try {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ apoioSocial }),
    });
  } catch {
    // Não bloqueia o cadastro por isso — dono ajusta depois em Configurações.
  }
}

function Home() {
  const [, setLocation] = useLocation();
  const { idioma: idiomaPadrao, t } = useTranslation();
  const { mutate: login, isPending: loggingIn } = useLoginOwner();
  const authStatus = useGetAuthStatus();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [registrationStep, setRegistrationStep] = useState<'details' | 'code'>('details');
  const [registrationCode, setRegistrationCode] = useState(['', '', '', '', '', '']);
  const [registrationPhone, setRegistrationPhone] = useState('');
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [formError, setFormError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const registrationCodeRefs = useRef<Array<HTMLInputElement | null>>([]);
  // Marca quando o CPF foi rejeitado no envio, para revalidar em tempo real no onChange.
  const cpfHadError = useRef(false);
  const [form, setForm] = useState({
    companyName: '',
    razaoSocial: '',
    ownerName: '',
    cpf: '',
    cnpj: '',
    email: '',
    emailConfirm: '',
    phone: '',
    phoneConfirm: '',
    postalCode: '',
    address: '',
    addressNumber: '',
    addressComplement: '',
    neighborhood: '',
    city: '',
    state: '',
    country: 'BR',
    password: '',
    passwordConfirm: '',
  });
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [apoioSocial, setApoioSocial] = useState<{ ativo: boolean; tipo: 'fixo' | 'percentual'; valor: string }>({
    ativo: false,
    tipo: 'percentual',
    valor: '',
  });
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState('');
  const [cepResolvido, setCepResolvido] = useState(true);
  const cepLookupSequence = useRef(0);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      // Redimensiona para no máximo 256×256 e comprime para JPEG 80%
      const img = new Image();
      img.onload = () => {
        const MAX = 256;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        setLogoDataUrl(compressed);
        window.localStorage.setItem('miar-company-logo', compressed);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    setAuthTokenGetter(() => getStoredToken() ?? '');
  }, []);

  useEffect(() => {
    if (authStatus.data?.registered) {
      setMode('login');
    }
  }, [authStatus.data?.registered]);

  useEffect(() => {
    if (form.country !== 'BR' || !form.state) {
      setCityOptions([]);
      setForm((previous) => (previous.city ? { ...previous, city: '' } : previous));
      return;
    }
    // Ao escolher manualmente um estado, a cidade anterior deixa de ser válida.
    // Quando o CEP já resolveu o endereço, preservamos a cidade devolvida pelo ViaCEP.
    if (!cepResolvido) {
      setForm((previous) => (previous.city ? { ...previous, city: '' } : previous));
    }

    let cancelled = false;
    setCitiesLoading(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${form.state}/municipios`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Não foi possível carregar as cidades.');
        const data = await response.json() as Array<{ nome?: string }>;
        if (!cancelled) {
          setCityOptions(data.map((city) => city.nome).filter((name): name is string => Boolean(name)));
        }
      })
      .catch(() => {
        if (!cancelled) setCityOptions([]);
      })
      .finally(() => {
        if (!cancelled) setCitiesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.country, form.state, cepResolvido]);

  const lookupCep = async (postalCode = form.postalCode, country = form.country) => {
    const digits = postalCode.replace(/\D/g, '');
    if (digits.length !== 8 || country !== 'BR') return;

    const sequence = ++cepLookupSequence.current;
    setCepLoading(true);
    setCepMessage('');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!response.ok) throw new Error('Não foi possível consultar o CEP.');
      const data = await response.json() as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro) throw new Error('CEP não encontrado.');

      if (sequence !== cepLookupSequence.current) return;
      setForm((previous) => ({
        ...previous,
        postalCode: formatCep(digits),
        address: data.logradouro || previous.address,
        neighborhood: data.bairro || previous.neighborhood,
        city: data.localidade || previous.city,
        state: data.uf || previous.state,
      }));
      setCepMessage('Endereço preenchido pelo CEP. Confira os dados antes de continuar.');
      setCepResolvido(true);
    } catch (error: unknown) {
      if (sequence !== cepLookupSequence.current) return;
      setCepMessage(error instanceof Error ? error.message : 'Não foi possível consultar o CEP.');
      setCepResolvido(false);
    } finally {
      if (sequence === cepLookupSequence.current) setCepLoading(false);
    }
  };

  // CORRIGIDO 30/07/2026: estava "if (false)" desde os testes, nunca religado.
  // Auto-login por token voltou a funcionar.
  useEffect(() => {
    const token = getStoredToken();
    if (!token || token === 'dev-bypass') {
      if (token === 'dev-bypass') window.localStorage.removeItem('miar-owner-token');
      return;
    }

    let cancelled = false;
    void fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error('invalid-session');
        // CORRIGIDO 08/08/2026: token válido não significa onboarding
        // concluído. Se o cadastro ficou pendente (fechou o app no meio do
        // fluxo), volta pro início do onboarding em vez de pular pro painel.
        if (!cancelled) {
          const onboardingPending = window.localStorage.getItem('miar-onboarding-pending') === '1';
          if (onboardingPending) {
            setLocation('/onboarding/segmento');
          } else {
            setLocation('/painel');
          }
        }
      })
      .catch(() => {
        if (!cancelled) window.localStorage.removeItem('miar-owner-token');
      });

    return () => {
      cancelled = true;
    };
  }, [setLocation]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');

    if (mode === 'register') {
      if (registrationStep === 'code') {
        void verifyRegistration();
        return;
      }
      if (form.email !== form.emailConfirm) {
        setFormError(t('cadastro.emails_diferentes'));
        return;
      }
      if (form.password !== form.passwordConfirm) {
        setFormError(t('cadastro.senhas_diferentes'));
        return;
      }
      if (passwordScore(form.password) < 2) {
        setFormError(t('cadastro.senha_fraca'));
        return;
      }
      if (!form.companyName.trim()) {
        setFormError(t('cadastro.nome_empresa_obrigatorio'));
        return;
      }
      if (form.country === 'BR' && form.postalCode.replace(/\D/g, '').length !== 8) {
        setFormError(t('cadastro.cep_obrigatorio'));
        return;
      }
      if (!validateCpf(form.cpf)) {
        cpfHadError.current = true;
        setFormError(t('cadastro.cpf_invalido'));
        return;
      }
      if (form.cnpj && !validateCnpj(form.cnpj)) {
        setFormError(t('cadastro.cnpj_invalido'));
        return;
      }
      if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 10) {
        setFormError(t('cadastro.telefone_invalido'));
        return;
      }
      if (form.phone.replace(/\D/g, '') !== form.phoneConfirm.replace(/\D/g, '')) {
        setFormError(t('cadastro.telefones_diferentes'));
        return;
      }
      const countryName = countryOptions.find(({ code }) => code === form.country)?.name ?? form.country;
      const stateName = brazilianStates.find(([uf]) => uf === form.state)?.[1] ?? form.state;
      const completeAddress = [
        form.address.trim(),
        form.addressNumber.trim() && `nº ${form.addressNumber.trim()}`,
        form.addressComplement.trim(),
        form.neighborhood.trim(),
        form.city.trim() && stateName ? `${form.city.trim()} - ${stateName}` : form.city.trim() || stateName,
        form.postalCode.trim() && `CEP ${form.postalCode.trim()}`,
        countryName,
      ].filter(Boolean).join(', ');
      setRegistrationLoading(true);
      fetch('/api/auth/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: form.companyName,
          razaoSocial: form.razaoSocial || null,
          logoUrl: logoDataUrl || null,
          cnpj: form.cnpj || form.cpf,
          cpf: form.cpf,
          ownerName: form.ownerName,
          email: form.email,
          phone: form.phone,
          address: completeAddress,
          password: form.password,
        }),
      })
        .then(async (response) => {
          const data = await readApiResponse(response, 'Não foi possível iniciar o cadastro.');
          if (data.token) {
            storeAuthToken(String(data.token), true);
            void salvarIdiomaPadrao(String(data.token), idiomaPadrao);
            void salvarApoioSocial(String(data.token), { ativo: apoioSocial.ativo, tipo: apoioSocial.tipo, valor: Number(apoioSocial.valor) || 0 });
            // CORRIGIDO 08/08/2026: marca que o cadastro ainda não terminou o
            // onboarding. Sem isso, se o usuário fechar e reabrir o app antes
            // de concluir, o auto-login pelo token pulava direto pro painel
            // (bug reportado: "fechei abri e já foi pra tela gestor princ.").
            window.localStorage.setItem('miar-onboarding-pending', '1');
            // CORRIGIDO 30/07/2026: fluxo linear restaurado -> segmento primeiro
            setLocation('/onboarding/segmento');
            return;
          }
          setRegistrationPhone(typeof data.phone === 'string' ? data.phone : form.phone);
          setRegistrationStep('code');
          setFormError('');
          setTimeout(() => registrationCodeRefs.current[0]?.focus(), 100);
        })
        .catch((error: unknown) => {
          setFormError(error instanceof Error ? error.message : 'Erro ao iniciar cadastro.');
        })
        .finally(() => setRegistrationLoading(false));
      return;
    }

    // Verificação de Segurança (15/08/2026): manda um deviceId estável (gerado
    // uma vez e salvo no navegador) pra o backend saber se este é um
    // aparelho novo acessando a conta.
    let deviceId = window.localStorage.getItem('miar-device-id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      window.localStorage.setItem('miar-device-id', deviceId);
    }
    login({ data: { email: form.email, password: form.password, deviceId, deviceLabel: navigator.userAgent } }, {
      onSuccess: (data: { token: string }) => {
        storeAuthToken(data.token, rememberDevice);
        setLocation('/painel');
      },
      onError: () => {
        setFormError(t('auth.error.invalid'));
      },
    });
  };

  const verifyRegistration = async () => {
    const code = registrationCode.join('');
    if (code.length !== 6) {
      setFormError('Digite os 6 dígitos do código.');
      return;
    }
    setRegistrationLoading(true);
    setFormError('');
    try {
      const response = await fetch('/api/auth/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: registrationPhone, code }),
      });
      const data = await readApiResponse(response, 'Não foi possível confirmar o cadastro.');
      if (typeof data.token !== 'string' || !data.token) {
        throw new Error('O cadastro foi confirmado, mas o servidor não enviou o acesso.');
      }
      storeAuthToken(data.token, true);
      window.localStorage.setItem('miar-passkey-pending-token', data.token);
      window.dispatchEvent(new Event('miar-passkey-prompt'));
      setMode('login');
      setRegistrationStep('details');
      setRegistrationCode(['', '', '', '', '', '']);
      setFormError(`${t('auth.button.register')}. ${t('auth.subtitle')}`);
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível confirmar o cadastro.');
    } finally {
      setRegistrationLoading(false);
    }
  };

  const resendRegistrationCode = async () => {
    setRegistrationLoading(true);
    setFormError('');
    try {
      const response = await fetch('/api/auth/register/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: registrationPhone }),
      });
      await readApiResponse(response, 'Não foi possível reenviar o código.');
      setRegistrationCode(['', '', '', '', '', '']);
      setFormError(`${t('auth.sms.code')}. ${t('cadastro.celular')}`);
      setTimeout(() => registrationCodeRefs.current[0]?.focus(), 100);
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível reenviar o código.');
    } finally {
      setRegistrationLoading(false);
    }
  };

  const updateRegistrationCode = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...registrationCode];
    next[index] = digit;
    setRegistrationCode(next);
    if (digit && index < 5) setTimeout(() => registrationCodeRefs.current[index + 1]?.focus(), 10);
  };

  const handleRegistrationCodeKeyDown = (index: number, event: React.KeyboardEvent) => {
    if (event.key === 'Backspace' && !registrationCode[index] && index > 0) {
      registrationCodeRefs.current[index - 1]?.focus();
    }
  };

  const restartRegistration = () => {
    setRegistrationStep('details');
    setRegistrationCode(['', '', '', '', '', '']);
    setRegistrationPhone('');
    setFormError('');
  };

  const goToLogin = () => {
    setShowForgot(false);
    setMode('login');
    setFormError('');
    restartRegistration();
  };

  const goToRegister = () => {
    setShowForgot(false);
    setMode('register');
    setFormError('');
    restartRegistration();
  };

  const inputClass =
    'w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:bg-slate-900 transition-colors text-sm';
  const inputClassCompact =
    'w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-1.5 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:bg-slate-900 transition-colors text-sm';
  const selectClass = inputClass + ' appearance-none';
  const selectClassCompact = inputClassCompact + ' appearance-none';

  const isRegister = mode === 'register';

  const headerLogoUpload = isRegister ? (
    <div className="flex items-center justify-center gap-3">
      <div className="relative shrink-0">
        <label className="group relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950 transition hover:border-emerald-400 sm:h-24 sm:w-24" title="Enviar, trocar ou remover logo do estabelecimento">
          {logoDataUrl ? <img src={logoDataUrl} alt="Logo do estabelecimento" className="h-full w-full object-contain p-1" /> : <span className="px-1 text-center text-[9px] leading-tight text-slate-500">Seu logo<br />aqui</span>}
          <input ref={logoInputRef} type="file" accept="image/*" className="sr-only" onChange={handleLogoUpload} aria-label="Enviar logo do estabelecimento" />
        </label>
        {logoDataUrl && <button type="button" onClick={() => { setLogoDataUrl(''); window.localStorage.removeItem('miar-company-logo'); if (logoInputRef.current) logoInputRef.current.value = ''; }} className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white shadow-lg" aria-label="Remover logo">×</button>}
      </div>
      <div className="hidden text-left sm:block">
        <p className="text-xs font-semibold text-slate-200">Logo do estabelecimento</p>
        <p className="text-[10px] text-slate-500">Clique para enviar, trocar ou remover</p>
      </div>
    </div>
  ) : null;

  return (
    <AuthShell headerCenter={headerLogoUpload}>
      <div className="flex flex-1 items-start justify-center pt-0 pb-0">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={isRegister && registrationStep === 'details' ? 'w-full h-full' : 'w-full max-w-md'}
        >
          {showForgot ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-7 shadow-2xl shadow-slate-950/60 backdrop-blur-sm">
              <ForgotPassword onBack={goToLogin} />
            </div>
          ) : (
          <>
          {/* Título da tela */}
          <div className="mb-2 text-center px-4">
            {!isRegister && (
              <>
                <h2 className="text-2xl font-semibold tracking-tight">{t('auth.title')}</h2>
                <p className="mt-2 text-sm text-slate-400">{t('auth.subtitle')}</p>
              </>
            )}
          </div>

          {/* Card do formulário */}
          <div className="rounded-none border-t border-b border-slate-800 bg-slate-900/60 p-7 shadow-2xl shadow-slate-950/60 backdrop-blur-sm" style={{maxHeight: 'calc(100vh - 100px)', overflow: 'auto'}}>
            <form onSubmit={onSubmit} className="space-y-3">
              {isRegister && registrationStep === 'code' ? (
                <>
                  <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-center">
                    <p className="text-sm font-medium">{t('auth.sms.code')}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t('auth.sms.sent')} {registrationPhone}.</p>
                  </div>
                  <div className="flex justify-center gap-2 py-2">
                    {registrationCode.map((digit, index) => (
                      <input
                        key={index}
                        ref={(element) => { registrationCodeRefs.current[index] = element; }}
                        className="h-12 w-10 rounded-xl border border-slate-800 bg-slate-900 text-center text-lg font-semibold text-slate-100 focus:border-primary focus:outline-none transition-colors"
                        value={digit}
                        onChange={(event) => updateRegistrationCode(index, event.target.value)}
                        onKeyDown={(event) => handleRegistrationCodeKeyDown(index, event)}
                        inputMode="numeric"
                        maxLength={1}
                        aria-label={`Dígito ${index + 1}`}
                      />
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                    disabled={registrationLoading || registrationCode.join('').length < 6}
                  >
                    {registrationLoading ? t('auth.button.entering') : t('auth.button.register')}
                  </button>
                  <button type="button" onClick={restartRegistration} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Voltar e revisar dados
                  </button>
                  <div className="flex items-center justify-center gap-3 text-xs">
                    <button type="button" onClick={() => void resendRegistrationCode()} disabled={registrationLoading} className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50">
                      {t('auth.sms.code')}
                    </button>
                    <span className="text-slate-600">|</span>
                    <button type="button" onClick={restartRegistration} disabled={registrationLoading} className="text-muted-foreground hover:text-foreground disabled:opacity-50">
                      {t('auth.enter.link')}
                    </button>
                  </div>
                </>
              ) : isRegister && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">

                    {/* Linha 1: Nome fantasia | Razão social */}
                    <label className="contents">
                      <span className="sr-only">{t('cadastro.nome_fantasia')}</span>
                      <input
                        className={inputClassCompact + ' col-span-12 sm:col-span-6'}
                        placeholder={t('cadastro.nome_fantasia')}
                        aria-label={t('cadastro.nome_fantasia')}
                        title={t('cadastro.nome_fantasia')}
                        value={form.companyName}
                        onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                        autoComplete="organization"
                        required
                      />
                    </label>
                    <label className="contents">
                      <span className="sr-only">{t('cadastro.razao_social')}</span>
                      <input
                        className={inputClassCompact + ' col-span-12 sm:col-span-6'}
                        placeholder={t('cadastro.razao_social')}
                        value={form.razaoSocial}
                        onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                        aria-label={t('cadastro.razao_social')}
                        title={t('cadastro.razao_social')}
                        autoComplete="organization"
                      />
                    </label>

                    {/* Linha 2: Nome | E-mail | Confirmar e-mail */}
                    <label className="contents">
                      <span className="sr-only">{t('cadastro.nome_completo')}</span>
                      <input
                        className={inputClassCompact + ' col-span-12 text-base font-medium sm:col-span-4'}
                        placeholder={t('cadastro.nome_completo')}
                        aria-label={t('cadastro.nome_completo')}
                        title={t('cadastro.nome_completo')}
                        value={form.ownerName}
                        onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                        autoComplete="name"
                        required
                      />
                    </label>
                    <label className="contents">
                      <span className="sr-only">{t('cadastro.email')}</span>
                      <input
                        className={inputClassCompact + ' col-span-12 sm:col-span-4'}
                        placeholder={t('cadastro.email')}
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        aria-label={t('cadastro.email')}
                        title={t('cadastro.email')}
                        autoComplete="email"
                        required
                        onInvalid={(e) => e.currentTarget.setCustomValidity(t('cadastro.campo_obrigatorio'))}
                        onInput={(e) => e.currentTarget.setCustomValidity('')}
                      />
                    </label>
                    <label className="contents">
                      <span className="sr-only">{t('cadastro.email_confirmar')}</span>
                      <input
                        className={inputClassCompact + ' col-span-12 sm:col-span-4'}
                        placeholder={t('cadastro.email_confirmar')}
                        aria-label={t('cadastro.email_confirmar')}
                        type="email"
                        value={form.emailConfirm}
                        onChange={(e) => setForm({ ...form, emailConfirm: e.target.value })}
                        autoComplete="email"
                        required
                        onInvalid={(e) => e.currentTarget.setCustomValidity(t('cadastro.campo_obrigatorio'))}
                        onInput={(e) => e.currentTarget.setCustomValidity('')}
                      />
                    </label>

                    {/* Linha 3: CPF | CNPJ */}
                    <label className="contents">
                      <span className="sr-only">{t('cadastro.cpf')}</span>
                      <input
                        className={inputClassCompact + ' col-span-12 sm:col-span-6'}
                        placeholder={t('cadastro.cpf')}
                        value={form.cpf}
                        onChange={(e) => {
                          setForm({ ...form, cpf: formatCpf(e.target.value) });
                          if (cpfHadError.current) {
                            const normalized = e.target.value.replace(/\D/g, '');
                            if (normalized.length === 11 && validateCpf(normalized)) {
                              setFormError('');
                              cpfHadError.current = false;
                            }
                          }
                        }}
                        aria-label={t('cadastro.cpf')}
                        title={t('cadastro.cpf')}
                        autoComplete="off"
                        required
                        onInvalid={(e) => e.currentTarget.setCustomValidity(t('cadastro.campo_obrigatorio'))}
                        onInput={(e) => e.currentTarget.setCustomValidity('')}
                      />
                    </label>
                    <label className="contents">
                      <span className="sr-only">{t('cadastro.cnpj')}</span>
                      <input
                        className={inputClassCompact + ' col-span-12 sm:col-span-6'}
                        placeholder={t('cadastro.cnpj')}
                        value={form.cnpj}
                        onChange={(e) => setForm({ ...form, cnpj: formatCnpj(e.target.value) })}
                        aria-label={t('cadastro.cnpj')}
                        title={t('cadastro.cnpj')}
                        autoComplete="off"
                      />
                    </label>

                    {/* Linha 4: CEP | Endereço | Número | Complemento */}
                    <div className="relative col-span-12 sm:col-span-2">
                      <input
                        className={inputClassCompact + ' w-full'}
                        aria-label={t('cadastro.cep')}
                        title={t('cadastro.cep')}
                        placeholder="CEP"
                        value={form.postalCode}
                        onChange={(e) => {
                          const postalCode = formatCep(e.target.value);
                          setCepMessage('');
                          setCepResolvido(false);
                          setForm((previous) => ({ ...previous, postalCode }));
                          if (postalCode.replace(/\D/g, '').length === 8 && form.country === 'BR') {
                            void lookupCep(postalCode, 'BR');
                          }
                        }}
                        onBlur={() => void lookupCep()}
                        inputMode="numeric"
                        autoComplete="postal-code"
                        required
                        onInvalid={(e) => e.currentTarget.setCustomValidity(t('cadastro.campo_obrigatorio'))}
                        onInput={(e) => e.currentTarget.setCustomValidity('')}
                      />
                      {cepLoading && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-300">{t('cadastro.cep_buscando')}</span>
                      )}
                      <a
                        href="https://buscacepinter.correios.com.br/app/endereco/index.php"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block text-[11px] text-emerald-400 hover:underline"
                      >
                        Não sei meu CEP
                      </a>
                    </div>
                    <input
                      className={inputClassCompact + ' col-span-12 sm:col-span-5' + (cepResolvido ? ' opacity-60' : '')}
                        placeholder={t('cadastro.endereco')}
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      autoComplete="street-address"
                      disabled={cepResolvido}
                    />
                    <label className="contents">
                      <span className="sr-only">{t('cadastro.numero')}</span>
                      <input
                        className={inputClassCompact + ' col-span-12 sm:col-span-2'}
                        aria-label={t('cadastro.numero')}
                        title={t('cadastro.numero')}
                        placeholder={t('cadastro.numero')}
                        value={form.addressNumber}
                        onChange={(e) => setForm({ ...form, addressNumber: e.target.value })}
                        inputMode="numeric"
                        autoComplete="address-line2"
                        required
                        onInvalid={(e) => e.currentTarget.setCustomValidity(t('cadastro.campo_obrigatorio'))}
                        onInput={(e) => e.currentTarget.setCustomValidity('')}
                      />
                    </label>
                    <input
                      className={inputClassCompact + ' col-span-12 sm:col-span-3'}
                      aria-label={t('cadastro.complemento')}
                      title={t('cadastro.complemento')}
                      placeholder={t('cadastro.complemento')}
                      value={form.addressComplement}
                      onChange={(e) => setForm({ ...form, addressComplement: e.target.value })}
                      autoComplete="address-line2"
                    />

                    {/* Linha 5: Bairro | Cidade | País | Estado */}
                    <input
                      className={inputClassCompact + ' col-span-12 sm:col-span-3'}
                      aria-label={t('cadastro.bairro')}
                      title={t('cadastro.bairro')}
                      placeholder={t('cadastro.bairro')}
                      value={form.neighborhood || ''}
                      onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                      autoComplete="address-level3"
                    />
                    {form.country === 'BR' ? (
                      <div className="relative col-span-12 sm:col-span-3">
                        <select
                          className={selectClassCompact + ' w-full' + (cepResolvido ? ' opacity-60' : '')}
                          value={form.city}
                          onChange={(e) => setForm({ ...form, city: e.target.value })}
                          disabled={cepResolvido || !form.state || citiesLoading}
                          aria-label={t('cadastro.cidade')}
                          required
                        >
                          <option value="">
                            {cepResolvido ? form.city || t('cadastro.cidade_placeholder') : !form.state ? t('cadastro.cidade_escolha_estado_primeiro') : citiesLoading ? t('loading') : t('cadastro.cidade_placeholder')}
                          </option>
                          {form.city && !cityOptions.includes(form.city) && <option value={form.city}>{form.city}</option>}
                          {cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                      </div>
                    ) : (
                      <input
                        className={inputClassCompact + ' col-span-12 sm:col-span-3'}
                        placeholder={t('cadastro.cidade')}
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                      />
                    )}
                    <div className="relative col-span-12 sm:col-span-3">
                      <select
                        className={selectClassCompact + ' w-full'}
                        value={form.country}
                        onChange={(e) => setForm({
                          ...form,
                          country: e.target.value,
                          state: e.target.value === 'BR' ? form.state : '',
                          city: e.target.value === 'BR' ? form.city : '',
                        })}
                        aria-label={t('cadastro.pais')}
                      >
                        {countryOptions.map(({ code, name, flag }) => (
                          <option key={code} value={code}>{flag} {name}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                    </div>
                    {form.country === 'BR' ? (
                      <div className="relative col-span-12 sm:col-span-3">
                        <select
                          className={selectClassCompact + ' w-full' + (cepResolvido ? ' opacity-60' : '')}
                          value={form.state}
                          onChange={(e) => setForm({ ...form, state: e.target.value, city: '' })}
                          aria-label={t('cadastro.estado')}
                          required
                          disabled={cepResolvido}
                        >
                          <option value="">{t('cadastro.estado')}</option>
                          {brazilianStates.map(([uf, name]) => <option key={uf} value={uf}>{name}</option>)}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                      </div>
                    ) : (
                      <input
                        className={inputClassCompact + ' col-span-12 sm:col-span-3'}
                        placeholder={t('cadastro.estado')}
                        value={form.state}
                        onChange={(e) => setForm({ ...form, state: e.target.value })}
                        aria-label={t('cadastro.estado')}
                      />
                    )}

                    {/* Linha 6: WhatsApp | Confirmar WhatsApp */}
                    <input
                      className={inputClassCompact + ' col-span-12 sm:col-span-6'}
                      aria-label={t('cadastro.celular')}
                      title={t('cadastro.celular')}
                      placeholder={t('cadastro.celular')}
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      autoComplete="tel"
                      required
                    />
                    <input
                      className={inputClassCompact + ' col-span-12 sm:col-span-6'}
                      aria-label={t('cadastro.celular_confirmar')}
                      title={t('cadastro.celular_confirmar')}
                      placeholder={t('cadastro.celular_confirmar')}
                      value={form.phoneConfirm}
                      onChange={(e) => setForm({ ...form, phoneConfirm: e.target.value })}
                      autoComplete="tel"
                      required
                    />

                    {cepMessage && (
                      <p role="alert" className="col-span-12 -mt-2 text-[11px] text-slate-300">{cepMessage}</p>
                    )}
                  </div>
                </>
              )}

              {!isRegister && (
                <input
                  className={inputClass}
                  placeholder={t('auth.email')}
                  type="text"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  autoComplete="email"
                  required
                />
              )}

              {/* Senha e confirmação: na mesma linha no cadastro */}
              {(!isRegister || registrationStep === 'details') && <div className={isRegister ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : ''}>
                <div className="relative">
                <input
                  className={(isRegister ? inputClassCompact : inputClass) + ' pr-11'}
                  placeholder={t('cadastro.senha')}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                </div>
                {isRegister && registrationStep === 'details' && (
                  <div className="relative">
                    <input
                      className={inputClassCompact + ' pr-11'}
                      placeholder={t('cadastro.senha_confirmar')}
                      type={showPasswordConfirm ? 'text' : 'password'}
                      value={form.passwordConfirm}
                      onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                      tabIndex={-1}
                    >
                      {showPasswordConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                )}
              </div>}

              {/* Forca da senha — barra horizontal com fim visivel (sem spinner) */}
              {isRegister && registrationStep === 'details' && form.password.length > 0 && (() => {
                const score = passwordScore(form.password);
                const labels = ['Fraca', 'Fraca', 'Media', 'Boa', 'Forte'];
                const colors = ['#E70B5F', '#E70B5F', '#FFB020', '#00E0A8', '#00A86B'];
                return (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div style={{ width: `${(score / 4) * 100}%`, background: colors[score] }}
                        className="h-full transition-all" />
                    </div>
                    <p className="text-xs" style={{ color: colors[score] }}>Senha {labels[score]}</p>
                  </div>
                );
              })()}



              {formError && (
                <p role="alert" aria-live="assertive" className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
                  {formError}
                </p>
              )}

              {!isRegister && (
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} />
                  <span>Continuar conectado neste dispositivo</span>
                </label>
              )}

              <button
                className="mt-4 w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-slate-950/60 hover:bg-emerald-400 active:scale-[0.98] transition-all disabled:opacity-50"
                type="submit"
                disabled={registrationLoading || loggingIn}
              >
                {registrationLoading || loggingIn
                  ? (isRegister ? 'Criando sua conta' : 'Entrando')
                  : isRegister
                  ? t('auth.button.register')
                  : t('auth.button.enter')}
              </button>
            </form>

            {/* Troca de modo */}
            <div className="mt-5 border-t border-slate-800 pt-5 text-center text-sm text-slate-500">
              {isRegister ? (
                <>
                  {t('auth.has.account')}{' '}
                  <button
                    className="text-slate-300 underline underline-offset-2 hover:text-primary transition-colors"
                    onClick={() => { setMode('login'); restartRegistration(); }}
                  >
                    {t('auth.enter.link')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="text-slate-300 underline underline-offset-2 hover:text-primary transition-colors"
                    onClick={() => setShowForgot(true)}
                  >
                    {t('auth.forgot')}
                  </button>
                  <div className="mt-3 text-xs text-slate-600">
                    <button
                      type="button"
                      className="text-slate-300 underline underline-offset-2 hover:text-primary transition-colors"
                      onClick={goToRegister}
                    >
                      {t('auth.new.register')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          </>
          )}
        </motion.div>
      </div>
    </AuthShell>
  );
}

// ─── Verificação por WhatsApp ────────────────────────────────────────────────

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

interface PhoneVerificationProps {
  role: 'client' | 'delivery';
  storageKey: string;
  title: string;
  subtitle: string;
  inviteToken?: string;
  onVerified: (token: string) => void;
}

function PhoneVerification({ role, storageKey, title, subtitle, inviteToken, onVerified }: PhoneVerificationProps) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState('');
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);

  const normalizedPhone = '+55' + phone.replace(/\D/g, '');

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro ao enviar código.'); return; }
      if (data.devCode) setDevCode(data.devCode);
      setStep('code');
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length < 6) { setError('Digite os 6 dígitos.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone, code: fullCode, role, name: name || undefined, inviteToken }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Código incorreto.'); return; }
      window.localStorage.setItem(storageKey, data.token);
      onVerified(data.token);
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeInput = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    if (digit && index < 5) setTimeout(() => codeRefs.current[index + 1]?.focus(), 10);
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex flex-1 items-start justify-center pt-8 pb-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15">
            <MessageCircle size={22} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-slate-950/60">
          <AnimatePresence mode="wait">
            {step === 'phone' ? (
              <motion.form
                key="phone"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                onSubmit={sendCode}
                className="space-y-3"
              >
                {role === 'delivery' && (
                  <input
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
                    placeholder="Seu nome completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                )}
                <div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 focus-within:border-emerald-500 transition-colors">
                    <span className="text-sm text-slate-500 select-none">🇧🇷 +55</span>
                    <input
                      className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                      placeholder="(00) 00000-0000"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      inputMode="tel"
                      required
                    />
                  </div>
                </div>
                {error && <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{error}</p>}
                <button
                  className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 active:scale-[0.98] transition-all disabled:opacity-50"
                  type="submit"
                  disabled={loading || phone.replace(/\D/g, '').length < 10}
                >
                  {loading ? 'Enviando...' : 'Receber código no WhatsApp'}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="code"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={verifyCode}
                className="space-y-4"
              >
                <div className="text-center text-sm text-slate-400">
                  Código enviado para <span className="font-medium text-slate-200">{phone}</span>
                </div>
                {devCode && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-400">
                    Modo dev — código: <span className="font-mono font-bold">{devCode}</span>
                  </div>
                )}
                <div className="flex justify-center gap-2">
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { codeRefs.current[i] = el; }}
                      className="h-12 w-10 rounded-xl border border-slate-800 bg-slate-900 text-center text-lg font-semibold text-slate-100 focus:border-emerald-500 focus:outline-none transition-colors"
                      value={digit}
                      onChange={(e) => handleCodeInput(i, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(i, e)}
                      inputMode="numeric"
                      maxLength={1}
                    />
                  ))}
                </div>
                {error && <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{error}</p>}
                <button
                  className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 active:scale-[0.98] transition-all disabled:opacity-50"
                  type="submit"
                  disabled={loading || code.join('').length < 6}
                >
                  {loading ? 'Verificando...' : 'Entrar'}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  onClick={() => { setStep('phone'); setCode(['', '', '', '', '', '']); setError(''); setDevCode(''); }}
                >
                  <ArrowLeft size={12} /> Trocar número
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function usePhoneAuth(storageKey: string) {
  const [token, setToken] = useState<string | null>(() => window.localStorage.getItem(storageKey));
  const logout = () => {
    window.localStorage.removeItem(storageKey);
    setToken(null);
  };
  return { token, setToken, logout };
}

// ─── Role Shell ──────────────────────────────────────────────────────────────

function RoleShell({ title, description, children, onLogout }: { title: string; description: string; children: React.ReactNode; onLogout?: () => void }) {
  const [, setLocation] = useLocation();

  return (
    <AuthShell>
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Piloto operacional</p>
            <h2 className="text-2xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-slate-400">{description}</p>
          </div>
          <div className="flex gap-2">
            {onLogout && (
              <button className="rounded-full bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700 transition-colors" onClick={onLogout}>Sair</button>
            )}
            <button className="rounded-full bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700 transition-colors" onClick={() => setLocation('/painel')}>Voltar ao painel</button>
          </div>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </AuthShell>
  );
}

function ClientRoute() {
  const { token, setToken, logout } = usePhoneAuth('miar-client-token');

  if (!token) {
    return (
      <AuthShell>
        <PhoneVerification
          role="client"
          storageKey="miar-client-token"
          title="Acesse o cardápio"
          subtitle="Confirme seu WhatsApp para fazer pedidos. Na próxima visita, entra direto."
          onVerified={setToken}
        />
      </AuthShell>
    );
  }

  return (
    <RoleShell title="Cliente" description="Cardápio, checkout e confirmação do pedido." onLogout={logout}>
      <ClientExperience />
    </RoleShell>
  );
}

function KitchenRoute() {
  return (
    <RoleShell title="Cozinha" description="Visualização KDS com fluxo de preparo e entrega.">
      <KitchenView />
    </RoleShell>
  );
}

function CashierRoute() {
  return (
    <RoleShell title="Caixa / Garçom" description="Recebimento, confirmação e atendimento do pedido.">
      <CashierView />
    </RoleShell>
  );
}

// Substituído (20/08/2026): o DeliveryView antigo (em operational-views.tsx)
// era um componente de demonstração com login próprio desconectado — pedia
// token de novo mesmo depois do WhatsApp já ter confirmado, e buscava
// pedidos sem autenticação nenhuma. Mesmo padrão de bug já corrigido hoje
// no ClientExperience do Garçom. Esse aqui usa o token real que o
// PhoneVerification acabou de gerar (localStorage 'miar-delivery-token'),
// chamando as mesmas rotas já testadas hoje (/api/orders, PATCH .../status).
interface DeliveryOrder {
  id: string;
  customerName?: string;
  address?: string;
  vehiclePlate?: string;
  mode: string;
  status: string;
  total?: number;
}

function DeliveryView() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const token = window.localStorage.getItem('miar-delivery-token') ?? '';

  const carregar = async () => {
    setLoading(true);
    setErro('');
    try {
      const res = await fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Não foi possível carregar as entregas.');
      const data = (await res.json()) as DeliveryOrder[];
      // Entregador vê pedidos de delivery prontos ou já em rota — não mistura
      // com pedido de mesa/drive-thru, que são outros perfis.
      setOrders(data.filter((o) => o.mode === 'delivery' && (o.status === 'ready' || o.status === 'delivering')));
    } catch {
      setErro('Não foi possível carregar as entregas. Tenta de novo em instantes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void carregar(); }, []);

  const avancar = async (order: DeliveryOrder, status: string) => {
    await fetch(`/api/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    await carregar();
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Entregador</p>
      <h2 className="mt-2 text-2xl font-semibold">Aceite a corrida e acompanhe o status</h2>

      {erro && <p className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">{erro}</p>}
      {loading && <p className="mt-4 text-sm text-slate-400">Carregando entregas...</p>}

      {!loading && orders.length === 0 && !erro && (
        <p className="mt-4 text-sm text-slate-400">Nenhuma entrega pronta no momento.</p>
      )}

      <div className="mt-4 space-y-2">
        {orders.map((order) => (
          <div key={order.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-slate-100">{order.customerName ?? 'Cliente'} • {order.address ?? 'Endereço não informado'}</p>
              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs uppercase">{order.status === 'ready' ? 'Pronto' : 'Em rota'}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {order.status === 'ready' && (
                <button className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950" onClick={() => void avancar(order, 'delivering')}>
                  Aceitar corrida
                </button>
              )}
              {order.status === 'delivering' && (
                <button className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300" onClick={() => void avancar(order, 'delivered')}>
                  Entregue
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeliveryRoute() {
  const [, setLocation] = useLocation();
  const { token, setToken, logout } = usePhoneAuth('miar-delivery-token');
  // Captura invite token da query string (?token=emp-xxx)
  const inviteToken = new URLSearchParams(window.location.search).get('token') ?? undefined;

  if (!token) {
    return (
      <AuthShell>
        <PhoneVerification
          role="delivery"
          storageKey="miar-delivery-token"
          title="Acesso do entregador"
          subtitle="Confirme seu WhatsApp para ativar seu acesso. Convite recebido do restaurante."
          inviteToken={inviteToken}
          onVerified={setToken}
        />
      </AuthShell>
    );
  }

  return (
    <RoleShell title="Entregador" description="Aceite, corrida e fechamento da entrega." onLogout={logout}>
      <DeliveryView />
    </RoleShell>
  );
}

// ── página ativa por quadrante: 0=pg1 1=pg2 2=pg4 ──────────────────────────
const Q_PAGES = [1, 2, 4] as const;
type QPage = (typeof Q_PAGES)[number];

function Quadrant({
  label,
  color = 'text-emerald-400',
  page,
  onPrev,
  onNext,
  children,
}: {
  label: string;
  color?: string;
  page: QPage;
  onPrev: () => void;
  onNext: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden border-slate-800">
      {/* barra superior do quadrante */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/70 px-3 py-1.5">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${color}`}>{label}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors"
          >
            ←
          </button>
          <div className="flex items-center gap-1.5">
            {Q_PAGES.map((p) => (
              <span
                key={p}
                className={`text-xs font-bold tabular-nums transition-colors ${
                  p === page ? `${color} scale-110` : 'text-slate-600'
                }`}
              >
                {p}
              </span>
            ))}
          </div>
          <button
            onClick={onNext}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors"
          >
            →
          </button>
        </div>
      </div>
      {/* conteúdo rolável */}
      <div className="flex-1 overflow-y-auto p-3">{children}</div>
    </div>
  );
}

function PainelLogo({ me }: { me: any }) {
  const storedLogo = useCompanyLogo();
  const apiLogo = me?.company?.logoUrl ?? '';
  const logo = apiLogo || storedLogo;
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-emerald-500/20 text-sm">
      {logo ? <img src={logo} alt="Logo" className="h-full w-full object-contain" /> : '🍽'}
    </div>
  );
}

// CORRIGIDO 30/07/2026 — reconstrução da Central de operação (já tinha
// existido antes em 25/07, se perdeu numa troca de instância do Replit).
// Cada painel mostra só um rótulo e uma seta; a seta abre um overlay com
// todos os menus organizados em 5 grupos. O usuário escolhe o layout
// (1, 2 ou 4 painéis) no cabeçalho do Dashboard.

const PAINEIS: { label: string; accent: string; textColor: string }[] = [
  { label: 'Painel 1', accent: 'bg-emerald-500', textColor: 'text-emerald-700 dark:text-emerald-300' },
  { label: 'Painel 2', accent: 'bg-sky-500', textColor: 'text-sky-700 dark:text-sky-300' },
  { label: 'Painel 3', accent: 'bg-amber-500', textColor: 'text-amber-700 dark:text-amber-300' },
  { label: 'Painel 4', accent: 'bg-fuchsia-500', textColor: 'text-fuchsia-700 dark:text-fuchsia-300' },
];

const GRUPOS_MENU: { titulo: string; itens: { href: string; label: string }[] }[] = [
  {
    titulo: 'Apps Operacionais',
    itens: [
      { href: '/cliente', label: 'Cliente' },
      { href: '/cozinha', label: 'Cozinha' },
      { href: '/caixa', label: 'Caixa' },
      { href: '/central-comando', label: 'Garçom e Central de Operação' },
      { href: '/entregador', label: 'Entregador' },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [
      { href: '/funcionarios', label: 'Funcionários' },
      { href: '/mesas', label: 'Mesas e QR' },
      { href: '/minha-ia', label: 'Minha IA' },
      { href: '/compras', label: 'Compras' },
      { href: '/fornecedores', label: 'Fornecedores' },
      { href: '/estoque', label: 'Estoque' },
      { href: '/fiado', label: 'Fiado' },
      { href: '/seguranca-rede', label: 'Verificação de Segurança' },
      { href: '/ficha-tecnica', label: 'Ficha Técnica' },
      { href: '/catalogo', label: 'Catálogo' },
      { href: '/rentabilidade', label: 'Rentabilidade' },
      { href: '/seguranca', label: 'Configurações' },
      { href: '/registro', label: 'Registro' },
    ],
  },
  {
    titulo: 'Análises & Operação',
    itens: [
      { href: '/feed', label: 'Feed' },
      { href: '/demanda', label: 'Motor de Demanda' },
      { href: '/rede-local', label: 'Rede Local' },
      { href: '/marketing', label: 'Marketing IA' },
      { href: '/apresentacao', label: 'Apresentação' },
    ],
  },
  {
    titulo: 'Configurações',
    itens: [
      { href: '/onboarding/estabelecimento', label: 'Estabelecimento' },
      { href: '/onboarding/produtos', label: 'Produtos' },
      { href: '/onboarding/usuarios', label: 'Usuários' },
      { href: '/onboarding/segmento', label: 'Segmento' },
      { href: '/jornada', label: 'Jornada' },
      { href: '/convite-entregador', label: 'Convidar Entregador' },
      { href: '/atalhos', label: 'Atalhos' },
    ],
  },
  {
    titulo: 'IA & Ferramentas',
    itens: [
      { href: '/miar-edita', label: 'MIAR AI EDITA' },
      { href: '/mia', label: 'MIAR' },
      { href: '/miar-intro', label: 'Miar Intro' },
      { href: '/estoque/auditoria', label: 'Auditoria de Estoque' },
      { href: '/estoque/codigo-barras', label: 'Código de Barras' },
      { href: '/camera-local', label: 'Câmera Local' },
      { href: '/drive-thru', label: 'Drive-thru' },
    ],
  },
];

function SimplePanel({ label, accent, textColor, maximized, onMaximize, refCallback, showModuleHeader }: { label: string; accent: string; textColor: string; maximized?: boolean; onMaximize: () => void; refCallback: (el: HTMLDivElement | null) => void; showModuleHeader: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [moduloAtivo, setModuloAtivo] = useState<{ href: string; label: string } | null>(null);
  return (
    <div ref={refCallback} className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
          <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
          <span className={`${textColor}`}>{label}</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onMaximize}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium shadow-sm transition ${
              maximized
                ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-400'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
            title={maximized ? 'Restaurar painel' : 'Maximizar painel'}
            aria-pressed={maximized}
          >
            {maximized ? '⬜' : '⛶'}
          </button>
          <LojaSwitcher compact />
          <button
            onClick={() => setAberto(true)}
            className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-200 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-700"
            aria-label={`Abrir módulos de ${label}`}
          >
            Módulos <ChevronDown size={12} />
          </button>
        </div>
      </div>

      {moduloAtivo && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-slate-200 dark:border-slate-800">
          {showModuleHeader && <div className="flex shrink-0 items-center justify-between gap-2 bg-slate-50 px-3 py-2 dark:bg-slate-900">
            <span className="truncate text-xs font-semibold text-[#34271d] dark:text-slate-200">{moduloAtivo.label}</span>
            <button type="button" onClick={() => setModuloAtivo(null)} className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[#34271d] hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800">
              <ArrowLeft size={13} /> Voltar ao painel
            </button>
          </div>}
          <iframe
            title={`${moduloAtivo.label} no ${label}`}
            src={moduloAtivo.href}
            className="min-h-0 flex-1 border-0 bg-white dark:bg-slate-950"
          />
        </div>
      )}

      {aberto && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setAberto(false)} />
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20">
            <div
              className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-[#fffdfb] p-5 text-[#34271d] shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-[#34271d] dark:text-slate-100">Módulos — {label}</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAberto(false)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#34271d] shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <ArrowLeft size={13} />
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAberto(false)}
                    aria-label="Fechar módulos"
                    title="Fechar módulos"
                    className="rounded-full p-1.5 text-[#34271d] hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {GRUPOS_MENU.map((grupo) => (
                  <div key={grupo.titulo}>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#645348] dark:text-slate-500">{grupo.titulo}</p>
                    <div className="space-y-1">
                      {grupo.itens.map((item) => (
                        <button
                          type="button"
                          key={item.href}
                          onClick={() => { setModuloAtivo(item); setAberto(false); }}
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[#34271d] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Dashboard() {
  const { data: me, isPending: meLoading, isError: meError } = useGetMe();
  const [, setLocation] = useLocation();

  // CORRIGIDO 08/08/2026: ao chegar de fato no painel (seja concluindo o
  // onboarding, seja pulando com "Fazer isso depois"), limpa a flag de
  // onboarding pendente — daqui pra frente reabrir o app vai direto pro
  // painel normalmente, sem ficar preso voltando pro onboarding pra sempre.
  useEffect(() => {
    window.localStorage.removeItem('miar-onboarding-pending');
  }, []);

  // CORRIGIDO 30/07/2026: substituído o carrossel de 4 quadrantes fixos por
  // um layout configurável (1, 2 ou 4 painéis), lembrado em localStorage.
  const [layout, setLayout] = useState<1 | 2 | 4>(() => {
    const saved = Number(window.localStorage.getItem('miar-painel-layout-v2'));
    return saved === 1 || saved === 2 || saved === 4 ? (saved as 1 | 2 | 4) : 4;
  });
  const [maximizedPanel, setMaximizedPanel] = useState<number | null>(null);
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);

  const toggleMaximize = useCallback((index: number) => {
    setMaximizedPanel((current) => (current === index ? null : index));
  }, []);

  useEffect(() => {
    window.localStorage.setItem('miar-painel-layout-v2', String(layout));
  }, [layout]);

  useEffect(() => {
    if (meError) setLocation('/');
  }, [meError, setLocation]);

  // ── estado de dados ──
  const [addressKey, setAddressKey] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical'>('warning');
  const [items, setItems] = useState<Array<{ id: string; note: string; tags: string; severity: string; addressKey: string; createdAt: string }>>([]);
  const [profiles, setProfiles] = useState<Array<{ employeeId: string; employeeName: string; negativeEvents: number; penaltyStatus: string; suspensionUntil?: string; lastIncidentAt?: string; incidents: Array<{ reason: string; notes?: string; createdAt: string; severity: string }> }>>([]);
  const [config, setConfig] = useState({ active: true, warningThreshold: 1, suspensionThreshold: 2, banThreshold: 3, suspensionDays: 48, requireAudit: true });
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [incidentReason, setIncidentReason] = useState('');
  const [incidentNotes, setIncidentNotes] = useState('');
  const [incidentSeverity, setIncidentSeverity] = useState<'info' | 'warning' | 'critical'>('warning');
  const [workflowOrders, setWorkflowOrders] = useState<Array<{ id: string; restaurantName: string; customerName: string; mode: string; status: string; total: number; createdAt: string }>>([]);

  const traduzirStatus = (s: string) => ({ received: 'Recebido', confirmed: 'Confirmado', preparing: 'Em preparo', ready: 'Pronto', delivering: 'Em rota', completed: 'Entregue', cancelled: 'Cancelado', pending: 'Pendente' }[s] ?? s);
  const traduzirModo = (m: string) => ({ delivery: 'Entrega', pickup: 'Retirada', 'dine-in': 'No local' }[m] ?? m);
  const traduzirPenalidade = (p: string) => ({ banned: 'Banido', suspension: 'Suspenso', warning: 'Advertência', ok: 'Regular', active: 'Regular' }[p] ?? p);

  const logout = () => {
    window.localStorage.removeItem('miar-owner-token');
    setLocation('/');
  };

  const loadObservations = async () => {
    const token = getStoredToken();
    const response = await fetch('/api/delivery-observations', { headers: { Authorization: `Bearer ${token ?? ''}` } });
    if (response.ok) {
      const data = await response.json();
      setItems(data.map((item: any) => ({ id: item.id, note: item.note, tags: item.tags.join(', '), severity: item.severity, addressKey: item.addressKey, createdAt: new Date(item.createdAt).toLocaleString('pt-BR') })));
    }
  };

  const loadGovernance = async () => {
    const token = getStoredToken();
    const [pr, cr] = await Promise.all([
      fetch('/api/delivery-governance/profiles', { headers: { Authorization: `Bearer ${token ?? ''}` } }),
      fetch('/api/delivery-governance/config', { headers: { Authorization: `Bearer ${token ?? ''}` } }),
    ]);
    if (pr.ok) setProfiles(await pr.json());
    if (cr.ok) setConfig(await cr.json());
  };

  const loadWorkflowOrders = async () => {
    const token = getStoredToken();
    const r = await fetch('/api/operational-workflow/orders', { headers: { Authorization: `Bearer ${token ?? ''}` } });
    if (r.ok) setWorkflowOrders(await r.json());
  };

  useEffect(() => {
    void loadObservations();
    void loadGovernance();
    void loadWorkflowOrders();
  }, []);

  const saveObservation = async () => {
    const token = getStoredToken();
    const r = await fetch('/api/delivery-observations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
      body: JSON.stringify({ addressKey: addressKey.trim(), addressText: addressKey.trim(), note, tags: tags.split(',').map((t) => t.trim()).filter(Boolean), severity, internalOnly: true }),
    });
    if (r.ok) { setAddressKey(''); setNote(''); setTags(''); setSeverity('warning'); await loadObservations(); }
  };

  const saveIncident = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = getStoredToken();
    const r = await fetch('/api/delivery-governance/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
      body: JSON.stringify({ employeeId: employeeId.trim(), employeeName: employeeName.trim() || undefined, reason: incidentReason.trim(), notes: incidentNotes.trim() || undefined, severity: incidentSeverity }),
    });
    if (r.ok) { setEmployeeId(''); setEmployeeName(''); setIncidentReason(''); setIncidentNotes(''); setIncidentSeverity('warning'); await loadGovernance(); }
  };

  const saveConfig = async () => {
    const token = getStoredToken();
    const r = await fetch('/api/delivery-governance/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
      body: JSON.stringify(config),
    });
    if (r.ok) setConfig(await r.json());
  };

  if (meLoading) {
    return (
      <div translate="no" className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <p className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-4 text-sm text-slate-300">
          Carregando seu painel...
        </p>
      </div>
    );
  }

  if (meError || !me) {
    return (
      <div translate="no" className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <h1 className="text-lg font-semibold">Sessão não encontrada</h1>
          <p className="mt-2 text-sm text-slate-400">Entre novamente para acessar o painel gestor.</p>
          <button
            type="button"
            onClick={() => setLocation('/')}
            className="mt-5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Voltar para entrar
          </button>
        </div>
      </div>
    );
  }

  // ── classes de input/select reutilizáveis ──
  const inp = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-500';
  const btn = (variant: 'primary' | 'ghost') =>
    variant === 'primary'
      ? 'rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-emerald-400 transition-colors'
      : 'rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors';

  return (
    <div translate="no" className="flex h-screen flex-col overflow-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* ── Cabeçalho global ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 py-2">
        <div className="flex items-center gap-3">
          <PainelLogo me={me} />
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-500 dark:text-emerald-400">Miar Gestor</p>
            <p className="text-sm font-semibold leading-none">{me?.restaurantName ?? 'Restaurante'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
            {([1, 2, 4] as const).map((n) => (
              <button
                key={n}
                onClick={() => setLayout(n)}
                className={`h-7 w-7 rounded text-xs font-bold transition-colors ${
                  layout === n ? 'bg-emerald-500 text-slate-950' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                aria-label={`${n} painel${n > 1 ? 'éis' : ''}`}
                title={`${n} painel${n > 1 ? 'éis' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>
          <MiaVisibilityToggle />
          <ThemeToggle />
          <button className={btn('ghost')} onClick={logout}>Sair</button>
        </div>
      </header>

      {/* ── Grade de painéis: 1, 2 ou 4, conforme o seletor ── */}
      <div
        className={`grid flex-1 divide-x divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden ${
          maximizedPanel !== null ? 'grid-cols-1 grid-rows-1'
          : layout === 1 ? 'grid-cols-1 grid-rows-1'
          : layout === 2 ? 'grid-cols-2 grid-rows-1'
          : 'grid-cols-2 grid-rows-2'
        }`}
      >
        {(maximizedPanel !== null ? [PAINEIS[maximizedPanel]] : PAINEIS.slice(0, layout)).map((p, index) => {
          const panelIndex = maximizedPanel !== null ? maximizedPanel : index;
          return (
            <SimplePanel
              key={p.label}
              label={p.label}
              accent={p.accent}
              textColor={p.textColor}
              maximized={maximizedPanel === panelIndex}
              onMaximize={() => toggleMaximize(panelIndex)}
              showModuleHeader={layout === 1}
              refCallback={(el) => { panelRefs.current[panelIndex] = el; }}
            />
          );
        })}
      </div>

    </div>
  );
}

function SegmentRoute() {
  const [, setLocation] = useLocation();
  return (
    <AuthShell>
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Onboarding inteligente · 1/4</p>
            <h2 className="text-2xl font-semibold">Configuração por segmento</h2>
          </div>
          <Link href="/painel" className="rounded-full bg-slate-800 px-3 py-2 text-sm">← Voltar ao painel</Link>
        </div>
        <SegmentOnboarding />
        {/* CORRIGIDO 30/07/2026: fecha o fluxo linear segmento -> usuários */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setLocation('/onboarding/usuarios')}
            className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Próximo: Usuários →
          </button>
        </div>
      </div>
    </AuthShell>
  );
}

function BarcodeRoute() {
  return (
    <AuthShell>
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Estoque</p>
            <h2 className="text-2xl font-semibold">Códigos de barras</h2>
          </div>
          <Link href="/painel" className="rounded-full bg-slate-800 px-3 py-2 text-sm">← Painel</Link>
        </div>
        <BarcodePanel />
      </div>
    </AuthShell>
  );
}

function MarketingRoute() {
  return (
    <AuthShell>
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Marketing IA</p>
            <h2 className="text-2xl font-semibold">Gerador de campanhas</h2>
          </div>
          <Link href="/painel" className="rounded-full bg-slate-800 px-3 py-2 text-sm">← Painel</Link>
        </div>
        <MarketingPanel />
      </div>
    </AuthShell>
  );
}

function StockAuditRoute() {
  return (
    <AuthShell>
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Auditoria de estoque</p>
            <h2 className="text-2xl font-semibold">Câmera ao vivo</h2>
          </div>
          <Link href="/painel" className="rounded-full bg-slate-800 px-3 py-2 text-sm">← Painel</Link>
        </div>
        <StockAuditCamera />
      </div>
    </AuthShell>
  );
}

function Router() {
  // O painel não deve criar uma sessão falsa automaticamente. Isso fazia a
  // tela inicial pular o cadastro do gestor e ainda enviava chamadas com o
  // token "dev-bypass", que a API rejeita.
  useEffect(() => {
    setAuthTokenGetter(() => getStoredToken() ?? '');
    // "Manter conectado" (16/08/2026) — o mecanismo já existia pronto e
    // testado em lib/api-client-react (startTokenRefreshLoop), só nunca
    // tinha sido chamado em nenhum app. Renova o token a cada 90min
    // enquanto o app estiver aberto, pra sessão de 2h nunca expirar no
    // meio do expediente sem precisar logar de novo.
    setAuthTokenSetter((novoToken: string | null | undefined) => {
      if (novoToken) window.localStorage.setItem('miar-owner-token', novoToken);
    });
    const stopRefreshLoop = startTokenRefreshLoop({ intervalMs: 90 * 60 * 1000 });
    return stopRefreshLoop;
  }, []);

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/termos" component={TermosPage} />
      <Route path="/privacidade" component={PrivacidadePage} />
      <Route path="/painel" component={Dashboard} />
      <Route path="/apresentacao" component={LandingPage} />
      <Route path="/mesas" component={Mesas} />
      <Route path="/minha-ia" component={MinhaIa} />
      <Route path="/catalogo" component={Catalogo} />
            <Route path="/central-comando" component={CentralComando} />
            <Route path="/funcionarios" component={Funcionarios} />
            <Route path="/seguranca" component={Seguranca} />
            <Route path="/rede-local" component={RedeLocal} />
            <Route path="/compras" component={Compras} />
            <Route path="/fornecedores" component={Fornecedores} />
            <Route path="/estoque" component={Estoque} />
            <Route path="/fiado" component={FiadoPage} />
            <Route path="/seguranca-rede" component={SegurancaRede} />
            <Route path="/atalhos" component={AtalhosPage} />
            <Route path="/camera-local" component={CameraLocal} />
            <Route path="/drive-thru" component={DriveThruPage} />
            <Route path="/feed" component={FeedInterno} />
            <Route path="/mural-empregos" component={MuralEmpregos} />
            <Route path="/publicar-feed" component={PublicarFeed} />
            <Route path="/reclamacoes" component={ComplaintsPage} />
            <Route path="/motor-demanda" component={MotorDemanda} />
            <Route path="/demanda" component={MotorDemanda} />
      <Route path="/convite-entregador" component={ConviteEntregador} />
      <Route path="/registro" component={RegistroProtegido} />
      <Route path="/bem-vindo" component={PosCadastro} />
      <Route path="/onboarding/usuarios" component={OnboardingUsuarios} />
      <Route path="/jornada" component={JornadaConfiguracao} />
      <Route path="/onboarding/estabelecimento" component={OnboardingEstabelecimento} />
      <Route path="/onboarding/produtos" component={OnboardingProdutos} />
      <Route path="/cliente" component={ClientRoute} />
      <Route path="/cozinha" component={KitchenRoute} />
      <Route path="/caixa" component={CashierRoute} />
      <Route path="/entregador" component={DeliveryRoute} />
      <Route path="/onboarding/segmento" component={SegmentRoute} />
      <Route path="/estoque/codigo-barras" component={BarcodeRoute} />
      <Route path="/marketing" component={MarketingRoute} />
      <Route path="/estoque/auditoria" component={StockAuditRoute} />
      <Route path="/miar-intro" component={MIARIntroPage} />
      <Route path="/mia" component={MiaPage} />
      <Route path="/miar-edita" component={MiarEdita} />
      <Route path="/rentabilidade" component={Rentabilidade} />
      <Route path="/ficha-tecnica" component={FichaTecnica} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [passkeyToken, setPasskeyToken] = useState<string | null>(() => window.localStorage.getItem('miar-passkey-pending-token'));

  useEffect(() => {
    const showPrompt = () => setPasskeyToken(window.localStorage.getItem('miar-passkey-pending-token'));
    window.addEventListener('miar-passkey-prompt', showPrompt);
    return () => window.removeEventListener('miar-passkey-prompt', showPrompt);
  }, []);

  const finishPasskeyPrompt = () => {
    window.localStorage.removeItem('miar-passkey-pending-token');
    setPasskeyToken(null);
  };

  return (
    <IdiomaProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <InitialLanguagePrompt />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <InstallPrompt />
          <FloatingChat getToken={() => getStoredToken() ?? ''} />
          <Toaster />
          <ConfigFlutuante />
          {passkeyToken && <PasskeyPrompt token={passkeyToken} onDone={finishPasskeyPrompt} />}
        </TooltipProvider>
      </QueryClientProvider>
    </IdiomaProvider>
  );
}

export default App;
