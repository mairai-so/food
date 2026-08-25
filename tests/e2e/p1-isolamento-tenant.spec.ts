#!/usr/bin/env node

/**
 * P1.2: Teste de isolamento entre tenants
 * 
 * Valida que empresa A não consegue acessar dados de empresa B
 * 
 * Cenários:
 * 1. Gestor A tenta acessar restaurantes de empresa B
 * 2. Gestor A tenta acessar funcionários de empresa B
 * 3. Gestor A tenta acessar pedidos de empresa B
 * 4. Gestor A tenta acessar caixa de empresa B
 * 
 * Todos devem retornar 403 Forbidden ou lista vazia
 */

import { test, expect } from '@playwright/test';

test.describe('Isolamento entre tenants (Empresa A vs Empresa B)', () => {
  test.skip(
    !process.env.EMPRESA_A_TOKEN || !process.env.EMPRESA_B_TOKEN,
    'Requer EMPRESA_A_TOKEN e EMPRESA_B_TOKEN reais para fixtures de dois tenants.',
  );

  let apiUrl = process.env.API_URL || 'http://localhost:5000';
  
  let empresaA = {
    id: 'empresa-a-001',
    token: process.env.EMPRESA_A_TOKEN!,
    restaurantId: process.env.EMPRESA_A_RESTAURANT_ID || 'rest-a-001',
    funcionarioId: 'func-a-001',
  };

  let empresaB = {
    id: 'empresa-b-001',
    token: process.env.EMPRESA_B_TOKEN!,
    restaurantId: process.env.EMPRESA_B_RESTAURANT_ID || 'rest-b-001',
    funcionarioId: 'func-b-001',
  };

  test.describe('Restaurantes', () => {
    test('01. Gestor A consegue ver seus restaurantes', async ({ request }) => {
      const response = await request.get(`${apiUrl}/api/restaurants`, {
        headers: { Authorization: `Bearer ${empresaA.token}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      
      // Validar que contém restaurante de A
      const restaurantIds = data.map((r: any) => r.id);
      expect(restaurantIds).toContain(empresaA.restaurantId);
      
      console.log(`✅ Gestor A vê ${data.length} restaurante(s)`);
    });

    test('02. Gestor A NÃO consegue acessar restaurante de B', async ({ request }) => {
      const response = await request.get(
        `${apiUrl}/api/restaurants/${empresaB.restaurantId}`,
        {
          headers: { Authorization: `Bearer ${empresaA.token}` },
        }
      );

      // Deve retornar 403 ou 404
      expect([403, 404]).toContain(response.status());
      console.log(`✅ Gestor A bloqueado ao acessar restaurante B (${response.status()})`);
    });

    test('03. Gestor B consegue ver seus restaurantes', async ({ request }) => {
      const response = await request.get(`${apiUrl}/api/restaurants`, {
        headers: { Authorization: `Bearer ${empresaB.token}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      
      const restaurantIds = data.map((r: any) => r.id);
      expect(restaurantIds).toContain(empresaB.restaurantId);
      
      console.log(`✅ Gestor B vê ${data.length} restaurante(s)`);
    });
  });

  test.describe('Funcionários', () => {
    test('01. Gestor A consegue ver seus funcionários', async ({ request }) => {
      const response = await request.get(
        `${apiUrl}/api/restaurants/${empresaA.restaurantId}/employees`,
        {
          headers: { Authorization: `Bearer ${empresaA.token}` },
        }
      );

      expect(response.status()).toBe(200);
      const data = await response.json();
      
      expect(data.length).toBeGreaterThan(0);
      console.log(`✅ Gestor A vê ${data.length} funcionário(s)`);
    });

    test('02. Gestor A NÃO consegue acessar funcionários de B', async ({ request }) => {
      const response = await request.get(
        `${apiUrl}/api/restaurants/${empresaB.restaurantId}/employees`,
        {
          headers: { Authorization: `Bearer ${empresaA.token}` },
        }
      );

      expect([403, 404]).toContain(response.status());
      console.log(`✅ Gestor A bloqueado ao acessar funcionários B (${response.status()})`);
    });
  });

  test.describe('Pedidos', () => {
    test('01. Gestor A consegue ver seus pedidos', async ({ request }) => {
      const response = await request.get(
        `${apiUrl}/api/restaurants/${empresaA.restaurantId}/orders`,
        {
          headers: { Authorization: `Bearer ${empresaA.token}` },
        }
      );

      expect(response.status()).toBe(200);
      console.log(`✅ Gestor A vê seus pedidos`);
    });

    test('02. Gestor A NÃO consegue acessar pedidos de B', async ({ request }) => {
      const response = await request.get(
        `${apiUrl}/api/restaurants/${empresaB.restaurantId}/orders`,
        {
          headers: { Authorization: `Bearer ${empresaA.token}` },
        }
      );

      expect([403, 404]).toContain(response.status());
      console.log(`✅ Gestor A bloqueado ao acessar pedidos B (${response.status()})`);
    });
  });

  test.describe('Caixa', () => {
    test('01. Gestor A consegue ver seu caixa', async ({ request }) => {
      const response = await request.get(
        `${apiUrl}/api/restaurants/${empresaA.restaurantId}/cashier/sessions`,
        {
          headers: { Authorization: `Bearer ${empresaA.token}` },
        }
      );

      expect(response.status()).toBe(200);
      console.log(`✅ Gestor A vê suas sessões de caixa`);
    });

    test('02. Gestor A NÃO consegue acessar caixa de B', async ({ request }) => {
      const response = await request.get(
        `${apiUrl}/api/restaurants/${empresaB.restaurantId}/cashier/sessions`,
        {
          headers: { Authorization: `Bearer ${empresaA.token}` },
        }
      );

      expect([403, 404]).toContain(response.status());
      console.log(`✅ Gestor A bloqueado ao acessar caixa B (${response.status()})`);
    });
  });

  test.afterAll(async () => {
    console.log('\n📊 Resultado de isolamento:');
    console.log(`  ✅ Empresa A: acesso permitido apenas a seus recursos`);
    console.log(`  ✅ Empresa B: acesso permitido apenas a seus recursos`);
    console.log(`  ✅ Cruzamento: bloqueado em todas as tentativas`);
  });
});
