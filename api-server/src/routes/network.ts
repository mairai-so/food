import { Router } from "express";
import { networkInterfaces, hostname } from "os";
import { requireAnyAuth } from "./auth.js";

const router = Router();

/**
 * GET /api/network/info
 * Retorna informações do servidor local para descoberta na rede.
 * Usado pela página "Rede Local" do gestor para verificar conectividade.
 * Protegido: mostra IPs internos do servidor, não deve ficar aberto ao
 * público.
 */
router.get("/network/info", requireAnyAuth, (_req, res) => {
  const ifaces = networkInterfaces();
  const ips: string[] = [];

  for (const ifaceList of Object.values(ifaces)) {
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }

  res.json({
    name: "MIAR AI/FOOD",
    version: "1.0.0",
    hostname: hostname(),
    ips,
    port: Number(process.env.PORT ?? 5000),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/network/ping
 * Verifica se o servidor está respondendo. Usado para medir latência.
 */
router.get("/network/ping", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

export default router;
