/**
 * mural-empregos.ts — Mural de Empregos (Manual, seção 21.2 / 57).
 *
 * Conecta estabelecimentos, profissionais e candidatos. Estrutura própria,
 * separada do Feed do Cliente — vagas não se misturam a posts de feed.
 * Uso é gratuito, sem cobrança adicional em nenhum plano.
 *
 * GET    /api/mural-empregos/vagas            → vagas do PRÓPRIO estabelecimento (dono logado), todas (inclusive pausada/encerrada)
 * GET    /api/mural-empregos/publicas         → vagas ativas de TODOS os estabelecimentos (candidato navegando, sem auth)
 * POST   /api/mural-empregos/vagas            → dono cria vaga
 * PATCH  /api/mural-empregos/vagas/:id/status → dono ativa/pausa/encerra a própria vaga
 * POST   /api/mural-empregos/vagas/:id/interesse → candidato demonstra interesse (rota pública)
 * GET    /api/mural-empregos/vagas/:id/interesses → dono vê quem se candidatou à própria vaga
 */
import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { requireOwnerAuth } from "./auth.js";
import {
  vagas,
  vagaInteresses,
  addVaga,
  atualizarStatusVaga,
  addVagaInteresse,
  restaurants,
  type VagaStatus,
  type VagaTipo,
} from "../lib/data-store.js";

const router: IRouter = Router();

// ── filtro de palavrão (mesma camada base usada no Feed Interno) ──────────
const PALAVRAS_BASE = [
  "merda", "porra", "caralho", "buceta", "foder", "fodase", "puta",
  "viado", "cuzao", "corno", "desgraca", "arrombado", "otario",
];

function contemPalavrao(texto: string): boolean {
  const tokens = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos pra comparar
    .split(/[^a-z0-9]+/);
  return tokens.some((t) => PALAVRAS_BASE.includes(t));
}

const TIPOS_VALIDOS: VagaTipo[] = ["efetivo", "freela", "temporario", "meio-periodo"];

// ── GET /api/mural-empregos/vagas — vagas do próprio estabelecimento ──────
router.get("/mural-empregos/vagas", requireOwnerAuth, (req, res): void => {
  const companyId = (req as any).owner.companyId as string;
  res.json(vagas.filter((v) => v.restaurantId === companyId));
});

// ── GET /api/mural-empregos/publicas — candidato navegando, sem auth ──────
router.get("/mural-empregos/publicas", (_req, res): void => {
  res.json(
    vagas
      .filter((v) => v.status === "ativa")
      .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
  );
});

// ── POST /api/mural-empregos/vagas — dono cria vaga ────────────────────────
router.post("/mural-empregos/vagas", requireOwnerAuth, (req, res): void => {
  const companyId = (req as any).owner.companyId as string;
  const restaurant = restaurants.find((r) => r.id === companyId);
  if (!restaurant) {
    res.status(404).json({ error: "Estabelecimento não encontrado" });
    return;
  }

  const body = req.body as {
    titulo?: string;
    descricao?: string;
    cargo?: string;
    tipo?: VagaTipo;
    remuneracao?: string;
    contato?: string;
  };

  const titulo = body.titulo?.trim();
  const descricao = body.descricao?.trim();
  const cargo = body.cargo?.trim();
  const contato = body.contato?.trim();
  const tipo = body.tipo;

  if (!titulo || !descricao || !cargo || !contato) {
    res.status(400).json({ error: "titulo, descricao, cargo e contato são obrigatórios" });
    return;
  }
  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    res.status(400).json({ error: `tipo deve ser um de: ${TIPOS_VALIDOS.join(", ")}` });
    return;
  }

  // Moderação: duas camadas — bloqueia palavrão em título e descrição antes
  // de a vaga ir ao ar (mesma lógica de duas camadas do Feed Interno).
  if (contemPalavrao(titulo) || contemPalavrao(descricao)) {
    res.status(422).json({ error: "O texto da vaga contém linguagem inadequada. Revise e tente novamente." });
    return;
  }

  const agora = new Date().toISOString();
  const vaga = addVaga({
    id: randomUUID(),
    restaurantId: companyId,
    restaurantName: restaurant.name,
    titulo,
    descricao,
    cargo,
    tipo,
    remuneracao: body.remuneracao?.trim() || undefined,
    contato,
    status: "ativa",
    criadoEm: agora,
    atualizadoEm: agora,
  });

  res.status(201).json(vaga);
});

// ── PATCH /api/mural-empregos/vagas/:id/status — dono controla a própria vaga
router.patch("/mural-empregos/vagas/:id/status", requireOwnerAuth, (req, res): void => {
  const companyId = (req as any).owner.companyId as string;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status } = req.body as { status?: VagaStatus };

  const validos: VagaStatus[] = ["ativa", "pausada", "encerrada"];
  if (!status || !validos.includes(status)) {
    res.status(400).json({ error: `status deve ser um de: ${validos.join(", ")}` });
    return;
  }

  const vaga = atualizarStatusVaga(id, companyId, status);
  if (!vaga) {
    res.status(404).json({ error: "Vaga não encontrada ou não pertence a este estabelecimento" });
    return;
  }

  res.json(vaga);
});

// ── POST /api/mural-empregos/vagas/:id/interesse — candidato, rota pública
router.post("/mural-empregos/vagas/:id/interesse", (req, res): void => {
  const { id } = req.params;
  const vaga = vagas.find((v) => v.id === id);
  if (!vaga || vaga.status !== "ativa") {
    res.status(404).json({ error: "Vaga não encontrada ou não está mais ativa" });
    return;
  }

  const body = req.body as { nome?: string; telefone?: string; mensagem?: string };
  const nome = body.nome?.trim();
  const telefone = body.telefone?.trim();

  if (!nome || !telefone) {
    res.status(400).json({ error: "nome e telefone são obrigatórios" });
    return;
  }
  if (body.mensagem && contemPalavrao(body.mensagem)) {
    res.status(422).json({ error: "A mensagem contém linguagem inadequada. Revise e tente novamente." });
    return;
  }

  const interesse = addVagaInteresse({
    id: randomUUID(),
    vagaId: id,
    nome,
    telefone,
    mensagem: body.mensagem?.trim() || undefined,
    criadoEm: new Date().toISOString(),
  });

  res.status(201).json(interesse);
});

// ── GET /api/mural-empregos/vagas/:id/interesses — dono vê candidaturas ────
router.get("/mural-empregos/vagas/:id/interesses", requireOwnerAuth, (req, res): void => {
  const companyId = (req as any).owner.companyId as string;
  const { id } = req.params;

  const vaga = vagas.find((v) => v.id === id && v.restaurantId === companyId);
  if (!vaga) {
    res.status(404).json({ error: "Vaga não encontrada ou não pertence a este estabelecimento" });
    return;
  }

  res.json(vagaInteresses.filter((i) => i.vagaId === id));
});

export default router;
