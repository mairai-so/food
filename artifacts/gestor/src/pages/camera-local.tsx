import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';

/**
 * MIAR AI/FOOD — Gestor · Camera local
 * Abre a webcam do proprio aparelho dentro de um painel, sem sair da tela.
 * Uma camera por painel. Deixa escolher o dispositivo quando ha mais de um.
 */
export default function CameraLocal() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [on, setOn] = useState(false);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setOn(false);
  };

  const start = async (id?: string) => {
    setError('');
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: id ? { deviceId: { exact: id } } : true,
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setOn(true);
      const list = await navigator.mediaDevices.enumerateDevices();
      const cams = list.filter((d) => d.kind === 'videoinput');
      setDevices(cams);
      if (!deviceId && cams[0]) setDeviceId(cams[0].deviceId);
    } catch (e) {
      setError('Nao foi possivel abrir a camera. Permita o acesso no navegador.');
      setOn(false);
    }
  };

  useEffect(() => () => stop(), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#050F19' }}>
      <div style={{ padding: '8px 8px 0' }}>
        <Link href="/painel" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>← Voltar</Link>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 8, alignItems: 'center' }}>
        {!on ? (
          <button onClick={() => start(deviceId || undefined)} style={btnStyle(true)}>Ligar camera</button>
        ) : (
          <button onClick={stop} style={btnStyle(false)}>Desligar</button>
        )}
        {devices.length > 1 && (
          <select
            value={deviceId}
            onChange={(e) => { setDeviceId(e.target.value); start(e.target.value); }}
            style={{
              flex: 1, background: '#0D161D', color: '#F5EEE6',
              border: '1px solid #1E2A34', borderRadius: 8, padding: '6px 8px', fontSize: 13,
            }}
          >
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>
            ))}
          </select>
        )}
      </div>
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
        />
        {!on && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#A99FB2', fontSize: 13, textAlign: 'center', padding: 16,
          }}>
            {error || 'Camera desligada. Toque em Ligar camera.'}
          </div>
        )}
      </div>
    </div>
  );
}

function btnStyle(primary: boolean): React.CSSProperties {
  return {
    border: primary ? 'none' : '1px solid #1E2A34',
    cursor: 'pointer',
    borderRadius: 999,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'inherit',
    background: primary ? '#00E6F2' : '#0D161D',
    color: primary ? '#050F19' : '#A99FB2',
  };
}
