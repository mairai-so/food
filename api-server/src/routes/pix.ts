import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { verifyToken } from "./auth.js";
import type { Request, Response, NextFunction } from "express";

/**
 * MIAR AI/FOOD — Pix via Mercado Pago.
 * Gera cobranca Pix de verdade e devolve o QR (imagem) + o copia-e-cola.
 * Usa MP_ACCESS_TOKEN do .env (o token de teste comeca com TEST-).
 * Enquanto o token nao estiver setado, responde 503 com aviso claro,
 * em vez de quebrar a tela.
 */

const router: IRouter = Router();

const MP_URL = "https://api.mercadopago.com/v1/payments";

function getToken(): string {
  return (process.env.MP_ACCESS_TOKEN ?? "").trim();
}

export async function fetchProviderPaymentStatus(paymentId: string): Promise<string | null> {
  const token = getToken();
  if (!token) return null;
  const response = await fetch(`${MP_URL}/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data: any = await response.json();
  if (!response.ok) return null;
  return typeof data?.status === "string" ? data.status : null;
}

// Exige login — de cliente (pagando o próprio pedido) ou de equipe (caixa
// lançando um pagamento). Sem isso, qualquer pessoa na internet conseguia
// gerar cobranças reais na conta do Mercado Pago do restaurante.
function requireClientOrStaffAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Login necessário" });
    return;
  }
  const payload = verifyToken(header.slice(7));
  if (!payload) {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }
  next();
}

// POST /api/pix/cobrar  { amount, description?, email? }
router.post("/pix/cobrar", requireClientOrStaffAuth, async (req, res): Promise<void> => {
  const token = getToken();
  if (!token) {
    res.status(503).json({
      error: "Pix nao configurado",
      detalhe: "Falta MP_ACCESS_TOKEN no .env do servidor (token de teste comeca com TEST-).",
    });
    return;
  }

  const { amount, description, email } = req.body as {
    amount: number;
    description?: string;
    email?: string;
  };

  const valor = Number(amount);
  if (!valor || valor <= 0) {
    res.status(400).json({ error: "amount invalido (valor em reais, ex: 42.90)" });
    return;
  }

  try {
    const resp = await fetch(MP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: Number(valor.toFixed(2)),
        description: description ?? "Pedido MIAR AI/FOOD",
        payment_method_id: "pix",
        payer: { email: (email && email.trim()) || "cliente-teste@miar.app" },
      }),
    });

    const data: any = await resp.json();

    if (!resp.ok) {
      res.status(resp.status).json({
        error: "Mercado Pago recusou a cobranca",
        detalhe: data?.message ?? data?.error ?? "erro desconhecido",
      });
      return;
    }

    const poi = data?.point_of_interaction?.transaction_data ?? {};
    res.json({
      paymentId: data?.id,
      status: data?.status, // "pending" ate o cliente pagar
      copiaECola: poi?.qr_code ?? "", // BR Code pra colar no app do banco
      qrBase64: poi?.qr_code_base64 ?? "", // imagem PNG do QR (base64, sem prefixo)
      ticketUrl: poi?.ticket_url ?? "",
    });
  } catch (err: any) {
    res.status(502).json({
      error: "Falha ao falar com o Mercado Pago",
      detalhe: String(err?.message ?? err),
    });
  }
});

// GET /api/pix/status/:id — confere se o cliente ja pagou
router.get("/pix/status/:id", requireClientOrStaffAuth, async (req, res): Promise<void> => {
  const token = getToken();
  if (!token) {
    res.status(503).json({ error: "Pix nao configurado" });
    return;
  }
  try {
    const paymentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const status = await fetchProviderPaymentStatus(paymentId);
    if (!status) {
      res.status(502).json({ error: "consulta recusada" });
      return;
    }
    res.json({ paymentId, status });
  } catch (err: any) {
    res.status(502).json({ error: "Falha na consulta", detalhe: String(err?.message ?? err) });
  }
});

export default router;
