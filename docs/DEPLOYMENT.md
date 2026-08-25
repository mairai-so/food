# Runbook de Deployment

Data: 2026-08-23  
Versão: 1.0  
Status: Rascunho

Este documento descreve o passo a passo para fazer deploy do MIAR AI SOLUCIONA em diferentes ambientes.

---

## Pré-requisitos

### Globais

- Node.js >= 18.x
- pnpm >= 8.x
- Docker >= 20.x
- Docker Compose >= 1.29
- PostgreSQL CLI (psql) para verificação local

### Por ambiente

| Recurso | Local | Staging | Produção |
|---------|-------|---------|----------|
| PostgreSQL | Container Docker | Gerenciado (Render/RDS) | Gerenciado (Render/RDS) |
| Redis | Opcional | Recomendado | Obrigatório |
| Backup | Manual | Automático | Automático |
| Monitoring | Local logs | CloudWatch/Datadog | CloudWatch/Datadog |

---

## 1. Ambiente Local

### 1.1 Setup inicial

```bash
# Clone o repositório
git clone https://github.com/MIAR-AI-S/OLUCAO.git
cd OLUCAO/i-food-main

# Instale dependências
pnpm install --frozen-lockfile

# Copie arquivo de environment
cp .env.example .env.local

# Edite variáveis conforme necessário
# JWT_SECRET, DATABASE_URL, API_PROXY_TARGET, etc.
```

### 1.2 Subir banco local

```bash
# Inicie PostgreSQL e Redis via Docker Compose
docker-compose up -d postgres redis

# Aguarde containers estarem saudáveis
docker-compose ps

# Verifique conexão
psql -h localhost -U postgres -d miar -c "SELECT 1;"
```

### 1.3 Build e testes

```bash
# Typecheck
pnpm typecheck

# Testes unitários
pnpm test

# Build de todos os apps
pnpm build

# Ou build específico
pnpm -F @workspace/gestor build
```

### 1.4 Desenvolvimento local

Abra em terminais separados:

```bash
# Terminal 1: API
cd api-server
PORT=5000 pnpm dev

# Terminal 2: App Gestor
cd artifacts/gestor
pnpm dev  # Porta padrão 5173

# Terminal 3: App Cozinha
cd artifacts/cozinha
pnpm dev  # Porta padrão 5175

# Terminal 4: App Caixa
cd artifacts/caixa
pnpm dev  # Porta padrão 5176

# etc.
```

### 1.5 E2E local

```bash
# Instale dependências nativas do Chromium
apt-get install -y libatk-1.0.so.0 libpangoft2-1.0.so.0 libpango-1.0.so.0

# Execute E2E específico
cd tests/e2e
pnpm test -- --grep "fluxo-completo" --headed

# Ou todos os E2E
pnpm test
```

---

## 2. Staging

Usar para validação pré-produção: branch `staging`, deploy automatizado.

### 2.1 Variáveis de ambiente

```bash
# .env.staging
NODE_ENV=staging
API_URL=https://api-staging.miar.ai
DATABASE_URL=postgresql://user:pass@staging-db.renderdb.com/miar
JWT_SECRET=<valor-forte-aleatório>
CORS_ORIGIN=https://staging.miar.ai,https://gestor-staging.miar.ai
```

### 2.2 Deploy via CI/CD

Configurar GitHub Actions (exemplo):

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy Staging

on:
  push:
    branches: [staging]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build
        run: |
          pnpm install --frozen-lockfile
          pnpm typecheck
          pnpm build
      
      - name: Deploy API
        run: |
          docker build -f deploy/Dockerfile.api -t miar-api:latest .
          docker push <registry>/miar-api:latest
      
      - name: Deploy Frontend
        run: |
          # Uploadar builds para CDN/S3
          aws s3 sync dist/gestor s3://staging-cdn/gestor/
          # Invalidar cache
          aws cloudfront create-invalidation ...
      
      - name: Health check
        run: |
          curl -f https://api-staging.miar.ai/health || exit 1
```

### 2.3 Backup e restore

```bash
# Backup do banco staging
pg_dump -h staging-db.renderdb.com -U postgres miar > backup-staging-$(date +%Y%m%d).sql

# Restore em local para testes
psql -h localhost -U postgres -d miar < backup-staging-20260823.sql
```

---

## 3. Produção

Deploy manual com aprovação. Risco alto.

### 3.1 Pré-deployment checklist

```
[ ] Branch main testado e aprovado em código review
[ ] Testes E2E passaram
[ ] Testes de segurança (tenant isolation, LGPD)
[ ] Backup agendado para antes do deploy
[ ] Runbook de rollback preparado
[ ] Time notificado do horário de deploy
[ ] Monitoramento ativo (CloudWatch, logs)
```

### 3.2 Variáveis de produção

```bash
# .env.production
NODE_ENV=production
API_URL=https://api.miar.ai
DATABASE_URL=postgresql://user:pass@prod-db.renderdb.com/miar
JWT_SECRET=<valor-super-forte-aleatório>
CORS_ORIGIN=https://miar.ai,https://gestor.miar.ai
LOG_LEVEL=info
```

### 3.3 Deploy da API

**Via Render.com (exemplo):**

```bash
# Push para trigger automático
git push origin main

# Ou manual via CLI Render
render deploy --service miar-api --branch main
```

**Via Docker + VPS:**

```bash
# Build imagem
docker build -f deploy/Dockerfile.api -t miar-api:v1.2.3 .

# Push para registry
docker push registry.example.com/miar-api:v1.2.3

# SSH para servidor
ssh deploy@prod-server.com

# Parar versão anterior
docker-compose -f deploy/docker-compose.production.yml stop api

# Atualizar imagem
sed -i 's/miar-api:.*/miar-api:v1.2.3/' docker-compose.production.yml

# Iniciar nova versão
docker-compose -f deploy/docker-compose.production.yml up -d api

# Verificar logs
docker logs -f miar-api
```

### 3.4 Deploy do frontend

```bash
# Build otimizado
NODE_ENV=production pnpm build

# Upload para CDN (S3 + CloudFront)
aws s3 sync artifacts/gestor/dist s3://miar-cdn/gestor/
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

### 3.5 Migração de banco

```bash
# Backup ANTES de rodar migração
pg_dump -h prod-db.renderdb.com -U postgres miar > backup-prod-$(date +%Y%m%d-%H%M%S).sql

# Aplicar migrações
npm run migrate:prod

# Verificar schema
psql -h prod-db.renderdb.com -U postgres -d miar -c "\dt"
```

### 3.6 Health check pós-deploy

```bash
#!/bin/bash
# health-check.sh

echo "Verificando API..."
curl -f https://api.miar.ai/health || exit 1

echo "Verificando banco..."
psql -h prod-db.renderdb.com -U postgres -d miar -c "SELECT COUNT(*) FROM companies;" || exit 1

echo "Verificando frontend..."
curl -f https://gestor.miar.ai/ | grep -q "Miar" || exit 1

echo "✅ Todos os health checks passaram"
```

---

## 4. Rollback

Se algo der errado em produção:

### 4.1 Rollback rápido (menos de 5 min)

```bash
# API (revert última imagem Docker)
docker-compose -f deploy/docker-compose.production.yml down api
sed -i 's/miar-api:.*/miar-api:v1.2.2/' docker-compose.production.yml
docker-compose -f deploy/docker-compose.production.yml up -d api

# Frontend (revert versão anterior em S3)
aws s3 sync s3://miar-cdn-backups/gestor-v1.2.2 s3://miar-cdn/gestor/
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"

# Validar
./health-check.sh
```

### 4.2 Rollback com banco

Se migração deu errado:

```bash
# 1. Parar API
docker-compose -f deploy/docker-compose.production.yml stop api

# 2. Restaurar backup
psql -h prod-db.renderdb.com -U postgres -d miar < backup-prod-20260823-140000.sql

# 3. Reverter código
git revert <commit-id>

# 4. Iniciar API com versão anterior
docker-compose -f deploy/docker-compose.production.yml up -d api

# 5. Validar
./health-check.sh
```

---

## 5. Monitoramento pós-deploy

### 5.1 Logs

```bash
# API logs
tail -f /var/log/miar/api.log

# Ou via Docker
docker logs -f miar-api

# Frontend (browser console)
# Usar CloudWatch, Datadog ou erro.io
```

### 5.2 Métricas

```bash
# Verificar latência
curl -w "@timing.txt" https://api.miar.ai/health

# Usar Prometheus/Grafana
# Dashboard: miar-api-status
```

### 5.3 Alertas

Configurar notificações:
- CPU > 80%
- Memória > 85%
- Erro 5xx rate > 1%
- Latência p99 > 500ms
- Banco indisponível
- Disco < 10% livre

---

## 6. Troubleshooting

### Problema: API não inicia

```bash
# Verificar logs
docker logs miar-api | tail -100

# Verificar conexão banco
psql -h prod-db.renderdb.com -U postgres -d miar -c "SELECT 1;"

# Verificar variáveis
docker exec miar-api env | grep DATABASE_URL

# Reiniciar
docker-compose restart api
```

### Problema: Frontend retorna 404

```bash
# Verificar se S3 tem o arquivo
aws s3 ls s3://miar-cdn/gestor/ | head -20

# Verificar cache CDN
aws cloudfront get-invalidation --distribution-id <ID> --id <inv-id>

# Limpar cache manualmente
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

### Problema: Banco cheio

```bash
# Verificar tamanho
psql -h prod-db.renderdb.com -U postgres -d miar -c "\l+"

# Limpar logs antigos
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';

# Ou aumentar disco em Render
```

---

## 7. Escalada de incidente

| Severidade | Tempo de resposta | Ação |
|-----------|------------------|------|
| Crítica (sem acesso) | Imediato | Rollback rápido + investigação |
| Alta (alguns usuários) | 15 min | Isolamento + patch ou rollback |
| Média (performance) | 1 hora | Análise + otimização ou rollback |
| Baixa (UI bug) | Próximo sprint | Agendado |

---

## 8. Checklist final

```
Antes do deploy:
[ ] Código revisado
[ ] Testes passando
[ ] Backup feito
[ ] Runbook revisado
[ ] Time alinhado

Durante:
[ ] Monitorando logs
[ ] Health checks ok
[ ] Performance normal
[ ] Usuários testando

Depois:
[ ] Documentar o que foi deployado
[ ] Listar issues encontradas
[ ] Planejar melhorias
```

---

## Referências

- Docker: https://docs.docker.com/
- Render: https://render.com/docs
- PostgreSQL: https://www.postgresql.org/docs/
- AWS S3: https://docs.aws.amazon.com/s3/
- GitHub Actions: https://docs.github.com/en/actions
