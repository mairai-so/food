/**
 * sse.ts — Server-Sent Events para atualizações em tempo real.
 *
 * Rotas mutantes chamam `broadcast(event, data)` após alterar o store.
 * O frontend assina GET /api/events e invalida queries ao receber eventos.
 */

import type { Request, Response } from "express";

type SseClient = Response;

const clients = new Set<SseClient>();

/** Registra um cliente SSE e remove ao desconectar. */
export function registerClient(req: Request, res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Nginx / proxy reverso
  res.flushHeaders();

  // Heartbeat a cada 20 s para manter a conexão viva pelo proxy
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 20_000);

  clients.add(res);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}

/** Envia um evento para todos os clientes conectados. */
export function broadcast(event: string, data?: unknown): void {
  const payload =
    data !== undefined ? `data: ${JSON.stringify(data)}\n\n` : "data: {}\n\n";
  const message = `event: ${event}\n${payload}`;
  for (const client of clients) {
    client.write(message);
  }
}
