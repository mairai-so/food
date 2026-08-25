import { useCallback, useRef, useState } from "react";

// ─── usePushToTalk ─────────────────────────────────────────────────────────
//
// Hook genérico de "aperta e segura pra falar", sem nenhuma dependência de
// domínio. Caminho principal: grava áudio com MediaRecorder e manda pro
// servidor transcrever (Whisper via Groq, rota /api/transcribe). Caminho de
// reserva: se o microfone não estiver disponível ou a transcrição falhar,
// cai pro reconhecimento de voz do navegador (Web Speech API), que funciona
// bem no Chrome mas é instável em outros navegadores — por isso é reserva,
// não o caminho principal.
//
// Pensado pra ser importado por qualquer app do monorepo (cozinha, garçom,
// equipe...). Cada app decide o que fazer com o texto final através do
// callback onTranscript — a lógica de comando/ação fica no app, não aqui.

export type PushToTalkState = "idle" | "recording" | "transcribing";

export interface UsePushToTalkOptions {
  /** Chamado com o texto final assim que a transcrição termina. */
  onTranscript: (text: string) => void;
  /** Rota do servidor que recebe o áudio e devolve { text }. */
  transcribeUrl?: string;
  /** Idioma pro reconhecimento de reserva do navegador. */
  lang?: string;
}

export interface UsePushToTalkResult {
  state: PushToTalkState;
  isListening: boolean;
  isTranscribing: boolean;
  /** Texto parcial, só disponível durante o caminho de reserva do navegador. */
  interimTranscript: string;
  isSupported: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

export function usePushToTalk({
  onTranscript,
  transcribeUrl = "/api/transcribe",
  lang = "pt-BR",
}: UsePushToTalkOptions): UsePushToTalkResult {
  const [state, setState] = useState<PushToTalkState>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const browserRecognitionRef = useRef<any>(null);

  const hasMediaRecorder =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const hasBrowserSpeech =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const isSupported = hasMediaRecorder || hasBrowserSpeech;

  // ── Caminho de reserva: reconhecimento do navegador ──────────────────────
  const startBrowserFallback = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setState("idle"); return; }
    const recognition = new SR();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      if (finalText) {
        setInterimTranscript("");
        onTranscript(finalText.trim());
      } else {
        setInterimTranscript(interim);
      }
    };
    recognition.onerror = () => setState("idle");
    recognition.onend = () => setState((s) => (s === "recording" ? "idle" : s));

    browserRecognitionRef.current = recognition;
    recognition.start();
    setState("recording");
  }, [lang, onTranscript]);

  // ── Caminho principal: gravar e mandar pro servidor transcrever ─────────
  const start = useCallback(async () => {
    setInterimTranscript("");
    if (!hasMediaRecorder) {
      if (hasBrowserSpeech) startBrowserFallback();
      return;
    }

    chunksRef.current = [];
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      if (hasBrowserSpeech) startBrowserFallback();
      return;
    }
    streamRef.current = stream;

    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      if (hasBrowserSpeech) startBrowserFallback();
      return;
    }

    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (!chunksRef.current.length) { setState("idle"); return; }

      setState("transcribing");
      const blob = new Blob(chunksRef.current, { type: mime });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const res = await fetch(transcribeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64: base64, mimeType: mime.split(";")[0] }),
          });
          if (res.ok) {
            const data = (await res.json()) as { text: string };
            if (data.text?.trim()) onTranscript(data.text.trim());
          } else if (hasBrowserSpeech) {
            startBrowserFallback();
            return;
          }
        } catch {
          if (hasBrowserSpeech) { startBrowserFallback(); return; }
        }
        setState("idle");
      };
      reader.readAsDataURL(blob);
    };

    recorder.start();
    setState("recording");
  }, [hasMediaRecorder, hasBrowserSpeech, transcribeUrl, onTranscript, startBrowserFallback]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      return;
    }
    if (browserRecognitionRef.current) {
      browserRecognitionRef.current.stop();
    }
  }, []);

  return {
    state,
    isListening: state === "recording",
    isTranscribing: state === "transcribing",
    interimTranscript,
    isSupported,
    start,
    stop,
  };
}
