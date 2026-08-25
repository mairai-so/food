import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DollarSign, ArrowDownCircle, ArrowUpCircle, LogOut, X } from 'lucide-react';
import { apiGet, apiPost, brl, getOperador } from './api';
import type { CashierState } from './tipos';

export default function BarraTurno({ onSair }: { onSair: () => void }) {
  const operador = getOperador();
  const [estado, setEstado] = useState<CashierState>({ session: null, summary: null });
  const [modal, setModal] = useState<'abrir' | 'fechar' | 'sangria' | 'reforco' | null>(null);
  const [valor, setValor] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      const r = await apiGet<{ session: CashierState['session']; summary: CashierState['summary'] }>(
        '/cashier/session/current'
      );
      setEstado({ session: r.session ?? (r as any), summary: r.summary ?? null });
    } catch {
      setEstado({ session: null, summary: null });
    }
  }, []);

  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(), 15000);
    return () => clearInterval(t);
  }, [carregar]);

  const fechar = () => { setModal(null); setValor(''); setErro(''); };

  const abrirTurno = async () => {
    setProcessando(true); setErro('');
    try {
      await apiPost('/cashier/session/open', { initialFloat: Number(valor || 0), operatorName: operador });
      await carregar();
      fechar();
    } catch { setErro('Não foi possível abrir o turno.'); }
    finally { setProcessando(false); }
  };

  const fecharTurno = async () => {
    if (!estado.session) return;
    setProcessando(true); setErro('');
    try {
      await apiPost(`/cashier/session/${estado.session.id}/close`, {
        actualCash: Number(valor || 0), operatorName: operador,
      });
      await carregar();
      fechar();
    } catch { setErro('Não foi possível fechar o turno.'); }
    finally { setProcessando(false); }
  };

  const movimento = async (type: 'sangria' | 'reforco') => {
    if (!estado.session) return;
    setProcessando(true); setErro('');
    try {
      await apiPost(`/cashier/session/${estado.session.id}/movement`, {
        type,
        amount: Number(valor || 0),
        operatorName: operador,
        description: type === 'sangria' ? 'Sangria manual' : 'Reforço de troco',
      });
      await carregar();
      fechar();
    } catch { setErro('Não foi possível registrar.'); }
    finally { setProcessando(false); }
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div>
          <p className="text-sm text-slate-400">Operador</p>
          <p className="font-semibold text-slate-100">{operador}</p>
        </div>

        {estado.session ? (
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-slate-400">Em caixa</p>
              <p className="font-semibold text-emerald-400">{brl(estado.summary?.cashInDrawer ?? 0)}</p>
            </div>
            <button onClick={() => setModal('sangria')} title="Sangria" className="rounded-lg bg-slate-800 p-2 text-red-400 hover:bg-slate-700">
              <ArrowDownCircle className="h-5 w-5" />
            </button>
            <button onClick={() => setModal('reforco')} title="Reforço" className="rounded-lg bg-slate-800 p-2 text-emerald-400 hover:bg-slate-700">
              <ArrowUpCircle className="h-5 w-5" />
            </button>
            <button onClick={() => setModal('fechar')} className="rounded-lg bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/30">
              Fechar turno
            </button>
          </div>
        ) : (
          <button onClick={() => setModal('abrir')} className="flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-[#0d1b1a] hover:bg-violet-400">
            <DollarSign className="h-4 w-4" /> Abrir turno
          </button>
        )}

        <button onClick={onSair} title="Sair" className="ml-2 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100">
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="w-full max-w-xs rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-slate-100">
                  {modal === 'abrir' && 'Abrir turno'}
                  {modal === 'fechar' && 'Fechar turno'}
                  {modal === 'sangria' && 'Sangria'}
                  {modal === 'reforco' && 'Reforço de troco'}
                </h3>
                <button onClick={fechar}><X className="h-5 w-5 text-slate-400" /></button>
              </div>
              <label className="mb-1.5 block text-sm text-slate-400">
                {modal === 'abrir' ? 'Fundo de troco inicial' : modal === 'fechar' ? 'Contagem em dinheiro' : 'Valor'}
              </label>
              <input
                type="number" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus
                className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-100 focus:border-violet-500 focus:outline-none"
              />
              {erro && <p className="mb-3 text-sm text-red-400">{erro}</p>}
              <button
                onClick={() => void (modal === 'abrir' ? abrirTurno() : modal === 'fechar' ? fecharTurno() : movimento(modal))}
                disabled={processando}
                className="w-full rounded-xl bg-violet-500 py-3 font-semibold text-[#0d1b1a] hover:bg-violet-400 disabled:opacity-50"
              >
                {processando ? 'Aguarde…' : 'Confirmar'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
