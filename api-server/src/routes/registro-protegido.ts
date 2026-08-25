// artifacts/api-server/src/routes/registro-protegido.ts
//
// REGISTRO PROTEGIDO — "Livro-caixa" de quem fez o quê.
// - Gravação SEMPRE ativa (não há como desligar).
// - Cada linha é encadeada por hash: mexer/apagar no banco quebra a corrente
//   e a verificação de integridade acusa adulteração.
// - Só o dono abre, e ainda por trás de uma SEGUNDA senha que ele cria.
// - Alertas são individuais por tipo de evento (liga/desliga um a um).
// - Reset da segunda senha é feito com a senha principal do dono.

import { Router, type IRouter } from "express";
import { randomUUID, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { requireOwnerAuth } from "./auth";
import { queryOne, execute } from "../lib/db";
import { loadSnapshot, scheduleSave } from "../lib/persistence.js";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Estado em memória (persistido junto com o resto do data-store se desejado).
// Cada empresa tem sua própria corrente de eventos e sua configuração.
// ─────────────────────────────────────────────────────────────────────────────
export interface EventoRegistro {
  id: string;
  companyId: string;
  seq: number;              // posição na corrente
  actorId: string;          // quem fez (id do funcionário/dono)
  actorName: string;        // nome de quem fez
  actorRole: string;        // papel: waiter, cook, cashier, owner...
  tipo: string;             // ex.: mesa.excluir, estoque.midia-manual, login.fora-horario
  descricao: string;        // texto legível
  metadata?: Record<string, any>;
  timestamp: string;        // ISO
  prevHash: string;         // hash do evento anterior
  hash: string;             // hash deste evento (inclui prevHash)
}

interface ConfigRegistro {
  companyId: string;
  segundaSenhaHash: string | null;   // null = ainda não configurado
  ativadoEm: string | null;
  puladoEm: string | null;           // "fazer isso depois"
  alertas: Record<string, boolean>;  // por tipo de evento
}

const correntes = new Map<string, EventoRegistro[]>();
const configs = new Map<string, ConfigRegistro>();

// ─────────────────────────────────────────────────────────────────────────────
// Persistência — sem isso, a corrente e as configurações somem a cada
// reinício do servidor (viviam só em memória). Salva depois de cada mudança
// e recarrega assim que o servidor sobe.
// ─────────────────────────────────────────────────────────────────────────────
function persistirEstado(): void {
  scheduleSave("registroProtegidoCorrentes", Array.from(correntes.entries()));
  scheduleSave("registroProtegidoConfigs", Array.from(configs.entries()));
}

export async function initializeRegistroProtegido(): Promise<void> {
  const [correntesSalvas, configsSalvas] = await Promise.all([
    loadSnapshot<Array<[string, EventoRegistro[]]>>("registroProtegidoCorrentes"),
    loadSnapshot<Array<[string, ConfigRegistro]>>("registroProtegidoConfigs"),
  ]);
  if (correntesSalvas) {
    for (const [companyId, corrente] of correntesSalvas) correntes.set(companyId, corrente);
  }
  if (configsSalvas) {
    for (const [companyId, config] of configsSalvas) configs.set(companyId, config);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de eventos que podem gerar alerta (a gravação vale para qualquer um).
// ─────────────────────────────────────────────────────────────────────────────
export const TIPOS_EVENTO: Array<{ id: string; nome: string; descricao: string; alertaPadrao: boolean }> = [
  { id: "mesa.excluir",          nome: "Excluir mesa",                 descricao: "Alguém removeu uma mesa do salão",                        alertaPadrao: true },
  { id: "estoque.midia-manual",  nome: "Mídia no estoque sem a IA",    descricao: "Subiram foto ou vídeo no estoque em vez de deixar a IA ler", alertaPadrao: true },
  { id: "login.fora-horario",    nome: "Login fora do horário",        descricao: "Acesso ao app fora do horário de funcionamento",          alertaPadrao: true },
  { id: "mesa.abrir",            nome: "Abrir mesa",                   descricao: "Um garçom abriu/ocupou uma mesa",                         alertaPadrao: false },
  { id: "pedido.cancelar",       nome: "Cancelar pedido",              descricao: "Um pedido foi cancelado",                                 alertaPadrao: false },
  { id: "desconto.aplicar",      nome: "Aplicar desconto",             descricao: "Um desconto foi dado em um pedido",                       alertaPadrao: false },
  { id: "caixa.fechar",          nome: "Fechar caixa",                 descricao: "A sessão de caixa foi encerrada",                         alertaPadrao: false },
  { id: "estoque.remover",       nome: "Remover item do estoque",      descricao: "Um item foi retirado do estoque",                         alertaPadrao: false },
];

function configPadrao(companyId: string): ConfigRegistro {
  const alertas: Record<string, boolean> = {};
  for (const t of TIPOS_EVENTO) alertas[t.id] = t.alertaPadrao;
  return { companyId, segundaSenhaHash: null, ativadoEm: null, puladoEm: null, alertas };
}

function getConfig(companyId: string): ConfigRegistro {
  let c = configs.get(companyId);
  if (!c) {
    c = configPadrao(companyId);
    configs.set(companyId, c);
  }
  return c;
}

function hashEvento(e: Omit<EventoRegistro, "hash">): string {
  const material = `${e.prevHash}|${e.seq}|${e.companyId}|${e.actorId}|${e.tipo}|${e.descricao}|${e.timestamp}|${JSON.stringify(e.metadata ?? {})}`;
  return createHash("sha256").update(material).digest("hex");
}

// Grava um evento na corrente. Chamável de dentro do próprio servidor.
export function registrar(input: {
  companyId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  tipo: string;
  descricao: string;
  metadata?: Record<string, any>;
}): EventoRegistro {
  const corrente = correntes.get(input.companyId) ?? [];
  const anterior = corrente[corrente.length - 1];
  const prevHash = anterior?.hash ?? "GENESIS";
  const seq = corrente.length + 1;

  const base: Omit<EventoRegistro, "hash"> = {
    id: randomUUID(),
    companyId: input.companyId,
    seq,
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    tipo: input.tipo,
    descricao: input.descricao,
    metadata: input.metadata,
    timestamp: new Date().toISOString(),
    prevHash,
  };
  const evento: EventoRegistro = { ...base, hash: hashEvento(base) };

  corrente.push(evento);
  correntes.set(input.companyId, corrente);
  persistirEstado();
  return evento;
}

// Verifica a corrente inteira. Retorna se está íntegra e onde quebrou.
function verificarIntegridade(companyId: string): { integro: boolean; quebrouEm: number | null; total: number } {
  const corrente = correntes.get(companyId) ?? [];
  let prev = "GENESIS";
  for (const e of corrente) {
    const recalc = hashEvento({ ...e });
    if (e.prevHash !== prev || e.hash !== recalc) {
      return { integro: false, quebrouEm: e.seq, total: corrente.length };
    }
    prev = e.hash;
  }
  return { integro: true, quebrouEm: null, total: corrente.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificação da SEGUNDA senha (gate do registro)
// ─────────────────────────────────────────────────────────────────────────────
export async function conferirSenhaMestra(companyId: string, senha: string): Promise<boolean> {
  const c = getConfig(companyId);
  if (!c.segundaSenhaHash) return false;
  return bcrypt.compare(senha ?? "", c.segundaSenhaHash);
}

async function conferirSenhaPrincipal(companyId: string, senha: string): Promise<boolean> {
  const owner = await queryOne<{ password_hash: string }>(
    "SELECT password_hash FROM owner_accounts WHERE company_id = $1",
    [companyId],
  );
  if (!owner) return false;
  return bcrypt.compare(senha ?? "", owner.password_hash);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/registro/status — o dono vê se já configurou a segunda senha
// ─────────────────────────────────────────────────────────────────────────────
router.get("/registro/status", requireOwnerAuth, (req, res): void => {
  const { companyId } = (req as any).owner;
  const c = getConfig(companyId);
  res.json({
    configurado: !!c.segundaSenhaHash,
    ativadoEm: c.ativadoEm,
    puladoEm: c.puladoEm,
    tipos: TIPOS_EVENTO,
    alertas: c.alertas,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/registro/pular — "fazer isso depois"
// ─────────────────────────────────────────────────────────────────────────────
router.post("/registro/pular", requireOwnerAuth, (req, res): void => {
  const { companyId } = (req as any).owner;
  const c = getConfig(companyId);
  c.puladoEm = new Date().toISOString();
  persistirEstado();
  res.json({ pulado: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/registro/definir-senha — cria a segunda senha (ativa o registro)
// body: { senha }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/registro/definir-senha", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId } = (req as any).owner;
  const { senha } = (req.body as { senha?: string }) ?? {};

  if (!senha || senha.length < 6) {
    res.status(400).json({ error: "A segunda senha precisa de ao menos 6 caracteres." });
    return;
  }

  const c = getConfig(companyId);
  if (c.segundaSenhaHash) {
    res.status(409).json({ error: "A segunda senha já existe. Use redefinir." });
    return;
  }

  c.segundaSenhaHash = await bcrypt.hash(senha, 12);
  c.ativadoEm = new Date().toISOString();
  persistirEstado();
  res.status(201).json({ ativado: true, ativadoEm: c.ativadoEm });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/registro/redefinir-senha — troca a segunda senha usando a PRINCIPAL
// body: { senhaPrincipal, novaSenha }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/registro/redefinir-senha", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId } = (req as any).owner;
  const { senhaPrincipal, novaSenha } = (req.body as { senhaPrincipal?: string; novaSenha?: string }) ?? {};

  if (!novaSenha || novaSenha.length < 6) {
    res.status(400).json({ error: "A nova segunda senha precisa de ao menos 6 caracteres." });
    return;
  }
  const ok = await conferirSenhaPrincipal(companyId, senhaPrincipal ?? "");
  if (!ok) {
    res.status(401).json({ error: "Senha principal incorreta." });
    return;
  }

  const c = getConfig(companyId);
  c.segundaSenhaHash = await bcrypt.hash(novaSenha, 12);
  if (!c.ativadoEm) c.ativadoEm = new Date().toISOString();
  persistirEstado();
  res.json({ redefinido: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/registro/alertas — liga/desliga alerta de um tipo (individual)
// body: { senha, tipo, ativo }
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/registro/alertas", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId } = (req as any).owner;
  const { senha, tipo, ativo } = (req.body as { senha?: string; tipo?: string; ativo?: boolean }) ?? {};

  const liberado = await conferirSenhaMestra(companyId, senha ?? "");
  if (!liberado) {
    res.status(401).json({ error: "Segunda senha incorreta." });
    return;
  }
  const c = getConfig(companyId);
  if (!tipo || !(tipo in c.alertas)) {
    res.status(400).json({ error: "Tipo de evento inválido." });
    return;
  }
  c.alertas[tipo] = !!ativo;
  persistirEstado();
  res.json({ tipo, ativo: c.alertas[tipo] });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/registro/abrir — o dono lê o registro (exige a segunda senha)
// body: { senha, limit? }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/registro/abrir", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId } = (req as any).owner;
  const { senha, limit } = (req.body as { senha?: string; limit?: number }) ?? {};

  const liberado = await conferirSenhaMestra(companyId, senha ?? "");
  if (!liberado) {
    res.status(401).json({ error: "Segunda senha incorreta." });
    return;
  }

  const corrente = correntes.get(companyId) ?? [];
  const integridade = verificarIntegridade(companyId);
  const max = Number(limit) > 0 ? Number(limit) : 200;
  const eventos = [...corrente].reverse().slice(0, max);

  res.json({
    integridade,
    total: corrente.length,
    eventos,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/registro/evento — qualquer app registra um evento (gravação sempre)
// Não exige a segunda senha: escrever é sempre permitido, LER é que é protegido.
// body: { actorId, actorName, actorRole, tipo, descricao, metadata? }
// Retorna também se aquele tipo deve disparar alerta agora.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/registro/evento", requireOwnerAuth, (req, res): void => {
  const { companyId } = (req as any).owner;
  const b = (req.body as Partial<EventoRegistro>) ?? {};

  if (!b.actorName || !b.tipo || !b.descricao) {
    res.status(400).json({ error: "actorName, tipo e descricao são obrigatórios." });
    return;
  }

  const evento = registrar({
    companyId,
    actorId: b.actorId ?? "desconhecido",
    actorName: b.actorName,
    actorRole: b.actorRole ?? "desconhecido",
    tipo: b.tipo,
    descricao: b.descricao,
    metadata: b.metadata,
  });

  const c = getConfig(companyId);
  const deveAlertar = !!c.alertas[b.tipo];

  res.status(201).json({ registrado: true, seq: evento.seq, alerta: deveAlertar });
});

export default router;
