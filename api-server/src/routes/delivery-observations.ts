import { Router, type IRouter } from "express";
import { createDeliveryObservation, listDeliveryObservations } from "../lib/data-store.js";
import { requireAnyAuth, requireOwnerAuth } from "./auth.js";

const router: IRouter = Router();

router.post("/delivery-observations", requireAnyAuth, (req, res) => {
  const payload = (req as any).auth;
  const companyId: string = payload.companyId;
  const body = req.body as {
    addressKey: string;
    addressText?: string;
    customerId?: string;
    customerName?: string;
    orderId?: string;
    note: string;
    tags?: string[];
    severity?: "info" | "warning" | "critical";
    internalOnly?: boolean;
  };

  if (!body?.addressKey?.trim() || !body?.note?.trim()) {
    res.status(400).json({ error: "addressKey e note são obrigatórios" });
    return;
  }

  const record = createDeliveryObservation({
    restaurantId: companyId,
    addressKey: body.addressKey.trim(),
    addressText: body.addressText?.trim(),
    customerId: body.customerId,
    customerName: body.customerName,
    orderId: body.orderId,
    note: body.note.trim(),
    tags: body.tags ?? [],
    severity: body.severity ?? "warning",
    internalOnly: body.internalOnly ?? true,
    createdBy: payload?.name ?? payload?.email ?? "system",
  });

  res.status(201).json(record);
});

// CORRIGIDO (15/08/2026): não filtrava por restaurante — qualquer dono
// autenticado via observações de entrega de TODOS os restaurantes.
router.get("/delivery-observations", requireOwnerAuth, (req, res) => {
  const companyId: string = (req as any).owner.companyId;
  const addressKey = typeof req.query.addressKey === "string" ? req.query.addressKey : undefined;
  res.json(listDeliveryObservations(companyId, addressKey));
});

export default router;
