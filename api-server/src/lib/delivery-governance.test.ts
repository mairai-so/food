import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGovernanceIncident, buildPenaltyStatus, isGovernanceBlocked, normalizeGovernanceConfig } from './delivery-governance.ts';

test('progressive penalties escalate warning, suspension and ban', () => {
  const config = normalizeGovernanceConfig({ warningThreshold: 1, suspensionThreshold: 2, banThreshold: 3, suspensionDays: 48, active: true });
  const profile = applyGovernanceIncident(undefined, {
    id: 'inc-1',
    employeeId: 'emp-1',
    employeeName: 'Ana',
    reason: 'Atraso injustificado',
    notes: 'Chegou 40 minutos depois',
    severity: 'warning',
    createdBy: 'owner',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'warning',
    penaltyLevel: 1,
  }, config);

  assert.equal(profile.penaltyStatus, 'warning');
  assert.equal(profile.negativeEvents, 1);

  const suspended = applyGovernanceIncident(profile, {
    id: 'inc-2',
    employeeId: 'emp-1',
    employeeName: 'Ana',
    reason: 'Comportamento inadequado',
    notes: 'Desrespeito com o cliente',
    severity: 'critical',
    createdBy: 'owner',
    createdAt: '2026-01-02T00:00:00.000Z',
    status: 'suspension',
    penaltyLevel: 2,
  }, config);

  assert.equal(suspended.penaltyStatus, 'suspension');
  assert.equal(suspended.negativeEvents, 2);

  const banned = applyGovernanceIncident(suspended, {
    id: 'inc-3',
    employeeId: 'emp-1',
    employeeName: 'Ana',
    reason: 'Avaria na embalagem',
    notes: 'Pedido chegou danificado',
    severity: 'critical',
    createdBy: 'owner',
    createdAt: '2026-01-03T00:00:00.000Z',
    status: 'banned',
    penaltyLevel: 3,
  }, config);

  assert.equal(banned.penaltyStatus, 'banned');
  assert.equal(banned.negativeEvents, 3);
});

test('buildPenaltyStatus keeps status at none when there are no incidents', () => {
  assert.equal(buildPenaltyStatus(0, normalizeGovernanceConfig()), 'none');
});

test('suspension and ban block access', () => {
  const config = normalizeGovernanceConfig({ active: true });
  const suspended = applyGovernanceIncident(undefined, {
    id: 'inc-1',
    employeeId: 'emp-1',
    employeeName: 'Ana',
    reason: 'Atraso injustificado',
    notes: 'Cliente reclamou',
    severity: 'warning',
    createdBy: 'owner',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'suspension',
    penaltyLevel: 2,
  }, config);
  assert.equal(isGovernanceBlocked(suspended), true);

  const banned = applyGovernanceIncident(undefined, {
    id: 'inc-2',
    employeeId: 'emp-2',
    employeeName: 'Beto',
    reason: 'Postura inadequada',
    notes: 'Banido por recorrência',
    severity: 'critical',
    createdBy: 'owner',
    createdAt: '2026-01-02T00:00:00.000Z',
    status: 'banned',
    penaltyLevel: 3,
  }, config);
  assert.equal(isGovernanceBlocked(banned), true);
});
