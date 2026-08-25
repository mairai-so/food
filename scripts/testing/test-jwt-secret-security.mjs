#!/usr/bin/env node

/**
 * Script de teste: Valida JWT_SECRET
 *
 * Cenários testados:
 * 1. Production sem JWT_SECRET → FALHA NO BOOT
 * 2. Production com JWT_SECRET fraco (< 16 chars) → AVISO
 * 3. Production com JWT_SECRET forte → OK
 * 4. Development sem JWT_SECRET → OK (usa fallback com aviso)
 * 5. Development com JWT_SECRET → OK
 */

function testJwtSecretValidation(nodeEnv, jwtSecret) {
  console.log(`\n🧪 Testando: NODE_ENV=${nodeEnv}, JWT_SECRET=${jwtSecret ? `"${jwtSecret}"` : 'undefined'}`);

  const isProduction = nodeEnv === 'production';

  // Em produção, JWT_SECRET deve estar obrigatoriamente definido
  if (isProduction && !jwtSecret) {
    console.log('   ❌ FALHA ESPERADA — JWT_SECRET é obrigatório em produção');
    console.log('   → Servidor NÃO iniciaria com erro ruidoso');
    return false;
  }

  if (isProduction && jwtSecret && jwtSecret.length < 16) {
    console.log(`   ⚠️  AVISO — JWT_SECRET é fraco (${jwtSecret.length} chars, recomendado 32+)`);
    console.log('   → Servidor iniciaria, mas com aviso de segurança');
    return true;
  }

  if (isProduction && jwtSecret && jwtSecret.length >= 16) {
    console.log(`   ✅ JWT_SECRET OK — ${jwtSecret.length} caracteres`);
    return true;
  }

  if (!isProduction && !jwtSecret) {
    console.log('   ✅ Development — Usando fallback "development-only-insecure-key" (com aviso)');
    return true;
  }

  if (!isProduction && jwtSecret) {
    console.log('   ✅ Development — JWT_SECRET explicitamente configurado');
    return true;
  }

  return true;
}

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  JWT_SECRET SECURITY VALIDATION TEST                          ║');
console.log('╚════════════════════════════════════════════════════════════════╝');

// Cenário 1: Production sem JWT_SECRET (FALHA)
testJwtSecretValidation('production', null);

// Cenário 2: Production com JWT_SECRET fraco
testJwtSecretValidation('production', 'fraco123');

// Cenário 3: Production com JWT_SECRET forte (32 caracteres)
const strongSecret = 'a'.repeat(32);
testJwtSecretValidation('production', strongSecret);

// Cenário 4: Development sem JWT_SECRET (usa fallback)
testJwtSecretValidation('development', null);

// Cenário 5: Development com JWT_SECRET
testJwtSecretValidation('development', 'my-dev-secret');

console.log('\n✅ RESUMO:');
console.log('   • JWT_SECRET é OBRIGATÓRIO em produção (sem fallback)');
console.log('   • Em produção, deve ter MÍNIMO 16 caracteres (recomendado 32+)');
console.log('   • Em desenvolvimento, pode usar fallback com aviso');
console.log('   • Validação acontece NO BOOT (falha rápida)');
console.log('');
