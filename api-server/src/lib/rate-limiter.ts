import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { createEndpointRateLimitConfig } from "./security-config.js";

const isDev = process.env.NODE_ENV !== "production";

/** Limite geral para a API.
 *  Em dev, desabilitado (skip all) — múltiplos apps compartilham o mesmo IP atrás do proxy.
 *  Em prod, 300 req/min por IP. */
export const generalLimiter = rateLimit({
  ...createEndpointRateLimitConfig({
    name: "general",
    windowMs: 60 * 1000,
    max: 300,
    message: { error: "Muitas requisições. Tente novamente em um minuto." },
    skip: () => isDev,
  }),
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
});

/** Limite específico para autenticação por senha. */
export const loginLimiter = rateLimit({
  ...createEndpointRateLimitConfig({
    name: "login",
    windowMs: 15 * 60 * 1000,
    max: isDev ? 40 : 10,
    message: {
      error: "Muitas tentativas de login. Tente novamente em alguns minutos.",
      detail: "Aguarde o tempo indicado no cabeçalho Retry-After antes de tentar novamente.",
    },
  }),
  keyGenerator: (req) => {
    const body = req.body as { email?: unknown; phone?: unknown };
    const identity = [body.email, body.phone]
      .find((value) => typeof value === "string" && value.trim().length > 0);
    if (typeof identity === "string") {
      return `identity:${identity.trim().toLowerCase()}`;
    }
    return `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
  },
  skipFailedRequests: true,
});

/** Limite para endpoints de IA — 60 req/min em dev, 30 em prod */
export const aiLimiter = rateLimit({
  ...createEndpointRateLimitConfig({
    name: "ai",
    windowMs: 60 * 1000,
    max: isDev ? 200 : 30,
    message: { error: "Limite de mensagens atingido. Aguarde um momento." },
    // Os routers de IA são montados com `router.use(aiLimiter, router)`. O
    // middleware precisa ignorar as demais rotas para não limitar pedidos,
    // mesas, cozinha e caixa por acidente.
    skip: (req) => {
      const path = req.path;
      return !(
        path === "/chat" ||
        path.startsWith("/chat/") ||
        path === "/restaurant-chat" ||
        path.startsWith("/restaurant-chat/") ||
        path === "/kitchen/chat" ||
        path === "/transcribe" ||
        path === "/marketing/campaign" ||
        path.startsWith("/marketing/campaigns") ||
        path === "/food-analysis" ||
        path === "/mia" ||
        path.startsWith("/mia/") ||
        path.startsWith("/intelligence/")
      );
    },
  }),
});

/** Limite para onboarding — evita spam de cadastros */
export const onboardingLimiter = rateLimit({
  ...createEndpointRateLimitConfig({
    name: "onboarding",
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5,
    message: {
      error: "Este e-mail, telefone ou endereço de rede atingiu o limite temporário de tentativas de cadastro.",
      detail: "Aguarde o tempo indicado no cabeçalho Retry-After antes de tentar novamente.",
    },
  }),
  keyGenerator: (req) => {
    const body = req.body as { email?: unknown; phone?: unknown; cnpj?: unknown };
    const identity = [body.email, body.phone, body.cnpj]
      .find((value) => typeof value === "string" && value.trim().length > 0);
    if (typeof identity === "string") {
      return `identity:${identity.trim().toLowerCase()}`;
    }
    return `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
  },
  // Erros de validação e conflitos não são cadastros concluídos. Contá-los
  // aqui bloqueava usuários legítimos que compartilham o IP do proxy.
  skipFailedRequests: true,
});

/** Limite específico para tentativas de confirmação de ativação. */
export const registrationCodeLimiter = rateLimit({
  ...createEndpointRateLimitConfig({
    name: "registration-code",
    windowMs: 15 * 60 * 1000,
    max: isDev ? 20 : 5,
    message: {
      error: "Muitas tentativas de código. Aguarde alguns minutos antes de tentar novamente.",
    },
  }),
  keyGenerator: (req) => {
    const body = req.body as { phone?: unknown };
    if (typeof body.phone === "string" && body.phone.trim()) {
      return `registration:${body.phone.trim().toLowerCase()}`;
    }
    return `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
  },
  skipFailedRequests: false,
});

/** Limita códigos de recuperação por identidade, evitando enumeração e força bruta. */
export const passwordRecoveryLimiter = rateLimit({
  ...createEndpointRateLimitConfig({
    name: "password-recovery",
    windowMs: 15 * 60 * 1000,
    max: isDev ? 10 : 5,
    message: { error: "Muitas tentativas de recuperação. Aguarde alguns minutos." },
  }),
  keyGenerator: (req) => {
    const body = req.body as { contact?: unknown; phone?: unknown };
    const identity = [body.contact, body.phone].find((value) => typeof value === "string" && value.trim());
    return typeof identity === "string"
      ? `recovery:${identity.trim().toLowerCase()}`
      : `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
  },
  skipFailedRequests: false,
});
