/**
 * perimetro.ts — Segurança física opcional: trava o uso dos apps de
 * operação a "dentro do restaurante". O dono liga/desliga em Configurações
 * (pode ter um motivo legítimo pra deixar desligado).
 *
 * Duas camadas que se cobrem, checadas nesta ordem:
 *  1. Rede local — o celular está numa das redes Wi-Fi cadastradas do
 *     restaurante (comparação por prefixo de IP). Mais forte: não dá pra
 *     falsificar, é físico.
 *  2. GPS — se a rede não bate (ex.: celular em dados móveis), aceita se
 *     as coordenadas enviadas pelo app estiverem dentro do raio da casa.
 *     Mais fraca (pode ser falsificada), por isso só entra como reserva.
 *
 * Se nenhuma das duas informações estiver disponível e o perímetro estiver
 * ativo, o acesso é negado — silêncio não conta como "dentro".
 */
import type { Request } from "express";
import { getSettings } from "./data-store.js";

function distanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ipDentroDaRede(ip: string, prefixos: string[]): boolean {
  const limpo = ip.replace("::ffff:", "");
  // localhost/rede de desenvolvimento sempre passa — evita travar o próprio teste local
  if (limpo === "127.0.0.1" || limpo === "::1") return true;
  return prefixos.some((p) => p && limpo.startsWith(p));
}

export interface PerimetroResultado {
  permitido: boolean;
  motivo?: string;
}

/**
 * Verifica se a requisição está "dentro do restaurante". Retorna sempre
 * permitido=true se o perímetro estiver desligado nas configurações.
 */
export function checkPerimetro(req: Request, exigirParaGestor: boolean, companyId: string): PerimetroResultado {
  const config = getSettings(companyId).perimetro;
  if (!config || !config.ativo) return { permitido: true };
  if (exigirParaGestor === false && config.aplicarNoGestor === false) {
    // chamado é do gestor e o dono optou por não aplicar o perímetro nele
  }

  // Camada 1: rede local
  const ip = req.ip ?? req.socket.remoteAddress ?? "";
  if (config.redesLocaisPermitidas.length > 0 && ipDentroDaRede(ip, config.redesLocaisPermitidas)) {
    return { permitido: true };
  }

  // Camada 2: GPS enviado pelo app (header custom, opcional)
  const geoHeader = req.headers["x-miar-geo"];
  if (typeof geoHeader === "string" && config.latitude != null && config.longitude != null) {
    const [latStr, lonStr] = geoHeader.split(",");
    const lat = Number(latStr);
    const lon = Number(lonStr);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      const dist = distanciaMetros(lat, lon, config.latitude, config.longitude);
      if (dist <= config.raioMetros) return { permitido: true };
    }
  }

  return { permitido: false, motivo: "Acesso permitido apenas dentro do restaurante" };
}
