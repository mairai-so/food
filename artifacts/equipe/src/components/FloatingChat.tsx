import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Minus, GripHorizontal, Maximize2, Minimize2 } from 'lucide-react';
import miaAvatar from '@/assets/miar-avatar.png';

interface FloatingChatProps {
  getToken: () => string;
  ownerName?: string;
  companyName?: string;
  endpoint?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function getInitialChatSize(isMobile: boolean) {
  return {
    w: isMobile ? Math.min(window.innerWidth - 20, 420) : 360,
    h: isMobile ? Math.min(window.innerHeight * 0.72, 520) : 480,
  };
}

function getInitialChatPosition(width: number, height: number, isMobile: boolean) {
  const maxX = Math.max(12, window.innerWidth - width - 12);
  const maxY = Math.max(12, window.innerHeight - height - 12);
  const x = isMobile ? clamp((window.innerWidth - width) / 2, 12, maxX) : maxX;
  const y = isMobile ? clamp(window.innerHeight - height - 18, 12, maxY) : maxY;
  return { x, y };
}

export function FloatingChat({ getToken, ownerName, companyName, endpoint = '/api/mia' }: FloatingChatProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('miar-chat-dismissed') === '1');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [size, setSize] = useState(() => getInitialChatSize(isMobile));
  const [position, setPosition] = useState(() => getInitialChatPosition(getInitialChatSize(isMobile).w, getInitialChatSize(isMobile).h, isMobile));
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; startW: number; startH: number; startXPos: number; startYPos: number } | null>(null);

  useEffect(() => {
    const handler = () => setDismissed(localStorage.getItem('miar-chat-dismissed') === '1');
    window.addEventListener('miar-chat-visibility-changed', handler);
    return () => window.removeEventListener('miar-chat-visibility-changed', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (maximized) {
      setSize({ w: Math.max(300, window.innerWidth - 24), h: Math.max(320, window.innerHeight - 24) });
      setPosition({ x: 12, y: 12 });
      return;
    }

    const baseSize = getInitialChatSize(isMobile);
    setSize((prev) => ({
      w: clamp(prev.w, 280, Math.max(280, window.innerWidth - 24)),
      h: clamp(prev.h, 300, Math.max(300, window.innerHeight - 24)),
    }));
    setPosition((prev) => ({
      x: clamp(prev.x, 12, Math.max(12, window.innerWidth - baseSize.w - 12)),
      y: clamp(prev.y, 12, Math.max(12, window.innerHeight - baseSize.h - 12)),
    }));
  }, [isMobile, maximized, open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (isMobile && open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobile, open]);

  const dismiss = useCallback(() => {
    localStorage.setItem('miar-chat-dismissed', '1');
    setDismissed(true);
    setOpen(false);
  }, []);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (maximized) return;
    e.preventDefault();
    dragRef.current = {
      mode: 'move',
      startX: e.clientX,
      startY: e.clientY,
      startW: size.w,
      startH: size.h,
      startXPos: position.x,
      startYPos: position.y,
    };

    const onMove = (ev: MouseEvent) => {
      const current = dragRef.current;
      if (!current || current.mode !== 'move') return;
      const dx = ev.clientX - current.startX;
      const dy = ev.clientY - current.startY;
      const nextX = clamp(current.startXPos + dx, 12, Math.max(12, window.innerWidth - size.w - 12));
      const nextY = clamp(current.startYPos + dy, 12, Math.max(12, window.innerHeight - size.h - 12));
      setPosition({ x: nextX, y: nextY });
    };

    const onUp = () => {
      const current = dragRef.current;
      if (current?.mode === 'move') {
        const snapTop = position.y < window.innerHeight * 0.22;
        if (snapTop) setPosition((prev) => ({ ...prev, y: 18 }));
      }
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [maximized, position.y, size.h, size.w]);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    if (maximized) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      startW: size.w,
      startH: size.h,
      startXPos: position.x,
      startYPos: position.y,
    };

    const onMove = (ev: MouseEvent) => {
      const current = dragRef.current;
      if (!current || current.mode !== 'resize') return;
      const nextW = clamp(current.startW + (ev.clientX - current.startX), 280, Math.max(280, window.innerWidth - current.startXPos - 12));
      const nextH = clamp(current.startH + (ev.clientY - current.startY), 300, Math.max(300, window.innerHeight - current.startYPos - 12));
      setSize({ w: nextW, h: nextH });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [maximized, position.x, position.y, size.h, size.w]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setError(null);
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setSending(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ messages: nextMessages, ownerName, companyName }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(response.status === 403
          ? 'Chat com a MIAR ainda não foi liberado pelo gestor pro seu cargo.'
          : (data.error ?? 'Erro ao falar com a MIAR'));
        return;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
    } catch (err: any) {
      setError(err.message ?? 'Erro de conexão');
    } finally {
      setSending(false);
    }
  }, [input, messages, sending, getToken, ownerName, companyName, endpoint]);

  if (dismissed) return null;

  if (!open) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-1">
        <button
          onClick={() => { setOpen(true); setMinimized(false); setMaximized(false); }}
          className="h-14 w-14 overflow-hidden rounded-full shadow-xl ring-2 ring-emerald-400/60 transition hover:scale-105 hover:ring-emerald-400"
          aria-label="Abrir chat com a MIAR"
        >
          <img src={miaAvatar} alt="MIAR" className="h-full w-full object-cover" />
        </button>
        <button
          onClick={dismiss}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-slate-400 shadow-lg hover:bg-slate-700 hover:text-slate-200"
          aria-label="Fechar chat da MIAR"
          title="Fechar — reative depois nas configurações"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (minimized && !isMobile) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 py-1.5 pl-1.5 pr-4 text-sm text-slate-200 shadow-xl hover:bg-slate-800"
      >
        <img src={miaAvatar} alt="MIAR" className="h-8 w-8 rounded-full object-cover" />
        MIAR
      </button>
    );
  }

  return (
    <div
      className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
      style={{
        width: maximized ? Math.max(300, window.innerWidth - 24) : size.w,
        height: maximized ? Math.max(320, window.innerHeight - 24) : size.h,
        left: maximized ? 12 : position.x,
        top: maximized ? 12 : position.y,
      }}
    >
      <div
        onMouseDown={onDragStart}
        className="absolute left-0 right-0 top-0 z-10 flex cursor-grab items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2 active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <img src={miaAvatar} alt="MIAR" className="h-7 w-7 rounded-full object-cover" />
          <span className="text-sm font-semibold text-slate-100">MIAR</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized((prev) => !prev)}
            className="rounded p-1 text-slate-400 hover:bg-slate-800"
            aria-label="Minimizar"
            title="Minimizar"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMaximized((prev) => !prev)}
            className="rounded p-1 text-slate-400 hover:bg-slate-800"
            aria-label={maximized ? 'Restaurar' : 'Maximizar'}
            title={maximized ? 'Restaurar' : 'Maximizar'}
          >
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-800" aria-label="Fechar" title="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="pt-12">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" style={{ height: maximized ? 'calc(100% - 92px)' : 'calc(100% - 116px)' }}>
          {messages.length === 0 && (
            <p className="text-sm text-slate-500">Oi! Pode perguntar sobre a operação, estoque, pedidos, o que precisar.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.role === 'user' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-100'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {sending && <p className="text-xs text-slate-500">MIAR está digitando...</p>}
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-800 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Fala com a MIAR..."
            className="flex-1 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
          />
          <button
            onClick={() => void send()}
            disabled={sending || !input.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-slate-950 disabled:opacity-40"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        onMouseDown={onResizeStart}
        className="absolute bottom-0 right-0 z-10 flex h-7 w-7 cursor-nw-resize items-center justify-center rounded-tl-lg bg-slate-800/85 text-slate-300 hover:bg-slate-700"
        title="Arraste para redimensionar"
      >
        <GripHorizontal className="h-3.5 w-3.5 rotate-45" />
      </div>
    </div>
  );
}
