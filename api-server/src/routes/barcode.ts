import { Router, type IRouter } from "express";
import { stockItems, updateStockItem } from "../lib/data-store";
import { logger } from "../lib/logger";
import { requireAnyAuth } from "./auth";
import { randomUUID } from "node:crypto";

const router: IRouter = Router();

// ─── Barcode Module ───────────────────────────────────────────────────────────
// Gera e valida códigos de barras para itens de estoque.
// Geração: atribui um valor Code128 persistente ao StockItem.
// Leitura: busca o StockItem pelo valor do código de barras lido pela câmera.

/**
 * Gera um código EAN-13 fictício (mas com dígito verificador válido).
 * Prefixo 789 = Brasil, + 9 dígitos + dígito verificador.
 */
function generateEAN13(seed?: string): string {
  // Usar UUID parcial como base numérica
  const base = seed
    ? seed.replace(/[^0-9]/g, "").slice(0, 12).padEnd(12, "0")
    : Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");

  const digits = `789${base.slice(3, 12)}`;
  const body = digits.slice(0, 12).padEnd(12, "0");

  // Calcular dígito verificador EAN-13
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(body[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;

  return body + check;
}

// ─── POST /barcode/generate — gera ou retorna o código de barras do item ─────
router.post("/barcode/generate", requireAnyAuth, (req, res): void => {
  // REGRA MULTI-TENANT: restaurantId nunca vem do body — sempre do token.
  const restaurantId: string = (req as any).auth.companyId;
  const { stockItemId } = req.body as { stockItemId: string };

  if (!stockItemId) {
    res.status(400).json({ error: "stockItemId é obrigatório" });
    return;
  }

  const item = stockItems.find(s => s.id === stockItemId && s.restaurantId === restaurantId);
  if (!item) {
    res.status(404).json({ error: `Item de estoque '${stockItemId}' não encontrado` });
    return;
  }

  // Se o item já tem barcode, retornar o existente
  if (item.barcode) {
    logger.info({ stockItemId, barcode: item.barcode }, "Barcode already exists");
    res.json({
      stockItemId: item.id,
      name: item.name,
      barcode: item.barcode,
      barcodeType: "EAN-13",
      existing: true,
    });
    return;
  }

  // Gerar novo barcode baseado no ID do item para consistência
  const barcode = generateEAN13(stockItemId.replace(/-/g, ""));
  const updated = updateStockItem(stockItemId, { barcode });

  if (!updated) {
    res.status(500).json({ error: "Falha ao salvar código de barras" });
    return;
  }

  logger.info({ stockItemId, barcode }, "Barcode generated");
  res.json({
    stockItemId: item.id,
    name: item.name,
    barcode,
    barcodeType: "EAN-13",
    existing: false,
  });
});

// ─── POST /barcode/generate-batch — gera barcodes para todos os itens sem código
router.post("/barcode/generate-batch", requireAnyAuth, (req, res): void => {
  // REGRA MULTI-TENANT: restaurantId nunca vem do body — sempre do token.
  const restaurantId: string = (req as any).auth.companyId;

  const targets = stockItems.filter(s => !s.barcode && s.restaurantId === restaurantId);

  const results = targets.map(item => {
    const barcode = generateEAN13(item.id.replace(/-/g, ""));
    updateStockItem(item.id, { barcode });
    return { stockItemId: item.id, name: item.name, barcode };
  });

  logger.info({ count: results.length, restaurantId }, "Batch barcode generation");
  res.json({ generated: results.length, items: results });
});

// ─── POST /barcode/scan — busca item pelo valor lido na câmera ────────────────
router.post("/barcode/scan", requireAnyAuth, (req, res): void => {
  // REGRA MULTI-TENANT: restaurantId nunca vem do body — sempre do token.
  const restaurantId: string = (req as any).auth.companyId;
  const { barcode } = req.body as { barcode: string };

  if (!barcode?.trim()) {
    res.status(400).json({ error: "barcode é obrigatório" });
    return;
  }

  const clean = barcode.trim();
  let item = stockItems.find(s => s.barcode === clean && s.restaurantId === restaurantId);

  // Fallback: busca por nome (útil para produtos sem barcode ainda)
  if (!item) {
    item = stockItems.find(
      s => s.name.toLowerCase().includes(clean.toLowerCase()) &&
        s.restaurantId === restaurantId
    );
  }

  if (!item) {
    res.status(404).json({
      error: "BARCODE_NAO_ENCONTRADO",
      message: `Código '${clean}' não encontrado no estoque. Verifique se o produto foi cadastrado.`,
      barcode: clean,
    });
    return;
  }

  logger.info({ barcode: clean, found: item.id, name: item.name }, "Barcode scan");
  res.json({
    found: true,
    barcode: item.barcode ?? clean,
    item: {
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      minQuantity: item.minQuantity,
      expiresAt: item.expiresAt,
      restaurantId: item.restaurantId,
      updatedAt: item.updatedAt,
    },
    alert: item.quantity <= item.minQuantity
      ? { level: "warning", message: `Estoque baixo: ${item.quantity} ${item.unit} (mínimo: ${item.minQuantity})` }
      : null,
  });
});

// ─── GET /barcode/list — lista todos os itens com barcode gerado ──────────────
router.get("/barcode/list", requireAnyAuth, (req, res) => {
  const restaurantId: string = (req as any).auth.companyId;
  const items = stockItems
    .filter(s => s.barcode && s.restaurantId === restaurantId)
    .map(s => ({
      stockItemId: s.id,
      name: s.name,
      category: s.category,
      quantity: s.quantity,
      unit: s.unit,
      barcode: s.barcode,
    }));
  res.json({ count: items.length, items });
});

export default router;
