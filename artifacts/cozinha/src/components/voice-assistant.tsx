import React, { useRef, useState } from 'react';
import { Mic, MessageSquare, Coffee, Briefcase } from 'lucide-react';
import { usePushToTalk } from '@workspace/voice-ptt';
import { useVoice } from '../hooks/use-voice';
import { useSendVoiceCommand, type KitchenOrder, type ExpiringStockItem, type PendingConfirmation } from '../lib/kitchen-api';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

interface VoiceAssistantProps {
  orders?: KitchenOrder[];
  expiringStock?: ExpiringStockItem[];
  onOrderStatusChanged?: (orderId: string, newStatus: string) => void;
}

export function VoiceAssistant({ orders, expiringStock, onOrderStatusChanged }: VoiceAssistantProps) {
  const { speak, stopSpeaking, isSpeaking } = useVoice();
  const { mutate: sendCommand } = useSendVoiceCommand();
  const [showTranscript, setShowTranscript] = React.useState(false);
  const [finalTranscript, setFinalTranscript] = React.useState('');
  const pendingConfirmationRef = useRef<PendingConfirmation | null>(null);

  // Modo pessoal: o profissional apertou o botão pra encerrar o expediente.
  // Fica salvo no aparelho, então continua no modo certo se recarregar a tela.
  const [mode, setMode] = useState<'profissional' | 'pessoal'>(() => {
    try {
      return (localStorage.getItem('miar.cozinha.modo') as 'profissional' | 'pessoal') || 'profissional';
    } catch { return 'profissional'; }
  });
  // modeRef existe porque o callback onTranscript é registrado uma vez pelo
  // hook e precisa sempre ler o modo mais recente, não o valor "congelado"
  // do momento em que foi criado.
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const toggleMode = () => {
    stopSpeaking();
    setMode((prev) => {
      const next = prev === 'profissional' ? 'pessoal' : 'profissional';
      try { localStorage.setItem('miar.cozinha.modo', next); } catch { /* ignore */ }
      speak(next === 'pessoal' ? 'Expediente encerrado. Agora é só a gente.' : 'De volta ao trabalho.');
      return next;
    });
  };

  const processTranscript = (transcript: string) => {
    if (!transcript.trim()) { setShowTranscript(false); return; }
    const currentMode = modeRef.current;
    setFinalTranscript(transcript);
    speak(currentMode === 'pessoal' ? '...' : 'Consultando...');
    sendCommand({
      data: {
        command: transcript,
        mode: currentMode,
        context: currentMode === 'pessoal' ? undefined : {
          orders,
          expiringStock,
          pendingConfirmation: pendingConfirmationRef.current ?? undefined,
        },
      }
    }, {
      onSuccess: ({ answer, raw }: { answer: string; raw: any }) => {
        // Confirmação pendente é de uso único — resolvida ou substituída neste turno
        pendingConfirmationRef.current = null;

        if (raw?.type === 'ignore') {
          // Captação sem conteúdo (ruído/tosse) — sem fala, sem transcript
          setShowTranscript(false);
          return;
        }

        // Aplica um item de resposta (confirmação a guardar / ação a executar de verdade).
        // Reaproveitado tanto pra uma resposta única quanto pra cada item de um "batch"
        // (mais de um comando na mesma fala, ex: "marca o timer do arroz e o 245 como pronto").
        const applyItem = (item: any) => {
          if (item?.type === 'confirmation_required') {
            pendingConfirmationRef.current = { action: item.action, payload: item.payload };
          }
          if (item?.type === 'action' && item.action === 'change_order_status' && item.payload?.orderId) {
            onOrderStatusChanged?.(item.payload.orderId, item.payload.newStatus);
          }
        };

        if (raw?.type === 'batch' && Array.isArray(raw.items)) {
          raw.items.forEach(applyItem);
        } else {
          applyItem(raw);
        }

        setFinalTranscript(answer);
        if (answer) speak(answer);

        setTimeout(() => setShowTranscript(false), 8000);
      },
      onError: (err: any) => {
        pendingConfirmationRef.current = null;
        const serverMessage = err?.data?.message;
        speak(serverMessage || "Desculpe, houve um erro ao consultar o sistema.");
        setTimeout(() => setShowTranscript(false), 3000);
      }
    });
  };

  // Caminho principal: grava e transcreve no servidor (Whisper). Cai pro
  // reconhecimento do navegador sozinho se o microfone falhar. Ver
  // lib/voice-ptt — esse mesmo hook é reaproveitável em qualquer outro app.
  const { isListening, isTranscribing, interimTranscript, isSupported, start, stop } =
    usePushToTalk({ onTranscript: processTranscript, transcribeUrl: '/api/transcribe' });

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isSupported) return;
    e.preventDefault();
    setShowTranscript(true);
    stopSpeaking();
    start();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isListening) return;
    e.preventDefault();
    stop();
  };

  if (!isSupported) return null;

  const isPersonal = mode === 'pessoal';
  const statusText = isListening
    ? (interimTranscript || 'Ouvindo...')
    : isTranscribing
      ? 'Transcrevendo...'
      : (finalTranscript || 'Processando...');

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {showTranscript && (
        <Card className={`w-80 shadow-xl animate-in slide-in-from-bottom-5 ${isPersonal ? 'border-amber-500/50' : 'border-primary/50'}`}>
          <CardContent className="p-4 flex gap-3">
            <MessageSquare className={`w-5 h-5 shrink-0 mt-0.5 ${isPersonal ? 'text-amber-500' : 'text-primary'}`} />
            <p className="text-sm font-medium">{statusText}</p>
          </CardContent>
        </Card>
      )}

      <Button
        size="icon"
        variant="outline"
        title={isPersonal ? 'Voltar ao modo trabalho' : 'Encerrar expediente'}
        className={`w-10 h-10 rounded-full shadow-lg ${isPersonal ? 'border-amber-500/50 text-amber-500' : ''}`}
        onClick={toggleMode}
      >
        {isPersonal ? <Briefcase className="w-4 h-4" /> : <Coffee className="w-4 h-4" />}
      </Button>

      <Button
        size="icon"
        variant={isListening ? "destructive" : "default"}
        className={`w-16 h-16 rounded-full shadow-2xl transition-all ${isListening ? 'scale-110 ring-4 ring-destructive/30' : 'hover:scale-105'} ${isSpeaking || isTranscribing ? 'animate-pulse bg-accent text-accent-foreground' : ''} ${isPersonal && !isListening && !isSpeaking && !isTranscribing ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()} // Prevent context menu on long press
      >
        <Mic className={`w-8 h-8 ${isListening ? 'animate-bounce' : ''}`} />
      </Button>
    </div>
  );
}
