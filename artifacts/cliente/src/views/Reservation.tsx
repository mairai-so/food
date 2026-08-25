import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, CalendarDays, Users, Clock, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import type { Restaurant } from '../types';
import { useTranslation } from '../i18n/IdiomaContext';

const TIMES = ['11:00','11:30','12:00','12:30','13:00','13:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30'];

export default function Reservation({
  restaurant, onBack,
}: {
  restaurant: Restaurant; onBack: () => void;
}) {
  const { t } = useTranslation();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [guests, setGuests] = useState(2);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const submit = async () => {
    if (!date || !time || !name.trim()) {
      setError(t('reserva.campos_obrigatorios'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const arrivalDate = new Date(`${date}T${time}:00`);
      const minutesUntil = Math.max(0, Math.floor((arrivalDate.getTime() - Date.now()) / 60000));

      // Mesas disponíveis do restaurante (API real); sem mesa válida não há reserva.
      const tablesRes = await fetch(`/api/restaurants/${restaurant.id}/tables`);
      if (!tablesRes.ok) {
        throw new Error(t('reserva.erro_servidor'));
      }
      const tables = (await tablesRes.json()) as { id: string }[];
      const tableId = tables[0]?.id;
      if (!tableId) {
        throw new Error(t('reserva.erro_semmais'));
      }

      // O backend exige ao menos um item de cardápio válido no pré-pedido;
      // usa-se o primeiro item disponível do restaurante para registrar a
      // reserva de forma real (mesa marcada como reservada).
      const menuRes = await fetch(`/api/restaurants/${restaurant.id}/menu`);
      const menuItems = menuRes.ok ? (await menuRes.json()) as { id: string }[] : [];
      const menuItemId = menuItems[0]?.id;
      if (!menuItemId) {
        throw new Error(t('reserva.erro_semmais'));
      }

      const createRes = await fetch('/api/pre-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          tableId,
          items: [{ menuItemId, quantity: 1, notes: `Reserva: ${name.trim()}${note.trim() ? ` — ${note.trim()}` : ''}` }],
          payNow: false,
          expectedArrivalMinutes: minutesUntil,
          customerName: name.trim(),
          customerPhone: phone.trim() || undefined,
          persons: guests,
        }),
      });
      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? t('reserva.erro_servidor'));
      }
      setDone(true);
    } catch (failure) {
      setDone(false);
      const message = failure instanceof Error && failure.message
        ? failure.message
        : t('reserva.erro_texto');
      setError(message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        <button onClick={onBack} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="font-semibold">{t('reserva.titulo')}</p>
          <p className="text-xs text-slate-400">{restaurant.name}</p>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6">
        {done ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-16 text-center" role="status" aria-live="polite">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">{t('reserva.sucesso_titulo')}</h2>
            <p className="mb-2 text-slate-400">
              {restaurant.name} {t('reserva.sucesso_texto1')} <strong className="text-slate-200">{guests} {guests > 1 ? t('reserva.pessoas') : t('reserva.pessoa')}</strong> {t('reserva.sucesso_texto2')}{' '}
              <strong className="text-slate-200">{date ? new Date(date + 'T12:00').toLocaleDateString('pt-BR') : ''}</strong> {t('reserva.sucesso_texto3')}{' '}
              <strong className="text-slate-200">{time}</strong>.
            </p>
            <p className="mb-8 text-sm text-slate-500">{t('reserva.sucesso_texto4')}</p>
            <button onClick={onBack}
              className="min-h-[44px] min-w-[44px] rounded-2xl bg-emerald-500 px-8 py-3 font-semibold text-white hover:bg-emerald-400">
              {t('reserva.voltar_inicio')}
            </button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {/* Date */}
            <div>
              <label htmlFor="reserva-data" className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" /> {t('reserva.data')} <span aria-hidden="true" className="text-rose-400">*</span>
              </label>
              <input id="reserva-data" type="date" value={date} min={today} required
                onChange={e => setDate(e.target.value)}
                onInvalid={e => e.currentTarget.setCustomValidity(t('reserva.campos_obrigatorios'))}
                onInput={e => e.currentTarget.setCustomValidity('')}
                className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none" />
            </div>

            {/* Time */}
            <div>
              <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <Clock className="h-3.5 w-3.5" /> {t('reserva.horario')} <span aria-hidden="true" className="text-rose-400">*</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {TIMES.map(timing => (
                  <button key={timing} type="button" aria-pressed={time === timing}
                    onClick={() => setTime(timing)}
                    className={`min-h-[44px] min-w-[44px] rounded-xl px-3 py-2 text-sm font-medium transition
                      ${time === timing ? 'bg-emerald-500 text-white' : 'border border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'}`}>
                    {timing}
                  </button>
                ))}
              </div>
            </div>

            {/* Guests */}
            <div>
              <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <Users className="h-3.5 w-3.5" /> {t('reserva.pessoas')}
              </span>
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => setGuests(g => Math.max(1, g - 1))}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800" aria-label={t('reserva.diminuir_pessoas')}>−</button>
                <span className="text-2xl font-bold text-slate-100 min-w-[2rem] text-center">{guests}</span>
                <button type="button" onClick={() => setGuests(g => Math.min(20, g + 1))}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800" aria-label={t('reserva.aumentar_pessoas')}>+</button>
                <span className="text-sm text-slate-500">{guests} {guests > 1 ? t('reserva.pessoas') : t('reserva.pessoa')}</span>
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-3">
              <label htmlFor="reserva-nome" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">{t('reserva.seus_dados')} <span aria-hidden="true" className="text-rose-400">*</span></label>
              <input id="reserva-nome" value={name} required
                onChange={e => setName(e.target.value)} placeholder={t('reserva.nome_placeholder')}
                onInvalid={e => e.currentTarget.setCustomValidity(t('reserva.campos_obrigatorios'))}
                onInput={e => e.currentTarget.setCustomValidity('')}
                className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none" />
              <input id="reserva-telefone" value={phone} type="tel"
                onChange={e => setPhone(e.target.value)} placeholder={t('reserva.telefone_placeholder')}
                className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none" />
              <textarea id="reserva-notas" value={note}
                onChange={e => setNote(e.target.value)} placeholder={t('reserva.notas_placeholder')}
                className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none" rows={2} />
            </div>

            {error && (
              <p role="alert" aria-live="assertive" className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
                <span className="mr-1 inline-block align-middle"><AlertTriangle className="h-4 w-4" /></span>{error}
              </p>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={onBack}
                className="min-h-[44px] min-w-[44px] flex-1 rounded-2xl border border-slate-700 bg-slate-900 py-4 text-base font-semibold text-slate-300 hover:bg-slate-800">
                {t('acao.cancelar')}
              </button>
              <button onClick={() => void submit()} disabled={loading}
                className="min-h-[44px] min-w-[44px] flex-[2] rounded-2xl bg-emerald-500 py-4 text-base font-semibold text-white hover:bg-emerald-400 disabled:opacity-50">
                {loading ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t('reserva.enviando')}</span> : t('reserva.confirmar')}
              </button>
            </div>
            {error && !loading && (
              <button type="button" onClick={() => void submit()}
                className="w-full rounded-2xl border border-emerald-500/40 bg-emerald-500/10 py-3 text-base font-semibold text-emerald-300 hover:bg-emerald-500/20">
                {t('reserva.tentar_novamente')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
