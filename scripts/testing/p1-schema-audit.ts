#!/usr/bin/env node

/**
 * P1.3: Auditoria de schema SQL
 * 
 * Compara três fontes:
 * 1. Drizzle (lib/db)
 * 2. SQL estático (database/schema.sql)
 * 3. SQL criado no boot da API
 * 
 * Gera relatório de divergências
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface SchemaSource {
  name: string;
  tables: string[];
  columns: Record<string, string[]>;
}

const report = {
  generatedAt: new Date().toISOString(),
  sources: [] as SchemaSource[],
  divergences: [] as string[],
  recommendations: [] as string[],
};

console.log('🔍 Auditando schema SQL...\n');

// 1. Extrair tabelas de Drizzle
console.log('1️⃣  Lendo schema Drizzle...');
try {
  const drizzleFiles = execSync('find lib/db -name "*.ts" | grep -v test').toString().split('\n').filter(Boolean);
  const drizzleTables = new Set<string>();

  drizzleFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    // Buscar por sqlTable ou defineTable
    const matches = content.match(/(?:sqlTable|defineTable)\s*\(\s*["'](\w+)["']/g);
    if (matches) {
      matches.forEach(match => {
        const tableName = match.match(/["'](\w+)["']/)?.[1];
        if (tableName) drizzleTables.add(tableName);
      });
    }
  });

  report.sources.push({
    name: 'Drizzle',
    tables: Array.from(drizzleTables).sort(),
    columns: {}, // Simplificado para este script
  });
  console.log(`  ✅ Encontradas ${drizzleTables.size} tabelas em Drizzle`);
} catch (e) {
  console.log(`  ❌ Erro ao ler Drizzle: ${e}`);
  report.divergences.push('Erro ao ler Drizzle');
}

// 2. Extrair tabelas de database/schema.sql
console.log('\n2️⃣  Lendo schema SQL estático...');
try {
  const schemaPath = 'database/schema.sql';
  if (fs.existsSync(schemaPath)) {
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    const sqlTables = new Set<string>();

    // Buscar CREATE TABLE
    const createMatches = schemaContent.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["']?(\w+)["']?/gi);
    if (createMatches) {
      createMatches.forEach(match => {
        const tableName = match.match(/["']?(\w+)["']?$/)?.[1];
        if (tableName) sqlTables.add(tableName);
      });
    }

    report.sources.push({
      name: 'SQL Estático',
      tables: Array.from(sqlTables).sort(),
      columns: {},
    });
    console.log(`  ✅ Encontradas ${sqlTables.size} tabelas em schema.sql`);
  } else {
    console.log(`  ⚠️  Arquivo não encontrado: ${schemaPath}`);
  }
} catch (e) {
  console.log(`  ❌ Erro ao ler SQL: ${e}`);
  report.divergences.push('Erro ao ler schema.sql');
}

// 3. Extrair tabelas criadas no boot da API
console.log('\n3️⃣  Lendo SQL de boot da API...');
try {
  const bootFiles = execSync('find api-server/src/lib -name "*.ts" | grep -v test').toString().split('\n').filter(Boolean);
  const bootTables = new Set<string>();

  bootFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    // Buscar por CREATE TABLE
    const matches = content.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["']?(\w+)["']?/gi);
    if (matches) {
      matches.forEach(match => {
        const tableName = match.match(/["']?(\w+)["']?$/)?.[1];
        if (tableName) bootTables.add(tableName);
      });
    }
  });

  if (bootTables.size > 0) {
    report.sources.push({
      name: 'Boot API',
      tables: Array.from(bootTables).sort(),
      columns: {},
    });
    console.log(`  ✅ Encontradas ${bootTables.size} tabelas no boot da API`);
  } else {
    console.log(`  ℹ️  Nenhuma tabela criada no boot (pode estar centralizado em outro lugar)`);
  }
} catch (e) {
  console.log(`  ❌ Erro ao ler boot: ${e}`);
  report.divergences.push('Erro ao ler boot da API');
}

// Comparar fontes
console.log('\n📊 Comparando fontes...\n');

const allTables = new Set<string>();
const tablesBySource: Record<string, Set<string>> = {};

report.sources.forEach(source => {
  tablesBySource[source.name] = new Set(source.tables);
  source.tables.forEach(t => allTables.add(t));
});

allTables.forEach(table => {
  const sources = Object.keys(tablesBySource).filter(s => tablesBySource[s].has(table));
  if (sources.length < Object.keys(tablesBySource).length) {
    const missing = Object.keys(tablesBySource).filter(s => !tablesBySource[s].has(table));
    const msg = `❌ Tabela "${table}" faltando em: ${missing.join(', ')}`;
    console.log(msg);
    report.divergences.push(msg);
  }
});

// Recomendações
console.log('\n💡 Recomendações:\n');

if (report.divergences.length === 0) {
  console.log('✅ Nenhuma divergência encontrada! Schema está coerente.');
  report.recommendations.push('Schema coerente entre as três fontes.');
} else {
  if (report.sources.length > 1) {
    const drizzle = report.sources.find(s => s.name === 'Drizzle');
    const sql = report.sources.find(s => s.name === 'SQL Estático');

    if (drizzle && sql) {
      console.log('1️⃣  Escolher Drizzle como fonte única de verdade:');
      console.log('   - Gerar database/schema.sql a partir do Drizzle.');
      console.log('   - Remover SQL duplicado do boot da API.');
      console.log('   - Usar migração de banco versionada.\n');
      report.recommendations.push('Usar Drizzle como fonte única');
    }
  }

  console.log('2️⃣  Próximos passos:');
  console.log('   - Executar: drizzle-kit push:pg');
  console.log('   - Validar com: drizzle-kit studio');
  console.log('   - Criar migração: drizzle-kit generate:pg\n');

  console.log('3️⃣  Riscos de deixar divergência:');
  console.log('   - Upgrade sem controle de migração.\n');
  console.log('   - Perda de dados ou inconsistência.');
  console.log('   - Dificuldade em rollback.\n');
}

// Salvar relatório
const reportPath = 'docs/SCHEMA_AUDIT_REPORT.json';
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n📄 Relatório salvo em: ${reportPath}`);

// Resumo final
console.log('\n' + '='.repeat(60));
console.log('📋 Resumo da auditoria:');
console.log('='.repeat(60));
console.log(`Fontes analisadas: ${report.sources.length}`);
console.log(`Total de tabelas: ${allTables.size}`);
console.log(`Divergências encontradas: ${report.divergences.length}`);
console.log(`Recomendações: ${report.recommendations.length}`);

if (report.divergences.length > 0) {
  console.log('\n⚠️  STATUS: Divergências detectadas. Ação necessária.');
  process.exit(1);
} else {
  console.log('\n✅ STATUS: Schema coerente.');
  process.exit(0);
}
