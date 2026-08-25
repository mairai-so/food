import assert from "node:assert/strict";
import test from "node:test";
import {
  createEndpointRateLimitConfig,
  enforceSecureTransport,
  getSecurityWarnings,
  isSecureTransport,
} from "./security-config.ts";

test("login limiter is stricter than the global limiter", () => {
  const general = createEndpointRateLimitConfig({
    name: "general",
    windowMs: 60_000,
    max: 300,
  });

  const login = createEndpointRateLimitConfig({
    name: "login",
    windowMs: 60_000,
    max: 10,
    message: {
      error: "Muitas tentativas de login. Tente novamente em alguns minutos.",
    },
  });

  assert.equal(general.max, 300);
  assert.equal(login.max, 10);
  assert.ok(login.max < general.max);
  assert.equal(login.message.error, "Muitas tentativas de login. Tente novamente em alguns minutos.");
});

test("production warns about missing HTTPS/TLS", () => {
  const warnings = getSecurityWarnings({
    NODE_ENV: "production",
    ALLOW_INSECURE_HTTP: "false",
  });

  assert.ok(warnings.some((entry) => /HTTPS|TLS|proxy/i.test(entry)));
});

test("local testing can explicitly allow insecure HTTP temporarily", () => {
  const warnings = getSecurityWarnings({
    NODE_ENV: "development",
    ALLOW_INSECURE_HTTP: "true",
  });

  assert.ok(warnings.some((entry) => /local|temporar/i.test(entry)));
});

test("production blocks insecure transport unless explicitly allowed", () => {
  const req = {
    secure: false,
    protocol: "http",
    headers: {},
  };

  const res = {
    status(code: number) {
      assert.equal(code, 403);
      return {
        json(payload: Record<string, unknown>) {
          assert.match(String(payload.error), /HTTPS\/TLS obrigatório/i);
          return payload;
        },
      };
    },
  };

  let called = false;
  enforceSecureTransport(req, res as any, () => {
    called = true;
  }, { NODE_ENV: "production", ALLOW_INSECURE_HTTP: "false" });

  assert.equal(called, false);
});

test("production accepts https behind a trusted proxy", () => {
  const req = {
    secure: false,
    protocol: "http",
    headers: {
      "x-forwarded-proto": "https",
    },
  };

  let called = false;
  enforceSecureTransport(req, {
    status: () => ({ json: () => undefined }),
  } as any, () => {
    called = true;
  }, { NODE_ENV: "production", ALLOW_INSECURE_HTTP: "false" });

  assert.equal(called, true);
  assert.equal(isSecureTransport(req, { NODE_ENV: "production", ALLOW_INSECURE_HTTP: "false" }), true);
});
