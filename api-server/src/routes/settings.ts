import { Router, type IRouter } from "express";
import { getSettings, updateSettings, createId } from "../lib/data-store";
import { requireOwnerAuth, requireAnyAuth } from "./auth";

const router: IRouter = Router();

router.get("/settings", requireOwnerAuth, async (req, res): Promise<void> => {
  const companyId = (req as any).owner.companyId as string;
  res.json(getSettings(companyId));
});

// Idioma padrão do estabelecimento — exige QUALQUER autenticação (dono ou
// funcionário), porque sem saber de qual estabelecimento é a pessoa, não
// tem "o" idioma padrão pra devolver (settings agora é por-restaurante,
// corrigido em 12/08/2026). Antes de ter algum token, a pessoa ainda não
// tem estabelecimento pra herdar idioma — nesse caso o app usa o idioma
// do navegador mesmo, não tem outro jeito correto de resolver isso.
router.get("/settings/idioma-padrao", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId = (req as any).auth?.companyId as string | undefined;
  if (!companyId) {
    res.status(400).json({ error: "Token sem estabelecimento associado" });
    return;
  }
  res.json({ idiomaPadrao: getSettings(companyId).idiomaPadrao });
});

router.patch("/settings", requireOwnerAuth, async (req, res): Promise<void> => {
  const companyId = (req as any).owner.companyId as string;
  updateSettings(companyId, req.body);
  res.json(getSettings(companyId));
});

router.post("/settings/regenerate-qr", requireOwnerAuth, async (req, res): Promise<void> => {
  const companyId = (req as any).owner.companyId as string;
  const newToken = createId();
  updateSettings(companyId, { qrEntranceToken: newToken });
  res.json({ qrEntranceToken: newToken });
});

export default router;
