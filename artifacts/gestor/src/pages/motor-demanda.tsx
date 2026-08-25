import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

/**
 * MIAR AI/FOOD — Gestor · Motor de Inteligencia de Demanda.
 * Mostra o que a cidade PROCUROU e NAO ACHOU (demanda reprimida), com o
 * nivel por volume. E o desejo que nao virou venda — o dado que ninguem tem.
 */

const C = {
  base: 'var(--miar-base, #050F19)',
  surface: 'var(--miar-surface, #0D161D)',
  text: 'var(--miar-text, #F5EEE6)',
  muted: 'var(--miar-muted, #A99FB2)',
  line: 'var(--miar-line, #1E2A34)',
  ciano: 'var(--miar-ciano, #00E6F2)',
  amarelo: '#FFB020',
};

type Linha = {
  termo: string;
  regiao: string;
  total: number;
  naoEncontrada: number;
  rejeicao: number;
  encontrada: number;
  visitantes: number;
  nivel: 'identificada' | 'recorrente' | 'forte';
};

const NIVEL_ROTULO: Record<Linha['nivel'], string> = {
  identificada: 'Oportunidade identificada',
  recorrente: 'Interesse recorrente',
  forte: 'Oportunidade forte',
};

function getToken(): string {
  try { return localStorage.getItem('miar_token') || ''; } catch { return ''; }
}

export default function MotorDemanda() {
  const [, setLocation] = useLocation();
  const [oportunidades, setOportunidades] = useState<Linha[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    fetch('/api/demanda/painel?dias=30', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => { setOportunidades(d.oportunidades ?? []); setCarregado(true); })
      .catch(() => { setErro('Nao foi possivel carregar o painel.'); setCarregado(true); });
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      background: C.base, color: C.text, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        borderBottom: `1px solid ${C.line}` }}>
        <button onClick={() => setLocation('/painel')}
          style={{ cursor: 'pointer', borderRadius: 999, padding: '8px 12px', fontSize: 14,
            fontWeight: 700, fontFamily: 'inherit', background: C.surface, color: C.muted,
            border: `1px solid ${C.line}` }}>Voltar</button>
        <strong style={{ fontSize: 15 }}>Oportunidades da cidade</strong>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>ultimos 30 dias</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 14, maxWidth: 780, width: '100%', margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 1.4 }}>
          O que gente procurou na sua regiao e nao encontrou. Desejo que ainda nao virou
          venda — o dado que so a MIAR enxerga.
        </p>

        {!carregado && <div style={{ color: C.muted, fontSize: 14 }}>Buscando sinais…</div>}
        {carregado && erro && <div style={{ color: C.amarelo, fontSize: 14 }}>{erro}</div>}
        {carregado && !erro && oportunidades.length === 0 && (
          <div style={{ color: C.muted, fontSize: 14, padding: 8 }}>
            Ainda nao ha demanda reprimida registrada. Conforme os clientes buscam, aparece aqui.
          </div>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {oportunidades.map((l, i) => (
            <div key={i} style={{ background: C.surface, border: `1px solid ${C.line}`,
              borderLeft: `4px solid ${C.amarelo}`, borderRadius: 14, padding: 14, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.amarelo }}>
                  {NIVEL_ROTULO[l.nivel]}
                </span>
                <span style={{ fontSize: 12, color: C.muted }}>· {l.regiao}</span>
                {l.visitantes > 0 && (
                  <span style={{ fontSize: 11, color: C.ciano, marginLeft: 'auto' }}>
                    {l.visitantes} de fora
                  </span>
                )}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {l.naoEncontrada} {l.naoEncontrada === 1 ? 'pessoa procurou' : 'pessoas procuraram'} “{l.termo}”
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                e nao encontrou oferta cadastrada na regiao.
                {l.encontrada > 0 && ` (${l.encontrada} acharam algo parecido)`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
