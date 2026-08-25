# PostgreSQL local

`schema.sql` é um dump de estrutura, sem dados de autenticação.

`sanitized-test-data.sql` é um fixture operacional derivado dos snapshots locais de teste. Ele inclui apenas colecções operacionais permitidas para validação de catálogo, lojas, stock, fornecedores, pré-pedidos e pedidos. Campos de autenticação, contacto, dados pessoais, QR, OTP, empregados, sessões e movimentos financeiros são removidos.

Para uma restauração segura:

```bash
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/sanitized-test-data.sql
```

A aplicação pode ser executada com banco vazio depois de aplicar apenas `schema.sql`; o smoke cria os dados necessários usando endpoints normais e dados fictícios.
