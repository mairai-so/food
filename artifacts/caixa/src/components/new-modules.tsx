import { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────
// StockAuditCamera — Auditoria de estoque por CÂMERA AO VIVO exclusivamente
// Upload de arquivo ou vídeo gravado é BLOQUEADO na UI e no backend.
// ─────────────────────────────────────────────────────────────────────────────
export function StockAuditCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<string[]>([]);

  const addLog = (msg: string) =>
    setAuditLogs(l => [`${new Date().toLocaleTimeString('pt-BR')} — ${msg}`, ...l.slice(0, 49)]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      addLog('Câmera ao vivo iniciada');
    } catch (err: any) {
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Permissão de câmera negada. Permita o acesso à câmera no navegador.'
          : `Erro ao acessar câmera: ${err.message}`,
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    addLog('Câmera encerrada');
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) return;
    const capturedAt = new Date().toISOString();

    // Capturar frame do vídeo ao vivo
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const imageBase64 = dataUrl.split(',')[1];

    setAnalyzing(true);
    setError(null);
    addLog('Enviando frame ao vivo para análise IA...');

    try {
      const response = await fetch('/api/vision/stock-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          imageBase64,
          mimeType: 'image/jpeg',
          liveCapture: true,       // ← obrigatório — valida ao vivo no backend
          capturedAt,              // ← timestamp do frame (max 30s de atraso)
          cameraId: 'device-0',
          cameraSource: 'device',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? data.error ?? 'Erro na análise');
        addLog(`ERRO: ${data.error}`);
        return;
      }
      setResult(data);
      addLog(`Análise OK — ${data.items?.length ?? 0} item(s) identificado(s) • Audit #${data.auditId?.slice(0, 8)}`);
    } catch (err: any) {
      setError(err.message);
      addLog(`FALHA de rede: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  }, [cameraActive]);

  return (
    <div className="space-y-4">
      {/* Aviso de segurança */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        <p className="font-semibold">🔒 Modo exclusivo: câmera ao vivo</p>
        <p className="mt-1 text-amber-400/80">
          Upload de fotos ou vídeos gravados é <strong>proibido</strong> para auditoria de estoque.
          O sistema aceita apenas frames capturados nesta sessão pela câmera conectada. Isso reduz o risco de usar arquivos antigos, mas não substitui outras validações de segurança.
        </p>
      </div>

      {/* Player de câmera */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
        <video
          ref={videoRef}
          className="w-full"
          playsInline
          muted
          style={{ minHeight: 220, background: '#020617' }}
        />
        <canvas ref={canvasRef} className="hidden" />
        {cameraActive && (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-medium text-white">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            AO VIVO
          </div>
        )}
        {!cameraActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-slate-500">Câmera desligada</p>
          </div>
        )}
      </div>

      {cameraError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {cameraError}
        </div>
      )}

      {/* Controles */}
      <div className="flex flex-wrap gap-2">
        {!cameraActive ? (
          <button
            onClick={startCamera}
            className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400 transition"
          >
            Ligar câmera
          </button>
        ) : (
          <>
            <button
              onClick={captureAndAnalyze}
              disabled={analyzing}
              className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400 transition disabled:opacity-50"
            >
              {analyzing ? 'Analisando...' : 'Capturar e analisar'}
            </button>
            <button
              onClick={stopCamera}
              className="rounded-xl bg-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600 transition"
            >
              Desligar câmera
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <strong>Erro:</strong> {error}
        </div>
      )}

      {/* Resultado da análise */}
      {result && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-slate-100">Itens identificados na câmera ao vivo</p>
            <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs text-emerald-400">
              Audit #{result.auditId?.slice(0, 8)}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {(result.items ?? []).map((item: any, idx: number) => (
              <div key={idx} className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-100">{item.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${item.quantity === 0 ? 'bg-rose-500/20 text-rose-300' : item.alert ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {item.quantity} {item.unit}
                  </span>
                </div>
                {item.expiresAt && (
                  <p className="mt-1 text-xs text-slate-400">Validade: {item.expiresAt}</p>
                )}
                {item.alert && (
                  <p className="mt-1 text-xs font-medium text-amber-400">⚠ {item.alert}</p>
                )}
              </div>
            ))}
            {(result.items ?? []).length === 0 && (
              <p className="text-sm text-slate-400">Nenhum item identificado neste frame.</p>
            )}
          </div>
        </div>
      )}

      {/* Log de auditoria */}
      {auditLogs.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Log de auditoria (sessão atual)</p>
          <div className="space-y-1 font-mono text-xs text-slate-400">
            {auditLogs.map((log, i) => <p key={i}>{log}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SegmentOnboarding — escolha de segmento e aplicação de preset
// ─────────────────────────────────────────────────────────────────────────────
const SEGMENTS = [
  { id: 'churrascaria', name: 'Churrascaria', icon: '🔥', description: 'Rodízio e cortes bovinos, suínos e frango' },
  { id: 'pizzaria', name: 'Pizzaria', icon: '🍕', description: 'Pizzas artesanais, massas frescas e calzones' },
  { id: 'bar-com-show', name: 'Bar com Show', icon: '🎵', description: 'Petiscos, drinks e música ao vivo' },
  { id: 'restaurante-japones', name: 'Restaurante Japonês', icon: '🍣', description: 'Sushis, sashimis, temakis e pratos quentes' },
  { id: 'hamburgueria', name: 'Hamburgueria', icon: '🍔', description: 'Smash burgers artesanais, batatas especiais e milkshakes' },
];

export function SegmentOnboarding() {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [replace, setReplace] = useState(false);

  const applyPreset = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('/api/onboarding/apply-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ segmentId: selected, replace }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? 'Erro ao aplicar preset'); return; }
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-400">
          Selecione o segmento do seu restaurante. O sistema irá injetar automaticamente o cardápio,
          estoque inicial e fluxos operacionais recomendados para o seu nicho.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SEGMENTS.map(seg => (
          <button
            key={seg.id}
            onClick={() => setSelected(seg.id)}
            className={`rounded-2xl border p-4 text-left transition ${
              selected === seg.id
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600'
            }`}
          >
            <div className="text-3xl">{seg.icon}</div>
            <p className="mt-2 font-semibold text-slate-100">{seg.name}</p>
            <p className="mt-1 text-xs text-slate-400">{seg.description}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={replace}
            onChange={e => setReplace(e.target.checked)}
            className="rounded"
          />
          Substituir cardápio e estoque existentes
        </label>
      </div>

      <button
        onClick={applyPreset}
        disabled={!selected || loading}
        className="rounded-xl bg-emerald-500 px-6 py-2.5 font-medium text-slate-950 hover:bg-emerald-400 transition disabled:opacity-40"
      >
        {loading ? 'Aplicando...' : 'Aplicar preset do segmento'}
      </button>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="font-semibold text-emerald-300">
            {result.segment.icon} {result.message}
          </p>
          <div className="mt-3 space-y-1 text-sm text-slate-300">
            <p>✔ {result.applied.menus} itens de cardápio</p>
            <p>✔ {result.applied.stockItems} itens de estoque</p>
          </div>
          {result.workflows?.length > 0 && (
            <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/50 p-3">
              <p className="mb-2 text-xs font-medium uppercase text-slate-500">Fluxos operacionais recomendados</p>
              <ul className="space-y-1 text-sm text-slate-300">
                {result.workflows.map((w: string, i: number) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BarcodePanel — geração e leitura de códigos de barras
// ─────────────────────────────────────────────────────────────────────────────
function BarcodeDisplay({ barcode }: { barcode: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !barcode) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    // Encode EAN-13 like bars using character code modulation
    const digits = barcode.replace(/\D/g, '').padEnd(13, '0').slice(0, 13);
    const barWidth = Math.floor(W / (digits.length * 7 + 12));
    let x = 10;
    ctx.fillStyle = '#000';
    for (const ch of digits) {
      const code = parseInt(ch, 10);
      const pattern = [3, 2, 1, 4, 2, 2, 3, 1, 2, 4][code % 10];
      for (let b = 0; b < pattern + 1; b++) {
        if (b % 2 === 0) {
          ctx.fillRect(x, 0, barWidth * (1 + (pattern % 2)), H - 20);
        }
        x += barWidth * (1 + (b % 3 === 0 ? 1 : 0));
      }
    }
    ctx.fillStyle = '#000';
    ctx.font = `${barWidth * 6}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(barcode, W / 2, H - 4);
  }, [barcode]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={80}
      className="rounded-lg bg-white"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

export function BarcodePanel() {
  const [stockItemId, setStockItemId] = useState('');
  const [scanValue, setScanValue] = useState('');
  const [generated, setGenerated] = useState<any>(null);
  const [scanned, setScanned] = useState<any>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<any>(null);

  const generateBarcode = async () => {
    if (!stockItemId.trim()) return;
    setGenLoading(true);
    setGenError(null);
    setGenerated(null);
    try {
      const response = await fetch('/api/barcode/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ stockItemId: stockItemId.trim() }),
      });
      const data = await response.json();
      if (!response.ok) { setGenError(data.error ?? 'Erro'); return; }
      setGenerated(data);
    } catch (err: any) { setGenError(err.message); }
    finally { setGenLoading(false); }
  };

  const scanBarcode = async () => {
    if (!scanValue.trim()) return;
    setScanLoading(true);
    setScanError(null);
    setScanned(null);
    try {
      const response = await fetch('/api/barcode/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ barcode: scanValue.trim() }),
      });
      const data = await response.json();
      if (!response.ok) { setScanError(data.message ?? data.error ?? 'Não encontrado'); return; }
      setScanned(data);
    } catch (err: any) { setScanError(err.message); }
    finally { setScanLoading(false); }
  };

  const generateBatch = async () => {
    try {
      const response = await fetch('/api/barcode/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      setBatchResult(data);
    } catch (err: any) { console.error(err); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Geração */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <p className="font-semibold text-slate-100">Gerar código de barras</p>
        <p className="mt-1 text-sm text-slate-400">Cole o ID do item de estoque para gerar e associar um código EAN-13.</p>
        <div className="mt-4 space-y-3">
          <input
            value={stockItemId}
            onChange={e => setStockItemId(e.target.value)}
            placeholder="ID do item (ex: si-001)"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
          />
          <button
            onClick={generateBarcode}
            disabled={genLoading || !stockItemId.trim()}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-40"
          >
            {genLoading ? 'Gerando...' : 'Gerar código'}
          </button>
          <button
            onClick={generateBatch}
            className="rounded-xl bg-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-600"
          >
            Gerar para todos os itens sem código
          </button>
        </div>

        {genError && <p className="mt-3 text-sm text-rose-400">{genError}</p>}

        {generated && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm">
              <p className="font-medium text-slate-100">{generated.name}</p>
              <p className="mt-1 font-mono text-emerald-400 text-lg tracking-widest">{generated.barcode}</p>
              <p className="mt-1 text-xs text-slate-500">{generated.barcodeType} • {generated.existing ? 'existente' : 'novo'}</p>
            </div>
            <BarcodeDisplay barcode={generated.barcode} />
          </div>
        )}

        {batchResult && (
          <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-sm text-slate-300">
            ✔ {batchResult.generated} código(s) gerado(s) em lote
          </div>
        )}
      </div>

      {/* Leitura / Busca */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <p className="font-semibold text-slate-100">Consultar por código de barras</p>
        <p className="mt-1 text-sm text-slate-400">Digite ou cole o valor lido pelo scanner para identificar o produto no estoque.</p>
        <div className="mt-4 space-y-3">
          <input
            value={scanValue}
            onChange={e => setScanValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && scanBarcode()}
            placeholder="Digite ou cole o código (ex: 7890000012348)"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-emerald-500"
          />
          <button
            onClick={scanBarcode}
            disabled={scanLoading || !scanValue.trim()}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-40"
          >
            {scanLoading ? 'Buscando...' : 'Identificar produto'}
          </button>
        </div>

        {scanError && <p className="mt-3 text-sm text-rose-400">{scanError}</p>}

        {scanned?.item && (
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-100">{scanned.item.name}</p>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">encontrado</span>
            </div>
            <p className="mt-1 text-slate-400">{scanned.item.category}</p>
            <p className="mt-2 text-slate-300">
              Estoque: <strong className={scanned.alert ? 'text-amber-400' : 'text-emerald-400'}>
                {scanned.item.quantity} {scanned.item.unit}
              </strong>
              {' '}(mín: {scanned.item.minQuantity})
            </p>
            {scanned.item.expiresAt && (
              <p className="mt-1 text-xs text-slate-400">Validade: {new Date(scanned.item.expiresAt).toLocaleDateString('pt-BR')}</p>
            )}
            {scanned.alert && (
              <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                ⚠ {scanned.alert.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MarketingPanel — geração de campanhas de marketing por IA com fotos do local
// ─────────────────────────────────────────────────────────────────────────────
export function MarketingPanel() {
  const [images, setImages] = useState<Array<{ base64: string; mimeType: string; name: string }>>([]);
  const [briefing, setBriefing] = useState('');
  const [restaurantName, setRestaurantName] = useState('Meu Restaurante');
  const [segment, setSegment] = useState('restaurante');
  const [loading, setLoading] = useState(false);
  const [campaign, setCampaign] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [tab, setTab] = useState<'create' | 'history'>('create');

  const loadCampaigns = async () => {
    try {
      const response = await fetch('/api/marketing/campaigns', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (response.ok) setCampaigns(await response.json());
    } catch {}
  };

  useEffect(() => { void loadCampaigns(); }, []);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newImages: typeof images = [];
    Array.from(files).slice(0, 5 - images.length).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target?.result as string;
        newImages.push({
          base64: dataUrl.split(',')[1],
          mimeType: file.type || 'image/jpeg',
          name: file.name,
        });
        if (newImages.length === Math.min(files.length, 5 - images.length)) {
          setImages(prev => [...prev, ...newImages].slice(0, 5));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const generateCampaign = async () => {
    if (!images.length) return;
    setLoading(true);
    setError(null);
    setCampaign(null);
    try {
      const response = await fetch('/api/marketing/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          images: images.map(i => ({ base64: i.base64, mimeType: i.mimeType })),
          restaurantName,
          segment,
          briefing,
        }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? 'Erro na geração'); return; }
      setCampaign(data);
      void loadCampaigns();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const deleteCampaign = async (id: string) => {
    await fetch(`/api/marketing/campaigns/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    void loadCampaigns();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setTab('create')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'create' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          Nova campanha
        </button>
        <button
          onClick={() => { setTab('history'); void loadCampaigns(); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'history' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          Histórico ({campaigns.length})
        </button>
      </div>

      {tab === 'create' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Nome do restaurante</label>
              <input
                value={restaurantName}
                onChange={e => setRestaurantName(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Segmento</label>
              <select
                value={segment}
                onChange={e => setSegment(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
              >
                <option value="restaurante">Restaurante geral</option>
                <option value="churrascaria">Churrascaria</option>
                <option value="pizzaria">Pizzaria</option>
                <option value="bar">Bar / Boteco</option>
                <option value="japones">Japonês / Sushi</option>
                <option value="hamburgueria">Hamburgueria</option>
              </select>
            </div>
          </div>

          {/* Upload de fotos — para marketing (não para auditoria de estoque) */}
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Fotos do estabelecimento / pratos (máx. 5)
            </label>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              className="relative rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950/50 p-6 text-center hover:border-emerald-500/50 transition"
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={e => handleFiles(e.target.files)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <p className="text-sm text-slate-400">Arraste fotos ou clique para selecionar</p>
              <p className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP — máx. 5 imagens</p>
            </div>
          </div>

          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative">
                  <img src={`data:${img.mimeType};base64,${img.base64}`} alt={img.name} className="h-16 w-16 rounded-lg object-cover" />
                  <button
                    onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs text-slate-400">Briefing adicional (opcional)</label>
            <textarea
              value={briefing}
              onChange={e => setBriefing(e.target.value)}
              placeholder="Ex: Promoção de almoço executivo R$ 29,90 de 11h às 15h, foco em trabalhadores da região..."
              rows={3}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <button
            onClick={generateCampaign}
            disabled={loading || !images.length}
            className="rounded-xl bg-emerald-500 px-6 py-2.5 font-medium text-slate-950 hover:bg-emerald-400 transition disabled:opacity-40"
          >
            {loading ? 'Gerando campanha com IA...' : '✦ Gerar campanha com IA'}
          </button>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          {campaign && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-400">{campaign.title}</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-100">{campaign.headline}</h3>
                </div>
                <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-400">{campaign.tone}</span>
              </div>

              <p className="text-sm leading-6 text-slate-300 whitespace-pre-line">{campaign.copy}</p>

              {campaign.instagramCaption && (
                <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                  <p className="mb-1 text-xs text-slate-500 uppercase">Caption Instagram</p>
                  <p className="text-sm text-slate-300 whitespace-pre-line">{campaign.instagramCaption}</p>
                </div>
              )}

              {campaign.whatsappMessage && (
                <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                  <p className="mb-1 text-xs text-slate-500 uppercase">Mensagem WhatsApp</p>
                  <p className="text-sm text-slate-300 whitespace-pre-line">{campaign.whatsappMessage}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {(campaign.hashtags ?? []).map((h: string) => (
                  <span key={h} className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-400">{h}</span>
                ))}
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                <p className="text-xs text-slate-500 uppercase mb-1">Call to action</p>
                <p className="text-sm font-medium text-emerald-400">{campaign.callToAction}</p>
              </div>

              {campaign.imageSuggestion && (
                <p className="text-xs text-slate-500">📷 Sugestão de imagem: {campaign.imageSuggestion}</p>
              )}
            </motion.div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {campaigns.length === 0 && (
            <p className="text-sm text-slate-400">Nenhuma campanha gerada ainda.</p>
          )}
          {campaigns.map(c => (
            <div key={c.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-100">{c.title}</p>
                  <p className="mt-0.5 text-sm text-emerald-400">{c.headline}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(c.generatedAt).toLocaleString('pt-BR')} • {c.tone} • {c.sourceImages} foto(s)
                  </p>
                </div>
                <button
                  onClick={() => deleteCampaign(c.id)}
                  className="text-xs text-rose-400 hover:text-rose-300"
                >
                  Excluir
                </button>
              </div>
              <p className="mt-3 text-sm text-slate-300 line-clamp-3">{c.copy}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CashCheckCamera — Conferência de cédula (triagem de nota falsa) por CÂMERA
// AO VIVO exclusivamente. Mesma infraestrutura de segurança do StockAuditCamera
// (webcam do computador do caixa OU câmera do celular — ambos são 'device').
// NUNCA declara "é falsa" com certeza: é triagem, decisão final é humana.
// ─────────────────────────────────────────────────────────────────────────────
export function CashCheckCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Permissão de câmera negada. Permita o acesso à câmera (funciona com webcam do computador ou câmera do celular).'
          : `Erro ao acessar câmera: ${err.message}`,
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const captureAndCheck = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) return;
    const capturedAt = new Date().toISOString();

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const imageBase64 = dataUrl.split(',')[1];

    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/vision/cash-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          imageBase64,
          mimeType: 'image/jpeg',
          liveCapture: true,       // ← obrigatório — valida ao vivo no backend
          capturedAt,              // ← timestamp do frame (max 30s de atraso)
          cameraId: 'device-0',
          cameraSource: 'device',  // ← igual pra webcam do PC ou câmera do celular
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? data.error ?? 'Erro na conferência');
        return;
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }, [cameraActive]);

  const suspicionStyle: Record<string, string> = {
    sem_suspeita: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    suspeita_leve: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    suspeita_alta: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  };
  const suspicionLabel: Record<string, string> = {
    sem_suspeita: '✓ Sem suspeita visual',
    suspeita_leve: '⚠ Suspeita leve — confira com atenção',
    suspeita_alta: '⚠ Suspeita alta — confira manualmente antes de aceitar',
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        <p className="font-semibold">🔒 Triagem visual — não substitui conferência manual</p>
        <p className="mt-1 text-amber-400/80">
          A câmera comum não autentica cédula com a confiabilidade de luz UV ou caneta detectora.
          Esta ferramenta só sinaliza suspeita para você decidir — a decisão final é sempre sua.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
        <video
          ref={videoRef}
          className="w-full"
          playsInline
          muted
          style={{ minHeight: 220, background: '#020617' }}
        />
        <canvas ref={canvasRef} className="hidden" />
        {cameraActive && (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-medium text-white">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            AO VIVO
          </div>
        )}
        {!cameraActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-slate-500">Câmera desligada</p>
          </div>
        )}
      </div>

      {cameraError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {cameraError}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!cameraActive ? (
          <button
            onClick={startCamera}
            className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400 transition"
          >
            Ligar câmera
          </button>
        ) : (
          <>
            <button
              onClick={captureAndCheck}
              disabled={analyzing}
              className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400 transition disabled:opacity-50"
            >
              {analyzing ? 'Analisando...' : 'Conferir nota'}
            </button>
            <button
              onClick={stopCamera}
              className="rounded-xl bg-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600 transition"
            >
              Desligar câmera
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <strong>Erro:</strong> {error}
        </div>
      )}

      {result && (
        <div className={`rounded-2xl border p-4 ${suspicionStyle[result.nivelSuspeita] ?? 'border-slate-800 bg-slate-900/80'}`}>
          <div className="flex items-center justify-between">
            <p className="font-medium">{suspicionLabel[result.nivelSuspeita] ?? 'Resultado'}</p>
            {result.valorAparente && (
              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-200">
                {result.valorAparente}
              </span>
            )}
          </div>
          {result.observacoes && (
            <p className="mt-2 text-sm opacity-90">{result.observacoes}</p>
          )}
          {result.recomendacao && (
            <p className="mt-2 text-xs font-medium opacity-80">{result.recomendacao}</p>
          )}
        </div>
      )}
    </div>
  );
}
