# ADR 0002: Estratégia de isolamento por tenant

**Status:** Proposto  
**Data:** 2026-08-23  
**Decisor:** Tech Lead + QA Security  

## Contexto

O projeto suporta múltiplas empresas (tenants) usando o mesmo banco. A falha de isolamento é risco crítico:

- Empresa A vê dados de empresa B.
- Escalação horizontal de privilégio.
- Vazamento de dados de cliente.

Hoje o isolamento é implementado em:
1. Middleware de autenticação.
2. Query filters no backend.
3. Row-level security (RLS) do PostgreSQL?

Não há teste sistematizado de isolamento.

## Decisão

**Implementar isolamento em camadas: autenticação → query → banco.**

### Camada 1: Autenticação

Cada request inclui:
```typescript
{
  userId: "user-123",
  companyId: "company-456",
  role: "MANAGER"
}
```

Isso é extraído do JWT e validado em cada rota.

### Camada 2: Query filtering (aplicação)

Toda query que acessa `restaurants`, `orders`, `employees`, etc. filtra por `companyId`:

```typescript
// ❌ Errado
const orders = await db.select().from(ordersTable);

// ✅ Correto
const orders = await db.select()
  .from(ordersTable)
  .where(eq(ordersTable.companyId, user.companyId));
```

### Camada 3: Row-level security (banco)

Opcional, mas recomendado para defesa em profundidade:

```sql
CREATE POLICY tenant_filter ON orders
  FOR SELECT
  USING (company_id = CURRENT_USER_ID());
```

## Implementação

### Checklist

- [ ] P1.2: Executar testes de isolamento e documentar resultados.
- [ ] Cada rota sensível deve incluir filtro de `companyId`.
- [ ] RLS ativado no PostgreSQL (não crítico se query filtering estiver forte).
- [ ] Teste de contrato: cada endpoint retorna 403 se acesso cruzado.

### Validação

```bash
# Teste manual
curl -H "Auth: token-company-A" \
  http://api/restaurants/id-restaurant-company-b
# Deve retornar 403 Forbidden ou 404 Not Found
```

## Consequências

✅ Positivas:
- Dados isolados por tenant.
- Auditável via logs.
- Testável automaticamente.

❌ Negativas:
- Overhead de queries (filtro em cada query).
- Risco se filtro for esquecido em uma rota.

## Mitigação do risco

1. **Linter customizado**: Alertar se query sem filtro de tenant.
2. **Code review**: Validar isolamento antes de merge.
3. **Teste automatizado**: P1.2 continua no CI.

## Referências

- https://supabase.com/docs/guides/auth/row-level-security
- https://owasp.org/www-project-top-ten/ (A06:2021 – Broken Access Control)
