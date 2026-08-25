import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetKitchenOrders, useGetKitchenSettings, useUpdateKitchenOrderStatus, useGetExpiringItems } from '../lib/kitchen-api';
import { OrderCard } from '../components/order-card';
import { ExpirySidebar } from '../components/expiry-sidebar';
import { VoiceAssistant } from '../components/voice-assistant';
import { useLocalTimers } from '../hooks/use-local-timers';
import { useOrderAnnouncer } from '../hooks/use-order-announcer';
import { KitchenOrder } from '../lib/kitchen-api';
import { Settings, Flame } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { playBeep, notifyBrowser } from '../lib/notifications';

function FooterClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="h-8 shrink-0 bg-card border-t flex items-center justify-between px-6 text-xs text-muted-foreground font-mono font-bold z-10 relative">
      <span>Cozinha MIAR</span>
      <span>{now.toLocaleDateString('pt-BR')} — {now.toLocaleTimeString('pt-BR')}</span>
    </div>
  );
}

export default function Board() {
  const queryClient = useQueryClient();
  const { data: orders } = useGetKitchenOrders({
    query: { refetchInterval: 8000 }
  });
  const { data: settings } = useGetKitchenSettings();
  const s = settings as any;

  const { mutate: updateStatus } = useUpdateKitchenOrderStatus({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      },
    },
  });
  const { data: expiringItems } = useGetExpiringItems();
  const { startTimer, getStartTime, removeTimer } = useLocalTimers();
  const { announceOrder, shouldAutoAnnounce } = useOrderAnnouncer();

  const previousOrdersRef = useRef<Record<string, KitchenOrder>>({});

  // SSE: atualiza em tempo real quando novo pedido chega
  useEffect(() => {
    const es = new EventSource('/api/events');
    es.addEventListener('order:new', () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    });
    es.onerror = () => {
      // reconecta automaticamente pelo browser
    };
    return () => es.close();
  }, [queryClient]);
  const [flash, setFlash] = useState(false);
  // CORRIGIDO 30/07/2026: ExpirySidebar só aparecia em telas ≥1024px, sem
  // alternativa em tablet/mobile. Agora vira botão flutuante + gaveta.
  const [mostrarVencimentosMobile, setMostrarVencimentosMobile] = useState(false);

  useEffect(() => {
    if (!orders) return;

    // Check for new orders
    orders.forEach(order => {
      const isNew = !previousOrdersRef.current[order.id];
      if (isNew && order.status === 'pending') {
        const rate = s?.voiceSpeed ?? 1.0;
        const pitch = s?.voicePitch ?? 1.0;

        if (shouldAutoAnnounce(order)) {
          announceOrder(order, rate, pitch);
        }

        if (s?.flashOnNewOrder) {
          setFlash(true);
          setTimeout(() => setFlash(false), 500);
        }

        if (s?.soundOnNewOrder) {
          playBeep('order');
        }

        if (s?.browserNotifications && s?.browserNotifyOnOrder) {
          notifyBrowser(`Novo Pedido — Mesa ${order.tableNumber}`, {
            body: order.items.map(i => `${i.quantity}x ${i.name}`).join(', ') +
                  (order.customerAllergies?.length ? `\n⚠️ Alergias: ${order.customerAllergies.join(', ')}` : ''),
          });
        }
      }

      // Start timer if transitioned to preparing
      const prevStatus = previousOrdersRef.current[order.id]?.status;
      if (order.status === 'preparing' && prevStatus !== 'preparing') {
        startTimer(order.id, order.startedAt ?? null);
      }

      // Remove timer if finished
      if ((order.status === 'ready' || order.status === 'delivered') && prevStatus === 'preparing') {
        removeTimer(order.id);
      }
    });

    // Update ref
    const newRef: Record<string, KitchenOrder> = {};
    orders.forEach(o => newRef[o.id] = o);
    previousOrdersRef.current = newRef;

  }, [orders, announceOrder, shouldAutoAnnounce, startTimer, removeTimer, s]);

  const handleNextStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'pending' ? 'preparing' : 'ready';
    updateStatus({ id: id as any, data: { status: nextStatus as any } });

    if (nextStatus === 'preparing') {
      startTimer(id);
    } else if (nextStatus === 'ready') {
      removeTimer(id);
    }
  };

  if (!orders) {
    return <div className="h-screen w-full flex items-center justify-center bg-background"><span className="text-xl font-mono text-muted-foreground animate-pulse">CARREGANDO SISTEMA...</span></div>;
  }

  const pending = orders.filter(o => o.status === 'pending').sort((a,b) => Number(b.isPriority ?? false) - Number(a.isPriority ?? false));
  const preparing = orders.filter(o => o.status === 'preparing').sort((a,b) => Number(b.isPriority ?? false) - Number(a.isPriority ?? false));
  const ready = orders.filter(o => o.status === 'ready').sort((a,b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden relative">
      {flash && <div className="absolute inset-0 bg-yellow-400/30 z-[100] pointer-events-none animate-in fade-in duration-100" />}

      {/* Header */}
      <header className="h-16 shrink-0 bg-card border-b px-6 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-md">
            <Flame className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-black tracking-tight uppercase">Cozinha MIAR</h1>
        </div>

        <Link href="/settings">
          <Button variant="outline" size="sm" className="font-semibold text-xs tracking-wider gap-2">
            <Settings className="w-4 h-4" />
            CONFIGURAÇÕES
          </Button>
        </Link>
      </header>

      {/* Main Board */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 p-6 overflow-hidden">

          {/* Column: Novo */}
          <section className="flex flex-col h-full bg-muted/50 rounded-xl overflow-hidden border">
            <header className="px-4 py-3 bg-card border-b flex items-center justify-between shrink-0">
              <h2 className="font-black text-lg tracking-tight uppercase flex items-center gap-2">
                NOVO
                <span className="bg-primary text-primary-foreground text-xs rounded-full w-6 h-6 flex items-center justify-center">{pending.length}</span>
              </h2>
            </header>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 pb-20">
                {pending.map(order => (
                  <OrderCard key={order.id} order={order} onNextStatus={handleNextStatus} startTime={getStartTime(order.id)} />
                ))}
                {pending.length === 0 && <div className="text-center py-10 text-muted-foreground font-medium text-sm">Nenhum pedido novo</div>}
              </div>
            </ScrollArea>
          </section>

          {/* Column: Preparando */}
          <section className="flex flex-col h-full bg-muted/50 rounded-xl overflow-hidden border">
            <header className="px-4 py-3 bg-card border-b flex items-center justify-between shrink-0">
              <h2 className="font-black text-lg tracking-tight uppercase text-amber-600 dark:text-amber-500 flex items-center gap-2">
                PREPARANDO
                <span className="bg-amber-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">{preparing.length}</span>
              </h2>
            </header>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 pb-20">
                {preparing.map(order => (
                  <OrderCard key={order.id} order={order} onNextStatus={handleNextStatus} startTime={getStartTime(order.id)} />
                ))}
                {preparing.length === 0 && <div className="text-center py-10 text-muted-foreground font-medium text-sm">Nenhum pedido em preparo</div>}
              </div>
            </ScrollArea>
          </section>

          {/* Column: Pronto */}
          <section className="flex flex-col h-full bg-muted/50 rounded-xl overflow-hidden border opacity-75 hover:opacity-100 transition-opacity">
            <header className="px-4 py-3 bg-card border-b flex items-center justify-between shrink-0">
              <h2 className="font-black text-lg tracking-tight uppercase text-green-600 dark:text-green-500 flex items-center gap-2">
                PRONTO
                <span className="bg-green-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">{ready.length}</span>
              </h2>
            </header>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 pb-20">
                {ready.map(order => (
                  <OrderCard key={order.id} order={order} startTime={null} />
                ))}
                {ready.length === 0 && <div className="text-center py-10 text-muted-foreground font-medium text-sm">Nenhum pedido aguardando entrega</div>}
              </div>
            </ScrollArea>
          </section>

        </div>

        {/* Expiry Sidebar — desktop */}
        <div className="hidden lg:block w-72 shrink-0 border-l bg-card">
          <ExpirySidebar />
        </div>
      </div>

      {/* Expiry Sidebar — mobile/tablet: botão flutuante + gaveta, mesmo componente */}
      <button
        onClick={() => setMostrarVencimentosMobile(true)}
        className={`lg:hidden fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-xl ${
          (expiringItems?.length ?? 0) > 0 ? 'bg-red-500 text-white' : 'bg-card border'
        }`}
        aria-label="Ver itens perto do vencimento"
      >
        <span className="text-lg">⏰</span>
        {(expiringItems?.length ?? 0) > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-700 px-1 text-[10px] font-bold text-white">
            {expiringItems!.length}
          </span>
        )}
      </button>
      <Sheet open={mostrarVencimentosMobile} onOpenChange={setMostrarVencimentosMobile}>
        <SheetContent side="right" className="w-80 p-0">
          <SheetHeader className="p-4 pb-0">
            <SheetTitle>Itens perto do vencimento</SheetTitle>
          </SheetHeader>
          <ExpirySidebar />
        </SheetContent>
      </Sheet>

      <VoiceAssistant
        orders={orders}
        expiringStock={expiringItems?.map(it => ({ name: it.name, quantity: it.quantity ?? 0, unit: it.unit ?? '', daysUntilExpiry: it.daysUntilExpiry }))}
        onOrderStatusChanged={(orderId, newStatus) => updateStatus({ id: orderId as any, data: { status: newStatus as any } })}
      />

      {(s?.showClock ?? true) && <FooterClock />}
    </div>
  );
}
