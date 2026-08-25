import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Bot, Loader2, Package, CheckCircle2, ChefHat, Bike, X, Star, Send, HelpCircle } from 'lucide-react';
import type { OrderMode, OrderStatus } from '../types';

type OrderData = {
  id: string; status: OrderStatus; mode: string;
  createdAt: string; items: { name: string; quantity: number; status: string }[]; total: number;
};

const STATUS_INFO: Record<OrderStatus, { label: string; icon: React.ReactNode; step: number; emoji: string }> = {
  pending:   { label: 'Pedido recebido',  icon: <Package className="h-5 w-5" />,     step: 0, emoji: '📦' },
  confirmed: { label: 'Confirmado',       icon: <CheckCircle2 className="h-5 w-5" />, step: 1, emoji: '✅' },
  preparing: { label: 'Preparando',       icon: <ChefHat className="h-5 w-5" />,      step: 2, emoji: '👨‍🍳' },
  ready:     { label: 'Pronto!',          icon: <CheckCircle2 className="h-5 w-5" />, step: 3, emoji: '🎉' },
  delivered: { label: 'Entregue',         icon: <Bike className="h-5 w-5" />,         step: 4, emoji: '🛵' },
  paid:      { label: 'Finalizado',       icon: <CheckCircle2 className="h-5 w-5" />, step: 5, emoji: '✔️' },
  cancelled: { label: 'Cancelado',        icon: <X className="h-5 w-5" />,            step: -1, emoji: '❌' },
};

import LiberacaoMesa from '../components/LiberacaoMesa';

export default function Tracking({
  orderId, restaurantName, restaurantId, mode, userId, onBack, onRate,
}: {
  orderId: string; restaurantName: string; restaurantId: string;
  mode: OrderMode; userId?: string; onBack: () => void; onRate: (orderId: string) => void;
}) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [aiEstimate, setAiEstimate] = useState('');
  const [loadingEst, setLoadingEst] = useState(false);
  const [showQuestionar, setShowQuestionar] = useState(false);
  const [questionInput, setQuestionInput] = useState('');
  const [complaintType, setComplaintType] = useState('qualidade');
  const [questionResponse, setQuestionResponse] = useState('');
  const [sendingQ, setSendingQ] = useState(false);
  const [rated, setRated] = useState(false);
  const [ratingStars, setRatingStars] = useState(0); // 0-10: comida
  const [waiterStars, setWaiterStars] = useState(0); // 0-10: garçom (opcional)
  const [ratingComment, setRatingComment] = useState('');
  const [waiterComment, setWaiterComment] = useState('');
  const [waiterName, setWaiterName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);
  const prevStatus = useRef<string>('');
  const [mostrarLiberacao, setMostrarLiberacao] = useState(false);
  const liberacaoJaMostrada = useRef(false);

  // Assinatura de liberacao: quando o pedido na mesa fica PRONTO, a tela inteira
  // vira turquesa com o numero gigante por 2s. So dispara uma vez, so na mesa.
  useEffect(() => {
    if (!order) return;
    const naMesa = mode !== 'delivery';
    if (naMesa && order.status === 'ready' && !liberacaoJaMostrada.current) {
      liberacaoJaMostrada.current = true;
      setMostrarLiberacao(true);
    }
  }, [order?.status, mode]);

  // numero grande: senha curta derivada do pedido (demo nao carrega numero de mesa aqui)
  const numeroLiberacao = (() => {
    const nums = String(orderId).replace(/\D/g, '');
    return nums ? nums.slice(-2) : String(orderId).slice(-2).toUpperCase();
  })();

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/public-status`);
        if (res.ok) setOrder(await res.json() as OrderData);
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => clearInterval(iv);
  }, [orderId]);

  useEffect(() => {
    if (!order || aiEstimate || prevStatus.current === order.status) return;
    prevStatus.current = order.status;
    setLoadingEst(true);
    const pending = (order.items ?? []).map(i => `${i.quantity}x ${i.name}`).join(', ');
    fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: `Você é o assistente Miar. Pedido ${mode === 'delivery' ? 'delivery' : 'mesa'} em "${restaurantName}": ${pending}. Status: ${order.status}. Dê uma estimativa curta e animada (2-3 frases).`,
        }],
      }),
    }).then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.message) setAiEstimate(d.message); })
      .catch(() => {})
      .finally(() => setLoadingEst(false));
  }, [order?.status]);

  const sendQuestion = async () => {
    if (!questionInput.trim() || sendingQ) return;
    setSendingQ(true);
    const q = questionInput.trim();
    setQuestionInput('');
    try {
      const token = localStorage.getItem('miar_client_token');
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          userId,
          orderId,
          restaurantId,
          restaurantName,
          type: complaintType,
          description: q,
        }),
      });
      const d = await res.json().catch(() => ({})) as { message?: string; error?: string };
      if (!res.ok) throw new Error(d.error ?? 'Não foi possível registrar a reclamação.');
      const verifyResponse = await fetch('/api/complaints/mine', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const complaints = await verifyResponse.json().catch(() => []) as Array<{ id?: string; order_id?: string; orderId?: string }>;
      const persisted = complaints.some(complaint =>
        complaint.id === (d as { id?: string }).id && (complaint.order_id ?? complaint.orderId) === orderId,
      );
      if (!verifyResponse.ok || !persisted) throw new Error('A reclamação não foi encontrada após o envio.');
      setQuestionResponse('Reclamação registrada e confirmada no servidor.');
    } catch {
      setQuestionResponse('Não foi possível registrar a reclamação. Tente novamente.');
    } finally { setSendingQ(false); }
  };

  const submitRating = async () => {
    if (!ratingStars) return;
    setSubmittingRating(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          foodRating: ratingStars,
          foodComment: ratingComment || undefined,
          waiterRating: waiterStars || undefined,
          waiterName: waiterName.trim() || undefined,
          waiterComment: waiterComment || undefined,
          customerName: isAnonymous ? undefined : (customerName.trim() || undefined),
          isAnonymous,
        }),
      });
      onRate(orderId);
      setRatingDone(true);
    } catch {
      setRatingDone(true);
    } finally { setSubmittingRating(false); }
  };

  const statuses: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready',
    mode === 'delivery' ? 'delivered' : 'paid'];
  const currentStep = order ? (STATUS_INFO[order.status]?.step ?? 0) : 0;
  const isDone = order?.status === 'delivered' || order?.status === 'paid';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {mostrarLiberacao && (
        <LiberacaoMesa
          numero={numeroLiberacao}
          rotulo={mode === 'delivery' ? 'PEDIDO' : 'MESA'}
          onFim={() => setMostrarLiberacao(false)}
        />
      )}
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={onBack} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></button>
          <div>
            <p className="font-semibold">{restaurantName}</p>
            <p className="text-xs text-slate-400">{mode === 'delivery' ? '🛵 Delivery' : '🪑 Na mesa'}</p>
          </div>
        </div>

        {/* Status stepper */}
        <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Acompanhamento</p>
          <div className="space-y-4">
            {statuses.map((s, i) => {
              const info = STATUS_INFO[s];
              const done = currentStep > info.step;
              const active = currentStep === info.step;
              return (
                <div key={s} className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm shrink-0
                    ${active ? 'bg-emerald-500 text-white' : done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-600'}`}>
                    {active ? <Loader2 className="h-4 w-4 animate-spin" /> : info.icon}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm ${active ? 'font-semibold text-emerald-400' : done ? 'text-slate-500 line-through' : 'text-slate-600'}`}>
                      {info.label}
                    </p>
                  </div>
                  {i < statuses.length - 1 && (
                    <div className={`h-4 w-0.5 ${done ? 'bg-emerald-500/40' : 'bg-slate-800'} absolute ml-[17px] mt-9`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* AI estimate */}
        <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <Bot className="h-4 w-4" /> Previsão da IA Miar
          </div>
          {loadingEst
            ? <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Calculando...</div>
            : <p className="text-sm text-slate-300">{aiEstimate || 'Pedido recebido! Em breve você receberá sua refeição. 🍽️'}</p>}
        </div>

        {/* Questionar */}
        <button onClick={() => setShowQuestionar(true)}
          className="mb-4 flex w-full items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 p-3 text-sm text-slate-400 hover:bg-slate-800">
          <HelpCircle className="h-4 w-4 text-amber-400" />
          <span>Questionar sobre o pedido</span>
        </button>

        {/* Pagar / Pedir conta — só quando entregue e na mesa */}
        {isDone && mode !== 'delivery' && !ratingDone && (
          <div className="mb-4 flex gap-3">
            <button
              onClick={() => {
                fetch('/api/waiter-calls', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ type: 'bill_request', orderId }),
                }).catch(() => {});
              }}
              className="flex-1 rounded-2xl border border-slate-600 bg-slate-800 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              🧾 Pedir a conta
            </button>
            <button
              onClick={() => onRate(orderId)}
              className="flex-1 rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white hover:bg-emerald-600 transition"
            >
              💳 Pagar agora
            </button>
          </div>
        )}

        {/* Rating (when done) */}
        {isDone && !ratingDone && (
          <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-900 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-200">Como foi a experiência?</p>

            <p className="mb-1.5 text-xs text-slate-400">Comida</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {Array.from({ length: 11 }, (_, n) => n).map(n => (
                <button key={n} onClick={() => setRatingStars(n)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition ${
                    n <= ratingStars && ratingStars > 0
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
            <textarea value={ratingComment} onChange={e => setRatingComment(e.target.value)}
              placeholder="Comentário sobre a comida (opcional)..."
              className="mb-4 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none"
              rows={2} />

            <p className="mb-1.5 text-xs text-slate-400">Garçom (opcional)</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {Array.from({ length: 11 }, (_, n) => n).map(n => (
                <button key={n} onClick={() => setWaiterStars(n)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition ${
                    n <= waiterStars && waiterStars > 0
                      ? 'bg-sky-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
            {waiterStars > 0 && (
              <>
                <input value={waiterName} onChange={e => setWaiterName(e.target.value)}
                  placeholder="Nome do garçom (se souber)"
                  className="mb-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 focus:border-sky-500 focus:outline-none" />
                <textarea value={waiterComment} onChange={e => setWaiterComment(e.target.value)}
                  placeholder="Comentário sobre o atendimento (opcional)..."
                  className="mb-4 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 focus:border-sky-500 focus:outline-none"
                  rows={2} />
              </>
            )}

            <label className="mb-2 flex items-center gap-2 text-xs text-slate-400">
              <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-950" />
              Enviar de forma anônima
            </label>
            {!isAnonymous && (
              <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                placeholder="Seu nome (opcional)"
                className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none" />
            )}

            <button onClick={submitRating} disabled={!ratingStars || submittingRating}
              className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {submittingRating ? 'Enviando...' : 'Enviar avaliação'}
            </button>
          </div>
        )}
        {ratingDone && (
          <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center text-sm text-emerald-400">
            ✅ Avaliação enviada! Obrigado pelo feedback.
          </div>
        )}

        {/* Order summary */}
        {order && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-300">Resumo do pedido</p>
            <div className="space-y-1">
              {(order.items ?? []).map((it, i) => (
                <div key={i} className="flex items-center justify-between text-sm text-slate-400">
                  <span>{it.quantity}x {it.name}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-slate-800 pt-3 text-sm font-semibold text-slate-200">
              Total: R$ {(order.total ?? 0).toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Questionar modal */}
      <AnimatePresence>
        {showQuestionar && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-slate-950/80 backdrop-blur"
            onClick={() => { if (!sendingQ) setShowQuestionar(false); }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="w-full rounded-t-3xl border-t border-slate-800 bg-slate-900 p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-semibold">❓ Questionar pedido</p>
                <button onClick={() => setShowQuestionar(false)} className="text-slate-400"><X className="h-5 w-5" /></button>
              </div>
              {questionResponse && (
                <div className="mb-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-300">
                  <Bot className="mb-1 h-4 w-4 text-blue-400" />
                  {questionResponse}
                </div>
              )}
              <p className="mb-3 text-xs text-slate-500">
                Exemplos: "Meu pedido está demorando", "O entregador está parado", "O pedido veio diferente"
              </p>
              <label className="mb-2 block text-xs text-slate-500" htmlFor="complaint-type">Motivo</label>
              <select id="complaint-type" value={complaintType} onChange={e => setComplaintType(e.target.value)}
                className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none">
                <option value="qualidade">Qualidade do pedido</option>
                <option value="atraso">Atraso</option>
                <option value="entrega">Problema na entrega</option>
                <option value="cobranca">Cobrança ou pagamento</option>
                <option value="outro">Outro</option>
              </select>
              <div className="flex gap-2">
                <input value={questionInput} onChange={e => setQuestionInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && void sendQuestion()}
                  placeholder="Descreva o problema..."
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
                <button onClick={() => void sendQuestion()} disabled={!questionInput.trim() || sendingQ}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white disabled:opacity-50">
                  {sendingQ ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
