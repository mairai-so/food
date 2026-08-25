/**
 * /api/transcribe — Transcrição de áudio por servidor (Whisper via Groq).
 *
 * Genérica e sem nenhuma dependência de domínio (cozinha, garçom, etc).
 * Existe pra substituir o reconhecimento de voz do navegador (instável fora
 * do Chrome, ausente em vários Android) por transcrição confiável no
 * servidor. Qualquer app do monorepo pode chamar essa mesma rota — é a base
 * da extensão de "mão livre" reaproveitável entre cozinha, garçom, equipe.
 */

import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function parseKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean);
}

const groqKeys = parseKeys(process.env.GROQ_API_KEYS ?? process.env.GROQ_API_KEY);
let groqKeyIndex = 0;

function nextGroqKey(): string {
  if (groqKeys.length === 0) throw new Error("No GROQ_API_KEYS configured");
  const key = groqKeys[groqKeyIndex % groqKeys.length];
  groqKeyIndex++;
  return key;
}

router.post("/transcribe", async (req, res): Promise<void> => {
  const { audioBase64, mimeType = "audio/webm" } = req.body as {
    audioBase64?: string;
    mimeType?: string;
  };

  if (!audioBase64) {
    res.status(400).json({ error: "audioBase64 é obrigatório" });
    return;
  }

  if (groqKeys.length === 0) {
    res.status(503).json({ error: "GROQ_API_KEYS não configurada." });
    return;
  }

  const attempts = groqKeys.length;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const apiKey = nextGroqKey();
    try {
      const audioBuffer = Buffer.from(audioBase64, "base64");
      const ext = mimeType.includes("mp4") ? "mp4"
        : mimeType.includes("ogg") ? "ogg"
        : mimeType.includes("wav") ? "wav"
        : mimeType.includes("mp3") ? "mp3"
        : "webm";

      const formData = new FormData();
      formData.append("file", new Blob([audioBuffer], { type: mimeType }), `audio.${ext}`);
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("language", "pt");
      formData.append("response_format", "json");
      formData.append("temperature", "0");

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Whisper ${response.status}: ${errText}`);
      }

      const result = (await response.json()) as { text: string };
      res.json({ text: result.text ?? "" });
      return;
    } catch (err) {
      lastError = err as Error;
      logger.warn({ attempt, err: (err as Error).message }, "Transcribe attempt failed");
    }
  }

  logger.error({ err: lastError }, "All transcribe attempts exhausted");
  res.status(503).json({ error: "Transcrição indisponível no momento. Tente novamente." });
});

export default router;
