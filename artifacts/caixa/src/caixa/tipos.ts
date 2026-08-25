// Tipos do domínio do caixa — espelham o que o backend devolve.

export type TableStatus = 'free' | 'occupied' | 'reserved' | 'cleaning' | 'paid';

export interface GuestShare {
  id: string;
  name: string;
  isComandante: boolean;
  paid: boolean;
  amount: number;
}

export interface SessionInfo {
  id: string;
  subtotal: number;
  paidAmount: number;
  pendingAmount: number;
  guestCount: number;
  itemCount: number;
  splitMode: 'equal' | 'byItems' | 'custom';
  fullyPaid: boolean;
  guests: GuestShare[];
}

export interface ReadyOrder {
  id: string;
  total: number;
  tableNumber: number;
  isPriority?: boolean;
  items?: { name: string; quantity: number }[];
  createdAt: string;
}

export interface TableWithSession {
  id: string;
  number: number;
  seats: number;
  status: TableStatus;
  qrToken: string;
  exitQrToken: string;
  session: SessionInfo | null;
  readyOrder: ReadyOrder | null;
  activeOrder: { id: string; total: number; status: string; createdAt: string } | null;
}

// Pedido do fluxo operacional (retirada vinda do app / balcão lançado no caixa)
export interface WorkflowOrder {
  id: string;
  restaurantName: string;
  customerName: string;
  status: string;
  mode: 'delivery' | 'pickup' | 'dine-in';
  items: { name: string; quantity: number; price?: number }[];
  total: number;
  createdAt: string;
}

export interface CashierSummary {
  totalCash: number;
  totalCard: number;
  totalPix: number;
  totalSangria: number;
  totalReforco: number;
  totalRevenue: number;
  cashInDrawer: number;
  salesCount: number;
}

export interface CashierSession {
  id: string;
  openedAt: string;
  initialFloat: number;
  operatorName: string;
  status: 'open' | 'closed';
}

export interface CashierState {
  session: CashierSession | null;
  summary: CashierSummary | null;
}

export interface Recado {
  id: string;
  tipo: 'operacao' | 'mesa';
  autor: string;
  texto: string;
  mesa?: number;
  criadoEm: string;
  leram: string[];
  fechado?: boolean;
}

// Item do carrinho do balcão (venda avulsa)
export interface MenuItemLite {
  id: string;
  name: string;
  price: number;
  category?: string;
}
export interface CartLine {
  itemId: string;
  name: string;
  price: number;
  qty: number;
}
