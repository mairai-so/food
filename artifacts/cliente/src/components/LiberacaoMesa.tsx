import { useEffect, useState } from 'react';

/**
 * MIAR AI/FOOD — Assinatura de liberacao (identidade / lei).
 * Quando o cliente e liberado (pedido pronto na mesa), a tela inteira vira
 * TURQUESA com um numero GIGANTE por 2 segundos. Turquesa = estado "liberado",
 * cor reservada, nunca decora. Sem palavra banida, nada gira.
 * Uso: <LiberacaoMesa numero={8} onFim={...} />
 */

const TURQUESA = '#00E0A8';
const BASE = '#050F19';

export default function LiberacaoMesa({
  numero,
  rotulo = 'MESA',
  onFim,
  duracaoMs = 2000,
}: {
  numero: number | string;
  rotulo?: string;
  onFim?: () => void;
  duracaoMs?: number;
}) {
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setSaindo(true), duracaoMs - 320);
    const t2 = setTimeout(() => onFim?.(), duracaoMs);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [duracaoMs, onFim]);

  return (
    <div
      role="status"
      aria-label={`${rotulo} ${numero} liberada`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: TURQUESA,
        color: BASE,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        opacity: saindo ? 0 : 1,
        transition: 'opacity 320ms ease',
      }}
    >
      <span style={{ fontSize: 'clamp(18px, 6vw, 34px)', fontWeight: 800, letterSpacing: 4, opacity: 0.85 }}>
        {rotulo}
      </span>
      <span style={{ fontSize: 'clamp(120px, 42vw, 340px)', fontWeight: 900, lineHeight: 1 }}>
        {numero}
      </span>
      <span style={{ fontSize: 'clamp(16px, 5vw, 28px)', fontWeight: 800, letterSpacing: 2 }}>
        LIBERADA
      </span>
    </div>
  );
}
