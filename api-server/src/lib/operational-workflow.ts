export type OperationalWorkflowOrderStatus = 'received' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'completed' | 'cancelled';

export interface OperationalWorkflowOrder {
  id: string;
  restaurantId: string;
  restaurantName: string;
  customerName: string;
  phone?: string;
  address?: string;
  mode: 'delivery' | 'pickup' | 'dine-in';
  status: OperationalWorkflowOrderStatus;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  createdAt: string;
  etaMinutes?: number;
  kind?: 'pizza' | 'churrasco' | 'generic';
  customization?: Record<string, unknown>;
}

export function buildOperationalOrder(overrides: Partial<OperationalWorkflowOrder> & Pick<OperationalWorkflowOrder, 'restaurantId' | 'restaurantName' | 'customerName' | 'mode' | 'items' | 'total'>): OperationalWorkflowOrder {
  return {
    id: `order-${Math.random().toString(36).slice(2, 8)}`,
    status: 'received',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function getOperationalWorkflowNextStatus(status: OperationalWorkflowOrderStatus, stage: 'kitchen' | 'delivery' | 'cashier'): OperationalWorkflowOrderStatus {
  if (stage === 'kitchen') {
    const map: Record<OperationalWorkflowOrderStatus, OperationalWorkflowOrderStatus> = {
      received: 'confirmed',
      confirmed: 'preparing',
      preparing: 'ready',
      ready: 'ready',
      delivering: 'delivering',
      completed: 'completed',
      cancelled: 'cancelled',
    };
    return map[status];
  }

  if (stage === 'cashier') {
    const map: Record<OperationalWorkflowOrderStatus, OperationalWorkflowOrderStatus> = {
      received: 'confirmed',
      confirmed: 'ready',
      preparing: 'ready',
      ready: 'ready',
      delivering: 'delivering',
      completed: 'completed',
      cancelled: 'cancelled',
    };
    return map[status];
  }

  const map: Record<OperationalWorkflowOrderStatus, OperationalWorkflowOrderStatus> = {
    received: 'received',
    confirmed: 'confirmed',
    preparing: 'preparing',
    ready: 'delivering',
    delivering: 'completed',
    completed: 'completed',
    cancelled: 'cancelled',
  };
  return map[status];
}

export function applyOperationalPayment(order: OperationalWorkflowOrder): OperationalWorkflowOrder {
  return {
    ...order,
    status: 'ready',
  };
}
