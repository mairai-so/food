#!/usr/bin/env node

/**
 * Demonstração visual: Antes vs Depois da correção
 *
 * Este script mostra exatamente o que estava errado e como corrigir
 */

console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║           EXEMPLO VISUAL: BRECHA MULTI-TENANT (Antes vs Depois)          ║
╚════════════════════════════════════════════════════════════════════════════╝

`);

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ ANTES (VULNERÁVEL) — recados.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  router.get("/recados", requireAnyAuth, (_req, res): void => {
    // Problema: SEM validação de restaurante
    res.json(recados.filter((r) => !r.fechado));
  });

Resultado quando Maria (Restaurante A) acessa /recados:
  ✅ Vê recados dela: "acabou troco", "cliente quer conta"
  ❌ TAMBÉM VÊ recados de João (Restaurante B): "mesas 4 e 5 prontas"
  ❌ TAMBÉM VÊ recados de Pedro (Restaurante C): "cliente ficou com raiva"

Banco de dados:
  [
    { id: "r-1", restaurantId: "rest-1", texto: "acabou troco", fechado: false },
    { id: "r-2", restaurantId: "rest-2", texto: "mesas prontas", fechado: false },  ← Vê isto!
    { id: "r-3", restaurantId: "rest-3", texto: "cliente ficou brava", fechado: false },  ← E isto!
  ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ DEPOIS (CORRETO) — recados.ts CORRIGIDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  router.get("/recados", requireAnyAuth, (req, res): void => {
    // Solução: Extrai companyId do token e filtra
    const companyId = (req as any).auth?.companyId;
    if (!companyId) {
      res.status(401).json({ error: "Não autenticado" });
      return;
    }
    res.json(recados.filter((r) => r.restaurantId === companyId && !r.fechado));
  });

Resultado quando Maria (Restaurante A) acessa /recados:
  ✅ Vê APENAS recados dela: "acabou troco", "cliente quer conta"
  ✅ NÃO VÊ recados de João: "mesas 4 e 5 prontas"
  ✅ NÃO VÊ recados de Pedro: "cliente ficou com raiva"

Mesmo banco de dados:
  [
    { id: "r-1", restaurantId: "rest-1", texto: "acabou troco", fechado: false },  ← Vê só isto!
    { id: "r-2", restaurantId: "rest-2", texto: "mesas prontas", fechado: false },  ← Filtrado out
    { id: "r-3", restaurantId: "rest-3", texto: "cliente ficou brava", fechado: false },  ← Filtrado out
  ]

`);

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ ANTES (VULNERÁVEL) — cashier-session.ts (PIOR CASO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  router.get("/cashier/session/current", requireAnyAuth, (_req, res): void => {
    // Problema: Retorna qualquer sessão aberta, de qualquer restaurante
    const session = getCurrentCashierSession();
    res.json({ session });
  });

  router.get("/cashier/session/history", requireAnyAuth, (_req, res): void => {
    // Problema: Retorna histórico de 30 DIAS de TODOS os restaurantes
    const closed = cashierSessions.filter(s => s.status === 'closed').slice(0, 30);
    res.json(closed);
  });

🔓 EXPLORAÇÃO:

Operador de Caixa da Pizzaria A (João) acessa:
  GET /api/cashier/session/current

Resposta:
  {
    "session": {
      "restaurantId": "rest-2",  ← Restaurant B!
      "operatorName": "Maria",
      "movements": [
        { "amount": 1000, "description": "Abertura com R$ 1000" },
        { "amount": 520.50, "description": "Venda PIX" },
        { "amount": -200, "description": "Sangria (saque)" }
      ],
      "totalRecipients": 1320.50
    }
  }

João agora sabe:
  💰 Restaurante B abriu com R$ 1000
  💰 Teve vendas de R$ 520.50 hoje
  💰 Fez um saque de R$ 200
  💰 Total atual em caixa: R$ 1320.50

Pior: Acessando /api/cashier/session/history, vê 30 DIAS DE TODAS AS TRANSAÇÕES!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ DEPOIS (CORRETO) — cashier-session.ts CORRIGIDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  router.get("/cashier/session/current", requireAnyAuth, (req, res): void => {
    // Solução: Passa companyId para função
    const companyId = (req as any).auth?.companyId;
    const session = getCurrentCashierSession(companyId);  // ← FILTRADO!
    res.json({ session });
  });

  router.get("/cashier/session/history", requireAnyAuth, (req, res): void => {
    // Solução: Filtra por restaurante
    const companyId = (req as any).auth?.companyId;
    const closed = cashierSessions
      .filter(s => s.status === 'closed' && s.restaurantId === companyId)  // ← FILTRADO!
      .slice(0, 30);
    res.json(closed);
  });

🔒 PROTEÇÃO:

Mesmo operador de Caixa da Pizzaria A (João) tenta acessar:
  GET /api/cashier/session/current

Resposta:
  {
    "session": {
      "restaurantId": "rest-1",  ← APENAS Pizzaria A!
      "operatorName": "João",
      "movements": [
        { "amount": 500, "description": "Abertura com R$ 500" },
        { "amount": 350.00, "description": "Venda PIX" }
      ],
      "totalRecipients": 850.00
    }
  }

João vê APENAS seus dados:
  ✅ Pizzaria A abriu com R$ 500
  ✅ Teve vendas de R$ 350 hoje
  ✅ Total atual em caixa: R$ 850.00

✅ NÃO consegue ver dados de Restaurante B
✅ Histórico também filtrado por Pizzaria A

`);

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PADRÃO A APLICAR EM TODAS AS ROTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CHECKLIST para cada rota:

  1. Exige autenticação?
     ✅ router.get("/recurso", requireAnyAuth, (req, res) => { ... })

  2. Extrai companyId do token?
     ✅ const companyId = (req as any).auth?.companyId;

  3. Valida se companyId existe?
     ✅ if (!companyId) { res.status(401).json(...); return; }

  4. Filtra dados por companyId?
     ✅ dados.filter(d => d.restaurantId === companyId || d.companyId === companyId)

  5. POST/PATCH/DELETE também validam?
     ✅ Ao salvar, SEMPRE incluir o companyId do token (não permitir que client envie)

`);

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 RESUMO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Problema:      RESTAURANT_ID = "rest-1" fixo (ou nenhuma validação)
Impacto:       Qualquer funcionário vê dados de TODOS os restaurantes
Severidade:    🔴🔴🔴 CRÍTICO
Risco:         Espionagem, roubo financeiro, sabotagem

Solução:       Filtrar por companyId do token EM TODAS AS ROTAS
Verificar:     MULTI_TENANT_ISOLATION_ISSUES.md

Arquivos com problema ainda:
  • recados.ts
  • waiter-calls.ts
  • cashier-session.ts

`);
