import { useState } from "react";
import { useLocation } from "wouter";
import { useLoginOwner } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Zap } from "lucide-react";
import { useTranslation } from "../i18n/IdiomaContext";

export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const loginMutation = useLoginOwner({
    mutation: {
      onSuccess: (data) => {
        const storage = rememberDevice ? localStorage : sessionStorage;
        const otherStorage = rememberDevice ? sessionStorage : localStorage;
        otherStorage.removeItem("gestor_token");
        storage.setItem("gestor_token", data.token);
        setLocation("/dashboard");
      },
      onError: (error) => {
        const errData = error as { data?: { error?: string } };
        toast({
          title: t('auth.error.login'),
          description: errData.data?.error || t('auth.error.default'),
          variant: "destructive",
        });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    loginMutation.mutate({ data: { email, password } });
  };

  return (
    <div className="min-h-[100dvh] w-full max-w-[430px] mx-auto bg-background flex flex-col px-6 py-12 relative shadow-2xl sm:border-x-2 border-border overflow-hidden">
      {/* Decorative bg elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>

      <div className="flex-1 flex flex-col justify-center relative z-10">
        <div className="mb-10 flex flex-col gap-4">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg border-2 border-primary-foreground/20">
            <Zap className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
              {t('app.title')}
            </h1>
            <p className="text-muted-foreground mt-2 font-medium text-lg">
              {t('app.subtitle')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground">{t('auth.email.label')}</label>
            <Input
              type="email"
              placeholder={t('auth.email.label').toLowerCase() === 'e-mail' ? 'seu@email.com' : 'you@email.com'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loginMutation.isPending}
            />
          </div>
          <div className="relative space-y-2">
            <label className="text-sm font-bold text-foreground">{t('auth.password.label')}</label>
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loginMutation.isPending}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(event) => setRememberDevice(event.target.checked)}
            />
            Manter conectado neste aparelho
          </label>

          <Button
            type="submit"
            className="w-full mt-6 text-lg h-14"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? t('auth.button.entering') : t('auth.button.access')}
          </Button>
        </form>
      </div>
    </div>
  );
}
