import { Router, type IRouter } from "express";
import { loyaltyRecords, type LoyaltyRecord } from "../lib/data-store.js";
import { scheduleSave } from "../lib/persistence.js";
import { verifyToken } from "./auth.js";

const router: IRouter = Router();

function calcLevel(points: number): LoyaltyRecord["level"] {
  if (points >= 1000) return "diamante";
  if (points >= 500) return "ouro";
  if (points >= 200) return "prata";
  return "bronze";
}

/** GET /api/loyalty/:clientId — retorna pontos e nível do cliente */
router.get("/loyalty/:clientId", (req, res): void => {
  const { clientId } = req.params;
  const record = loyaltyRecords.find((r) => r.clientAccountId === clientId);
  if (!record) {
    res.json({ clientAccountId: clientId, points: 0, level: "bronze", updatedAt: new Date().toISOString() });
    return;
  }
  res.json(record);
});

/** POST /api/loyalty/me/add — adiciona pontos usando o JWT do cliente (sem precisar passar clientId na URL) */
router.post("/loyalty/me/add", (req, res): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Login necessário" });
    return;
  }
  const payload = verifyToken(header.slice(7));
  if (!payload?.isClientUser || typeof payload.clientId !== "string") {
    res.status(401).json({ error: "Token inválido ou não é cliente" });
    return;
  }
  const clientId = payload.clientId;
  const body = req.body as { points?: number };
  const toAdd = Math.max(0, Math.floor(Number(body.points) || 0));

  let record = loyaltyRecords.find((r) => r.clientAccountId === clientId);
  if (record) {
    record.points += toAdd;
    record.level = calcLevel(record.points);
    record.updatedAt = new Date().toISOString();
  } else {
    record = {
      clientAccountId: clientId,
      points: toAdd,
      level: calcLevel(toAdd),
      updatedAt: new Date().toISOString(),
    };
    loyaltyRecords.push(record);
  }
  scheduleSave("loyaltyRecords", loyaltyRecords);
  res.json(record);
});

/** POST /api/loyalty/:clientId/add — adiciona pontos ao cliente */
router.post("/loyalty/:clientId/add", (req, res): void => {
  const { clientId } = req.params;
  const body = req.body as { points?: number };
  const toAdd = Math.max(0, Math.floor(Number(body.points) || 0));

  let record = loyaltyRecords.find((r) => r.clientAccountId === clientId);
  if (record) {
    record.points += toAdd;
    record.level = calcLevel(record.points);
    record.updatedAt = new Date().toISOString();
  } else {
    record = {
      clientAccountId: clientId,
      points: toAdd,
      level: calcLevel(toAdd),
      updatedAt: new Date().toISOString(),
    };
    loyaltyRecords.push(record);
  }

  scheduleSave("loyaltyRecords", loyaltyRecords);
  res.json(record);
});

export default router;
