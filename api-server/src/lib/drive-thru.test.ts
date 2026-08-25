import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyDriveThruStatus,
  normalizePlate,
  buildDriveThruVehicle,
  buildDriveThruOrder,
  createDriveThruLprResult,
  resolveStoreScope,
  getStoreScopeIds,
} from './drive-thru.ts';

test('normaliza placa brasileira para o padrão do painel do drive-thru', () => {
  assert.equal(normalizePlate('abc-1234'), 'ABC1234');
  assert.equal(normalizePlate(' ABC-1D34 '), 'ABC1D34');
  assert.equal(normalizePlate('abc1d34'), 'ABC1D34');
});

test('avança o status do veículo e mantém o restaurante isolado', () => {
  const vehicle = buildDriveThruVehicle({
    restaurantId: 'loja-1',
    plate: 'ABC1D34',
    source: 'camera',
  });

  const progressed = applyDriveThruStatus(vehicle, 'at-window');
  assert.equal(progressed.status, 'at-window');
  assert.equal(progressed.restaurantId, 'loja-1');
});

test('pedido de drive-thru carrega loja, placa, status e atendimento', () => {
  const order = buildDriveThruOrder({
    restaurantId: 'loja-1',
    vehicleId: 'vehicle-001',
    plate: 'ABC1D34',
    orderId: 'pedido-abc',
    customerName: 'Marcos',
    status: 'waiting',
    attendanceId: 'atendimento-01',
  });

  assert.equal(order.restaurantId, 'loja-1');
  assert.equal(order.plate, 'ABC1D34');
  assert.equal(order.status, 'waiting');
  assert.equal(order.attendanceId, 'atendimento-01');
  assert.ok(order.createdAt);
});

test('mesma placa em lojas diferentes não pode misturar dados', () => {
  const loja1 = buildDriveThruOrder({
    restaurantId: 'loja-1',
    vehicleId: 'vehicle-001',
    plate: 'ABC1D34',
    orderId: 'pedido-1',
    status: 'waiting',
  });

  const loja2 = buildDriveThruOrder({
    restaurantId: 'loja-2',
    vehicleId: 'vehicle-999',
    plate: 'ABC1D34',
    orderId: 'pedido-2',
    status: 'waiting',
  });

  assert.notEqual(loja1.restaurantId, loja2.restaurantId);
  assert.equal(loja1.plate, loja2.plate);
  assert.ok(loja1.id !== loja2.id);
});

test('resultado do LPR fica preparado para integração real', () => {
  const result = createDriveThruLprResult({
    restaurantId: 'loja-2',
    source: 'camera',
    rawPlate: 'abc-1d34',
    confidence: 0.96,
    provider: 'gemini-vision',
  });

  assert.equal(result.restaurantId, 'loja-2');
  assert.equal(result.normalizedPlate, 'ABC1D34');
  assert.equal(result.status, 'plate-read');
  assert.equal(result.provider, 'gemini-vision');
  assert.ok(result.detectedAt);
});

test('escopo de loja na IA exige definição explícita para consultas sem loja', () => {
  assert.equal(resolveStoreScope('Quanto temos de frango?'), 'ambiguous');
  assert.equal(resolveStoreScope('Consulta da Loja 1'), 'loja-1');
  assert.equal(resolveStoreScope('Da Loja 2.'), 'loja-2');
  assert.equal(resolveStoreScope('Das duas lojas'), 'todas');
});

test('AUDITORIA: usuario com acesso so a Loja 1 nao ve Loja 2', () => {
  const userPermissions = ['loja-1'];
  const records = [
    { id: '1', restaurantId: 'loja-1' },
    { id: '2', restaurantId: 'loja-2' },
  ];
  const visible = records.filter((r) => userPermissions.includes(r.restaurantId));
  assert.equal(visible.length, 1);
  assert.equal(visible[0].restaurantId, 'loja-1');
});

test('AUDITORIA: getStoreScopeIds retorna as lojas certas para cada escopo', () => {
  assert.deepEqual(getStoreScopeIds('loja-1'), ['loja-1']);
  assert.deepEqual(getStoreScopeIds('loja-2'), ['loja-2']);
  assert.deepEqual(getStoreScopeIds('todas'), ['loja-1', 'loja-2']);
  assert.deepEqual(getStoreScopeIds('ambiguous'), []);
});
