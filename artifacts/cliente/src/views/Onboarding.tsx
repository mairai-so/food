import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, User, Mail, Phone, Lock, Eye, EyeOff,
  MessageCircle, ArrowLeft, Loader2, CheckCircle2,
} from 'lucide-react';
import { setUser, setOnboarded, setSetupDone, clearSetupDone, setClientToken, clearClientToken } from '../lib/storage';
import { guiaPorVozAtiva, definirGuiaPorVoz, falar, falarSeAtivo } from '../lib/acessibilidade';
import type { UserProfile } from '../types';
import { randomUUID } from '../lib/uuid';

// ─── Tipos de etapa ───────────────────────────────────────────────────────────

type Step =
  | 'welcome'
  | 'choice'
  | 'register'
  | 'login'
  | 'whatsapp-phone'
  | 'whatsapp-otp'
  | 'acessibilidade';

// ─── Perfil local padrão (visitante ou pós-auth) ─────────────────────────────

function makeProfile(overrides: Partial<UserProfile>): UserProfile {
  return {
    id: randomUUID(),
    name: '', email: '', isGuest: false,
    healthConditions: [], nutritionGoals: [],
    dislikedIngredients: [], likedThings: [],
    communicationStyle: 'amigavel',
    shareDataWithRestaurants: true, allowAIMemory: true,
    ...overrides,
  };
}

// ─── Campo de input genérico ──────────────────────────────────────────────────

function Field({
  label, value, onChange, type = 'text', placeholder = '', autoComplete,
  icon: Icon, endSlot,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; autoComplete?: string;
  icon?: React.ElementType; endSlot?: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-stone-500">{label}</p>
      <div className="relative flex items-center">
        {Icon && <Icon className="absolute left-3.5 h-4 w-4 text-stone-400 pointer-events-none" />}
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full rounded-2xl border border-stone-200 bg-white py-3.5 pr-12 text-sm text-stone-900 placeholder-stone-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 ${Icon ? 'pl-10' : 'pl-4'}`}
        />
        {endSlot && <div className="absolute right-3">{endSlot}</div>}
      </div>
    </div>
  );
}

function PasswordField({
  label, value, onChange, autoComplete, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  autoComplete?: string; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Field
      label={label} value={value} onChange={onChange}
      type={show ? 'text' : 'password'}
      placeholder={placeholder ?? '••••••••'}
      autoComplete={autoComplete}
      icon={Lock}
      endSlot={
        <button type="button" onClick={() => setShow(s => !s)} className="text-stone-400 hover:text-stone-600">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  );
}

// ─── Botão de ação principal ──────────────────────────────────────────────────

function PrimaryBtn({
  onClick, loading, disabled, children,
}: {
  onClick?: () => void; loading?: boolean; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-4 text-base font-semibold text-white transition hover:bg-orange-400 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

function SecondaryBtn({
  onClick, children,
}: {
  onClick?: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white py-4 text-base font-medium text-stone-700 transition hover:bg-stone-50"
    >
      {children}
    </button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>('welcome');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [guiaVoz, setGuiaVoz] = useState(() => guiaPorVozAtiva());

  useEffect(() => {
    if (step === 'welcome') {
      falarSeAtivo('Bem-vindo ao MIAR. Descubra restaurantes, faça pedidos, reserve mesas e tenha uma IA no seu bolso para cada refeição.');
    }
  }, [step]);

  // Cadastro
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regGender, setRegGender] = useState<UserProfile['gender'] | ''>('');
  const [regPass, setRegPass] = useState('');
  const [regPassConf, setRegPassConf] = useState('');

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // WhatsApp OTP
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState('');

  const clearErr = () => setError('');

  // ── Visitante ───────────────────────────────────────────────────────────────
  const continueAsGuest = () => {
    clearClientToken();
    setUser(makeProfile({ name: 'Visitante', isGuest: true, id: randomUUID() }));
    setOnboarded();
    onDone();
  };

  // ── Salvar após auth com API ────────────────────────────────────────────────
  const finishWithAuth = (token: string, user: { id: string; name: string; email: string; phone?: string | null; gender?: UserProfile['gender'] | null; shareDataWithRestaurants?: boolean; allowAIMemory?: boolean; onboardingCompleted?: boolean }) => {
    setClientToken(token);
    setUser(makeProfile({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? undefined,
      gender: user.gender ?? undefined,
      isGuest: false,
      shareDataWithRestaurants: user.shareDataWithRestaurants ?? true,
      allowAIMemory: user.allowAIMemory ?? true,
    }));
    setOnboarded();
    if (user.onboardingCompleted) setSetupDone();
    else clearSetupDone();
    onDone();
  };

  // ── Cadastro ────────────────────────────────────────────────────────────────
  const submitRegister = async () => {
    clearErr();
    if (!regName.trim()) { setError('Informe seu nome'); return; }
    if (!regEmail.trim() || !regEmail.includes('@')) { setError('E-mail inválido'); return; }
    if (!regPhone.trim()) { setError('Informe seu telefone'); return; }
    if (!regGender) { setError('Selecione uma opção de gênero'); return; }
    if (regPass.length < 8) { setError('Senha deve ter no mínimo 8 caracteres'); return; }
    if (regPass !== regPassConf) { setError('As senhas não coincidem'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/client/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName.trim(), email: regEmail.trim(), phone: regPhone.trim(), gender: regGender, password: regPass }),
      });
      const data = await res.json() as { token?: string; user?: { id: string; name: string; email: string; phone: string; gender?: UserProfile['gender']; onboardingCompleted?: boolean }; error?: string };
      if (!res.ok) { setError(data.error ?? 'Erro ao criar conta'); return; }
      finishWithAuth(data.token!, data.user!);
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally { setLoading(false); }
  };

  // ── Login com senha ─────────────────────────────────────────────────────────
  const submitLogin = async () => {
    clearErr();
    if (!loginEmail.trim() || !loginEmail.includes('@')) { setError('E-mail inválido'); return; }
    if (!loginPass.trim()) { setError('Informe sua senha'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/client/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPass }),
      });
      const data = await res.json() as { token?: string; user?: { id: string; name: string; email: string; phone: string; gender?: UserProfile['gender']; onboardingCompleted?: boolean }; error?: string };
      if (!res.ok) { setError(data.error ?? 'E-mail ou senha incorretos'); return; }
      finishWithAuth(data.token!, data.user!);
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally { setLoading(false); }
  };

  // ── WhatsApp OTP: enviar código (retorna true se enviou) ────────────────────
  const sendOtp = async (): Promise<boolean> => {
    clearErr();
    if (!otpPhone.trim()) { setError('Informe seu telefone'); return false; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: otpPhone.trim() }),
      });
      const data = await res.json() as { ok?: boolean; devCode?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Não foi possível enviar o código'); return false; }
      setOtpSent(true);
      if (data.devCode) setDevCode(data.devCode);
      return true;
    } catch {
      setError('Falha de conexão. Tente novamente.');
      return false;
    } finally { setLoading(false); }
  };

  // ── WhatsApp OTP: verificar código ─────────────────────────────────────────
  const verifyOtp = async () => {
    clearErr();
    if (otpCode.trim().length !== 6) { setError('Código deve ter 6 dígitos'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: otpPhone.trim(), code: otpCode.trim(), role: 'client' }),
      });
      const data = await res.json() as { token?: string; user?: { id: string; name: string; phone: string }; error?: string };
      if (!res.ok) { setError(data.error ?? 'Código inválido'); return; }
      finishWithAuth(data.token!, {
        id: data.user!.id,
        name: data.user!.name || otpPhone,
        email: '',
        phone: data.user!.phone,
      });
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally { setLoading(false); }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-5 text-stone-900">
      <AnimatePresence mode="wait">

        {/* ── Boas-vindas ── */}
        {step === 'welcome' && (
          <motion.div key="welcome"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="flex w-full max-w-sm flex-col items-center text-center">

            {/* Acessibilidade (16/08/2026, Manual seção 38.1): guia por voz
                aparece logo de cara, pra todo mundo, não escondido em
                configuração — quem é cego não deve depender de outra
                pessoa pra descobrir que a opção existe. */}
            <button
              type="button"
              onClick={() => {
                const novoEstado = !guiaVoz;
                setGuiaVoz(novoEstado);
                definirGuiaPorVoz(novoEstado);
                falar(novoEstado
                  ? 'Guia por voz ativado. Bem-vindo ao MIAR. Toque em qualquer lugar da tela para ouvir a descrição.'
                  : 'Guia por voz desativado.');
              }}
              aria-pressed={guiaVoz}
              className={`mb-6 flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3.5 text-sm font-semibold transition ${
                guiaVoz
                  ? 'border-orange-400 bg-orange-50 text-orange-600'
                  : 'border-stone-300 bg-white text-stone-600'
              }`}
            >
              {guiaVoz ? '🔊 Guia por voz ativado' : '🔈 Ativar guia por voz'}
            </button>

            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-orange-100 text-5xl shadow-sm">
              🍽️
            </div>
            <h1 className="mb-1 text-3xl font-bold tracking-tight text-stone-900">Miar</h1>
            <p className="mb-1 text-lg font-semibold text-orange-500">AI/FOOD</p>
            <p className="mb-10 text-sm text-stone-500">
              Descubra restaurantes, faça pedidos, reserve mesas e tenha uma IA no seu bolso para cada refeição.
            </p>

            <div className="mb-8 w-full text-left">
              <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                Você pode dizer para a IA
              </p>
              <div className="space-y-2">
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-stone-700">
                  <span className="mr-1 font-semibold text-orange-500">"</span>
                  IA, só tenho R$ 20,00 e estou com fome
                  <span className="ml-1 font-semibold text-orange-500">"</span>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
                  <span className="mr-1 font-semibold text-sky-400">"</span>
                  IA, estou atrasado e com fome
                  <span className="ml-1 font-semibold text-sky-400">"</span>
                </div>
              </div>
            </div>

            <PrimaryBtn onClick={() => setStep('choice')}>
              Começar <ChevronRight className="h-5 w-5" />
            </PrimaryBtn>
          </motion.div>
        )}

        {/* ── Escolha ── */}
        {step === 'choice' && (
          <motion.div key="choice"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-sm">
            <h2 className="mb-1 text-2xl font-bold">Acesse o Miar</h2>
            <p className="mb-8 text-sm text-stone-500">
              Crie uma conta ou entre para ter experiência personalizada — histórico, fidelidade e IA adaptada ao seu gosto.
            </p>
            <div className="space-y-3">
              <PrimaryBtn onClick={() => { clearErr(); setStep('register'); }}>
                Criar minha conta
              </PrimaryBtn>
              <SecondaryBtn onClick={() => { clearErr(); setStep('login'); }}>
                Já tenho conta
              </SecondaryBtn>
              <SecondaryBtn onClick={() => { clearErr(); setOtpSent(false); setStep('whatsapp-phone'); }}>
                <MessageCircle className="h-4 w-4 text-green-500" />
                Entrar com WhatsApp
              </SecondaryBtn>
              <button
                onClick={continueAsGuest}
                className="w-full pt-2 text-sm text-stone-400 hover:text-stone-600"
              >
                Continuar sem cadastro
              </button>
            </div>
            <p className="mt-6 text-center text-xs text-stone-400">
              Sem cadastro: você pode ver restaurantes e cardápios.
              <br />Pedidos, favoritos e IA personalizada exigem conta.
            </p>
          </motion.div>
        )}

        {/* ── Cadastro ── */}
        {step === 'register' && (
          <motion.div key="register"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-sm">
            <button onClick={() => { clearErr(); setStep('choice'); }}
              className="mb-5 flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <h2 className="mb-1 text-2xl font-bold">Criar conta</h2>
            <p className="mb-6 text-sm text-stone-500">Seus dados ficam protegidos. Pode completar o perfil depois.</p>

            <div className="space-y-3">
              <Field label="Nome completo" value={regName} onChange={setRegName}
                placeholder="Como você quer ser chamado" autoComplete="name" icon={User} />
              <Field label="E-mail" value={regEmail} onChange={setRegEmail}
                type="email" placeholder="seu@email.com" autoComplete="email" icon={Mail} />
              <Field label="Telefone (WhatsApp)" value={regPhone} onChange={setRegPhone}
                type="tel" placeholder="(11) 99999-9999" autoComplete="tel" icon={Phone} />
              <div>
                <label htmlFor="client-gender" className="mb-1.5 block text-xs font-semibold text-stone-500">Gênero</label>
                <select
                  id="client-gender"
                  value={regGender}
                  onChange={e => setRegGender(e.target.value as UserProfile['gender'])}
                  className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3.5 text-sm text-stone-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20"
                >
                  <option value="">Selecione uma opção</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                  <option value="prefiro-nao-dizer">Prefiro não dizer</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <PasswordField label="Senha" value={regPass} onChange={setRegPass}
                autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
              <PasswordField label="Confirmar senha" value={regPassConf} onChange={setRegPassConf}
                autoComplete="new-password" placeholder="Repita a senha" />
            </div>

            {error && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
            )}

            <div className="mt-5 space-y-3">
              <PrimaryBtn onClick={() => void submitRegister()} loading={loading}>
                Criar conta
              </PrimaryBtn>
              <p className="text-center text-xs text-stone-400">
                Ao criar conta, você aceita os Termos de Uso do Miar.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Login com senha ── */}
        {step === 'login' && (
          <motion.div key="login"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-sm">
            <button onClick={() => { clearErr(); setStep('choice'); }}
              className="mb-5 flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <h2 className="mb-1 text-2xl font-bold">Entrar</h2>
            <p className="mb-6 text-sm text-stone-500">Acesse com e-mail e senha.</p>

            <div className="space-y-3">
              <Field label="E-mail" value={loginEmail} onChange={setLoginEmail}
                type="email" placeholder="seu@email.com" autoComplete="email" icon={Mail} />
              <PasswordField label="Senha" value={loginPass} onChange={setLoginPass}
                autoComplete="current-password" />
            </div>

            {error && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
            )}

            <div className="mt-5 space-y-3">
              <PrimaryBtn onClick={() => void submitLogin()} loading={loading}>
                Entrar
              </PrimaryBtn>
              <SecondaryBtn onClick={() => { clearErr(); setOtpSent(false); setStep('whatsapp-phone'); }}>
                <MessageCircle className="h-4 w-4 text-green-500" />
                Entrar sem senha (WhatsApp)
              </SecondaryBtn>
            </div>
          </motion.div>
        )}

        {/* ── WhatsApp: informar telefone ── */}
        {step === 'whatsapp-phone' && (
          <motion.div key="whatsapp-phone"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-sm">
            <button onClick={() => { clearErr(); setStep('choice'); }}
              className="mb-5 flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-3xl">
              💬
            </div>
            <h2 className="mb-1 text-2xl font-bold">Entrar pelo WhatsApp</h2>
            <p className="mb-6 text-sm text-stone-500">
              Enviaremos um código de 6 dígitos para o seu WhatsApp. Sem senha necessária.
            </p>

            <Field label="Número do WhatsApp" value={otpPhone} onChange={setOtpPhone}
              type="tel" placeholder="(11) 99999-9999" autoComplete="tel" icon={Phone} />

            {error && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
            )}

            <div className="mt-5">
              <PrimaryBtn onClick={async () => { const ok = await sendOtp(); if (ok) setStep('whatsapp-otp'); }} loading={loading}>
                Enviar código
              </PrimaryBtn>
            </div>
          </motion.div>
        )}

        {/* ── WhatsApp: digitar código ── */}
        {step === 'whatsapp-otp' && (
          <motion.div key="whatsapp-otp"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-sm">
            <button onClick={() => { clearErr(); setStep('whatsapp-phone'); }}
              className="mb-5 flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-3xl">
              ✉️
            </div>
            <h2 className="mb-1 text-2xl font-bold">Código enviado!</h2>
            <p className="mb-2 text-sm text-stone-500">
              Digite o código de 6 dígitos que chegou no WhatsApp{' '}
              <span className="font-semibold text-stone-700">{otpPhone}</span>.
            </p>
            {devCode && (
              <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                ⚙️ Modo dev — código: <strong>{devCode}</strong>
              </p>
            )}

            <div>
              <p className="mb-1.5 text-xs font-semibold text-stone-500">Código de verificação</p>
              <input
                value={otpCode} onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); clearErr(); }}
                inputMode="numeric" maxLength={6} placeholder="000000"
                className="w-full rounded-2xl border border-stone-200 bg-white py-3.5 pl-4 pr-4 text-center text-2xl font-bold tracking-[0.5em] text-stone-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20"
              />
            </div>

            {error && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
            )}

            <div className="mt-5 space-y-3">
              <PrimaryBtn onClick={() => void verifyOtp()} loading={loading} disabled={otpCode.length < 6}>
                <CheckCircle2 className="h-4 w-4" /> Confirmar
              </PrimaryBtn>
              <button
                onClick={async () => { setOtpCode(''); clearErr(); await sendOtp(); }}
                className="w-full text-center text-sm text-stone-400 hover:text-stone-600"
              >
                Reenviar código
              </button>
            </div>
          </motion.div>
        )}


      </AnimatePresence>
    </div>
  );
}
