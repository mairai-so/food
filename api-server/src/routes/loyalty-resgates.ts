import { Router, type IRouter } from "express";
import { requireOwnerAuth } from "./auth";
import { loyaltyResgates } from "../lib/data-store";

const router: IRouter = Router();

// GET /api/loyalty/resgates — lista os resgates de fidelidade do
// restaurante (pendentes primeiro), pra o gestor saber quem já bateu o
// marco e precisa receber o item físico.
router.get("/loyalty/resgates", requireOwnerAuth, (req, res): void => {
  const companyId: string = (req as any).owner.companyId;
  const status = req.query.status as string | undefined;

  let lista = loyaltyResgates.filter((r) => r.restaurantId === companyId);
  if (status === "pendente" || status === "entregue") {
    lista = lista.filter((r) => r.status === status);
  }
  lista.sort((a, b) => (a.status === b.status ? 0 : a.status === "pendente" ? -1 : 1));
  res.json(lista);
});

// PATCH /api/loyalty/resgates/:id/entregar — gestor confirma que entregou
// o item físico ao cliente. Essa confirmação é o "resgate real" exigido
// pela promoção de lançamento estendida (manual, seção 27.2) — o toggle
// de configuração sozinho não conta.
router.patch("/loyalty/resgates/:id/entregar", requireOwnerAuth, (req, res): void => {
  const companyId: string = (req as any).owner.companyId;
  const { id } = req.params;
  const { entreguePor } = req.body as { entreguePor?: string };

  const resgate = loyaltyResgates.find((r) => r.id === id && r.restaurantId === companyId);
  if (!resgate) {
    res.status(404).json({ error: "Resgate não encontrado" });
    return;
  }
  if (resgate.status === "entregue") {
    res.status(409).json({ error: "Este resgate já foi marcado como entregue" });
    return;
  }

  resgate.status = "entregue";
  resgate.entregueAt = new Date().toISOString();
  resgate.entreguePor = entreguePor?.trim() || undefined;
  res.json(resgate);
});

export default router;
