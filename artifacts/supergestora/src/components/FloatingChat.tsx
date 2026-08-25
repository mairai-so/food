import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Minus, GripHorizontal, Maximize2, Minimize2, Camera, Paperclip, RefreshCw } from 'lucide-react';
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
  // Anexo de imagem (22/08/2026) — mesmo padrão do backend, base64 puro
  // sem prefixo data:URI, junto do tipo MIME pra reconstrução no visor.
  imageBase64?: string;
  imageMimeType?: string;
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

const CLOSED_BUTTON_SIZE = { w: 64, h: 64 };

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
  // Câmera + anexo (22/08/2026) — mesma capacidade que já existe no MIAR
  // AI Pessoal: câmera interna/externa, sem limite de tamanho de arquivo
  // (o único teto real é o body parser do Express, 10MB, generoso o
  // bastante pra uma foto).
  const [pendingImage, setPendingImage] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState(() => getInitialChatSize(isMobile));
  const [position, setPosition] = useState(() => getInitialChatPosition(CLOSED_BUTTON_SIZE.w, CLOSED_BUTTON_SIZE.h, isMobile));
  const normalLayoutRef = useRef<{ size: typeof size; position: typeof position } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; startW: number; startH: number; startXPos: number; startYPos: number; moved: boolean } | null>(null);
  const clickSuppressRef = useRef(false);

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

    setSize((prev) => ({
      w: clamp(prev.w, 280, Math.max(280, window.innerWidth - 24)),
      h: clamp(prev.h, 300, Math.max(300, window.innerHeight - 24)),
    }));
    setPosition((prev) => ({
      x: clamp(prev.x, 12, Math.max(12, window.innerWidth - size.w - 12)),
      y: clamp(prev.y, 12, Math.max(12, window.innerHeight - size.h - 12)),
    }));
  }, [isMobile, maximized, open, size.h, size.w]);

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

  const handleOpen = useCallback(() => {
    if (clickSuppressRef.current) {
      clickSuppressRef.current = false;
      return;
    }
    setOpen(true);
    setMinimized(false);
    setMaximized(false);
  }, []);

  const toggleMaximized = useCallback(() => {
    if (maximized) {
      const previous = normalLayoutRef.current;
      if (previous) {
        setSize(previous.size);
        setPosition(previous.position);
      }
      setMaximized(false);
      return;
    }

    normalLayoutRef.current = { size, position };
    setMaximized(true);
  }, [maximized, position, size]);

  const onDragStart = useCallback((e: React.PointerEvent<HTMLButtonElement | HTMLDivElement>) => {
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
      moved: false,
    };

    const onMove = (ev: PointerEvent) => {
      const current = dragRef.current;
      if (!current || current.mode !== 'move') return;
      const dx = ev.clientX - current.startX;
      const dy = ev.clientY - current.startY;
      if (!current.moved && Math.hypot(dx, dy) > 6) {
        current.moved = true;
      }

      const boundsWidth = open ? size.w : CLOSED_BUTTON_SIZE.w;
      const boundsHeight = open ? size.h : CLOSED_BUTTON_SIZE.h;
      const nextX = clamp(current.startXPos + dx, 12, Math.max(12, window.innerWidth - boundsWidth - 12));
      const nextY = clamp(current.startYPos + dy, 12, Math.max(12, window.innerHeight - boundsHeight - 12));
      setPosition({ x: nextX, y: nextY });
    };

    const onUp = () => {
      const current = dragRef.current;
      if (current?.mode === 'move' && current.moved) {
        clickSuppressRef.current = true;
      }

      if (current?.mode === 'move') {
        const snapTop = position.y < window.innerHeight * 0.22;
        if (snapTop) setPosition((prev) => ({ ...prev, y: 18 }));
      }

      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [maximized, open, position.y, size.h, size.w]);

  const onResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
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
      moved: false,
    };

    const onMove = (ev: PointerEvent) => {
      const current = dragRef.current;
      if (!current || current.mode !== 'resize') return;
      const deltaX = ev.clientX - current.startX;
      // Alça no canto inferior-direito (convenção padrão de qualquer janela):
      // arrastar pra direita AUMENTA a largura, o canto esquerdo fica parado.
      const nextW = clamp(current.startW + deltaX, 280, Math.max(280, window.innerWidth - current.startXPos - 12));
      const nextH = clamp(current.startH + (ev.clientY - current.startY), 300, Math.max(300, window.innerHeight - current.startYPos - 12));
      setSize({ w: nextW, h: nextH });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [maximized, position.x, position.y, size.h, size.w]);

  // Converte arquivo (upload ou captura de câmera) pra base64 puro, sem
  // prefixo data:URI, pronto pro formato que o backend/Gemini espera.
  const fileToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const handleFileSelected = useCallback(async (file: File) => {
    const base64 = await fileToBase64(file);
    setPendingImage({ base64, mimeType: file.type || 'image/jpeg', previewUrl: URL.createObjectURL(file) });
  }, []);

  const toggleCamera = useCallback(async () => {
    if (cameraOpen) {
      cameraStream?.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
      setCameraOpen(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Sua plataforma não suporta câmera neste navegador.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cameraFacing }, audio: false });
      setCameraStream(stream);
      setCameraOpen(true);
    } catch {
      setError('Não foi possível abrir a câmera.');
    }
  }, [cameraOpen, cameraStream, cameraFacing]);

  const switchCameraFacing = useCallback(async () => {
    const next = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(next);
    if (!cameraOpen) return;
    cameraStream?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next }, audio: false });
      setCameraStream(stream);
    } catch {
      setError('Não foi possível trocar de câmera neste aparelho.');
    }
  }, [cameraFacing, cameraOpen, cameraStream]);

  useEffect(() => {
    if (cameraOpen && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen, cameraStream]);

  const captureCameraFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      void fileToBase64(blob).then((base64) => {
        setPendingImage({ base64, mimeType: 'image/jpeg', previewUrl: URL.createObjectURL(blob) });
      });
    }, 'image/jpeg', 0.9);
    cameraStream?.getTracks().forEach((t) => t.stop());
    setCameraStream(null);
    setCameraOpen(false);
  }, [cameraStream]);

  const send = useCallback(async () => {
    const text = input.trim();
    if ((!text && !pendingImage) || sending) return;
    setInput('');
    setError(null);
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: text || '(imagem enviada)', imageBase64: pendingImage?.base64, imageMimeType: pendingImage?.mimeType },
    ];
    setMessages(nextMessages);
    setPendingImage(null);
    setSending(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ messages: nextMessages, ownerName, companyName }),
      });
      const responseText = await response.text();
      let data: { error?: string; message?: string } = {};
      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText) as { error?: string; message?: string };
        } catch {
          data = { error: 'A MIAR retornou uma resposta inválida.' };
        }
      }
      if (!response.ok) {
        setError(response.status === 403
          ? 'Chat com a MIAR ainda não foi liberado pelo gestor pro seu cargo.'
          : (data.error ?? 'Erro ao falar com a MIAR'));
        return;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message ?? 'Não recebi uma resposta da MIAR.' }]);
    } catch (err: any) {
      setError(err.message ?? 'Erro de conexão');
    } finally {
      setSending(false);
    }
  }, [input, pendingImage, messages, sending, getToken, ownerName, companyName, endpoint]);

  if (dismissed) return null;

  if (!open) {
    return (
      <div
        className="fixed z-50 flex items-center gap-1"
        style={{ left: position.x, top: position.y, touchAction: 'none' }}
      >
        <button
          onPointerDown={onDragStart}
          onClick={handleOpen}
          style={{ touchAction: 'none' }}
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
        onPointerDown={onDragStart}
        onClick={() => setMinimized(false)}
        className="fixed z-50 flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 py-1.5 pl-1.5 pr-4 text-sm text-slate-200 shadow-xl hover:bg-slate-800"
        style={{ left: position.x, top: position.y }}
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
        onPointerDown={onDragStart}
        className="absolute left-0 right-0 top-0 z-10 flex cursor-grab items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2 active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <img src={miaAvatar} alt="MIAR" className="h-7 w-7 rounded-full object-cover" />
          <span className="text-sm font-semibold text-slate-100">MIAR</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setMinimized((prev) => !prev)}
            className="rounded p-1 text-slate-400 hover:bg-slate-800"
            aria-label="Minimizar"
            title="Minimizar"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={toggleMaximized}
            className="rounded p-1 text-slate-400 hover:bg-slate-800"
            aria-label={maximized ? 'Restaurar' : 'Maximizar'}
            title={maximized ? 'Restaurar' : 'Maximizar'}
          >
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setOpen(false)}
            className="rounded p-1 text-slate-400 hover:bg-slate-800"
            aria-label="Fechar"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col pt-12">
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <p className="text-sm text-slate-500">Oi! Pode perguntar sobre a operação, estoque, pedidos, o que precisar.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.role === 'user' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-100'
              }`}>
                {m.imageBase64 && (
                  <img
                    src={`data:${m.imageMimeType ?? 'image/jpeg'};base64,${m.imageBase64}`}
                    alt="Imagem enviada"
                    className="mb-1.5 max-h-40 rounded-lg object-cover"
                  />
                )}
                {m.content}
              </div>
            </div>
          ))}
          {sending && <p className="text-xs text-slate-500">MIAR está digitando...</p>}
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>

        {pendingImage && (
          <div className="flex items-center gap-2 border-t border-slate-800 bg-slate-900/60 px-3 py-2">
            <img src={pendingImage.previewUrl} alt="Anexo pronto para enviar" className="h-12 w-12 rounded-lg object-cover" />
            <span className="flex-1 text-xs text-slate-400">Imagem pronta — escreve algo ou manda só assim</span>
            <button type="button" onClick={() => setPendingImage(null)} className="rounded p-1 text-slate-400 hover:bg-slate-800" aria-label="Remover imagem">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mt-auto flex shrink-0 items-end gap-2 border-t border-slate-800 p-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFileSelected(f); e.target.value = ''; }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Anexar imagem"
            title="Anexar imagem"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void toggleCamera()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Abrir câmera"
            title="Abrir câmera"
          >
            <Camera className="h-4 w-4" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Fala com a MIAR..."
            rows={1}
            className="max-h-32 min-h-10 flex-1 resize-y rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
          />
          <button
            onClick={() => void send()}
            disabled={sending || (!input.trim() && !pendingImage)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-slate-950 disabled:opacity-40"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {cameraOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 p-3">
            <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl bg-black" />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => void switchCameraFacing()} className="rounded-full bg-slate-800 px-3 py-2 text-xs text-slate-200">
                <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
                {cameraFacing === 'user' ? 'usar câmera externa' : 'usar câmera interna'}
              </button>
              <button type="button" onClick={captureCameraFrame} className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
                capturar
              </button>
              <button type="button" onClick={() => void toggleCamera()} className="rounded-full bg-slate-800 px-3 py-2 text-xs text-slate-200">
                fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        onPointerDown={onResizeStart}
        // Corrigido (22/08/2026, achado pelo Robson: "botão de arrastar do
        // lado errado") — convenção universal de qualquer janela é o
        // redimensionar ficar no canto inferior-DIREITO, não esquerdo.
        className="absolute bottom-0 right-0 z-10 flex h-7 w-7 cursor-nwse-resize items-center justify-center rounded-tl-lg bg-slate-800/85 text-slate-300 hover:bg-slate-700"
        title="Arraste para redimensionar"
      >
        <GripHorizontal className="h-3.5 w-3.5 rotate-45" />
      </div>
    </div>
  );
}
