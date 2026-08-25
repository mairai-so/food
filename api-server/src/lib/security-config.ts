export type RateLimitConfig = {
  name: string;
  windowMs: number;
  max: number;
  message?: { error: string; detail?: string };
  // Corrigido (20/08/2026, achado pelo GitHub Actions — CI compila do zero
  // e pegou o que o build incremental local escondia): antes só aceitava
  // `() => boolean`, sem acesso à requisição. O aiLimiter precisa olhar
  // `req.path` pra ignorar rotas que não são de IA (pedido, mesa, cozinha,
  // caixa), então o tipo precisa aceitar o parâmetro opcional — os
  // limitadores que não usam `req` (ex.: `skip: () => isDev`) continuam
  // funcionando iguais, já que um parâmetro extra nunca quebra quem não o usa.
  skip?: (req: Parameters<import("express").RequestHandler>[0]) => boolean;
};

export function createEndpointRateLimitConfig(config: RateLimitConfig) {
  const message = config.message ?? {
    error: `Muitas requisições em ${config.name}. Tente novamente mais tarde.`,
  };

  return {
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: config.skip,
    message,
  };
}

export function getSecurityWarnings(env: Record<string, string | undefined>) {
  const warnings: string[] = [];
  const isProduction = env.NODE_ENV === "production";
  const insecureHttpAllowed = env.ALLOW_INSECURE_HTTP === "true";

  if (isProduction && !insecureHttpAllowed) {
    warnings.push(
      "HTTPS/TLS obrigatório em produção. Senhas e tokens não devem trafegar em texto claro.",
    );
  }

  if (isProduction && insecureHttpAllowed) {
    warnings.push(
      "HTTPS/TLS está desativado temporariamente em produção. Isso deve ser removido antes de expor a app publicamente.",
    );
  }

  if (!isProduction) {
    warnings.push(
      "Ambiente local: HTTPS/TLS pode ficar desligado apenas para teste local; manter explicitamente atrás do proxy ou nginx em produção.",
    );
  }

  return warnings;
}

export function isSecureTransport(
  req: {
    secure?: boolean;
    protocol?: string;
    headers?: Record<string, string | string[] | undefined>;
  },
  env: Record<string, string | undefined> = process.env,
): boolean {
  const isProduction = env.NODE_ENV === "production";
  if (!isProduction) return true;

  if (env.ALLOW_INSECURE_HTTP === "true") return true;

  if (req.secure === true) return true;
  if (req.protocol === "https") return true;

  const forwarded = req.headers?.["x-forwarded-proto"];
  if (typeof forwarded === "string") {
    return forwarded.toLowerCase().split(",")[0].trim() === "https";
  }
  if (Array.isArray(forwarded)) {
    return forwarded.some((value) => value.toLowerCase().split(",")[0].trim() === "https");
  }

  return false;
}

export function enforceSecureTransport(
  req: {
    secure?: boolean;
    protocol?: string;
    headers?: Record<string, string | string[] | undefined>;
    method?: string;
  },
  res: {
    status: (code: number) => { json: (payload: Record<string, unknown>) => unknown };
  },
  next: () => void,
  env: Record<string, string | undefined> = process.env,
): void {
  if (isSecureTransport(req, env)) {
    next();
    return;
  }

  res.status(403).json({
    error: "HTTPS/TLS obrigatório em produção.",
    detail: "Use proxy reverso com TLS terminado antes deste servidor ou configure ALLOW_INSECURE_HTTP=true apenas para teste local temporário.",
  });
}
