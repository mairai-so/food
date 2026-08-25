# ADR 0001: Schema SQL como fonte única de verdade

**Status:** Proposto  
**Data:** 2026-08-23  
**Decisor:** Tech Lead  

## Contexto

Atualmente, o projeto tem três "fontes" de verdade para o schema:

1. **Drizzle ORM** (`lib/db/schema.ts`): Schema declarativo, type-safe, com migrações automáticas.
2. **SQL estático** (`database/schema.sql`): Script SQL puro, versionado, fácil de revisar.
3. **SQL de boot** (`api-server/src/lib/`): Tabelas criadas dinamicamente no boot da API.

Isso cria:
- Divergência silenciosa.
- Dificuldade em migrar.
- Risco de perda de dados.
- Upgrade sem controle.

## Decisão

**Usar Drizzle como fonte única de verdade para schema.**

### Razões

1. **Type-safety**: Erros de schema detectados em tempo de compilação.
2. **Migrações versionadas**: Cada mudança é uma migração reproduzível.
3. **Rollback seguro**: Drizzle gerencia histórico de mudanças.
4. **Integração com API**: A API já usa Drizzle, mantém coerência.

### Implementação

```bash
# 1. Gerar SQL estático a partir de Drizzle
drizzle-kit generate:pg

# 2. Remover SQL duplicado de boot
# Deletar ou comentar criação de tabelas em src/lib/*.ts

# 3. Aplicar migrações no boot
await db.migrate();

# 4. Versioná-lo
git add drizzle/migrations/
git add database/schema.sql
```

## Consequências

✅ Positivas:
- Uma fonte confiável.
- Migrações rastreáveis.
- Integração com CI: gerar schema no build.

❌ Negativas:
- Equipe precisa aprender Drizzle.
- Migração de dados existentes requer cuidado.

## Validação

P1.3 executará auditoria de schema e confirmará escolha.

---

## Referências

- https://orm.drizzle.team/docs/migrations
- Drizzle Studio: visualizar e testar schema.
