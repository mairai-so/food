import { useState } from 'react';
import { useLocation } from 'wouter';

/**
 * MIAR AI/FOOD — Gestor · Feed interno
 * Mural de avisos da casa. Dois tipos que NAO se misturam:
 *  - OPERACAO (voz do comando): ciano. Ex "abrimos em 10 min", "acabou arroz".
 *  - NOTA DE MESA (pendencia): amarelo. Amarra numa mesa e some quando a mesa fecha.
 * Cada aviso sai POR CHAVE (quem recebe cada tipo se define no cadastro do funcionario).
 * Notificacao chega no celular; a pessoa bate pra CONFIRMAR que leu — da pra ver quem viu.
 * Filtro de palavrao em duas camadas: lista base + palavras que o dono trava.
 * Identidade travada: nada gira, sem palavra banida, uma cor um sentido.
 */

// ---- cores da identidade (lei) ----
const C = {
  base: 'var(--miar-base, #050F19)',
  surface: 'var(--miar-surface, #0D161D)',
  text: 'var(--miar-text, #F5EEE6)',
  muted: 'var(--miar-muted, #A99FB2)',
  line: 'var(--miar-line, #1E2A34)',
  ciano: 'var(--miar-ciano, #00E6F2)',   // OPERACAO / comando
  amarelo: '#FFB020',                     // NOTA DE MESA / pendencia
};

type Tipo = 'operacao' | 'mesa';

type Aviso = {
  id: string;
  tipo: Tipo;
  autor: string;
  texto: string;
  mesa?: number;        // so quando tipo === 'mesa'
  criadoEm: number;
  leram: string[];      // nomes de quem confirmou leitura
  fechado?: boolean;    // nota de mesa some quando true
};

// ---- filtro de palavrao (camada base; a lista do dono soma a esta) ----
const PALAVRAS_BASE = [
  'merda', 'porra', 'caralho', 'buceta', 'foder', 'fodase', 'puta',
  'viado', 'cuzao', 'corno', 'desgraca', 'arrombado', 'otario',
];

function cobrir(palavra: string) {
  return '*'.repeat(palavra.length);
}

function limpar(texto: string, extras: string[]) {
  const lista = [...PALAVRAS_BASE, ...extras.map((p) => p.trim().toLowerCase()).filter(Boolean)];
  return texto
    .split(/(\s+)/)
    .map((tok) => {
      const nu = tok.toLowerCase().replace(/[^a-zà-ú0-9]/gi, '');
      return lista.includes(nu) ? cobrir(tok) : tok;
    })
    .join('');
}

// quem sou eu agora (na demo, alterna pra mostrar leitura de outra pessoa)
const EQUIPE = ['Voce', 'Ana', 'Bruno', 'Caixa', 'Cozinha'];

export default function FeedInterno() {
  const [, setLocation] = useLocation();

  const [avisos, setAvisos] = useState<Aviso[]>([
    {
      id: 'a1', tipo: 'operacao', autor: 'Caixa',
      texto: 'Abrimos o salao em 10 minutos, tudo pronto na frente.',
      criadoEm: Date.now() - 1000 * 60 * 6, leram: ['Ana'],
    },
    {
      id: 'a2', tipo: 'mesa', autor: 'Ana', mesa: 8,
      texto: 'Mesa 8 esta impaciente, tratar com jeito e agilizar a bebida.',
      criadoEm: Date.now() - 1000 * 60 * 2, leram: [],
    },
  ]);

  const [eu, setEu] = useState('Voce');
  const [tipo, setTipo] = useState<Tipo>('operacao');
  const [texto, setTexto] = useState('');
  const [mesa, setMesa] = useState('');
  const [travadas, setTravadas] = useState<string[]>(['brasao']); // exemplo: dono trava um nome
  const [novaTravada, setNovaTravada] = useState('');

  const acento = tipo === 'operacao' ? C.ciano : C.amarelo;

  const publicar = () => {
    const t = texto.trim();
    if (!t) return;
    if (tipo === 'mesa' && !mesa.trim()) return;
    const novo: Aviso = {
      id: 'a' + Date.now(),
      tipo,
      autor: eu,
      texto: limpar(t, travadas),
      mesa: tipo === 'mesa' ? Number(mesa) : undefined,
      criadoEm: Date.now(),
      leram: [eu], // quem escreve ja leu
    };
    setAvisos((prev) => [novo, ...prev]);
    setTexto('');
    setMesa('');
  };

  const confirmarLeitura = (id: string) => {
    setAvisos((prev) =>
      prev.map((a) =>
        a.id === id && !a.leram.includes(eu) ? { ...a, leram: [...a.leram, eu] } : a
      )
    );
  };

  const fecharMesa = (id: string) => {
    setAvisos((prev) => prev.map((a) => (a.id === id ? { ...a, fechado: true } : a)));
  };

  const addTravada = () => {
    const p = novaTravada.trim().toLowerCase();
    if (!p || travadas.includes(p)) return;
    setTravadas((prev) => [...prev, p]);
    setNovaTravada('');
  };

  const quando = (ms: number) => {
    const min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `ha ${min} min`;
    return `ha ${Math.round(min / 60)} h`;
  };

  const visiveis = avisos.filter((a) => !(a.tipo === 'mesa' && a.fechado));

  const input: React.CSSProperties = {
    background: C.base, color: C.text, border: `1px solid ${C.line}`,
    borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', width: '100%',
  };
  const chip = (on: boolean, cor: string): React.CSSProperties => ({
    cursor: 'pointer', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 700,
    fontFamily: 'inherit', background: on ? cor : C.surface, color: on ? '#050F19' : C.muted,
    border: on ? 'none' : `1px solid ${C.line}`,
  });

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      background: C.base, color: C.text, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* barra */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        borderBottom: `1px solid ${C.line}`, flexWrap: 'wrap' }}>
        <button onClick={() => setLocation('/painel')} style={{ ...chip(false, C.ciano), padding: '8px 12px' }}>Voltar</button>
        <strong style={{ fontSize: 15 }}>Feed interno</strong>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>Voce esta como:</span>
        <select value={eu} onChange={(e) => setEu(e.target.value)}
          style={{ ...input, width: 'auto', padding: '6px 10px', fontSize: 13 }}>
          {EQUIPE.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'grid', gap: 14,
        gridTemplateColumns: 'minmax(0,1fr)', maxWidth: 780, width: '100%', margin: '0 auto' }}>

        {/* escrever */}
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 14,
          display: 'grid', gap: 10, borderTop: `3px solid ${acento}` }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={chip(tipo === 'operacao', C.ciano)} onClick={() => setTipo('operacao')}>Aviso de operacao</button>
            <button style={chip(tipo === 'mesa', C.amarelo)} onClick={() => setTipo('mesa')}>Nota de mesa</button>
          </div>
          {tipo === 'mesa' && (
            <input value={mesa} onChange={(e) => setMesa(e.target.value.replace(/\D/g, ''))}
              placeholder="Numero da mesa" inputMode="numeric" style={input} />
          )}
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2}
            placeholder={tipo === 'operacao' ? 'Recado pra equipe' : 'O que a equipe precisa saber dessa mesa'}
            style={{ ...input, resize: 'vertical' }} />
          <button onClick={publicar}
            style={{ ...chip(true, acento), padding: '11px 16px', fontSize: 15, justifySelf: 'end' }}>
            Publicar
          </button>
        </div>

        {/* lista */}
        <div style={{ display: 'grid', gap: 10 }}>
          {visiveis.length === 0 && (
            <div style={{ color: C.muted, fontSize: 14, padding: 8 }}>Nenhum aviso no mural.</div>
          )}
          {visiveis.map((a) => {
            const cor = a.tipo === 'operacao' ? C.ciano : C.amarelo;
            const jaLi = a.leram.includes(eu);
            return (
              <div key={a.id} style={{ background: C.surface, border: `1px solid ${C.line}`,
                borderLeft: `4px solid ${cor}`, borderRadius: 14, padding: 12, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.muted }}>
                  <span style={{ color: cor, fontWeight: 800 }}>
                    {a.tipo === 'operacao' ? 'OPERACAO' : `MESA ${a.mesa}`}
                  </span>
                  <span>· {a.autor}</span>
                  <span style={{ marginLeft: 'auto' }}>{quando(a.criadoEm)}</span>
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.35 }}>{a.texto}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: C.muted }}>
                    {a.leram.length} leu{a.leram.length > 0 ? `: ${a.leram.join(', ')}` : ''}
                  </span>
                  {!jaLi && (
                    <button onClick={() => confirmarLeitura(a.id)}
                      style={{ ...chip(true, cor), padding: '7px 14px', fontSize: 13 }}>
                      Confirmar leitura
                    </button>
                  )}
                  {jaLi && <span style={{ fontSize: 12, color: cor, fontWeight: 700 }}>Voce leu</span>}
                  {a.tipo === 'mesa' && (
                    <button onClick={() => fecharMesa(a.id)}
                      style={{ marginLeft: 'auto', cursor: 'pointer', background: 'transparent',
                        color: C.muted, border: `1px solid ${C.line}`, borderRadius: 999,
                        padding: '7px 14px', fontSize: 13, fontFamily: 'inherit' }}>
                      Mesa fechou
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* palavras travadas do dono */}
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 14, display: 'grid', gap: 10 }}>
          <strong style={{ fontSize: 14 }}>Palavras travadas</strong>
          <span style={{ fontSize: 12, color: C.muted }}>
            Palavrao ja vira asterisco sozinho. Aqui o dono soma as palavras que quer travar nesta casa.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={novaTravada} onChange={(e) => setNovaTravada(e.target.value)}
              placeholder="Palavra pra travar" style={input}
              onKeyDown={(e) => { if (e.key === 'Enter') addTravada(); }} />
            <button onClick={addTravada} style={{ ...chip(true, C.ciano), padding: '10px 16px' }}>Travar</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {travadas.map((p) => (
              <span key={p} style={{ fontSize: 12, color: C.text, background: C.base,
                border: `1px solid ${C.line}`, borderRadius: 999, padding: '5px 10px' }}>
                {p}
                <button onClick={() => setTravadas((prev) => prev.filter((x) => x !== p))}
                  style={{ marginLeft: 6, cursor: 'pointer', background: 'transparent', color: C.muted,
                    border: 'none', fontFamily: 'inherit', fontSize: 13 }}>×</button>
              </span>
            ))}
          </div>
        </div>

        {/* rodape — uso gratuito, sem cobranca adicional em nenhum plano */}
        <div style={{ textAlign: 'center', fontSize: 12, color: C.muted, padding: '4px 8px 12px' }}>
          O Feed interno é gratuito e não gera cobrança adicional, independente do plano contratado.
        </div>
      </div>
    </div>
  );
}
