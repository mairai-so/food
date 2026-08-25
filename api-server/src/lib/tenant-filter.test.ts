import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTenantRecords } from './tenant-filter.ts';

test('filters tenant records by the authenticated company id', () => {
  const records = [
    { id: 'order-a', restaurantId: 'company-a' },
    { id: 'order-b', restaurantId: 'company-b' },
  ];

  assert.deepEqual(filterTenantRecords(records, 'company-a'), [
    { id: 'order-a', restaurantId: 'company-a' },
  ]);
});
