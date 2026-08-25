// api-server/src/routes/gestores.ts
//
// Cadastro de GESTOR (sócio). Sócio é gestor, gestor é dono: entra no app do
// gestor, com senha obrigatória, e recebe a chave mestra. Criado por cadastro
// direto (e-mail + senha) por quem já é gestor. Cada criação fica na caixa preta.

import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { exigirChaveMestra } from "../middlewares/porteiro";
import { queryOne, query, execute } from "../lib/db";
import { registrar } from "./registro-protegido";

const router: IRouter = Router();

// POST /api/gestores — cria outro gestor (sócio) na empresa
router.post("/gestores", exigirChaveMestra, async (req, res): Promise<void> => {
  const ator = (req as any).ator;
  const companyId = ator.companyId as string;
  const { name, email, password } = (req.body as {
    name?: string;
    email?: string;
    password?: string;
  }) ?? {};

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "A senha precisa de ao menos 6 caracteres." });
    return;
  }

  const emailNorm = email.trim().toLowerCase();
  const jaExiste = await queryOne("SELECT id FROM owner_accounts WHERE email = $1", [emailNorm]);
  if (jaExiste) {
    res.status(409).json({ error: "Já existe um acesso com esse e-mail." });
    return;
  }

  const gestorId = randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);

  // Entra na mesma empresa, como owner (chave mestra). Sócio = dono.
  await execute(
    `INSERT INTO owner_accounts (id, company_id, email, password_hash, name)
     VALUES ($1, $2, $3, $4, $5)`,
    [gestorId, companyId, emailNorm, passwordHash, name.trim()],
  );

  // Caixa preta: quem criou qual sócio.
  registrar({
    companyId,
    actorId: ator.id,
    actorName: ator.name,
    actorRole: ator.role,
    tipo: "gestor.criar",
    descricao: `Cadastrou ${name.trim()} como gestor (sócio)`,
    metadata: { gestorId, email: emailNorm },
  });

  res.status(201).json({
    id: gestorId,
    name: name.trim(),
    email: emailNorm,
    role: "owner",
  });
});

// GET /api/gestores — lista os gestores da empresa
router.get("/gestores", exigirChaveMestra, async (req, res): Promise<void> => {
  const ator = (req as any).ator;
  const rows = await query<{ id: string; name: string; email: string; created_at: string }>(
    "SELECT id, name, email, created_at FROM owner_accounts WHERE company_id = $1 ORDER BY created_at ASC",
    [ator.companyId],
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      createdAt: r.created_at,
      voceMesmo: r.id === ator.id,
    })),
  );
});

// DELETE /api/gestores/:id — revoga acesso de um gestor
// Não é possível revogar a si mesmo (evita se trancar pra fora).
router.delete("/gestores/:id", exigirChaveMestra, async (req, res): Promise<void> => {
  const ator = (req as any).ator;
  const { id } = req.params;

  if (id === ator.id) {
    res.status(400).json({ error: "Você não pode revogar o próprio acesso." });
    return;
  }

  const alvo = await queryOne<{ id: string; name: string; company_id: string }>(
    "SELECT id, name, company_id FROM owner_accounts WHERE id = $1",
    [id],
  );
  if (!alvo || alvo.company_id !== ator.companyId) {
    res.status(404).json({ error: "Gestor não encontrado." });
    return;
  }

  // Precisa sobrar ao menos um gestor.
  const total = await queryOne<{ n: string }>(
    "SELECT COUNT(*)::text AS n FROM owner_accounts WHERE company_id = $1",
    [ator.companyId],
  );
  if (total && Number(total.n) <= 1) {
    res.status(400).json({ error: "A empresa precisa de ao menos um gestor." });
    return;
  }

  await execute("DELETE FROM owner_accounts WHERE id = $1", [id]);

  registrar({
    companyId: ator.companyId,
    actorId: ator.id,
    actorName: ator.name,
    actorRole: ator.role,
    tipo: "gestor.revogar",
    descricao: `Revogou o acesso de ${alvo.name}`,
    metadata: { gestorId: id },
  });

  res.json({ revoked: true, id });
});

export default router;
