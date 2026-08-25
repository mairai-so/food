/**
 * mia.tsx — Chat da MIAR: IA pessoal do gestor.
 *
 * Requisitos:
 * - Textarea auto-crescente (min 1 linha, max ~8 linhas)
 * - Microfone (STT) + Anexo
 * - Pastas: criar pasta já cria conversa dentro automaticamente
 * - Timestamps HH:MM:SS em toda conversa
 * - Botão copiar em toda mensagem
 * - Play/Pause/Stop no MESMO botão (cicla estados)
 * - Seleção de texto → narrar apenas o trecho selecionado
 * - Voz 100% feminina — sem exceções
 * - Menu de contexto direito para copiar/colar
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Paperclip, Send,
  Play, Pause, Square,
  FolderPlus, MessageSquarePlus, Trash2,
  ChevronRight, ChevronDown,
  Copy, Check, Brain, X, ArrowLeft,
  Volume2, VolumeX, Edit3, MoreHorizontal,
  BookOpen,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface MiaAttachment { name: string; type: string; dataUrl: string; }
interface MiaMessage {
  id: string;
  role: 'user' | 'mia';
  content: string;
  timestamp: number;
  attachments?: MiaAttachment[];
}
interface MiaConversation {
  id: string;
  folderId: string | null;
  title: string;
  messages: MiaMessage[];
  createdAt: number;
  updatedAt: number;
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};
interface MiaFolder {
  id: string;
  name: string;
  createdAt: number;
  collapsed?: boolean;
}

// ─── Persistência ─────────────────────────────────────────────────────────────

const FOLDERS_KEY = 'mia-folders-v2';
const CONVS_KEY   = 'mia-conversations-v2';

const loadFolders = (): MiaFolder[] => {
  try { return JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? '[]'); } catch { return []; }
};
const loadConvs = (): MiaConversation[] => {
  try { return JSON.parse(localStorage.getItem(CONVS_KEY) ?? '[]'); } catch { return []; }
};
const saveFolders = (f: MiaFolder[]) => localStorage.setItem(FOLDERS_KEY, JSON.stringify(f));
const saveConvs   = (c: MiaConversation[]) => localStorage.setItem(CONVS_KEY, JSON.stringify(c));

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// HH:MM:SS — timestamp completo para facilitar localização de conversas
const formatTimeFull = (ts: number): string =>
  new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const formatDateShort = (ts: number): string =>
  new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

// ─── TTS — voz 100% feminina ──────────────────────────────────────────────────

const MALE_NAMES = [
  'tom', 'daniel', 'alex', 'fred', 'jorge', 'carlos', 'luciano',
  'rodrigo', 'antonio', 'reed', 'oliver', 'liam', 'joão', 'pedro',
  'rui', 'miguel', 'bruce', 'paul', 'james', 'mark',
];

function isMaleVoice(v: SpeechSynthesisVoice): boolean {
  const n = v.name.toLowerCase();
  return (
    (n.includes('male') && !n.includes('female')) ||
    n.includes('masculin') ||
    MALE_NAMES.some((m) => n.includes(m))
  );
}

function getFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices();

  // 1. Português do Brasil feminino explícito
  const ptBrF = voices.find(v =>
    (v.lang === 'pt-BR' || v.lang === 'pt_BR') && !isMaleVoice(v)
  );
  if (ptBrF) return ptBrF;

  // 2. Qualquer português feminino
  const ptF = voices.find(v => v.lang.startsWith('pt') && !isMaleVoice(v));
  if (ptF) return ptF;

  // 3. Espanhol feminino (sotaque aceitável)
  const esF = voices.find(v => v.lang.startsWith('es') && !isMaleVoice(v));
  if (esF) return esF;

  // 4. Inglês feminino conhecido
  const enF = voices.find(v =>
    v.lang.startsWith('en') && !isMaleVoice(v) &&
    /samantha|victoria|karen|moira|fiona|ava|allison|susan|zoe|kate|siri/i.test(v.name)
  );
  if (enF) return enF;

  // 5. Qualquer voz não-masculina
  return voices.find(v => !isMaleVoice(v)) ?? null;
}

// Estados do player: idle → playing → paused → idle
type PlayState = 'idle' | 'playing' | 'paused';

function useTTS() {
  const [states, setStates] = useState<Record<string, PlayState>>({});
  const uttRef  = useRef<SpeechSynthesisUtterance | null>(null);
  const activeId = useRef<string | null>(null);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
    const load = () => setVoicesLoaded(true);
    speechSynthesis.addEventListener('voiceschanged', load);
    if (speechSynthesis.getVoices().length > 0) setVoicesLoaded(true);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  const setState = (id: string, s: PlayState) =>
    setStates(prev => ({ ...prev, [id]: s }));

  // Botão único: idle → play, playing → pause, paused → stop
  const toggle = useCallback((id: string, text: string) => {
    if (typeof speechSynthesis === 'undefined' || muted) return;
    const current = states[id] ?? 'idle';

    if (current === 'idle') {
      // Para qualquer coisa em execução
      if (activeId.current && activeId.current !== id) {
        speechSynthesis.cancel();
        setState(activeId.current, 'idle');
      }
      // Inicia
      const utt = new SpeechSynthesisUtterance(text);
      const voice = getFemaleVoice();
      if (voice) utt.voice = voice;
      utt.lang  = voice?.lang ?? 'pt-BR';
      utt.rate  = 1.05;
      utt.pitch = 1.1;
      utt.onend = () => { setState(id, 'idle'); activeId.current = null; };
      utt.onerror = () => { setState(id, 'idle'); activeId.current = null; };
      uttRef.current = utt;
      activeId.current = id;
      speechSynthesis.speak(utt);
      setState(id, 'playing');
    } else if (current === 'playing') {
      speechSynthesis.pause();
      setState(id, 'paused');
    } else {
      // paused → stop
      speechSynthesis.cancel();
      setState(id, 'idle');
      activeId.current = null;
    }
  }, [states, muted]);

  // Narrar apenas o texto selecionado
  const speakSelection = useCallback((selectedText: string) => {
    if (!selectedText || muted) return;
    speechSynthesis.cancel();
    // Para qualquer msg ativa
    if (activeId.current) {
      setState(activeId.current, 'idle');
      activeId.current = null;
    }
    const utt = new SpeechSynthesisUtterance(selectedText);
    const voice = getFemaleVoice();
    if (voice) utt.voice = voice;
    utt.lang  = voice?.lang ?? 'pt-BR';
    utt.rate  = 1.0;
    utt.pitch = 1.1;
    speechSynthesis.speak(utt);
  }, [muted]);

  const getState = (id: string): PlayState => states[id] ?? 'idle';

  return { toggle, speakSelection, getState, voicesLoaded, muted, setMuted };
}

// ─── STT ──────────────────────────────────────────────────────────────────────

function useSTT(onResult: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);

  const toggle = useCallback(() => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }
    const r = new SR() as SpeechRecognitionLike;
    r.lang = 'pt-BR';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => {
      const txt = e.results[0]?.[0]?.transcript ?? '';
      if (txt) onResult(txt);
    };
    r.onend = () => setListening(false);
    r.start();
    recogRef.current = r;
    setListening(true);
  }, [listening, onResult]);

  return { listening, toggle };
}

// ─── Ícone do botão de play (cicla estados) ───────────────────────────────────

function PlayButton({ state, onClick }: { state: PlayState; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      title={state === 'idle' ? 'Narrar' : state === 'playing' ? 'Pausar' : 'Parar'}
      className={`rounded-lg p-1.5 transition-colors ${
        state === 'idle'
          ? 'text-slate-600 hover:text-[#66e3f2]'
          : state === 'playing'
          ? 'text-[#66e3f2] hover:text-amber-400'
          : 'text-amber-400 hover:text-rose-400'
      }`}
    >
      {state === 'idle'   && <Play   size={13} />}
      {state === 'playing'&& <Pause  size={13} />}
      {state === 'paused' && <Square size={13} />}
    </motion.button>
  );
}

// ─── Balão de mensagem ────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  playState,
  onPlay,
}: {
  msg: MiaMessage;
  playState: PlayState;
  onPlay: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isMia = msg.role === 'mia';

  const copy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`group flex gap-2.5 ${isMia ? 'justify-start' : 'justify-end'}`}
    >
      {isMia && (
        <div className="size-7 rounded-full bg-gradient-to-br from-[#00A86B] to-[#00E6F2] flex items-center justify-center shrink-0 mt-1 shadow-md shadow-[#00A86B]/20">
          <Brain size={14} className="text-white" />
        </div>
      )}

      <div className={`max-w-[78%] flex flex-col ${isMia ? 'items-start' : 'items-end'}`}>
        {/* Timestamp HH:MM:SS */}
        <span className="text-[10px] text-slate-600 mb-1 px-1 font-mono">
          {formatTimeFull(msg.timestamp)}
        </span>

        {/* Balão */}
        <div
          className={`relative rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap select-text ${
            isMia
              ? 'bg-slate-800/90 border border-slate-700/60 text-slate-200 rounded-tl-sm'
              : 'bg-[#00A86B]/20 border border-[#00A86B]/30 text-slate-100 rounded-tr-sm'
          }`}
        >
          {msg.content}

          {/* Anexos */}
          {msg.attachments?.map((a, i) => (
            <div key={i} className="mt-2 flex items-center gap-2 rounded-lg bg-slate-900/60 px-2 py-1.5 text-xs text-slate-400">
              <Paperclip size={11} />
              {a.name}
            </div>
          ))}
        </div>

        {/* Controles */}
        <div className="flex items-center justify-end gap-1 mt-1">
          {isMia && <PlayButton state={playState} onClick={onPlay} />}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={copy}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
            title="Copiar texto"
            aria-label="Copiar texto da mensagem"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MiaPage() {
  const [, navigate] = useLocation();
  const [meName, setMeName] = useState<string | null>(null);
  const [meEmail, setMeEmail] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('miar-owner-token');
    if (!token) return;

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject(response.status))
      .then((data: { owner?: { name?: string; email?: string } }) => {
        setMeName(data.owner?.name ?? null);
        setMeEmail(data.owner?.email?.toLowerCase() ?? null);
      })
      .catch(() => {});
  }, []);

  const isDanieli = meEmail === 'danieli441gimenes@gmail.com';
  const firstName = meName?.trim().split(' ')[0] ?? null;

  // Estado das pastas e conversas
  const [folders, setFolders]   = useState<MiaFolder[]>(loadFolders);
  const [convs, setConvs]       = useState<MiaConversation[]>(loadConvs);
  const [activeId, setActiveId] = useState<string | null>(() => loadConvs()[0]?.id ?? null);

  // Input
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [sidebarOpen, setSidebar] = useState(true);

  // Seleção de texto para narração parcial
  const [selectionText, setSelectionText] = useState('');
  const [selectionPos, setSelectionPos]   = useState<{ x: number; y: number } | null>(null);

  // Renomear pasta
  const [renaming, setRenaming]   = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  // Nova pasta / conversa
  const [newFolder, setNewFolder]   = useState(false);
  const [folderName, setFolderName] = useState('');

  // Refs
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const chatRef     = useRef<HTMLDivElement>(null);

  // TTS / STT
  const tts = useTTS();
  const stt = useSTT((t) => setInput(prev => prev ? prev + ' ' + t : t));

  // Conversa ativa
  const activeConv = convs.find(c => c.id === activeId) ?? null;

  // Persistência automática
  useEffect(() => { saveFolders(folders); }, [folders]);
  useEffect(() => { saveConvs(convs); }, [convs]);

  // Scroll automático
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages.length]);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, []);

  useEffect(() => { autoResize(); }, [input, autoResize]);

  // Seleção de texto → floating button narrar
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      setTimeout(() => {
        const sel = window.getSelection();
        const txt = sel?.toString().trim() ?? '';
        if (txt.length > 3 && chatRef.current?.contains(sel?.anchorNode ?? null)) {
          setSelectionText(txt);
          setSelectionPos({ x: e.clientX, y: e.clientY });
        } else {
          setSelectionText('');
          setSelectionPos(null);
        }
      }, 50);
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Fecha floating button ao clicar fora
  useEffect(() => {
    const handler = () => { setSelectionText(''); setSelectionPos(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─── Criar pasta → cria conversa dentro automaticamente ─────────────────────

  const createFolder = () => {
    const name = folderName.trim() || 'Nova Pasta';
    const folderId = newId();
    const convId   = newId();
    const now      = Date.now();

    const folder: MiaFolder = { id: folderId, name, createdAt: now, collapsed: false };
    const conv: MiaConversation = {
      id: convId,
      folderId,
      title: 'Nova conversa',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    setFolders(prev => [folder, ...prev]);
    setConvs(prev => [conv, ...prev]);
    setActiveId(convId);
    setNewFolder(false);
    setFolderName('');
  };

  // ─── Criar conversa solta (sem pasta) ───────────────────────────────────────

  const createLooseConv = () => {
    const id  = newId();
    const now = Date.now();
    const conv: MiaConversation = {
      id,
      folderId: null,
      title: 'Nova conversa',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    setConvs(prev => [conv, ...prev]);
    setActiveId(id);
  };

  // ─── Criar conversa dentro de pasta ─────────────────────────────────────────

  const createConvInFolder = (folderId: string) => {
    const id  = newId();
    const now = Date.now();
    const conv: MiaConversation = {
      id,
      folderId,
      title: 'Nova conversa',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    setConvs(prev => [conv, ...prev]);
    setActiveId(id);
  };

  // ─── Deletar conversa ────────────────────────────────────────────────────────

  const deleteConv = (id: string) => {
    setConvs(prev => prev.filter(c => c.id !== id));
    if (activeId === id) {
      const remaining = convs.filter(c => c.id !== id);
      setActiveId(remaining[0]?.id ?? null);
    }
  };

  // ─── Deletar pasta (e conversas dentro) ──────────────────────────────────────

  const deleteFolder = (folderId: string) => {
    setFolders(prev => prev.filter(f => f.id !== folderId));
    setConvs(prev => {
      const removed = prev.filter(c => c.folderId === folderId).map(c => c.id);
      const next    = prev.filter(c => c.folderId !== folderId);
      if (removed.includes(activeId ?? '')) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };

  // ─── Toggle collapse de pasta ────────────────────────────────────────────────

  const toggleFolder = (folderId: string) =>
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, collapsed: !f.collapsed } : f));

  // ─── Enviar mensagem ──────────────────────────────────────────────────────────

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    // Garante que tem conversa ativa
    let convId = activeId;
    if (!convId) {
      const id  = newId();
      const now = Date.now();
      const conv: MiaConversation = {
        id,
        folderId: null,
        title: text.slice(0, 40),
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      setConvs(prev => [conv, ...prev]);
      setActiveId(id);
      convId = id;
    }

    const userMsg: MiaMessage = { id: newId(), role: 'user', content: text, timestamp: Date.now() };
    setConvs(prev => prev.map(c =>
      c.id === convId
        ? { ...c, messages: [...c.messages, userMsg], updatedAt: Date.now(),
            title: c.messages.length === 0 ? text.slice(0, 40) : c.title }
        : c
    ));
    setInput('');
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
    setLoading(true);

    try {
      const conv = convs.find(c => c.id === convId);
      const history = (conv?.messages ?? []).slice(-10).map(m => ({
        role: m.role === 'mia' ? 'assistant' : 'user',
        content: m.content,
      }));

      const token = localStorage.getItem('miar-owner-token');
      const res = await fetch('/api/mia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: text }] }),
      });

      const data = await res.json();
      const reply = data.reply ?? data.content ?? data.message ?? 'Desculpe, algo deu errado.';

      const miaMsg: MiaMessage = { id: newId(), role: 'mia', content: reply, timestamp: Date.now() };
      setConvs(prev => prev.map(c =>
        c.id === convId ? { ...c, messages: [...c.messages, miaMsg], updatedAt: Date.now() } : c
      ));
    } catch {
      const errMsg: MiaMessage = {
        id: newId(), role: 'mia',
        content: 'Não consegui me conectar agora. Tente novamente em instantes.',
        timestamp: Date.now(),
      };
      setConvs(prev => prev.map(c =>
        c.id === convId ? { ...c, messages: [...c.messages, errMsg] } : c
      ));
    } finally {
      setLoading(false);
    }
  };

  // ─── Anexo ────────────────────────────────────────────────────────────────────

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setInput(prev => prev + ` [Anexo: ${file.name}]`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ─── Conversas por pasta ──────────────────────────────────────────────────────

  const convsByFolder = (folderId: string | null) =>
    convs.filter(c => c.folderId === folderId).sort((a, b) => b.updatedAt - a.updatedAt);

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">

      {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col bg-slate-900/95 border-r border-slate-800 overflow-hidden shrink-0"
          >
            {/* Header sidebar */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
              <div className="size-8 rounded-xl bg-gradient-to-br from-[#00A86B] to-[#00E6F2] flex items-center justify-center shadow-lg shadow-[#00A86B]/20">
                <Brain size={16} className="text-white" />
              </div>
              <span className="font-black text-slate-100 tracking-wide">MIAR</span>
              {firstName && <span className="text-[10px] text-slate-500">olá, {firstName}</span>}
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => tts.setMuted(m => !m)}
                  className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                  title={tts.muted ? 'Ativar voz' : 'Silenciar voz'}
                >
                  {tts.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <button
                  onClick={() => navigate('/miar-intro')}
                  className="rounded-lg p-1.5 text-slate-500 hover:text-[#66e3f2] transition-colors"
                  title="Manual da MIAR"
                >
                  <BookOpen size={14} />
                </button>
              </div>
            </div>

            {isDanieli && (
              <div className="border-b border-slate-800 p-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="mb-2 text-xs font-semibold text-slate-300">Sua playlist sertanejo 🎶</p>
                  <iframe
                    title="Sua playlist sertanejo"
                    src="https://open.spotify.com/embed/playlist/1nhnTxcDfMMJYrEig4l7XQ?utm_source=generator&theme=0"
                    width="100%"
                    height="152"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                  />
                </div>
              </div>
            )}

            {/* Ações rápidas */}
            <div className="flex gap-2 px-3 py-3 border-b border-slate-800">
              <button
                onClick={createLooseConv}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#00A86B]/15 border border-[#00A86B]/25 py-2 text-xs font-semibold text-[#00A86B] hover:bg-[#00A86B]/25 transition-colors"
              >
                <MessageSquarePlus size={13} /> Nova conversa
              </button>
              <button
                onClick={() => setNewFolder(true)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-400 hover:border-slate-600 transition-colors"
                title="Nova pasta"
              >
                <FolderPlus size={13} />
              </button>
            </div>

            {/* Input nova pasta */}
            <AnimatePresence>
              {newFolder && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-slate-800"
                >
                  <div className="px-3 py-2 flex gap-2">
                    <input
                      autoFocus
                      value={folderName}
                      onChange={e => setFolderName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') createFolder();
                        if (e.key === 'Escape') { setNewFolder(false); setFolderName(''); }
                      }}
                      placeholder="Nome da pasta..."
                      className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-[#00A86B]/50 focus:outline-none"
                    />
                    <button onClick={createFolder} className="rounded-lg bg-[#00A86B] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#00E6F2]">
                      Criar
                    </button>
                    <button onClick={() => { setNewFolder(false); setFolderName(''); }} className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300">
                      <X size={13} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Lista: conversas soltas + pastas */}
            <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">

              {/* Conversas sem pasta */}
              {convsByFolder(null).map(conv => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  active={conv.id === activeId}
                  onClick={() => setActiveId(conv.id)}
                  onDelete={() => deleteConv(conv.id)}
                  indent={false}
                />
              ))}

              {/* Pastas */}
              {folders.map(folder => (
                <div key={folder.id}>
                  {/* Cabeçalho da pasta */}
                  <div className="group flex items-center gap-1.5 rounded-xl px-2 py-1.5 hover:bg-slate-800/60 transition-colors">
                    <button
                      onClick={() => toggleFolder(folder.id)}
                      className="flex items-center gap-1.5 flex-1 text-left min-w-0"
                    >
                      <motion.span animate={{ rotate: folder.collapsed ? -90 : 0 }} transition={{ duration: 0.15 }}>
                        <ChevronDown size={13} className="text-slate-500 shrink-0" />
                      </motion.span>
                      <span className="text-xs font-semibold text-slate-400 truncate">{folder.name}</span>
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => createConvInFolder(folder.id)}
                        className="rounded-lg p-1 text-slate-500 hover:text-[#00A86B]"
                        title="Nova conversa aqui"
                      >
                        <MessageSquarePlus size={11} />
                      </button>
                      <button
                        onClick={() => { setRenaming(folder.id); setRenameVal(folder.name); }}
                        className="rounded-lg p-1 text-slate-500 hover:text-slate-300"
                        title="Renomear"
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        onClick={() => deleteFolder(folder.id)}
                        className="rounded-lg p-1 text-slate-500 hover:text-rose-400"
                        title="Deletar pasta"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Conversas da pasta */}
                  <AnimatePresence>
                    {!folder.collapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden pl-3"
                      >
                        {convsByFolder(folder.id).map(conv => (
                          <ConvItem
                            key={conv.id}
                            conv={conv}
                            active={conv.id === activeId}
                            onClick={() => setActiveId(conv.id)}
                            onDelete={() => deleteConv(conv.id)}
                            indent
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}

              {convs.length === 0 && folders.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-600">
                  Crie uma conversa para começar
                </div>
              )}
            </div>

            {/* Voltar */}
            <div className="border-t border-slate-800 p-3">
              <button
                onClick={() => navigate('/painel')}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft size={13} /> Voltar ao painel
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── ÁREA PRINCIPAL ────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md shrink-0">
          <button
            onClick={() => setSidebar(o => !o)}
            className="rounded-xl p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            {sidebarOpen ? <X size={16} /> : <ChevronRight size={16} />}
          </button>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-200 truncate text-sm">
              {activeConv?.title || 'MIAR — Sua parceira de negócio'}
            </p>
            {activeConv && (
              <p className="text-[10px] text-slate-500 font-mono">
                {formatDateShort(activeConv.createdAt)} · {formatTimeFull(activeConv.createdAt)}
              </p>
            )}
          </div>

          <button
            onClick={createLooseConv}
            className="rounded-xl p-2 text-slate-500 hover:text-[#00A86B] hover:bg-[#00A86B]/10 transition-colors"
            title="Nova conversa"
          >
            <MessageSquarePlus size={16} />
          </button>
        </header>

        {/* Mensagens */}
        <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
          {!activeConv || activeConv.messages.length === 0 ? (
            <EmptyState onSend={(t) => { setInput(t); setTimeout(() => send(), 50); }} />
          ) : (
            activeConv.messages.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                playState={tts.getState(msg.id)}
                onPlay={() => tts.toggle(msg.id, msg.content)}
              />
            ))
          )}

          {loading && (
            <div className="flex gap-2.5 justify-start">
              <div className="size-7 rounded-full bg-gradient-to-br from-[#00A86B] to-[#00E6F2] flex items-center justify-center shrink-0 mt-1">
                <Brain size={14} className="text-white" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-slate-800 border border-slate-700 px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="size-2 rounded-full bg-[#00A86B]"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Floating button: narrar seleção */}
        <AnimatePresence>
          {selectionText && selectionPos && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={{ position: 'fixed', left: selectionPos.x - 60, top: selectionPos.y - 48, zIndex: 100 }}
              onMouseDown={e => {
                e.preventDefault();
                tts.speakSelection(selectionText);
                setSelectionText('');
                setSelectionPos(null);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 border border-[#66e3f2]/40 px-3 py-1.5 text-xs font-semibold text-[#66e3f2] shadow-xl shadow-slate-950/50 hover:bg-slate-700 transition-colors"
            >
              <Volume2 size={12} /> Narrar seleção
            </motion.button>
          )}
        </AnimatePresence>

        {/* Input area */}
        <div className="px-4 pb-4 pt-2 border-t border-slate-800 bg-slate-950/80 shrink-0">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 focus-within:border-[#00A86B]/50 transition-colors shadow-lg">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize(); }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Fale com a MIAR... (Enter para enviar, Shift+Enter para nova linha)"
              rows={1}
              className="w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none min-h-[44px] max-h-[200px]"
              style={{ overflow: 'hidden' }}
            />
            <div className="flex items-center gap-2 px-3 pb-2.5 pt-1">
              {/* Mic */}
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={stt.toggle}
                className={`rounded-xl p-2 transition-colors ${
                  stt.listening
                    ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                }`}
                title={stt.listening ? 'Parar gravação' : 'Falar com a MIAR'}
                aria-label={stt.listening ? 'Parar gravação de voz' : 'Ativar gravação de voz'}
              >
                {stt.listening ? <MicOff size={16} /> : <Mic size={16} />}
              </motion.button>

              {/* Anexo */}
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => fileRef.current?.click()}
                className="rounded-xl p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                title="Anexar arquivo"
                aria-label="Anexar arquivo"
              >
                <Paperclip size={16} />
              </motion.button>
              <input ref={fileRef} type="file" hidden accept="image/*,.pdf,.txt,.docx" onChange={handleFile} />

              <div className="flex-1" />

              {/* Contador de chars */}
              {input.length > 0 && (
                <span className="text-[10px] text-slate-600 font-mono">{input.length}</span>
              )}

              {/* Enviar */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={send}
                disabled={!input.trim() || loading}
                className="rounded-xl bg-[#00A86B] p-2.5 text-white shadow-md shadow-[#00A86B]/25 hover:bg-[#00E6F2] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                aria-label="Enviar mensagem"
              >
                <Send size={16} />
              </motion.button>
            </div>
          </div>
          <p className="text-center text-[10px] text-slate-700 mt-2">
            A MIAR aprende com cada conversa. Quanto mais você compartilha, melhor ela fica.
          </p>
        </div>
      </div>

      {/* Modal rename pasta */}
      <AnimatePresence>
        {renaming && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setRenaming(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl w-72"
            >
              <p className="mb-3 text-sm font-semibold">Renomear pasta</p>
              <input
                autoFocus value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setFolders(prev => prev.map(f => f.id === renaming ? { ...f, name: renameVal.trim() || f.name } : f));
                    setRenaming(null);
                  }
                  if (e.key === 'Escape') setRenaming(null);
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-[#00A86B]/50 focus:outline-none"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => setRenaming(null)} className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300">Cancelar</button>
                <button
                  onClick={() => {
                    setFolders(prev => prev.map(f => f.id === renaming ? { ...f, name: renameVal.trim() || f.name } : f));
                    setRenaming(null);
                  }}
                  className="rounded-lg bg-[#00A86B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#00E6F2]"
                >Salvar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Componente de item de conversa ──────────────────────────────────────────

function ConvItem({
  conv, active, onClick, onDelete, indent,
}: {
  conv: MiaConversation; active: boolean; onClick: () => void; onDelete: () => void; indent: boolean;
}) {
  return (
    <div className={`group flex items-center gap-1 rounded-xl transition-colors cursor-pointer ${
      active ? 'bg-[#00A86B]/15 border border-[#00A86B]/25' : 'hover:bg-slate-800/60 border border-transparent'
    } ${indent ? 'ml-2' : ''}`}>
      <button onClick={onClick} className="flex-1 min-w-0 px-3 py-2 text-left">
        <p className={`text-xs font-medium truncate ${active ? 'text-[#00A86B]' : 'text-slate-400'}`}>
          {conv.title || 'Nova conversa'}
        </p>
        <p className="text-[10px] text-slate-600 font-mono mt-0.5">
          {formatTimeFull(conv.updatedAt)}
        </p>
      </button>
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className="rounded-lg p-1.5 mr-1 text-slate-700 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
        title="Deletar conversa"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

// ─── Estado vazio — sugestões de início ──────────────────────────────────────

function EmptyState({ onSend }: { onSend: (t: string) => void }) {
  const suggestions = [
    'Quais clientes não pedem faz mais de 2 semanas?',
    'O que meu concorrente mais próximo tem que eu não tenho?',
    'Cria um treinamento de 15min sobre atendimento ao cliente',
    'Analisa meu cardápio e diz o que reformular',
    'Quais tendências do momento posso aproveitar?',
    'Me dá um briefing do negócio dessa semana',
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10 gap-8">
      <div>
        <div className="size-16 rounded-3xl bg-gradient-to-br from-[#00A86B] to-[#00E6F2] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#00A86B]/25">
          <Brain size={28} className="text-white" />
        </div>
        <h2 className="text-xl font-black text-slate-200 mb-2">Olá! Sou a MIAR.</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Sua parceira de inteligência de negócio. Me fale sobre o restaurante,
          seus clientes, suas preocupações — estou aqui pra ajudar.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
        {suggestions.map((s, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSend(s)}
            className="text-left rounded-2xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 text-sm text-slate-400 hover:border-[#00A86B]/30 hover:text-slate-300 hover:bg-slate-900 transition-all"
          >
            {s}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
