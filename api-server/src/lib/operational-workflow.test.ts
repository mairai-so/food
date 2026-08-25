import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOperationalPayment, buildOperationalOrder, getOperationalWorkflowNextStatus, type OperationalWorkflowOrderStatus } from './operational-workflow.ts';

test('advance workflow status across kitchen and delivery stages', () => {
  const order = buildOperationalOrder({
    restaurantId: 'rest-1',
    restaurantName: 'Churrascaria do Vale',
    customerName: 'Ana',
    mode: 'delivery',
    items: [{ name: 'Picanha', quantity: 1, price: 89 }],
    total: 89,
  });

  assert.equal(getOperationalWorkflowNextStatus(order.status as OperationalWorkflowOrderStatus, 'kitchen'), 'confirmed');
  assert.equal(getOperationalWorkflowNextStatus('preparing' as OperationalWorkflowOrderStatus, 'kitchen'), 'ready');
  assert.equal(getOperationalWorkflowNextStatus('ready' as OperationalWorkflowOrderStatus, 'delivery'), 'delivering');
});

test('payment completion moves a pending order to ready', () => {
  const order = buildOperationalOrder({
    restaurantId: 'rest-1',
    restaurantName: 'Churrascaria do Vale',
    customerName: 'Bruno',
    mode: 'pickup',
    items: [{ name: 'Pizza', quantity: 1, price: 49 }],
    total: 49,
  });

  const paidOrder = applyOperationalPayment(order);
  assert.equal(paidOrder.status, 'ready');
});
