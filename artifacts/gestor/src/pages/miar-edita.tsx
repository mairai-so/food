import { useEffect, useRef, useState } from 'react';
import { Camera, Download, MonitorUp, Play, Square, Video, X } from 'lucide-react';

type SourceMode = 'none' | 'screen' | 'camera' | 'both';

function sourceMode(screen: MediaStream | null, camera: MediaStream | null): SourceMode {
  if (screen && camera) return 'both';
  if (screen) return 'screen';
  if (camera) return 'camera';
  return 'none';
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export default function MiarEdita() {
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  const mode = sourceMode(screenStream, cameraStream);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = screenStream ?? cameraStream;
    }
    return () => {
      stopStream(screenStream);
      stopStream(cameraStream);
    };
  }, [screenStream, cameraStream]);

  const addScreen = async () => {
    setError('');
    try {
      setScreenStream(await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }));
    } catch {
      setError('A captura de tela foi cancelada ou não está disponível neste navegador.');
    }
  };

  const addCamera = async () => {
    setError('');
    try {
      setCameraStream(await navigator.mediaDevices.getUserMedia({ video: true, audio: true }));
    } catch {
      setError('A câmera e o microfone precisam de permissão para iniciar.');
    }
  };

  const startRecording = () => {
    const stream = screenStream ?? cameraStream;
    if (!stream) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      setRecordedUrl(URL.createObjectURL(blob));
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const closeSource = () => {
    stopStream(screenStream);
    stopStream(cameraStream);
    setScreenStream(null);
    setCameraStream(null);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
  };

  return (
    <main className="min-h-full bg-[#10161b] px-5 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-lime-300">MIAR AI EDITA</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Grave o que precisa ser compartilhado.</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-400">Um estúdio rápido dentro do Gestor para capturar tela, câmera e ideias em movimento.</p>
          </div>
          <span className="rounded-full border border-lime-300/30 bg-lime-300/10 px-3 py-1.5 text-xs font-medium text-lime-200">Modo {mode}</span>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
            <div className="flex aspect-video items-center justify-center bg-[radial-gradient(circle_at_top,#26343b,#05080a_70%)]">
              {mode === 'none' ? <Video className="h-16 w-16 text-slate-700" /> : <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-contain" />}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 p-3">
              <button type="button" onClick={() => void addScreen()} className="inline-flex items-center gap-2 rounded-lg bg-lime-300 px-3 py-2 text-sm font-semibold text-slate-950"><MonitorUp size={16} /> Tela</button>
              <button type="button" onClick={() => void addCamera()} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/10"><Camera size={16} /> Câmera</button>
              {mode !== 'none' && <button type="button" onClick={closeSource} className="inline-flex items-center gap-2 rounded-lg border border-red-300/20 px-3 py-2 text-sm text-red-200 hover:bg-red-400/10"><X size={16} /> Limpar</button>}
              <button type="button" disabled={!recording && mode === 'none'} onClick={recording ? stopRecording : startRecording} className={`ml-auto inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${recording ? 'bg-red-500 text-white' : 'bg-white text-slate-950 disabled:cursor-not-allowed disabled:opacity-30'}`}>
                {recording ? <><Square size={15} /> Parar</> : <><Play size={15} /> Gravar</>}
              </button>
            </div>
          </div>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Entrega local</p>
            <h2 className="mt-3 text-xl font-semibold">Seu material fica no navegador.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">A gravação atual não sobe para a nuvem. Baixe o vídeo quando terminar e compartilhe pelo canal de sua escolha.</p>
            {recordedUrl && <a href={recordedUrl} download="miar-edita-gravacao.webm" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-lime-300 px-4 py-3 text-sm font-semibold text-slate-950"><Download size={16} /> Baixar gravação</a>}
            {error && <p role="alert" className="mt-5 rounded-lg border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
          </aside>
        </section>
      </div>
    </main>
  );
}