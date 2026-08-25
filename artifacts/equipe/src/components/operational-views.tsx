import { useEffect, useMemo, useState } from 'react';

type OrderStatus = 'received' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'completed' | 'cancelled';

type CartItem = {
  id: string;
  name: string;
  kind: 'pizza' | 'churrasco';
  price: number;
  customization: Record<string, unknown>;
};

type WorkflowOrder = {
  id: string;
  restaurantName: string;
  customerName: string;
  mode: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  kind?: 'pizza' | 'churrasco' | 'generic';
  customization?: Record<string, unknown>;
  address?: string;
  phone?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
};

const catalog = [
  {
    id: 'pizza-marguerita',
    name: 'Pizza Marguerita',
    kind: 'pizza' as const,
    price: 49,
    description: 'Molho, mussarela e manjericão',
    customization: {
      size: 'Média',
      flavor: 'Marguerita',
      split: 'full',
      edge: 'normal',
      additions: [],
      removals: [],
      stage: 'massa -> recheio -> forno -> acabamento',
    },
  },
  {
    id: 'pizza-meio',
    name: 'Pizza Meio a Meio',
    kind: 'pizza' as const,
    price: 59,
    description: 'Metade calabresa e metade quatro queijos',
    customization: {
      size: 'Grande',
      flavor: 'Meio a Meio',
      split: 'half-half',
      edge: 'recheada',
      additions: ['borda recheada'],
      removals: [],
      stage: 'massa -> recheio -> forno -> acabamento',
    },
  },
  {
    id: 'churrasco-picanha',
    name: 'Picanha Premium',
    kind: 'churrasco' as const,
    price: 89,
    description: 'Corte especial com acompanhamento',
    customization: {
      cut: 'Picanha',
      weight: 300,
      doneness: 'ao ponto',
      sides: ['arroz', 'farofa'],
    },
  },
];

function formatStatus(status: OrderStatus) {
  switch (status) {
    case 'received': return 'Recebido';
    case 'confirmed': return 'Confirmado';
    case 'preparing': return 'Em preparo';
    case 'ready': return 'Pronto';
    case 'delivering': return 'Em rota';
    case 'completed': return 'Entregue';
    default: return 'Cancelado';
  }
}

export function ClientExperience() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('Cliente Demo');
  const [mode, setMode] = useState<'delivery' | 'pickup' | 'dine-in'>('delivery');
  const [message, setMessage] = useState('');

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price, 0), [cart]);

  const addToCart = (item: typeof catalog[number]) => {
    const customization = { ...item.customization, note: 'Personalização de teste' };
    setCart((prev) => [...prev, { id: `${item.id}-${Date.now()}`, name: item.name, kind: item.kind, price: item.price, customization }]);
  };

  const checkout = async () => {
    if (!cart.length) {
      setMessage('Adicione pelo menos um item ao carrinho.');
      return;
    }

    try {
      for (const item of cart) {
        let response: Response;
        if (item.kind === 'pizza') {
          response = await fetch('/api/operational-workflow/orders/pizza', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              restaurantName: 'Churrascaria do Vale',
              customerName,
              mode,
              size: (item.customization.size as string) || 'Média',
              flavor: (item.customization.flavor as string) || item.name,
              split: item.customization.split as string | undefined,
              edge: item.customization.edge as string | undefined,
              additions: item.customization.additions as string[] | undefined,
              removals: item.customization.removals as string[] | undefined,
              estimatedMinutes: 25,
              total: item.price,
            }),
          });
        } else {
          response = await fetch('/api/operational-workflow/orders/churrasco', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              restaurantName: 'Churrascaria do Vale',
              customerName,
              mode,
              cut: (item.customization.cut as string) || 'Picanha',
              weight: (item.customization.weight as number) || 300,
              doneness: (item.customization.doneness as string) || 'ao ponto',
              sides: item.customization.sides as string[] | undefined,
              estimatedMinutes: 30,
              total: item.price,
            }),
          });
        }

        if (!response.ok) {
          throw new Error('Falha ao criar pedido');
        }

        await response.json();
      }
      setCart([]);
      setMessage('Pedido criado e registrado no sistema.');
    } catch (error) {
      setMessage('Não foi possível criar o pedido agora.');
    }
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Cliente</p>
          <h2 className="text-2xl font-semibold">Cardápio e checkout</h2>
        </div>
        <div className="rounded-full bg-slate-800 px-3 py-2 text-sm">Modo: {mode}</div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="font-medium text-slate-100">Cardápio</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {catalog.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-100">{item.name}</p>
                    <span className="text-sm text-emerald-400">R$ {item.price.toFixed(2)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{item.description}</p>
                  <button className="mt-3 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950" onClick={() => addToCart(item)}>Adicionar</button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="font-medium text-slate-100">Detalhes do pedido</p>
            <input className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Seu nome" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            <div className="mt-3 flex gap-2">
              {(['delivery', 'pickup', 'dine-in'] as const).map((option) => (
                <button key={option} className={`rounded-full px-3 py-2 text-sm ${mode === option ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`} onClick={() => setMode(option)}>{option === 'delivery' ? 'Entrega' : option === 'pickup' ? 'Retirada' : 'No local'}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="font-medium text-slate-100">Carrinho</p>
          <div className="mt-3 space-y-2">
            {cart.length === 0 ? <p className="text-sm text-slate-400">Nenhum item ainda.</p> : cart.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
                <p className="font-medium text-slate-100">{item.name}</p>
                <p className="mt-1 text-slate-400">{JSON.stringify(item.customization)}</p>
                <p className="mt-1 text-emerald-400">R$ {item.price.toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-sm text-slate-400">Total</p>
            <p className="text-2xl font-semibold text-slate-100">R$ {total.toFixed(2)}</p>
            <button className="mt-3 w-full rounded-xl bg-emerald-500 px-3 py-2 font-medium text-slate-950" onClick={checkout}>Fechar pedido</button>
            {message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function KitchenView() {
  const [orders, setOrders] = useState<WorkflowOrder[]>([]);

  const load = async () => {
    const response = await fetch('/api/operational-workflow/orders');
    if (response.ok) {
      const data = await response.json();
      setOrders(data);
    }
  };

  useEffect(() => { void load(); }, []);

  const advance = async (order: WorkflowOrder) => {
    await fetch(`/api/operational-workflow/orders/${order.id}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'kitchen' }),
    });
    await load();
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Cozinha</p>
      <h2 className="mt-2 text-2xl font-semibold">KDS • pedidos para acompanhamento</h2>
      <div className="mt-4 space-y-2">
        {orders.map((order) => (
          <div key={order.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-slate-100">{order.customerName} • {order.restaurantName}</p>
              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs uppercase">{formatStatus(order.status)}</span>
            </div>
            {order.kind ? <p className="mt-2 text-sm text-slate-400">Tipo: {order.kind}</p> : null}
            {order.customization ? <p className="mt-2 text-sm text-slate-400">Detalhes: {JSON.stringify(order.customization)}</p> : null}
            <button className="mt-3 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950" onClick={() => void advance(order)}>Avançar status</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CashierView() {
  const [orders, setOrders] = useState<WorkflowOrder[]>([]);

  const load = async () => {
    const response = await fetch('/api/operational-workflow/orders');
    if (response.ok) {
      const data = await response.json();
      setOrders(data);
    }
  };

  useEffect(() => { void load(); }, []);

  const advance = async (order: WorkflowOrder) => {
    await fetch(`/api/operational-workflow/orders/${order.id}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'cashier' }),
    });
    await load();
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Caixa / Garçom</p>
      <h2 className="mt-2 text-2xl font-semibold">Pedidos para atendimento</h2>
      <div className="mt-4 space-y-2">
        {orders.map((order) => (
          <div key={order.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-slate-100">{order.customerName} • {order.mode}</p>
              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs uppercase">{formatStatus(order.status)}</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">Total: R$ {order.total.toFixed(2)}</p>
            <button className="mt-3 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950" onClick={() => void advance(order)}>Atualizar status</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DeliveryView() {
  const [orders, setOrders] = useState<WorkflowOrder[]>([]);
  const [deliveryToken, setDeliveryToken] = useState('');
  const [loginMessage, setLoginMessage] = useState('');

  const load = async () => {
    const response = await fetch('/api/operational-workflow/orders');
    if (response.ok) {
      const data = await response.json();
      setOrders(data.filter((order: WorkflowOrder) => order.status === 'ready' || order.status === 'delivering'));
    }
  };

  useEffect(() => { void load(); }, []);

  const login = async () => {
    const response = await fetch('/api/auth/employee-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: deliveryToken }),
    });
    if (response.ok) {
      setLoginMessage('Login liberado para a corrida.');
      return;
    }
    const payload = await response.json().catch(() => ({}));
    setLoginMessage(payload.error || 'Acesso bloqueado pela governança.');
  };

  const updateStatus = async (order: WorkflowOrder, status: OrderStatus) => {
    await fetch(`/api/operational-workflow/orders/${order.id}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'delivery' }),
    });
    await load();
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Entregador</p>
      <h2 className="mt-2 text-2xl font-semibold">Aceite a corrida e acompanhe o status</h2>
      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <p className="font-medium text-slate-100">Login do entregador</p>
        <input className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Token de acesso" value={deliveryToken} onChange={(event) => setDeliveryToken(event.target.value)} />
        <button className="mt-3 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950" onClick={() => void login()}>Entrar</button>
        {loginMessage ? <p className="mt-3 text-sm text-slate-300">{loginMessage}</p> : null}
      </div>

      <div className="mt-4 space-y-2">
        {orders.map((order) => (
          <div key={order.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-slate-100">{order.customerName} • {order.address ?? 'Endereço de teste'}</p>
              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs uppercase">{formatStatus(order.status)}</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">Observações: {order.customization ? JSON.stringify(order.customization) : 'Sem observações'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950" onClick={() => void updateStatus(order, 'delivering')}>Aceitar corrida</button>
              <button className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300" onClick={() => void updateStatus(order, 'completed')}>Entregue</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
