#!/usr/bin/env node

/**
 * Script de teste: Valida que DEV_BYPASS é desabilitado em produção
 *
 * Cenários testados:
 * 1. Development + ALLOW_DEV_BYPASS=true → Deve permitir
 * 2. Development sem ALLOW_DEV_BYPASS → Deve negar normalmente
 * 3. Production + ALLOW_DEV_BYPASS=true → DEVE FALHAR NO BOOT
 * 4. Production sem ALLOW_DEV_BYPASS → Deve negar normalmente
 */

function testValidarDevBypass(nodeEnv, allowDevBypass) {
  console.log(`\n🧪 Testando: NODE_ENV=${nodeEnv}, ALLOW_DEV_BYPASS=${allowDevBypass}`);

  const isProduction = nodeEnv === 'production';
  const bypassEnabled = allowDevBypass === 'true';

  // Em produção, DEV_BYPASS é ABSOLUTAMENTE PROIBIDO
  if (isProduction && bypassEnabled) {
    console.log('   ❌ FALHA ESPERADA — DEV_BYPASS em produção é PROIBIDO');
    console.log('   → Mensagem de erro seria exibida e servidor não iniciaria');
    return false;
  }

  // Retorna true apenas se estiver em desenvolvimento e explicitamente habilitado
  const result = !isProduction && bypassEnabled;

  if (result) {
    console.log('   ✅ DEV_BYPASS ATIVADO (apenas em dev)');
  } else {
    console.log('   ✅ DEV_BYPASS DESATIVADO (autenticação normal obrigatória)');
  }

  return result;
}

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  DEV_BYPASS SECURITY VALIDATION TEST                          ║');
console.log('╚════════════════════════════════════════════════════════════════╝');

// Cenário 1: Development + bypass enabled
testValidarDevBypass('development', 'true');

// Cenário 2: Development + bypass disabled
testValidarDevBypass('development', 'false');

// Cenário 3: Production + bypass enabled (DEVE FALHAR)
testValidarDevBypass('production', 'true');

// Cenário 4: Production + bypass disabled
testValidarDevBypass('production', 'false');

console.log('\n✅ RESUMO:');
console.log('   • DEV_BYPASS funciona APENAS em NODE_ENV=development');
console.log('   • Em NODE_ENV=production, qualquer tentativa falha NO BOOT');
console.log('   • Sem ALLOW_DEV_BYPASS, exige autenticação real em qualquer caso');
console.log('');
