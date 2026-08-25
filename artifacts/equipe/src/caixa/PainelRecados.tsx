import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Check, ChevronDown, CircleAlert } from 'lucide-react';
import { apiGet, apiPost, apiPatch, getOperador } from './api';
import type { Recado } from './tipos';

/**
 * Mural de recados interno do caixa — bidirecional.
 * A atendente LÊ os avisos (operação em ciano, nota de mesa em amarelo) e
 * também ESCREVE. Pode minimizar; fica uma bolha com contador de não lidos.
 * Não some da tela — sempre acessível num toque.
 */
export default function PainelRecados() {
  const eu = getOperador();
  const [aberto, setAberto] = useState(false);
  const [recados, setRecados] = useState<Recado[]>([]);
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<'operacao' | 'mesa'>('operacao');
  const [mesa, setMesa] = useState('');
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const lista = await apiGet<Recado[]>('/recados');
      setRecados(lista);
    } catch { /* silencioso: polling */ }
  }, []);

  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(), 8000);
    return () => clearInterval(t);
  }, [carregar]);

  const naoLidos = recados.filter(r => !r.leram.includes(eu)).length;

  const enviar = async () => {
    if (!texto.trim() || enviando) return;
    if (tipo === 'mesa' && !mesa.trim()) return;
    setEnviando(true);
    try {
      await apiPost<Recado>('/recados', {
        tipo,
        autor: eu,
        texto: texto.trim(),
        mesa: tipo === 'mesa' ? Number(mesa) : undefined,
      });
      setTexto(''); setMesa('');
      await carregar();
    } catch { /* ignore */ }
    finally { setEnviando(false); }
  };

  const marcarLido = async (id: string) => {
    try {
      await apiPatch<Recado>(`/recados/${id}/lido`, { quem: eu });
      setRecados(prev => prev.map(r => r.id === id && !r.leram.includes(eu)
        ? { ...r, leram: [...r.leram, eu] } : r));
    } catch { /* ignore */ }
  };

  // Bolha minimizada
  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-3 font-semibold text-slate-950 shadow-2xl shadow-cyan-500/30 transition hover:bg-cyan-400"
      >
        <MessageSquare className="h-5 w-5" />
        Recados
        {naoLidos > 0 && (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
            {naoLidos}
          </span>
        )}
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-5 right-5 z-40 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-cyan-400" />
          <span className="font-semibold text-slate-100">Recados da casa</span>
        </div>
        <button onClick={() => setAberto(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100" title="Minimizar">
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* Lista */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {recados.length === 0 && (
          <p className="mt-8 text-center text-sm text-slate-500">Nenhum recado agora.</p>
        )}
        <AnimatePresence initial={false}>
          {recados.map(r => {
            const lido = r.leram.includes(eu);
            const cor = r.tipo === 'mesa' ? '#FFB020' : '#00E6F2';
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border p-3"
                style={{ borderColor: `${cor}33`, background: `${cor}0d` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: cor }}>
                    {r.tipo === 'mesa' ? `Mesa ${r.mesa}` : 'Operação'}
                  </span>
                  <span className="text-[11px] text-slate-500">{r.autor}</span>
                </div>
                <p className="mt-1 text-sm text-slate-100">{r.texto}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    {new Date(r.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {lido ? (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400"><Check className="h-3 w-3" /> Lido</span>
                  ) : (
                    <button onClick={() => void marcarLido(r.id)} className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700">
                      Marcar lido
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Escrever */}
      <div className="border-t border-slate-800 p-3">
        <div className="mb-2 flex gap-2">
          <button
            onClick={() => setTipo('operacao')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${tipo === 'operacao' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            Operação
          </button>
          <button
            onClick={() => setTipo('mesa')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${tipo === 'mesa' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            Nota de mesa
          </button>
        </div>
        {tipo === 'mesa' && (
          <input
            value={mesa}
            onChange={e => setMesa(e.target.value.replace(/\D/g, ''))}
            placeholder="Nº da mesa"
            inputMode="numeric"
            className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
        )}
        <div className="flex gap-2">
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void enviar(); }}
            placeholder={tipo === 'mesa' ? 'Ex.: aniversário, alergia…' : 'Ex.: acabou troco'}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
          <button
            onClick={() => void enviar()}
            disabled={enviando || !texto.trim() || (tipo === 'mesa' && !mesa.trim())}
            className="flex items-center justify-center rounded-lg bg-cyan-500 px-3 text-slate-950 transition hover:bg-cyan-400 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {tipo === 'mesa' && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
            <CircleAlert className="h-3 w-3" /> Some quando a mesa fecha.
          </p>
        )}
      </div>
    </motion.div>
  );
}
