import { Router, type IRouter } from "express";
import { requireAnyAuth, requireOwnerAuth } from "./auth";
import { logger } from "../lib/logger";
import { randomUUID } from "crypto";
import { stockAuditAlerts, employees, type StockAuditAlert } from "../lib/data-store";

const router: IRouter = Router();

function parseKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean);
}

const geminiKeys = parseKeys(process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY);
let keyIdx = 0;
function nextKey(): string {
  if (!geminiKeys.length) throw new Error("No GEMINI_API_KEYS configured");
  return geminiKeys[keyIdx++ % geminiKeys.length];
}

const VISION_SYSTEM = `Você é "Olhos da MIAR", assistente de monitoramento inteligente para restaurantes.
Analise a imagem com foco em:
- Estado da cozinha (atividade, organização, pratos em preparo, possíveis riscos)
- Ocupação do salão e comportamento dos clientes
- Situações que exigem atenção imediata
- Higiene e segurança visível
Responda em português brasileiro, de forma direta e objetiva. Máximo 2-3 frases curtas.
Se a imagem for escura, borrada ou sem conteúdo relevante, informe isso claramente.`;

const MODELS = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"];

// ─── Analyze endpoint (accepts base64 frame) ──────────────────────────────────
router.post("/vision/analyze", async (req, res): Promise<void> => {
  const { imageBase64, mimeType = "image/jpeg", question } = req.body as {
    imageBase64: string;
    mimeType?: string;
    question?: string;
  };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 é obrigatório" });
    return;
  }

  const prompt = question?.trim() || "Descreva o que está acontecendo nesta imagem de forma útil para a equipe do restaurante.";
  const attempts = Math.max(geminiKeys.length, 1) * MODELS.length;
  let lastError: Error | null = null;

  for (let i = 0; i < attempts; i++) {
    const apiKey = nextKey();
    const model = MODELS[i % MODELS.length];

    try {
      logger.info({ model }, "Vision analyze attempt");
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: VISION_SYSTEM }] },
            contents: [{
              role: "user",
              parts: [
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
                { text: prompt },
              ],
            }],
            generationConfig: { maxOutputTokens: 200, temperature: 0.3 },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        if ([429, 401, 403].includes(response.status)) {
          throw new Error(`Gemini Vision ${model} ${response.status}`);
        }
        throw new Error(`Gemini Vision error ${response.status}: ${err}`);
      }

      const data = (await response.json()) as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Resposta vazia do Gemini Vision");

      logger.info({ model }, "Vision analyze OK");
      res.json({ analysis: text, model });
      return;
    } catch (err) {
      lastError = err as Error;
      logger.warn({ model, err: (err as Error).message }, "Vision attempt failed");
    }
  }

  logger.error({ err: lastError }, "All vision providers failed");
  res.status(503).json({ error: "IA de visão temporariamente indisponível. Tente novamente." });
});

// ─── Proxy frame for MJPEG cameras (avoids browser CORS on canvas capture) ───
router.post("/vision/proxy-frame", async (req, res): Promise<void> => {
  const { url } = req.body as { url: string };
  if (!url) { res.status(400).json({ error: "url é obrigatório" }); return; }

  try {
    // Fetch with a short timeout — MJPEG streams are infinite, we just want the first frame
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = response.headers.get("content-type") ?? "image/jpeg";

    // For MJPEG streams: read until we have at least one complete JPEG (FFD8...FFD9)
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const MAX_BYTES = 1_000_000; // 1MB max

    while (totalBytes < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      totalBytes += value.byteLength;

      // Check if we have a complete JPEG (ends with FFD9)
      const last = chunks[chunks.length - 1];
      if (last.length >= 2 &&
          last[last.length - 2] === 0xFF &&
          last[last.length - 1] === 0xD9) {
        break;
      }
    }
    reader.cancel();

    const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)));

    // Find the last complete JPEG in the buffer (starts FF D8, ends FF D9)
    let jpegStart = -1;
    let jpegEnd = -1;
    for (let i = buffer.length - 2; i >= 0; i--) {
      if (buffer[i] === 0xFF && buffer[i + 1] === 0xD9) { jpegEnd = i + 2; break; }
    }
    for (let i = 0; i < jpegEnd; i++) {
      if (buffer[i] === 0xFF && buffer[i + 1] === 0xD8) { jpegStart = i; break; }
    }

    const jpeg = jpegStart >= 0 && jpegEnd > jpegStart
      ? buffer.slice(jpegStart, jpegEnd)
      : buffer;

    res.json({
      base64: jpeg.toString("base64"),
      mimeType: "image/jpeg",
    });
  } catch (err) {
    logger.warn({ url, err: (err as Error).message }, "proxy-frame failed");
    res.status(502).json({ error: "Não foi possível capturar frame da câmera" });
  }
});

// ─── Stock Count + Expiry Scan ───────────────────────────────────────────────
const STOCK_SYSTEM = `Você é um assistente especializado em controle de estoque para restaurantes.
Analise a imagem enviada e:
1. IDENTIFIQUE todos os produtos alimentares, bebidas ou materiais visíveis
2. CONTE a quantidade de cada item (unidades, volumes, pesos estimados)
3. LEIA as datas de validade/vencimento impressas nas embalagens (procure por: "Val:", "Venc:", "Validade:", "Best before:", "Use by:", datas no formato DD/MM/AAAA ou MM/AAAA)
4. CLASSIFIQUE cada item numa categoria: Carnes, Grãos, Laticínios, Bebidas, Temperos, Descartáveis, Outros

Responda APENAS com um JSON válido, sem markdown, sem explicações, no formato:
{
  "items": [
    {
      "name": "Nome do produto",
      "quantity": 3,
      "unit": "un|kg|L|pacotes|caixas|garrafas|sacos|latas",
      "category": "Categoria",
      "expiresAt": "2025-08-15" | null,
      "expiryRaw": "texto exato lido da embalagem ou null",
      "confidence": "high|medium|low"
    }
  ]
}

Se não conseguir ler a validade, use null. Se a imagem não tiver produtos visíveis, retorne {"items": []}.`;

// ─── Live-only enforcement for stock audit ────────────────────────────────────
// Upload de vídeo/imagem gravada previamente é PROIBIDO para evitar fraudes.
// Somente frames capturados em tempo real da câmera conectada são aceitos.
// O imageBase64 nunca é salvo no servidor ou logado.
router.post("/vision/stock-count", requireAnyAuth, async (req, res): Promise<void> => {
  // REGRA MULTI-TENANT: restaurantId nunca vem do body — sempre do token.
  const restaurantId: string = (req as any).auth.companyId;
  const {
    imageBase64,
    mimeType = "image/jpeg",
    liveCapture,
    capturedAt,
    cameraId,
    cameraSource,
  } = req.body as {
    imageBase64: string;
    mimeType?: string;
    liveCapture?: boolean;
    capturedAt?: string;
    cameraId?: string;
    cameraSource?: string;
  };

  // ── Regra 1: exigir flag de captura ao vivo ──────────────────────────────
  if (liveCapture !== true) {
    res.status(403).json({
      error: "ACESSO_NEGADO_UPLOAD_PRE_GRAVADO",
      message:
        "Upload de vídeo ou imagem gravada previamente é proibido para auditoria de estoque. " +
        "Apenas frames capturados em tempo real da câmera conectada são aceitos. " +
        "Use a câmera ao vivo — não faça upload de arquivos.",
    });
    return;
  }

  // ── Regra 2: rejeitar origem de arquivo ────────────────────────────────────
  if (cameraSource === "file" || cameraSource === "upload" || cameraId === "upload") {
    res.status(403).json({
      error: "ACESSO_NEGADO_ORIGEM_INVALIDA",
      message: "cameraSource 'file' ou 'upload' não é permitido. Use cameraSource 'device', 'mjpeg' ou 'hls'.",
    });
    return;
  }

  // ── Regra 3: validar frescor do timestamp (máximo 30 segundos) ─────────────
  if (!capturedAt) {
    res.status(400).json({
      error: "TIMESTAMP_OBRIGATORIO",
      message: "O campo capturedAt (ISO 8601) é obrigatório para auditoria ao vivo. Capture um novo frame da câmera.",
    });
    return;
  }
  const captureMs = new Date(capturedAt).getTime();
  if (isNaN(captureMs)) {
    res.status(400).json({ error: "TIMESTAMP_INVALIDO", message: "capturedAt deve ser uma data ISO 8601 válida." });
    return;
  }
  const ageSeconds = (Date.now() - captureMs) / 1000;
  if (ageSeconds > 30 || ageSeconds < -5) {
    res.status(400).json({
      error: "FRAME_EXPIRADO",
      message: `Frame com ${Math.round(ageSeconds)}s de idade. O limite é 30 segundos. Capture um novo frame diretamente da câmera.`,
    });
    return;
  }

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 é obrigatório" });
    return;
  }

  const resolvedCameraId = cameraId ?? "device-0";
  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError: Error | null = null;

  for (let i = 0; i < Math.max(geminiKeys.length, 1) * models.length; i++) {
    const apiKey = nextKey();
    const model = models[i % models.length];

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: STOCK_SYSTEM }] },
            contents: [{
              role: "user",
              parts: [
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
                { text: "Analise esta imagem de estoque/prateleira e retorne o JSON com todos os produtos visíveis." },
              ],
            }],
            generationConfig: { maxOutputTokens: 1024, temperature: 0.1 },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        if ([429, 401, 403].includes(response.status)) throw new Error(`${model} ${response.status}`);
        throw new Error(`${model} error ${response.status}: ${err}`);
      }

      const data = (await response.json()) as any;
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      text = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("Resposta não contém JSON válido");
        parsed = JSON.parse(match[0]);
      }

      // ── Registrar log de auditoria (sem salvar o imageBase64) ──────────────
      const { auditLogs } = await import("../lib/data-store");
      const { scheduleSave } = await import("../lib/persistence.js");
      const { randomUUID } = await import("node:crypto");
      const auditEntry = {
        id: randomUUID(),
        restaurantId,
        employeeId: "system-vision",
        employeeName: "Câmera ao Vivo",
        employeeRole: "system",
        action: "STOCK_AUDIT_LIVE_SCAN",
        description: `Auditoria ao vivo via câmera ${resolvedCameraId}: ${parsed.items?.length ?? 0} item(s) identificado(s)`,
        metadata: {
          cameraId: resolvedCameraId,
          cameraSource: cameraSource ?? "device",
          capturedAt,
          itemCount: parsed.items?.length ?? 0,
          model,
          // imageBase64 NÃO é salvo — prevenção de fraude
        },
        timestamp: new Date().toISOString(),
      };
      auditLogs.push(auditEntry);
      scheduleSave("auditLogs", auditLogs);

      // ── Alertas KDS para itens críticos (estoque ausente ou vencendo) ──────
      const criticalItems = (parsed.items ?? []).filter(
        (item: any) => item.quantity === 0 || item.quantity < (item.minQuantity ?? 0) || item.alert,
      );
      if (criticalItems.length > 0) {
        const { broadcast } = await import("../lib/sse");
        broadcast("kds-stock-alert", {
          source: "live-camera-audit",
          cameraId: resolvedCameraId,
          capturedAt,
          alerts: criticalItems.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            alert: item.alert ?? "estoque baixo",
          })),
        });
      }

      logger.info({ model, count: parsed.items?.length, cameraId: resolvedCameraId }, "Stock count (live) OK");
      res.json({ ...parsed, auditId: auditEntry.id, liveCapture: true, cameraId: resolvedCameraId });
      return;
    } catch (err) {
      lastError = err as Error;
      logger.warn({ model, err: (err as Error).message }, "Stock count attempt failed");
    }
  }

  res.status(503).json({ error: "IA de contagem indisponível. Tente novamente." });
});

// ─── Cash / Banknote Check ("Nota Falsa") ─────────────────────────────────────
// Reaproveita a mesma infraestrutura de câmera ao vivo do stock-count: sem
// upload de arquivo, timestamp fresco (30s), funciona igual com webcam do
// computador do caixa ou câmera do celular (cameraSource: 'device' nos dois casos).
const CASH_CHECK_SYSTEM = `Você é um assistente de TRIAGEM visual de cédulas de Real (BRL) para o caixa de um restaurante.

IMPORTANTE — LIMITAÇÃO FÍSICA: uma câmera comum (webcam ou celular) NÃO consegue
autenticar uma cédula com a mesma confiabilidade de luz ultravioleta ou caneta
detectora. Você NUNCA deve declarar com certeza que uma nota é falsa ou verdadeira.
Sua função é apenas apontar SUSPEITA VISUAL para o operador humano decidir.

Analise a imagem da cédula e:
1. Identifique o valor aparente (R$ 2, 5, 10, 20, 50, 100, 200)
2. Observe sinais visuais que mereçam atenção: nitidez/borrão da impressão,
   cor fora do padrão, textura aparentemente lisa demais (papel-moeda real tem
   textura), ausência de elementos visíveis de segurança esperados para aquele
   valor, bordas ou proporções estranhas
3. Classifique o nível de suspeita

Responda APENAS com JSON válido, sem markdown:
{
  "valorAparente": "R$ 50" | null,
  "nivelSuspeita": "sem_suspeita" | "suspeita_leve" | "suspeita_alta",
  "observacoes": "descrição curta do que motivou o nível de suspeita, ou null se sem_suspeita",
  "recomendacao": "texto curto pro operador, sempre no tom de sugestão de conferência manual, nunca afirmação de que é falsa"
}

Se a imagem não mostrar uma cédula claramente, retorne nivelSuspeita "suspeita_leve" com observacoes explicando que não foi possível analisar direito, pedindo nova captura.`;

router.post("/vision/cash-check", requireAnyAuth, async (req, res): Promise<void> => {
  // REGRA MULTI-TENANT: restaurantId nunca vem do body — sempre do token.
  const restaurantId: string = (req as any).auth.companyId;
  const {
    imageBase64,
    mimeType = "image/jpeg",
    liveCapture,
    capturedAt,
    cameraId,
    cameraSource,
  } = req.body as {
    imageBase64: string;
    mimeType?: string;
    liveCapture?: boolean;
    capturedAt?: string;
    cameraId?: string;
    cameraSource?: string;
  };

  // ── Mesmas 3 regras de segurança do stock-count ──────────────────────────
  if (liveCapture !== true) {
    res.status(403).json({
      error: "ACESSO_NEGADO_UPLOAD_PRE_GRAVADO",
      message:
        "Upload de imagem gravada previamente é proibido para conferência de cédula. " +
        "Apenas frames capturados em tempo real da câmera conectada são aceitos.",
    });
    return;
  }
  if (cameraSource === "file" || cameraSource === "upload" || cameraId === "upload") {
    res.status(403).json({
      error: "ACESSO_NEGADO_ORIGEM_INVALIDA",
      message: "cameraSource 'file' ou 'upload' não é permitido. Use cameraSource 'device', 'mjpeg' ou 'hls'.",
    });
    return;
  }
  if (!capturedAt) {
    res.status(400).json({
      error: "TIMESTAMP_OBRIGATORIO",
      message: "O campo capturedAt (ISO 8601) é obrigatório. Capture um novo frame da câmera.",
    });
    return;
  }
  const captureMs = new Date(capturedAt).getTime();
  if (isNaN(captureMs)) {
    res.status(400).json({ error: "TIMESTAMP_INVALIDO", message: "capturedAt deve ser uma data ISO 8601 válida." });
    return;
  }
  const ageSeconds = (Date.now() - captureMs) / 1000;
  if (ageSeconds > 30 || ageSeconds < -5) {
    res.status(400).json({
      error: "FRAME_EXPIRADO",
      message: `Frame com ${Math.round(ageSeconds)}s de idade. O limite é 30 segundos. Capture um novo frame diretamente da câmera.`,
    });
    return;
  }
  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 é obrigatório" });
    return;
  }

  const resolvedCameraId = cameraId ?? "device-0";
  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];

  for (let i = 0; i < Math.max(geminiKeys.length, 1) * models.length; i++) {
    const apiKey = nextKey();
    const model = models[i % models.length];

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: CASH_CHECK_SYSTEM }] },
            contents: [{
              role: "user",
              parts: [
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
                { text: "Analise esta cédula e retorne o JSON de triagem." },
              ],
            }],
            generationConfig: { maxOutputTokens: 300, temperature: 0.1 },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        if ([429, 401, 403].includes(response.status)) throw new Error(`${model} ${response.status}`);
        throw new Error(`${model} error ${response.status}: ${err}`);
      }

      const data = (await response.json()) as any;
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      text = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("Resposta não contém JSON válido");
        parsed = JSON.parse(match[0]);
      }

      // ── Registrar log de auditoria (sem salvar o imageBase64) ──────────────
      const { auditLogs } = await import("../lib/data-store");
      const { scheduleSave } = await import("../lib/persistence.js");
      const { randomUUID } = await import("node:crypto");
      const auditEntry = {
        id: randomUUID(),
        restaurantId,
        employeeId: "system-vision",
        employeeName: "Câmera ao Vivo",
        employeeRole: "system",
        action: "CASH_CHECK_LIVE_SCAN",
        description: `Conferência de cédula via câmera ${resolvedCameraId}: ${parsed.nivelSuspeita ?? "?"}`,
        metadata: {
          cameraId: resolvedCameraId,
          cameraSource: cameraSource ?? "device",
          capturedAt,
          nivelSuspeita: parsed.nivelSuspeita,
          model,
          // imageBase64 NÃO é salvo — prevenção de fraude
        },
        timestamp: new Date().toISOString(),
      };
      auditLogs.push(auditEntry);
      scheduleSave("auditLogs", auditLogs);

      logger.info({ model, nivelSuspeita: parsed.nivelSuspeita, cameraId: resolvedCameraId }, "Cash check (live) OK");
      res.json({ ...parsed, auditId: auditEntry.id, liveCapture: true, cameraId: resolvedCameraId });
      return;
    } catch (err) {
      logger.warn({ model, err: (err as Error).message }, "Cash check attempt failed");
    }
  }

  res.status(503).json({ error: "IA de conferência indisponível. Tente novamente." });
});

// ─── Invoice / Nota Fiscal Scan ──────────────────────────────────────────────
const INVOICE_SYSTEM = `Você é um assistente especializado em leitura de documentos fiscais brasileiros para restaurantes.
Analise a imagem enviada que pode ser uma Nota Fiscal, DANFE, Cupom Fiscal, NF-e, NFS-e, ou qualquer nota de entrega/recebimento.

Extraia TODOS os itens/produtos listados no documento.
Para cada item, extraia:
- Nome do produto (exatamente como está no documento)
- Quantidade (número)
- Unidade de medida (UN, KG, CX, PCT, FD, LT, etc. — converta para português: un, kg, caixa, pacote, fardo, litro)
- Valor unitário (se disponível)
- Data de validade (se impressa no documento)

Responda APENAS com JSON válido, sem markdown:
{
  "supplier": "nome do fornecedor ou null",
  "invoiceNumber": "número da nota ou null",
  "invoiceDate": "data em YYYY-MM-DD ou null",
  "totalValue": 0.00,
  "items": [
    {
      "name": "Nome do produto",
      "quantity": 10,
      "unit": "kg|un|caixas|pacotes|litros|garrafas|sacos|latas|fardos",
      "unitPrice": 5.50,
      "expiresAt": "YYYY-MM-DD ou null",
      "category": "Carnes|Grãos|Laticínios|Bebidas|Temperos|Descartáveis|Outros"
    }
  ]
}

Se o documento não for uma nota fiscal reconhecível, retorne: {"error": "Documento não reconhecido como nota fiscal"}`;

router.post("/vision/invoice-scan", requireAnyAuth, async (req, res): Promise<void> => {
  const { imageBase64, mimeType = "image/jpeg" } = req.body as {
    imageBase64: string;
    mimeType?: string;
  };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 é obrigatório" });
    return;
  }

  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError: Error | null = null;

  for (let i = 0; i < Math.max(geminiKeys.length, 1) * models.length; i++) {
    const apiKey = nextKey();
    const model = models[i % models.length];
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: INVOICE_SYSTEM }] },
            contents: [{
              role: "user",
              parts: [
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
                { text: "Leia este documento fiscal e extraia todos os produtos/itens." },
              ],
            }],
            generationConfig: { maxOutputTokens: 2048, temperature: 0.05 },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        if ([429, 401, 403].includes(response.status)) throw new Error(`${model} ${response.status}`);
        throw new Error(`error ${response.status}: ${err}`);
      }

      const data = (await response.json()) as any;
      let text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      text = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

      let parsed: any;
      try { parsed = JSON.parse(text); }
      catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("JSON inválido");
        parsed = JSON.parse(match[0]);
      }

      logger.info({ model, items: parsed.items?.length }, "Invoice scan OK");
      res.json(parsed);
      return;
    } catch (err) {
      lastError = err as Error;
      logger.warn({ model, err: (err as Error).message }, "Invoice scan failed");
    }
  }

  res.status(503).json({ error: "Leitura de nota indisponível. Tente novamente." });
});

// ─── Auditoria de estoque — exige captura AO VIVO pela câmera ──────────────────
// O app do celular deve usar <input capture="environment"> (força câmera,
// bloqueia galeria) e enviar captureMethod: "camera-ao-vivo". Se vier
// qualquer outro valor (ex.: "galeria", ou ausente), ou se o timestamp do
// arquivo divergir mais de 2 minutos do horário do servidor, o sistema
// registra um alerta que só o DONO vê — o funcionário nunca sabe que esse
// alerta foi disparado, pra não avisar que está sendo monitorado.
router.post("/vision/auditoria-estoque", requireAnyAuth, async (req, res): Promise<void> => {
  const auth = (req as any).auth as {
    companyId: string;
    employeeId?: string;
    isEmployee?: boolean;
  };
  const { imageBase64, captureMethod, fileTimestamp, itemAuditado } = req.body as {
    imageBase64?: string;
    captureMethod?: string;
    fileTimestamp?: string; // ISO — horário que o app diz que a foto/frame foi capturado
    itemAuditado?: string;
  };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 é obrigatório" });
    return;
  }

  let employeeName: string | undefined;
  if (auth.isEmployee && auth.employeeId) {
    employeeName = employees.find((e) => e.id === auth.employeeId)?.name;
  }

  const motivos: string[] = [];

  if (captureMethod !== "camera-ao-vivo") {
    motivos.push(`Método de captura reportado foi "${captureMethod ?? "não informado"}", não câmera ao vivo`);
  }

  if (fileTimestamp) {
    const diffMs = Math.abs(Date.now() - new Date(fileTimestamp).getTime());
    const DOIS_MINUTOS = 2 * 60 * 1000;
    if (!Number.isNaN(diffMs) && diffMs > DOIS_MINUTOS) {
      motivos.push(`Horário do arquivo diverge ${Math.round(diffMs / 60000)} min do horário real — pode ser mídia antiga`);
    }
  }

  if (motivos.length > 0) {
    const alerta: StockAuditAlert = {
      id: randomUUID(),
      restaurantId: auth.companyId,
      employeeId: auth.employeeId,
      employeeName,
      motivo: motivos.join("; ") + (itemAuditado ? ` (item: ${itemAuditado})` : ""),
      capturaMethod: captureMethod ?? "não informado",
      createdAt: new Date().toISOString(),
    };
    stockAuditAlerts.push(alerta);
    logger.warn({ alerta }, "Auditoria de estoque suspeita — alerta silencioso gerado");
  }

  // A resposta pro funcionário é sempre neutra — nunca revela se o alerta disparou.
  res.status(201).json({ ok: true, registrado: true });
});

// GET /vision/auditoria-estoque/alertas — só o dono vê os alertas silenciosos
router.get("/vision/auditoria-estoque/alertas", requireOwnerAuth, (req, res): void => {
  const companyId: string = (req as any).owner.companyId;
  const alertas = stockAuditAlerts
    .filter((a) => a.restaurantId === companyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(alertas);
});

// PATCH /vision/auditoria-estoque/alertas/:id/resolver — dono marca como visto/resolvido
router.patch("/vision/auditoria-estoque/alertas/:id/resolver", requireOwnerAuth, (req, res): void => {
  const companyId: string = (req as any).owner.companyId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const alerta = stockAuditAlerts.find((a) => a.id === id && a.restaurantId === companyId);
  if (!alerta) {
    res.status(404).json({ error: "Alerta não encontrado" });
    return;
  }
  alerta.resolvedAt = new Date().toISOString();
  res.json(alerta);
});

export default router;
