import { useEffect, useRef, useState } from 'react';
import { X, Camera } from 'lucide-react';
import jsQR from 'jsqr';

/**
 * MIAR AI/FOOD — Leitor de QR da mesa (cliente) - CORRIGIDO
 * Caminho rapido: usa o BarcodeDetector nativo quando existe (Chrome Android).
 * Caminho universal: quando o navegador nao tem BarcodeDetector (iPhone, Safari,
 * Firefox, maioria dos desktops), le os quadros da camera por um canvas e
 * decodifica com jsQR. Assim le o QR em QUALQUER aparelho, nao so no Android.
 */

export default function LeitorQR({
  onLido,
  onFechar,
}: {
  onLido: (texto: string) => void;
  onFechar: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lidoRef = useRef(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    const Detector = (window as any).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;

    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');

    const entregar = (texto: string) => {
      if (lidoRef.current || !texto) return;
      lidoRef.current = true;
      onLido(texto);
    };

    // Fallback universal: desenha o quadro num canvas e roda o jsQR
    const lerComJsQR = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const res = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
      if (res && res.data) entregar(res.data);
    };

    const ler = async () => {
      if (!vivo || lidoRef.current || !videoRef.current) return;
      try {
        if (detector) {
          const codigos = await detector.detect(videoRef.current);
          if (codigos && codigos.length > 0 && codigos[0].rawValue) {
            entregar(codigos[0].rawValue);
            return;
          }
        } else {
          lerComJsQR();
          if (lidoRef.current) return;
        }
      } catch {}
      rafRef.current = requestAnimationFrame(ler);
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (!vivo) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          rafRef.current = requestAnimationFrame(ler);
        }
      } catch (e: any) {
        setErro(
          e?.name === 'NotAllowedError'
            ? 'Permita o acesso a camera no navegador pra ler o QR.'
            : e?.name === 'NotFoundError'
            ? 'Nenhuma camera encontrada neste aparelho.'
            : e?.name === 'NotReadableError'
            ? 'A camera esta em uso por outro app. Feche e tente de novo.'
            : `Nao foi possivel abrir a camera: ${e?.message ?? e}`,
        );
      }
    })();

    return () => {
      vivo = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onLido]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4 text-white">
        <span className="flex items-center gap-2 font-semibold">
          <Camera className="h-5 w-5" /> Ler QR da mesa
        </span>
        <button onClick={onFechar} className="rounded-lg bg-white/10 p-2">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {/* mira */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-56 w-56 rounded-3xl border-2 border-emerald-400/80" />
        </div>
      </div>

      {erro && <div className="bg-slate-900 p-4 text-sm text-amber-300">{erro}</div>}
    </div>
  );
}
