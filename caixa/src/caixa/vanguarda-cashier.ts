import { apiGet, apiPost, getOperador } from './api';

export type CashierSession = {
  id: string;
  status: 'open' | 'closed';
  operatorName: string;
  initialFloat: number;
  expectedCash?: number;
  actualCash?: number;
  difference?: number;
  openedAt: string;
  movements: Array<{ id: string; type: string; amount: number; operatorName: string; timestamp: string }>;
  openingDenominations?: Record<string, number>;
  closingDenominations?: Record<string, number>;
  handoff?: {
    mode: 'with_sangria' | 'without_sangria';
    outgoingOperatorName: string;
    incomingOperatorName?: string;
    outgoingNotes?: string;
    incomingNotes?: string;
    countedCash?: number;
    receivedAt?: string;
  };
};

export type ReconciliationMethod = 'cash' | 'pix' | 'credit' | 'debit' | 'voucher' | 'app';
export type MethodReconciliation = {
  expected?: number;
  counted?: number;
  confirmed?: number;
  pending?: number;
  failed?: number;
  refunded?: number;
  inReconciliation?: number;
  difference?: number;
};
export type CashierSummary = {
  cashInDrawer: number;
  totalRevenue?: number;
  totalSales?: number;
  totalCash?: number;
  totalCard?: number;
  totalPix?: number;
  totalCredit?: number;
  totalDebit?: number;
  totalVoucher?: number;
  totalApp?: number;
  totalSangria: number;
  totalReforco: number;
  salesCount?: number;
  movementCount?: number;
  reconciliation?: Partial<Record<ReconciliationMethod, MethodReconciliation>>;
};

export async function getCurrentCashierSession() {
  return apiGet<{ session: CashierSession | null; summary?: CashierSummary }>('/cashier/session/current');
}

export async function openCashierSession(initialFloat: number, openingDenominations?: Record<string, number>) {
  return apiPost<{ session: CashierSession; summary: CashierSummary }>('/cashier/session/open', {
    initialFloat,
    operatorName: getOperador(),
    openingDenominations,
  });
}

export async function addCashMovement(sessionId: string, type: 'sangria' | 'reforco', amount: number, description: string) {
  return apiPost<{ movement: CashierSession['movements'][number]; summary: CashierSummary }>(`/cashier/session/${encodeURIComponent(sessionId)}/movement`, {
    type,
    amount,
    operatorName: getOperador(),
    description,
  });
}

export async function closeCashierSession(sessionId: string, actualCash: number, closingNotes?: string, closingDenominations?: Record<string, number>) {
  return apiPost<{ session: CashierSession; summary: CashierSummary; difference: number; expectedCash: number }>(`/cashier/session/${encodeURIComponent(sessionId)}/close`, {
    actualCash,
    operatorName: getOperador(),
    closingNotes,
    closingDenominations,
  });
}

export async function handoffCashierSession(sessionId: string, mode: 'with_sangria' | 'without_sangria', actualCash: number, closingNotes?: string, closingDenominations?: Record<string, number>) {
  return apiPost<{ session: CashierSession; summary: CashierSummary; difference: number; expectedCash: number }>(`/cashier/session/${encodeURIComponent(sessionId)}/handoff`, {
    mode,
    actualCash,
    closingNotes,
    closingDenominations,
  });
}

export async function receiveCashierHandoff(previousSessionId: string, initialFloat: number, incomingNotes?: string, openingDenominations?: Record<string, number>) {
  return apiPost<{ session: CashierSession; summary: CashierSummary }>(`/cashier/session/handoff/receive`, {
    previousSessionId,
    initialFloat,
    incomingNotes,
    openingDenominations,
  });
}
