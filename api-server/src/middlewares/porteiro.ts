// artifacts/api-server/src/middlewares/porteiro.ts
//
// O PORTEIRO. Confere, em cada ação protegida, se quem chamou tem a função
// ligada. Quem tem a CHAVE MESTRA (owner/manager) passa por qualquer porta.
// Desmarcar uma função na tela de usuários passa a barrar de verdade aqui,
// não só some da tela.

import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../routes/auth";
import { CHAVE_MESTRA, PAPEIS_COM_CHAVE, type Papel } from "../lib/funcoes";
import { registrar } from "../routes/registro-protegido";

// Extrai o "ator" a partir do token (dono, gestor ou funcionário).
export interface Ator {
  id: string;
  name: string;
  role: string;
  companyId: string | null;
  funcoes: string[];
  temChave: boolean;
}

function lerAtor(req: Request): Ator | null {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const payload: any = token ? verifyToken(token) : null;
  if (!payload) return null;

  const role: string = payload.role ?? "custom";
  const temChave = PAPEIS_COM_CHAVE.includes(role as Papel);

  return {
    id: payload.ownerId ?? payload.employeeId ?? payload.userId ?? "desconhecido",
    name: payload.name ?? "desconhecido",
    role,
    companyId: payload.companyId ?? null,
    funcoes: Array.isArray(payload.funcoes) ? payload.funcoes : [],
    temChave,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DEV BYPASS — Controle de autenticação para testes (APENAS desenvolvimento)
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ CRÍTICO: Em NODE_ENV=production, DEV_BYPASS é COMPLETAMENTE DESABILITADO.
//    Tentativa de usá-lo em produção falha no boot com erro ruidoso.
// ⚠️ IMPORTANTE: Só funciona se ALLOW_DEV_BYPASS === "true" (literal, string exata)
//    E apenas se NODE_ENV !== 'production'

function validarDevBypass(): boolean {
  const isProduction = process.env.NODE_ENV === 'production';
  const bypassEnabled = process.env.ALLOW_DEV_BYPASS === 'true';

  // Em produção, DEV_BYPASS é ABSOLUTAMENTE PROIBIDO
  if (isProduction && bypassEnabled) {
    const msg = `
╔════════════════════════════════════════════════════════════════════════════╗
║ 🚨 ERRO CRÍTICO DE SEGURANÇA                                              ║
║ DEV_BYPASS está HABILITADO em NODE_ENV=production                          ║
║                                                                            ║
║ Isso é um risco crítico de segurança. DEV_BYPASS só pode ser usado em     ║
║ desenvolvimento (NODE_ENV=development ou NODE_ENV=test).                   ║
║                                                                            ║
║ ❌ AÇÃO: Remova ou desabilite ALLOW_DEV_BYPASS do .env de produção         ║
║ ❌ AÇÃO: Reinicie o servidor após corrigir                                ║
║                                                                            ║
║ Para ativar DEV_BYPASS em desenvolvimento, set:                           ║
║   NODE_ENV=development ALLOW_DEV_BYPASS=true                              ║
╚════════════════════════════════════════════════════════════════════════════╝
    `;
    throw new Error(msg);
  }

  // Retorna true apenas se estiver em desenvolvimento e explicitamente habilitado
  return !isProduction && bypassEnabled;
}

// Pré-valida na importação do módulo (falha imediatamente se config inválida)
const DEV_BYPASS_ALLOWED = validarDevBypass();

const DEV_ATOR: Ator = {
  id: 'dev', name: 'Dev', role: 'owner', companyId: 'dev',
  funcoes: [], temChave: true,
};

// Middleware: exige a função `funcaoId`. Chave mestra passa direto.
export function exigirFuncao(funcaoId: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // DEV BYPASS: apenas se estiver explicitamente habilitado EM DESENVOLVIMENTO
    if (DEV_BYPASS_ALLOWED) {
      (req as any).ator = DEV_ATOR;
      next();
      return;
    }
    const ator = lerAtor(req);
    if (!ator) {
      res.status(401).json({ error: "Não autenticado." });
      return;
    }

    // Chave mestra abre qualquer porta.
    if (ator.temChave) {
      (req as any).ator = ator;
      next();
      return;
    }

    // Funcionário só passa se a função estiver ligada para ele.
    if (ator.funcoes.includes(funcaoId)) {
      (req as any).ator = ator;
      next();
      return;
    }

    // Barrado. Registra a tentativa de acesso indevido na caixa preta.
    if (ator.companyId) {
      registrar({
        companyId: ator.companyId,
        actorId: ator.id,
        actorName: ator.name,
        actorRole: ator.role,
        tipo: "acesso.negado",
        descricao: `Tentativa de usar "${funcaoId}" sem permissão`,
        metadata: { funcao: funcaoId, rota: req.originalUrl },
      });
    }

    res.status(403).json({ error: "Você não tem essa função liberada." });
  };
}

// Middleware: exige a chave mestra (só dono/gestor).
export function exigirChaveMestra(req: Request, res: Response, next: NextFunction): void {
  if (DEV_BYPASS_ALLOWED) { (req as any).ator = DEV_ATOR; next(); return; }
  const ator = lerAtor(req);
  if (!ator) {
    res.status(401).json({ error: "Não autenticado." });
    return;
  }
  if (!ator.temChave) {
    if (ator.companyId) {
      registrar({
        companyId: ator.companyId,
        actorId: ator.id,
        actorName: ator.name,
        actorRole: ator.role,
        tipo: "acesso.negado",
        descricao: "Tentativa de usar comando de gestor sem a chave",
        metadata: { rota: req.originalUrl },
      });
    }
    res.status(403).json({ error: "Apenas gestor pode fazer isso." });
    return;
  }
  (req as any).ator = ator;
  next();
}

export { lerAtor, CHAVE_MESTRA };
