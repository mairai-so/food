import React, { useRef, useEffect } from 'react';
import { Mic, MessageSquare } from 'lucide-react';
import { useVoice, useSpeechRecognition } from '../hooks/use-voice';
import { useSendVoiceCommand } from '../lib/kitchen-api';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

interface VoiceAssistantProps {
  context?: string;
}

export function VoiceAssistant({ context }: VoiceAssistantProps) {
  const { speak, stopSpeaking, isSpeaking } = useVoice();
  const { mutate: sendCommand } = useSendVoiceCommand();
  const [showTranscript, setShowTranscript] = React.useState(false);
  const [finalTranscript, setFinalTranscript] = React.useState('');

  const handleResult = (text: string) => {
    // Only used for continuous recognition, but we are using touch-to-talk
  };

  const { isListening, transcript, startListening, stopListening, isSupported } = useSpeechRecognition(handleResult);

  // Track button press
  const holdTimeoutRef = useRef<any>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isSupported) return;
    e.preventDefault();
    setShowTranscript(true);
    stopSpeaking();
    startListening();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isListening) return;
    e.preventDefault();
    stopListening();

    if (transcript.trim()) {
      setFinalTranscript(transcript);
      speak("Consultando...");
      sendCommand({
        data: {
          command: transcript,
          context: context
        }
      }, {
        onSuccess: (response: { answer: string }) => {
          setFinalTranscript(response.answer);
          speak(response.answer);

          // Hide transcript after reading
          setTimeout(() => setShowTranscript(false), 8000);
        },
        onError: () => {
          speak("Desculpe, houve um erro ao consultar o sistema.");
          setTimeout(() => setShowTranscript(false), 3000);
        }
      });
    } else {
      setShowTranscript(false);
    }
  };

  if (!isSupported) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {showTranscript && (
        <Card className="w-80 shadow-xl border-primary/50 animate-in slide-in-from-bottom-5">
          <CardContent className="p-4 flex gap-3">
            <MessageSquare className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm font-medium">
              {isListening ? (transcript || "Ouvindo...") : (finalTranscript || "Processando...")}
            </p>
          </CardContent>
        </Card>
      )}

      <Button
        size="icon"
        variant={isListening ? "destructive" : "default"}
        className={`w-16 h-16 rounded-full shadow-2xl transition-all ${isListening ? 'scale-110 ring-4 ring-destructive/30' : 'hover:scale-105'} ${isSpeaking ? 'animate-pulse bg-accent text-accent-foreground' : ''}`}
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
