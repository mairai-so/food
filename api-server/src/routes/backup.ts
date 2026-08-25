import { Router, type IRouter } from "express";
import {
  restaurants, menuItems, tables, stockItems, employees, cashierSessions, feedbacks,
} from "../lib/data-store";
import { query as dbQuery, execute } from "../lib/db";
import { logger } from "../lib/logger";
import { requireOwnerAuth } from "./auth";

const router: IRouter = Router();

interface BackupSnapshot {
  version: string;
  createdAt: string;
  counts: Record<string, number>;
  data: Record<string, unknown>;
}

// últimos 3 snapshots em memória
const snapshots: BackupSnapshot[] = [];

function createSnapshot(): BackupSnapshot {
  const snap: BackupSnapshot = {
    version: "1.0",
    createdAt: new Date().toISOString(),
    counts: {
      stockItems: stockItems.length,
      employees: employees.length,
      cashierSessions: cashierSessions.length,
      auditLogs: 0,
    },
    data: {
      restaurants: JSON.parse(JSON.stringify(restaurants)),
      menuItems: JSON.parse(JSON.stringify(menuItems)),
      tables: JSON.parse(JSON.stringify(tables)),
      stockItems: JSON.parse(JSON.stringify(stockItems)),
      employees: JSON.parse(JSON.stringify(employees)),
      cashierSessions: JSON.parse(JSON.stringify(cashierSessions)),
      feedbacks: JSON.parse(JSON.stringify(feedbacks)),
    },
  };
  snapshots.push(snap);
  if (snapshots.length > 3) snapshots.shift();
  logger.info({ createdAt: snap.createdAt }, "Backup criado");
  return snap;
}

// ── GET /api/backup — download do backup completo
router.get("/backup", requireOwnerAuth, async (_req, res): Promise<void> => {
  const snap = createSnapshot();
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="miar-backup-${new Date().toISOString().slice(0, 10)}.json"`
  );
  res.json(snap);
});

// ── GET /api/backup/list — lista backups em memória
router.get("/backup/list", requireOwnerAuth, async (_req, res): Promise<void> => {
  res.json({
    backups: snapshots.map((s) => ({ createdAt: s.createdAt, version: s.version, counts: s.counts })),
    autoBackupInterval: "30min",
  });
});

// ── POST /api/backup/restore — restaura a partir de um snapshot (índice 0..2)
router.post("/backup/restore", requireOwnerAuth, async (req, res): Promise<void> => {
  const { index = 0 } = req.body as { index?: number };
  const snap = snapshots[index];
  if (!snap) {
    res.status(404).json({ error: "Snapshot não encontrado. Índice inválido ou sem backups disponíveis." });
    return;
  }

  try {
    // Restaura stockItems em memória
    const data = snap.data as Record<string, unknown[]>;
    stockItems.length = 0;
    (data.stockItems as typeof stockItems).forEach((i) => stockItems.push(i));

    // Restaura cashierSessions em memória
    cashierSessions.length = 0;
    (data.cashierSessions as typeof cashierSessions).forEach((s) => cashierSessions.push(s));

    logger.info({ snapIndex: index, createdAt: snap.createdAt }, "Backup restaurado");
    res.json({
      ok: true,
      restoredAt: new Date().toISOString(),
      snapshotCreatedAt: snap.createdAt,
      counts: snap.counts,
    });
  } catch (err) {
    logger.error({ err }, "Erro ao restaurar backup");
    res.status(500).json({ error: "Falha ao restaurar backup" });
  }
});

export function startAutoBackup(): void {
  createSnapshot(); // snapshot imediato no startup
  setInterval(createSnapshot, 30 * 60 * 1000); // a cada 30 minutos
}

export default router;
