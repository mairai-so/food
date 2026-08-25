import { useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * MIAR AI/FOOD — Gestor · Recuperar senha
 * Fluxo: e-mail -> codigo por e-mail -> nova senha.
 * Usa os mesmos endpoints de verificacao do cadastro:
 *   POST /api/auth/password/start   { contact }              -> { phone }
 *   POST /api/auth/password/verify  { phone, code }          -> { token }
 *   POST /api/auth/password/reset   { token, password }      -> { ok }
 * Sem palavra banida, sem spinner: estado com texto e barra.
 */

type Step = 'contact' | 'code' | 'newPassword' | 'done';

export function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>('contact');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);

  const input =
    'w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors text-sm';
  const primaryBtn =
    'w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50';
  const secondaryBtn =
    'w-full rounded-xl border border-slate-800 bg-slate-900 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50';

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await fetch('/api/auth/password/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Nao foi possivel enviar o codigo.');
      setPhone(data.phone ?? contact);
      setStep('code');
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar recuperacao.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.join('');
    if (c.length !== 6) { setError('Digite os 6 digitos do codigo.'); return; }
    setError('');
    setBusy(true);
    try {
      const r = await fetch('/api/auth/password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: c }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Codigo incorreto.');
      setToken(data.token);
      setStep('newPassword');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel confirmar o codigo.');
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('A senha precisa de ao menos 6 caracteres.'); return; }
    if (password !== passwordConfirm) { setError('As senhas nao coincidem.'); return; }
    setError('');
    setBusy(true);
    try {
      const r = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Nao foi possivel redefinir a senha.');
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao redefinir a senha.');
    } finally {
      setBusy(false);
    }
  };

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[i] = d;
    setCode(next);
    if (d && i < 5) setTimeout(() => codeRefs.current[i + 1]?.focus(), 10);
  };
  const onKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) codeRefs.current[i - 1]?.focus();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors"
        >
          Voltar
        </button>
        <div className="text-center flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">Recuperar senha</h2>
          <p className="mt-2 text-sm text-slate-400">
            {step === 'contact' && 'Informe seu e-mail ou telefone cadastrado.'}
            {step === 'code' && 'Digite o código que enviamos por e-mail.'}
            {step === 'newPassword' && 'Crie uma nova senha.'}
            {step === 'done' && 'Senha alterada com sucesso.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-xs text-red-300">
          {error}
        </div>
      )}

      {step === 'contact' && (
        <form onSubmit={start} className="space-y-3">
          <input className={input} placeholder="E-mail ou telefone" value={contact}
            onChange={(e) => setContact(e.target.value)} required />
          <button type="submit" className={secondaryBtn} disabled={busy || !contact}>
            {busy ? 'Enviando código...' : 'Enviar código'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={verify} className="space-y-3">
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-center">
            <p className="text-sm font-medium">Código enviado por e-mail</p>
            <p className="mt-1 text-xs text-muted-foreground">Enviamos um codigo para {phone}.</p>
          </div>
          <div className="flex justify-center gap-2 py-2">
            {code.map((digit, i) => (
              <input key={i} ref={(el) => { codeRefs.current[i] = el; }}
                className="h-12 w-10 rounded-xl border border-slate-800 bg-slate-900 text-center text-lg font-semibold text-slate-100 focus:border-primary focus:outline-none transition-colors"
                value={digit} onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onKey(i, e)} inputMode="numeric" maxLength={1}
                aria-label={`Digito ${i + 1}`} />
            ))}
          </div>
          <button type="submit" className={primaryBtn} disabled={busy || code.join('').length < 6}>
            {busy ? 'Confirmando...' : 'Confirmar codigo'}
          </button>
        </form>
      )}

      {step === 'newPassword' && (
        <form onSubmit={reset} className="space-y-3">
          <div className="relative"><input className={input} type={showPassword ? 'text' : 'password'} placeholder="Nova senha" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Mostrar ou ocultar senha">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
          <div className="relative"><input className={input} type={showPasswordConfirm ? 'text' : 'password'} placeholder="Confirmar nova senha" value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)} required />
            <button type="button" onClick={() => setShowPasswordConfirm((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Mostrar ou ocultar confirmação da senha">{showPasswordConfirm ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
          <button type="submit" className={primaryBtn} disabled={busy}>
            {busy ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <button type="button" onClick={onBack} className={primaryBtn}>Voltar para entrar</button>
      )}

      {step !== 'done' && (
        <button type="button" onClick={onBack}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
          Voltar para entrar
        </button>
      )}
    </div>
  );
}
