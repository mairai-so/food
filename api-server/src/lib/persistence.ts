/**
 * persistence.ts — Salva e restaura o estado do data-store no PostgreSQL.
 *
 * Estratégia: snapshot por chave. Cada entidade do store vira uma linha
 * na tabela store_snapshots (key → JSONB). Ao iniciar, lemos todas as
 * chaves e rehidratamos os arrays em memória. Após cada request mutante,
 * agendamos um save debounced.
 */

import { db } from "@workspace/db";
import { storeSnapshots } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

// ─── Tipos internos ───────────────────────────────────────────────────────────

type SnapshotPayload = Record<string, unknown>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function saveSnapshot(key: string, data: unknown): Promise<void> {
  try {
    await saveSnapshotConfirmed(key, data);
  } catch (err) {
    logger.error({ err, key }, "persistence: falha ao salvar snapshot");
  }
}

export async function saveSnapshotConfirmed(key: string, data: unknown): Promise<void> {
  await db
    .insert(storeSnapshots)
    .values({ key, data: data as SnapshotPayload })
    .onConflictDoUpdate({
      target: storeSnapshots.key,
      set: { data: data as SnapshotPayload },
    });
}

export async function loadSnapshot<T>(key: string): Promise<T | null> {
  try {
    const [row] = await db
      .select()
      .from(storeSnapshots)
      .where(eq(storeSnapshots.key, key));
    return row ? (row.data as T) : null;
  } catch (err) {
    logger.error({ err, key }, "persistence: falha ao carregar snapshot");
    return null;
  }
}

// ─── Debounce: agrupa saves em rajada num único write ─────────────────────────

const pendingSaves = new Map<string, unknown>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSave(key: string, data: unknown): void {
  pendingSaves.set(key, data);
  if (saveTimer) return; // já agendado
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    await flushPendingSaves();
  }, 300);
}

// Força a gravação imediata de tudo que estiver pendente, ignorando o
// debounce. Chamado no desligamento gracioso (SIGTERM/SIGINT) para que um
// restart de deploy, crash controlado, ou "docker stop" nunca perca uma
// escrita que ainda não tinha completado os 300ms do debounce.
export async function flushPendingSaves(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pendingSaves.size === 0) return;
  const batch = new Map(pendingSaves);
  pendingSaves.clear();
  for (const [k, v] of batch) {
    await saveSnapshot(k, v);
  }
  logger.debug({ keys: [...batch.keys()] }, "persistence: flush final antes de encerrar");
}
