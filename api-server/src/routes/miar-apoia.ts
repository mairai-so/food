/**
 * miar-apoia.ts — MIAR Apoia (Manual, seção 28.4).
 *
 * Conecta artistas/atletas (perfil marcado no App Cliente) com
 * estabelecimentos que trabalham com shows e querem receber contato
 * (marcado no onboarding do Gestor). Não é ideia solta — é o encontro
 * real dos dois lados que foram capturados separadamente antes.
 *
 * POST /api/miar-apoia/perfil         → cliente salva/atualiza o próprio perfil de artista
 * GET  /api/miar-apoia/perfil         → cliente lê o próprio perfil
 * GET  /api/miar-apoia/artistas       → dono vê artistas que batem com a área do estabelecimento
 *                                        (só retorna algo se o estabelecimento tiver
 *                                        shows.recebeContatos ativado — senão 403 explicando)
 */
import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { requireClientAuth, requireOwnerAuth } from "./auth.js";
import {
  salvarPerfilArtista,
  getPerfilArtista,
  perfisArtista,
  restaurants,
  getSettings,
  addEventoArtista,
  atualizarStatusEventoArtista,
  eventosArtista,
  addConsumoArtista,
  consumosArtista,
  type NivelArtista,
  type AreaArtista,
  type StatusEventoArtista,
} from "../lib/data-store.js";

const router: IRouter = Router();

const NIVEIS_VALIDOS: NivelArtista[] = ["profissional", "amador"];
const AREAS_VALIDAS: AreaArtista[] = ["musica", "stand-up", "teatro", "danca", "artes-visuais", "outro"];

// ── POST /api/miar-apoia/perfil — cliente salva o próprio perfil ──────────────
router.post("/miar-apoia/perfil", requireClientAuth, (req, res): void => {
  const clientId = (req as any).clientId as string;

  const body = req.body as {
    nome?: string;
    cidade?: string;
    nivel?: NivelArtista;
    area?: AreaArtista;
    areaOutro?: string;
    desejaConvitesTrabalho?: boolean;
    desejaMensagensEventos?: boolean;
    contato?: string;
  };

  const nome = body.nome?.trim();
  if (!nome) {
    res.status(400).json({ error: "nome é obrigatório" });
    return;
  }
  if (!body.nivel || !NIVEIS_VALIDOS.includes(body.nivel)) {
    res.status(400).json({ error: `nivel deve ser um de: ${NIVEIS_VALIDOS.join(", ")}` });
    return;
  }
  if (body.area && !AREAS_VALIDAS.includes(body.area)) {
    res.status(400).json({ error: `area deve ser uma de: ${AREAS_VALIDAS.join(", ")}` });
    return;
  }

  const perfil = salvarPerfilArtista({
    clientId,
    nome,
    cidade: body.cidade?.trim(),
    nivel: body.nivel,
    area: body.area,
    areaOutro: body.area === "outro" ? body.areaOutro?.trim() : undefined,
    desejaConvitesTrabalho: !!body.desejaConvitesTrabalho,
    desejaMensagensEventos: !!body.desejaMensagensEventos,
    contato: body.contato?.trim(),
    atualizadoEm: new Date().toISOString(),
  });

  res.json(perfil);
});

// ── GET /api/miar-apoia/perfil — cliente lê o próprio perfil ──────────────────
router.get("/miar-apoia/perfil", requireClientAuth, (req, res): void => {
  const clientId = (req as any).clientId as string;
  const perfil = getPerfilArtista(clientId);
  res.json(perfil ?? null);
});

// ── GET /api/miar-apoia/artistas — dono vê artistas que batem com sua área ────
// Só entrega dados se o próprio estabelecimento tiver optado por receber
// contatos (settings.shows.recebeContatos) — sem isso, ninguém vê perfil de
// artista de ninguém, mesmo sendo dono autenticado. Isso é o filtro de
// privacidade: artista só aparece pra quem realmente disse que quer receber.
router.get("/miar-apoia/artistas", requireOwnerAuth, (req, res): void => {
  const companyId = (req as any).owner.companyId as string;
  const restaurant = restaurants.find((r) => r.id === companyId);
  if (!restaurant) {
    res.status(404).json({ error: "Estabelecimento não encontrado" });
    return;
  }

  const estabelecimentoSettings = getSettings(companyId);
  if (!estabelecimentoSettings.shows?.trabalhaComShows || !estabelecimentoSettings.shows?.recebeContatos) {
    res.status(403).json({
      error: "Seu estabelecimento não está configurado pra receber contatos de artistas. Ative isso no onboarding, em Configurações.",
    });
    return;
  }

  const todasAsAreas = estabelecimentoSettings.shows.todasAreas;
  const areasDoEstabelecimento = new Set(estabelecimentoSettings.shows.areas ?? []);

  const artistasCompativeis = Array.from(perfisArtista.values()).filter((a) => {
    if (!a.desejaConvitesTrabalho) return false;
    if (a.nivel !== "profissional") return false; // só profissional recebe convite de trabalho
    if (todasAsAreas) return true;
    return a.area ? areasDoEstabelecimento.has(a.area) : false;
  });

  // Nunca expõe o contato direto sem necessidade — devolve o suficiente pra
  // o dono decidir se quer, e o contato só quando fizer sentido de verdade.
  res.json(
    artistasCompativeis.map((a) => ({
      nome: a.nome,
      cidade: a.cidade,
      area: a.area,
      areaOutro: a.areaOutro,
      contato: a.contato,
    }))
  );
});

// ── Agenda de eventos — Espaço do Artista (Manual, seções 19 e 145) ───────────
// O ambiente do artista concentra agenda de eventos, cachês e consumo num só
// lugar, evitando planilha ou canal separado.

const STATUS_VALIDOS: StatusEventoArtista[] = ["convidado", "confirmado", "recusado", "concluido", "cancelado"];

// POST /api/miar-apoia/eventos — dono convida um artista pra um evento
router.post("/miar-apoia/eventos", requireOwnerAuth, (req, res): void => {
  const companyId = (req as any).owner.companyId as string;
  const restaurant = restaurants.find((r) => r.id === companyId);
  if (!restaurant) {
    res.status(404).json({ error: "Estabelecimento não encontrado" });
    return;
  }

  const body = req.body as {
    artistaClientId?: string;
    titulo?: string;
    data?: string;
    cache?: number;
    couvertParaArtista?: number;
    contrato?: string;
  };

  if (!body.artistaClientId || !perfisArtista.has(body.artistaClientId)) {
    res.status(400).json({ error: "artistaClientId inválido — o artista precisa ter perfil no MIAR Apoia" });
    return;
  }
  const titulo = body.titulo?.trim();
  if (!titulo || !body.data) {
    res.status(400).json({ error: "titulo e data são obrigatórios" });
    return;
  }

  const agora = new Date().toISOString();
  const evento = addEventoArtista({
    id: randomUUID(),
    artistaClientId: body.artistaClientId,
    restaurantId: companyId,
    restaurantName: restaurant.name,
    titulo,
    data: body.data,
    cache: body.cache,
    couvertParaArtista: body.couvertParaArtista,
    contrato: body.contrato?.trim(),
    status: "convidado",
    criadoEm: agora,
    atualizadoEm: agora,
  });

  res.status(201).json(evento);
});

// GET /api/miar-apoia/eventos — agenda do artista (cliente) OU do estabelecimento (dono)
router.get("/miar-apoia/eventos", requireClientAuth, (req, res): void => {
  const clientId = (req as any).clientId as string;
  res.json(
    eventosArtista
      .filter((e) => e.artistaClientId === clientId)
      .sort((a, b) => (a.data < b.data ? -1 : 1))
  );
});

router.get("/miar-apoia/eventos/estabelecimento", requireOwnerAuth, (req, res): void => {
  const companyId = (req as any).owner.companyId as string;
  res.json(
    eventosArtista
      .filter((e) => e.restaurantId === companyId)
      .sort((a, b) => (a.data < b.data ? -1 : 1))
  );
});

// PATCH /api/miar-apoia/eventos/:id/status — artista confirma/recusa, ou dono marca concluído/cancela
router.patch("/miar-apoia/eventos/:id/status", requireClientAuth, (req, res): void => {
  const clientId = (req as any).clientId as string;
  const { status } = req.body as { status?: StatusEventoArtista };
  if (!status || !STATUS_VALIDOS.includes(status)) {
    res.status(400).json({ error: `status deve ser um de: ${STATUS_VALIDOS.join(", ")}` });
    return;
  }
  const evento = atualizarStatusEventoArtista(String(req.params.id), { artistaClientId: clientId }, status);
  if (!evento) {
    res.status(404).json({ error: "Evento não encontrado ou não pertence a este artista" });
    return;
  }
  res.json(evento);
});

router.patch("/miar-apoia/eventos/:id/status-estabelecimento", requireOwnerAuth, (req, res): void => {
  const companyId = (req as any).owner.companyId as string;
  const { status } = req.body as { status?: StatusEventoArtista };
  if (!status || !STATUS_VALIDOS.includes(status)) {
    res.status(400).json({ error: `status deve ser um de: ${STATUS_VALIDOS.join(", ")}` });
    return;
  }
  const evento = atualizarStatusEventoArtista(String(req.params.id), { restaurantId: companyId }, status);
  if (!evento) {
    res.status(404).json({ error: "Evento não encontrado ou não pertence a este estabelecimento" });
    return;
  }
  res.json(evento);
});

// ── Controle de consumo — artista acessa o ambiente Cliente normalmente, e o
// que consome se relaciona com a própria conta aqui. Cortesia não desconta
// do cachê; não-cortesia soma no fechamento financeiro com o artista.
router.post("/miar-apoia/consumo", requireOwnerAuth, (req, res): void => {
  const companyId = (req as any).owner.companyId as string;
  const body = req.body as {
    artistaClientId?: string;
    eventoId?: string;
    descricao?: string;
    valor?: number;
    cortesia?: boolean;
  };

  if (!body.artistaClientId || !perfisArtista.has(body.artistaClientId)) {
    res.status(400).json({ error: "artistaClientId inválido" });
    return;
  }
  const descricao = body.descricao?.trim();
  if (!descricao || typeof body.valor !== "number" || body.valor < 0) {
    res.status(400).json({ error: "descricao e valor (>= 0) são obrigatórios" });
    return;
  }

  const consumo = addConsumoArtista({
    id: randomUUID(),
    artistaClientId: body.artistaClientId,
    restaurantId: companyId,
    eventoId: body.eventoId,
    descricao,
    valor: body.valor,
    cortesia: !!body.cortesia,
    criadoEm: new Date().toISOString(),
  });

  res.status(201).json(consumo);
});

// GET /api/miar-apoia/consumo — artista vê o próprio consumo (todas as casas)
router.get("/miar-apoia/consumo", requireClientAuth, (req, res): void => {
  const clientId = (req as any).clientId as string;
  res.json(consumosArtista.filter((c) => c.artistaClientId === clientId));
});

// GET /api/miar-apoia/consumo/estabelecimento/:artistaClientId — dono vê o
// fechamento financeiro de cachê + consumo de UM artista com esse estabelecimento
router.get("/miar-apoia/consumo/estabelecimento/:artistaClientId", requireOwnerAuth, (req, res): void => {
  const companyId = (req as any).owner.companyId as string;
  const { artistaClientId } = req.params;

  const consumos = consumosArtista.filter(
    (c) => c.restaurantId === companyId && c.artistaClientId === artistaClientId
  );
  const eventos = eventosArtista.filter(
    (e) => e.restaurantId === companyId && e.artistaClientId === artistaClientId
  );

  const totalConsumoDescontavel = consumos.filter((c) => !c.cortesia).reduce((s, c) => s + c.valor, 0);
  const totalCache = eventos.filter((e) => e.status === "concluido").reduce((s, e) => s + (e.cache ?? 0), 0);

  res.json({
    consumos,
    eventos,
    totalConsumoDescontavel,
    totalCache,
    saldoAReceber: totalCache - totalConsumoDescontavel,
  });
});

export default router;
