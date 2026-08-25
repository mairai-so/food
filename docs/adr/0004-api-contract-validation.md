# ADR 0004: Validação de contrato entre frontend e API

**Status:** Proposto  
**Data:** 2026-08-23  
**Decisor:** Tech Lead  

## Contexto

Hoje a API tem `lib/api-spec/openapi.yaml`, mas:

1. Não há garantia de que implementação corresponde ao spec.
2. Frontend pode chamar endpoints que não existem ou mudaram.
3. Response types podem divergir.
4. Descobrir divergências só em runtime.

Exemplos de problemas:
- Frontend espera `{ id, name }`, API retorna `{ id, title }`.
- Endpoint deletado, frontend tenta chamar, retorna 404.
- Status code diferente do documentado.

## Decisão

**Implementar testes de contrato que validam OpenAPI vs implementação.**

### O que é "contrato"?

Um contrato entre frontend e API define:
- Endpoints existentes.
- Métodos HTTP (GET, POST, etc).
- Request schema (body, query, path).
- Response schema e status code.

Teste de contrato valida que ambos os lados respeitam o contrato.

### Implementação

1. **Validar que toda rota é documentada:**
   ```typescript
   // Extrair todas as rotas Express da API
   const expressRoutes = getExpressRoutes(app);
   
   // Extrair todas as rotas do OpenAPI
   const openApiRoutes = parseOpenAPI('./openapi.yaml');
   
   // Validar que expressRoutes ⊆ openApiRoutes
   expect(expressRoutes).toEqual(openApiRoutes);
   ```

2. **Validar que responses respeitam schema:**
   ```typescript
   // Fazer requisição real
   const response = await request.get('/api/restaurants/123');
   
   // Validar contra OpenAPI
   const schema = openapi.paths['/api/restaurants/{id}'].get.responses['200'];
   expect(response.json()).toMatchSchema(schema);
   ```

3. **Integrar no CI:**
   ```bash
   pnpm test:contract  # Roda antes de build
   ```

### Ferramentas

- **Dredd**: Valida respostas contra OpenAPI.
- **Sepia**: Record/replay de HTTP para testes.
- **Jest**: Customizado com validador de schema.

Recomendação: **Jest + custom matcher** para flexibilidade.

## Exemplo

```typescript
// tests/contract/api.test.ts
describe('API Contract', () => {
  it('GET /api/restaurants retorna lista', async () => {
    const response = await request.get('/api/restaurants');
    
    expect(response.status).toBe(200);
    expect(response.json()).toMatchOpenAPISchema(
      'paths."/api/restaurants".get.responses.200'
    );
  });
});
```

## Consequências

✅ Positivas:
- Descobrir divergências no CI, não em produção.
- Documentação sempre sincronizada com código.
- Confiança em refatorações.

❌ Negativas:
- Setup inicial (ferramenta + testes).
- Overhead na CI (mais testes).
- Precisa manter OpenAPI atualizado.

## Validação

P2.3 criará testes de contrato e adicionará ao CI.

## Referências

- https://dredd.org/ (Dredd testing tool)
- https://swagger.io/tools/swagger-ui/ (OpenAPI viewer)
- https://martinfowler.com/bliki/ContractTest.html
