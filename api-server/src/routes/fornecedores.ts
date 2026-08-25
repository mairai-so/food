import { Router, type IRouter } from "express";
import { suppliers, createSupplier, updateSupplier, deleteSupplier } from "../lib/data-store";
import { requireAnyAuth } from "./auth";

// REGRA MULTI-TENANT: nunca use um restaurantId fixo aqui.
// Sempre extraia o companyId do token via (req as any).auth.companyId.

const router: IRouter = Router();

router.get("/fornecedores", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  res.json(suppliers.filter(s => s.restaurantId === companyId));
});

router.post("/fornecedores", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  const b = req.body as any;
  if (!b.name) { res.status(400).json({ error: "name é obrigatório" }); return; }
  res.status(201).json(createSupplier({
    restaurantId: companyId,
    name: b.name,
    contact: b.contact ?? "",
    phone: b.phone ?? "",
    email: b.email ?? "",
    category: b.category ?? "Geral",
    notes: b.notes ?? "",
  }));
});

router.patch("/fornecedores/:id", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  // Verificar que o fornecedor pertence a este restaurante antes de atualizar
  const existing = suppliers.find(s => s.id === id && s.restaurantId === companyId);
  if (!existing) { res.status(404).json({ error: "Fornecedor não encontrado" }); return; }
  const s = updateSupplier(id, req.body as any);
  if (!s) { res.status(404).json({ error: "Fornecedor não encontrado" }); return; }
  res.json(s);
});

router.delete("/fornecedores/:id", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  // Verificar que o fornecedor pertence a este restaurante antes de deletar
  const existing = suppliers.find(s => s.id === id && s.restaurantId === companyId);
  if (!existing) { res.status(404).json({ error: "Fornecedor não encontrado" }); return; }
  if (!deleteSupplier(id)) { res.status(404).json({ error: "Fornecedor não encontrado" }); return; }
  res.status(204).send();
});

export default router;
