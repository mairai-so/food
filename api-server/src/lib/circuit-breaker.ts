import { query, execute } from "./db";
import { logger } from "./logger";

const FAILURE_THRESHOLD = 3;        // falhas antes de abrir o circuit
const OPEN_DURATION_MS = 5 * 60000; // 5 minutos suspenso
const TIMEOUT_MS = 2000;            // 2s timeout por consulta

interface CircuitState {
  state: "closed" | "open" | "half-open";
  failureCount: number;
  openUntil?: Date;
}

// Cache em memória para evitar hit no DB a cada requisição
const cache = new Map<string, CircuitState>();

export async function getCircuitState(restaurantId: string): Promise<CircuitState> {
  if (cache.has(restaurantId)) return cache.get(restaurantId)!;

  const rows = await query<{
    state: string;
    failure_count: number;
    open_until: string | null;
  }>(
    "SELECT state, failure_count, open_until FROM circuit_breaker WHERE restaurant_id = $1",
    [restaurantId]
  );

  const row = rows[0];
  const state: CircuitState = row
    ? {
        state: row.state as CircuitState["state"],
        failureCount: row.failure_count,
        openUntil: row.open_until ? new Date(row.open_until) : undefined,
      }
    : { state: "closed", failureCount: 0 };

  cache.set(restaurantId, state);
  return state;
}

/** Retorna true se o restaurante está disponível */
export async function isAvailable(restaurantId: string): Promise<boolean> {
  const s = await getCircuitState(restaurantId);
  if (s.state === "closed") return true;
  if (s.state === "open" && s.openUntil && new Date() > s.openUntil) {
    // Transição para half-open: tenta uma vez
    await updateState(restaurantId, "half-open", s.failureCount);
    return true;
  }
  return s.state !== "open";
}

export async function recordSuccess(restaurantId: string): Promise<void> {
  await updateState(restaurantId, "closed", 0);
  cache.delete(restaurantId);
}

export async function recordFailure(restaurantId: string): Promise<void> {
  const s = await getCircuitState(restaurantId);
  const newCount = s.failureCount + 1;
  let newState: CircuitState["state"] = s.state;
  let openUntil: Date | undefined;

  if (newCount >= FAILURE_THRESHOLD) {
    newState = "open";
    openUntil = new Date(Date.now() + OPEN_DURATION_MS);
    logger.warn({ restaurantId, newCount }, "Circuit breaker ABERTO — restaurante suspenso por 5min");
  }

  await updateState(restaurantId, newState, newCount, openUntil);
  cache.delete(restaurantId);
}

async function updateState(
  restaurantId: string,
  state: string,
  failureCount: number,
  openUntil?: Date
): Promise<void> {
  await execute(
    `INSERT INTO circuit_breaker (restaurant_id, state, failure_count, open_until, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (restaurant_id) DO UPDATE
       SET state = $2, failure_count = $3, open_until = $4, updated_at = NOW()`,
    [restaurantId, state, failureCount, openUntil ?? null]
  );
}

/** Executa uma função com timeout — registra sucesso/falha no circuit breaker */
export async function withCircuitBreaker<T>(
  restaurantId: string,
  fn: () => Promise<T>
): Promise<T> {
  const available = await isAvailable(restaurantId);
  if (!available) {
    throw new Error(`Restaurante ${restaurantId} temporariamente indisponível`);
  }

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)
  );

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    await recordSuccess(restaurantId);
    return result;
  } catch (err) {
    await recordFailure(restaurantId);
    throw err;
  }
}
