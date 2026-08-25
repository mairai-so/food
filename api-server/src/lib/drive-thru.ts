export type DriveThruStatus =
  | 'detected'
  | 'plate-read'
  | 'matched'
  | 'waiting'
  | 'at-window'
  | 'ready'
  | 'completed';

export type DriveThruStoreScope = 'loja-1' | 'loja-2' | 'todas' | 'ambiguous';

export interface DriveThruVehicle {
  id: string;
  restaurantId: string;
  plate: string;
  cameraId?: string;
  source: 'camera' | 'manual' | 'external';
  status: DriveThruStatus;
  createdAt: string;
  updatedAt: string;
  orderId?: string;
  customerName?: string;
  notes?: string;
  eventLog: Array<{ at: string; status: DriveThruStatus; source: string; message: string }>;
}

export interface DriveThruOrder {
  id: string;
  restaurantId: string;
  vehicleId: string;
  plate: string;
  orderId?: string;
  status: DriveThruStatus;
  customerName?: string;
  attendanceId?: string;
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
  notes?: string;
}

export interface DriveThruLprResult {
  id: string;
  restaurantId: string;
  source: 'camera' | 'manual' | 'external';
  provider?: string;
  rawPlate: string;
  normalizedPlate: string;
  confidence?: number;
  status: 'plate-read';
  detectedAt: string;
}

export function normalizePlate(input: string): string {
  const digits = input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!digits) return '';

  if (digits.length === 7 && /^[A-Z0-9]{7}$/.test(digits)) return digits;

  if (digits.length === 8) {
    const prefix = digits.slice(0, 3);
    const suffix = digits.slice(3);
    return `${prefix}${suffix}`;
  }

  return digits.slice(0, 7);
}

export function buildDriveThruVehicle(input: {
  restaurantId: string;
  plate: string;
  cameraId?: string;
  source?: 'camera' | 'manual' | 'external';
  orderId?: string;
  customerName?: string;
  notes?: string;
}): DriveThruVehicle {
  const now = new Date().toISOString();
  const plate = normalizePlate(input.plate);
  const status: DriveThruStatus = 'detected';

  return {
    id: `vehicle-${Math.random().toString(36).slice(2, 9)}`,
    restaurantId: input.restaurantId,
    plate,
    cameraId: input.cameraId,
    source: input.source ?? 'camera',
    status,
    createdAt: now,
    updatedAt: now,
    orderId: input.orderId,
    customerName: input.customerName,
    notes: input.notes,
    eventLog: [{
      at: now,
      status,
      source: input.source ?? 'camera',
      message: `Veículo detectado com placa ${plate}`,
    }],
  };
}

export function buildDriveThruOrder(input: {
  restaurantId: string;
  vehicleId: string;
  plate: string;
  orderId?: string;
  customerName?: string;
  status?: DriveThruStatus;
  attendanceId?: string;
  notes?: string;
  scheduledAt?: string;
  createdAt?: string;
}): DriveThruOrder {
  const now = input.createdAt ?? new Date().toISOString();
  const plate = normalizePlate(input.plate);

  return {
    id: `drive-order-${Math.random().toString(36).slice(2, 9)}`,
    restaurantId: input.restaurantId,
    vehicleId: input.vehicleId,
    plate,
    orderId: input.orderId,
    status: input.status ?? 'waiting',
    customerName: input.customerName,
    attendanceId: input.attendanceId,
    createdAt: now,
    updatedAt: now,
    scheduledAt: input.scheduledAt ?? now,
    notes: input.notes,
  };
}

export function createDriveThruLprResult(input: {
  restaurantId: string;
  source?: 'camera' | 'manual' | 'external';
  provider?: string;
  rawPlate: string;
  confidence?: number;
}): DriveThruLprResult {
  const now = new Date().toISOString();
  const normalized = normalizePlate(input.rawPlate);

  return {
    id: `lpr-${Math.random().toString(36).slice(2, 9)}`,
    restaurantId: input.restaurantId,
    source: input.source ?? 'external',
    provider: input.provider,
    rawPlate: input.rawPlate,
    normalizedPlate: normalized,
    confidence: input.confidence,
    status: 'plate-read',
    detectedAt: now,
  };
}

export function applyDriveThruStatus(vehicle: DriveThruVehicle, nextStatus: DriveThruStatus): DriveThruVehicle {
  const now = new Date().toISOString();

  return {
    ...vehicle,
    status: nextStatus,
    updatedAt: now,
    eventLog: [
      ...vehicle.eventLog,
      {
        at: now,
        status: nextStatus,
        source: 'system',
        message: `Status atualizado para ${nextStatus}`,
      },
    ],
  };
}

export function resolveStoreScope(query: string): DriveThruStoreScope {
  const text = (query ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  if (!text) return 'ambiguous';
  if (/(todas|ambas|duas lojas|as duas)/.test(text)) return 'todas';
  if (/(loja\s*1|loja\s*01|filial\s*1|restaurante\s*1)/.test(text)) return 'loja-1';
  if (/(loja\s*2|loja\s*02|filial\s*2|restaurante\s*2)/.test(text)) return 'loja-2';
  if (/(loja|restaurante|filial)/.test(text) && /(1|um)/.test(text) && !/(2|dois)/.test(text)) return 'loja-1';
  if (/(loja|restaurante|filial)/.test(text) && /(2|dois)/.test(text)) return 'loja-2';

  return 'ambiguous';
}

export function filterByStoreScope<T extends { restaurantId: string }>(records: T[], scope: DriveThruStoreScope, restaurantId?: string): T[] {
  if (scope === 'todas' || !restaurantId) return records;
  return records.filter((record) => record.restaurantId === restaurantId);
}

export function getStoreScopeIds(scope: DriveThruStoreScope): string[] {
  if (scope === 'loja-1') return ['loja-1'];
  if (scope === 'loja-2') return ['loja-2'];
  if (scope === 'todas') return ['loja-1', 'loja-2'];
  return [];
}
