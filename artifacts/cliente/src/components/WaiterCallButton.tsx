import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Loader2, CheckCircle2 } from 'lucide-react';
import type { ActiveOrder } from '../types';

type CallState = 'idle' | 'calling' | 'pending' | 'claimed';

interface WaiterCall {
  id: string;
  tableId: string;
  status: 'pending' | 'claimed';
}

export default function WaiterCallButton({ activeOrder }: { activeOrder: ActiveOrder | null }) {
  const [state, setState] = useState<CallState>('idle');
  const [callId, setCallId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Only show for dine-in orders
  const visible = !!activeOrder && activeOrder.mode === 'dine-in';

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // Poll to detect when waiter claims the call
  useEffect(() => {
    if (state !== 'pending' || !callId) { stopPolling(); return; }

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/waiter-calls');
        if (!res.ok) return;
        const calls: WaiterCall[] = await res.json();
        const mine = calls.find((c) => c.id === callId);
        // If our call is gone from the pending list or is claimed → waiter accepted
        if (!mine || mine.status === 'claimed') {
          stopPolling();
          setState('claimed');
          setTimeout(() => {
            setState('idle');
            setCallId(null);
          }, 3500);
        }
      } catch { /* silently ignore */ }
    }, 3000);

    return stopPolling;
  }, [state, callId, stopPolling]);

  // Reset when activeOrder changes (new order or cleared)
  useEffect(() => {
    setState('idle');
    setCallId(null);
    stopPolling();
  }, [activeOrder?.id, stopPolling]);

  const handleCall = async () => {
    if (state !== 'idle' || !activeOrder) return;
    setState('calling');

    try {
      const res = await fetch('/api/waiter-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: activeOrder.tableId ?? activeOrder.id,
          tableNumber: activeOrder.tableNumber ?? 0,
          message: 'Cliente chamando pelo app',
        }),
      });
      if (!res.ok) throw new Error('Falha ao chamar garçom');
      const call: WaiterCall = await res.json();
      setCallId(call.id);
      setState('pending');
    } catch {
      setState('idle');
    }
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="waiter-btn"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="fixed bottom-24 right-4 z-50"
      >
        {state === 'idle' && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleCall}
            className="flex items-center gap-2 rounded-full bg-amber-400 px-4 py-3 text-sm font-bold text-amber-950 shadow-lg shadow-amber-400/30 hover:bg-amber-300 active:bg-amber-500"
            aria-label="Chamar garçom"
          >
            <Bell className="h-4 w-4" />
            Chamar garçom
          </motion.button>
        )}

        {state === 'calling' && (
          <div className="flex items-center gap-2 rounded-full bg-amber-400/80 px-4 py-3 text-sm font-bold text-amber-950 shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chamando…
          </div>
        )}

        {state === 'pending' && (
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/40"
          >
            <Bell className="h-4 w-4" />
            Aguardando garçom…
          </motion.div>
        )}

        {state === 'claimed' && (
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/40"
          >
            <CheckCircle2 className="h-4 w-4" />
            Garçom a caminho!
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
