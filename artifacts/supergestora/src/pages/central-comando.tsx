import { useState, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';

/**
 * MIAR AI/FOOD — Gestor · Central de Comando
 *
 * Os 4 quadrantes ficam sempre visíveis e sempre "vivos" (nenhum painel é
 * desmontado, então nada perde estado ao trocar de foco). Clicar em
 * "Maximizar" expande aquele painel pra ocupar o espaço inteiro; os outros
 * três encolhem numa faixa fina embaixo, mas continuam ligados — um clique
 * neles volta ao normal. Cada painel tem botões práticos de uso do dia a dia:
 * Tela cheia (Fullscreen real do navegador), Abrir em outra janela (abre o
 * app de verdade numa aba nova, sem limitação de iframe) e Desvincular
 * (abre numa janela solta, pra jogar em outro monitor).
 */

type Modulo = { url: string; nome: string; interno?: boolean };

// Módulos que vivem dentro do próprio gestor (rota relativa) e módulos que
// são outros apps do ecossistema (precisam da URL completa de cada um).
// Em desenvolvimento cada app roda numa porta fixa (ver README-CENTRAL.txt);
// em produção, configure VITE_URL_<APP> no ambiente do gestor.
const urlApp = (env: string | undefined, portaDev: number) =>
  env && env.trim() ? env : `http://localhost:${portaDev}`;

const MODULOS: Modulo[] = [
  { url: '/central-comando', nome: 'Central de pedidos', interno: true },
  { url: '/central-de-lojas', nome: 'Central de Lojas', interno: true },
  { url: urlApp(import.meta.env.VITE_URL_CAIXA, 5174), nome: 'Caixa (PDV)' },
  { url: urlApp(import.meta.env.VITE_URL_COZINHA, 5175), nome: 'Cozinha' },
  { url: urlApp(import.meta.env.VITE_URL_ENTREGADOR, 5176), nome: 'Entregas' },
  { url: urlApp(import.meta.env.VITE_URL_GARCOM, 5177), nome: 'Garçom' },
  { url: urlApp(import.meta.env.VITE_URL_EQUIPE, 5181), nome: 'App da Equipe' },
  { url: urlApp(import.meta.env.VITE_URL_CLIENTE, 5178), nome: 'Experiência do cliente' },
  { url: '/marketing', nome: 'Marketing IA', interno: true },
  { url: '/estoque/auditoria', nome: 'Auditoria de estoque', interno: true },
  { url: '/estoque/codigo-barras', nome: 'Código de barras', interno: true },
  { url: '/socios', nome: 'Sócios', interno: true },
  { url: '/camera-local', nome: 'Câmera', interno: true },
  { url: '/drive-thru', nome: 'Drive-thru', interno: true },
  { url: '/feed', nome: 'Feed interno', interno: true },
  { url: '/mural-empregos', nome: 'Mural de empregos', interno: true },
  { url: '/publicar-feed', nome: 'Publicar no Feed', interno: true },
  { url: '/motor-demanda', nome: 'Oportunidades da cidade', interno: true },
];

const PADRAO = [0, 1, 2, 3]; // Central de pedidos, Caixa, Cozinha, Entregas

export default function CentralComando() {
  const [, setLocation] = useLocation();
  const [sel, setSel] = useState<number[]>(PADRAO);
  const [maximizado, setMaximizado] = useState<number | null>(null);
  const paneRefs = useRef<(HTMLDivElement | null)[]>([]);

  const setPaneModulo = (index: number, modIndex: number) => {
    setSel((prev) => {
      const next = [...prev];
      next[index] = modIndex;
      return next;
    });
  };

  const alternarMaximizar = (i: number) => {
    setMaximizado((atual) => (atual === i ? null : i));
  };

  const telaCheia = useCallback((i: number) => {
    const el = paneRefs.current[i];
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  }, []);

  const abrirOutraJanela = (i: number) => {
    window.open(MODULOS[sel[i]].url, '_blank');
  };

  const desvincular = (i: number) => {
    const modulo = MODULOS[sel[i]];
    window.open(
      modulo.url,
      `miar-${modulo.nome}`,
      'width=900,height=700,left=100,top=100,resizable=yes,scrollbars=yes'
    );
  };

  const btn = (active: boolean): React.CSSProperties => ({
    cursor: 'pointer',
    borderRadius: 999,
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'inherit',
    background: active ? 'var(--miar-ciano, #00E6F2)' : 'var(--miar-surface, #0D161D)',
    color: active ? '#050F19' : 'var(--miar-muted, #A99FB2)',
    border: active ? 'none' : '1px solid var(--miar-line, #1E2A34)',
  });

  const iconBtn: React.CSSProperties = {
    cursor: 'pointer',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    fontFamily: 'inherit',
    background: 'transparent',
    color: 'var(--miar-muted, #A99FB2)',
    border: '1px solid var(--miar-line, #1E2A34)',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        background: 'var(--miar-base, #050F19)', color: 'var(--miar-text, #F5EEE6)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* barra de comando */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          borderBottom: '1px solid var(--miar-line, #1E2A34)', flexWrap: 'wrap',
        }}
      >
        <button onClick={() => setLocation('/painel')} style={{ ...btn(false), padding: '8px 12px' }}>
          Voltar
        </button>
        <strong style={{ fontSize: 15, marginRight: 8 }}>Central de Comando</strong>
        <span style={{ fontSize: 12, color: 'var(--miar-muted, #A99FB2)' }}>
          {maximizado === null ? 'Vendo os 4 ao mesmo tempo' : `Maximizado: ${MODULOS[sel[maximizado]].nome}`}
        </span>
      </div>

      {/* grade: 4 quadrantes sempre montados; o maximizado ocupa tudo, os
          outros encolhem numa faixa fina embaixo (continuam vivos) */}
      <div
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: 8, minHeight: 0,
        }}
      >
        <div
          style={{
            flex: 1, display: 'grid', gap: 8, minHeight: 0,
            gridTemplateColumns: maximizado === null ? '1fr 1fr' : '1fr',
            gridTemplateRows: maximizado === null ? '1fr 1fr' : '1fr',
          }}
        >
          {(maximizado === null ? [0, 1, 2, 3] : [maximizado]).map((i) => (
            <Painel
              key={i}
              index={i}
              modulos={MODULOS}
              modIndex={sel[i]}
              onModuloChange={(m) => setPaneModulo(i, m)}
              onMaximizar={() => alternarMaximizar(i)}
              maximizadoAtivo={maximizado === i}
              onTelaCheia={() => telaCheia(i)}
              onAbrirJanela={() => abrirOutraJanela(i)}
              onDesvincular={() => desvincular(i)}
              btnStyle={iconBtn}
              refCallback={(el) => (paneRefs.current[i] = el)}
            />
          ))}
        </div>

        {/* faixa fina com os outros 3, quando um está maximizado */}
        {maximizado !== null && (
          <div style={{ display: 'flex', gap: 8, height: 96 }}>
            {[0, 1, 2, 3].filter((i) => i !== maximizado).map((i) => (
              <button
                key={i}
                onClick={() => setMaximizado(i)}
                style={{
                  flex: 1, borderRadius: 10, border: '1px solid var(--miar-line, #1E2A34)',
                  background: 'var(--miar-surface, #0D161D)', color: 'var(--miar-muted, #A99FB2)',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                }}
                title="Clique pra trazer este pra frente"
              >
                {MODULOS[sel[i]].nome}
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

function Painel({
  index, modulos, modIndex, onModuloChange, onMaximizar, maximizadoAtivo,
  onTelaCheia, onAbrirJanela, onDesvincular, btnStyle, refCallback,
}: {
  index: number;
  modulos: Modulo[];
  modIndex: number;
  onModuloChange: (m: number) => void;
  onMaximizar: () => void;
  maximizadoAtivo: boolean;
  onTelaCheia: () => void;
  onAbrirJanela: () => void;
  onDesvincular: () => void;
  btnStyle: React.CSSProperties;
  refCallback: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={refCallback}
      style={{
        display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0,
        border: '1px solid var(--miar-line, #1E2A34)', borderRadius: 14,
        overflow: 'hidden', background: 'var(--miar-surface, #0D161D)',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
          borderBottom: '1px solid var(--miar-line, #1E2A34)', flexWrap: 'wrap',
        }}
      >
        <select
          value={modIndex}
          onChange={(e) => onModuloChange(Number(e.target.value))}
          style={{
            flex: 1, minWidth: 100, background: 'var(--miar-base, #050F19)',
            color: 'var(--miar-text, #F5EEE6)', border: '1px solid var(--miar-line, #1E2A34)',
            borderRadius: 8, padding: '6px 8px', fontSize: 13, fontFamily: 'inherit',
          }}
        >
          {modulos.map((m, i) => (
            <option key={m.url + i} value={i}>{m.nome}</option>
          ))}
        </select>
        <button onClick={onMaximizar} style={btnStyle} title={maximizadoAtivo ? 'Restaurar' : 'Maximizar'}>
          {maximizadoAtivo ? '▢ Restaurar' : '⤢ Maximizar'}
        </button>
        <button onClick={onTelaCheia} style={btnStyle} title="Tela cheia">⛶ Tela cheia</button>
        <button onClick={onAbrirJanela} style={btnStyle} title="Abrir em outra aba">↗ Outra aba</button>
        <button onClick={onDesvincular} style={btnStyle} title="Abrir numa janela solta">⧉ Desvincular</button>
      </div>
      <iframe
        title={`Painel ${index + 1}`}
        src={modulos[modIndex].url}
        style={{ flex: 1, width: '100%', border: 'none', background: 'var(--miar-base, #050F19)' }}
      />
    </div>
  );
}
