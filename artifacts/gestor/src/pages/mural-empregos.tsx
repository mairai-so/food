import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Briefcase, Plus, X, Pause, Play, Ban, Users, Phone } from 'lucide-react';

/**
 * MIAR AI/FOOD — Gestor · Mural de Empregos
 * Estrutura própria, separada do Feed do Cliente (vagas não se misturam a
 * post de divulgação). Uso é gratuito, sem cobrança adicional em nenhum
 * plano — mesma regra do Feed Interno.
 */

const C = {
  base: 'var(--miar-base, #050F19)',
  surface: 'var(--miar-surface, #0D161D)',
  text: 'var(--miar-text, #F5EEE6)',
  muted: 'var(--miar-muted, #A99FB2)',
  line: 'var(--miar-line, #1E2A34)',
  ciano: 'var(--miar-ciano, #00E6F2)',
};

type VagaStatus = 'ativa' | 'pausada' | 'encerrada';
type VagaTipo = 'efetivo' | 'freela' | 'temporario' | 'meio-periodo';

interface Vaga {
  id: string;
  restaurantId: string;
  restaurantName: string;
  titulo: string;
  descricao: string;
  cargo: string;
  tipo: VagaTipo;
  remuneracao?: string;
  contato: string;
  status: VagaStatus;
  criadoEm: string;
  atualizadoEm: string;
}

interface VagaInteresse {
  id: string;
  vagaId: string;
  nome: string;
  telefone: string;
  mensagem?: string;
  criadoEm: string;
}

const TIPO_LABEL: Record<VagaTipo, string> = {
  efetivo: 'Efetivo',
  freela: 'Freelancer',
  temporario: 'Temporário',
  'meio-periodo': 'Meio período',
};

const STATUS_LABEL: Record<VagaStatus, string> = {
  ativa: 'Ativa',
  pausada: 'Pausada',
  encerrada: 'Encerrada',
};

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? '';
}

const formVazio = { titulo: '', descricao: '', cargo: '', tipo: 'efetivo' as VagaTipo, remuneracao: '', contato: '' };

export default function MuralEmpregosPage() {
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(formVazio);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [vagaExpandida, setVagaExpandida] = useState<string | null>(null);
  const [interesses, setInteresses] = useState<Record<string, VagaInteresse[]>>({});

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/mural-empregos/vagas', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (r.ok) setVagas(await r.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const criarVaga = async () => {
    if (!form.titulo.trim() || !form.descricao.trim() || !form.cargo.trim() || !form.contato.trim()) {
      setErro('Preencha título, descrição, cargo e contato.');
      return;
    }
    setSaving(true);
    setErro('');
    try {
      const r = await fetch('/api/mural-empregos/vagas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      });
      if (r.ok) {
        setForm(formVazio);
        setShowForm(false);
        await load();
      } else {
        const data = await r.json().catch(() => ({}));
        setErro(data.error ?? 'Não foi possível publicar a vaga.');
      }
    } finally {
      setSaving(false);
    }
  };

  const mudarStatus = async (id: string, status: VagaStatus) => {
    const r = await fetch(`/api/mural-empregos/vagas/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ status }),
    });
    if (r.ok) await load();
  };

  const verInteresses = async (vagaId: string) => {
    if (vagaExpandida === vagaId) {
      setVagaExpandida(null);
      return;
    }
    setVagaExpandida(vagaId);
    if (!interesses[vagaId]) {
      const r = await fetch(`/api/mural-empregos/vagas/${vagaId}/interesses`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (r.ok) {
        const data = await r.json();
        setInteresses((prev) => ({ ...prev, [vagaId]: data }));
      }
    }
  };

  return (
    <div style={{ background: C.base, minHeight: '100vh', color: C.text }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 40px' }}>
        <Link href="/painel" style={{ fontSize: 13, color: C.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>← Voltar</Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Briefcase size={22} color={C.ciano} />
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Mural de Empregos</h1>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: C.ciano, color: '#031018',
              border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancelar' : 'Nova vaga'}
          </button>
        </div>

        {showForm && (
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 20 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <input
                placeholder="Título da vaga (ex.: Garçom para fins de semana)"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                style={inputStyle}
              />
              <textarea
                placeholder="Descrição — o que a pessoa vai fazer, horário, requisitos"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' as const }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  placeholder="Cargo (ex.: Garçom, Cozinheiro)"
                  value={form.cargo}
                  onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value as VagaTipo })}
                  style={{ ...inputStyle, flex: 1 }}
                >
                  {Object.entries(TIPO_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  placeholder="Remuneração (opcional)"
                  value={form.remuneracao}
                  onChange={(e) => setForm({ ...form, remuneracao: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  placeholder="Contato (telefone/WhatsApp)"
                  value={form.contato}
                  onChange={(e) => setForm({ ...form, contato: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
              {erro && <p style={{ color: '#FF6B6B', fontSize: 13, margin: 0 }}>{erro}</p>}
              <button
                onClick={() => void criarVaga()}
                disabled={saving}
                style={{
                  background: C.ciano, color: '#031018', border: 'none', borderRadius: 10,
                  padding: '10px 14px', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Publicando...' : 'Publicar vaga'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ color: C.muted, fontSize: 14 }}>Carregando vagas...</p>
        ) : vagas.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 14 }}>Nenhuma vaga publicada ainda.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {vagas.map((v) => (
              <div key={v.id} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{v.titulo}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>
                      {v.cargo} · {TIPO_LABEL[v.tipo]}{v.remuneracao ? ` · ${v.remuneracao}` : ''}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                      background: v.status === 'ativa' ? 'rgba(0,230,242,0.15)' : 'rgba(169,159,178,0.15)',
                      color: v.status === 'ativa' ? C.ciano : C.muted,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {STATUS_LABEL[v.status]}
                  </span>
                </div>
                <p style={{ margin: '8px 0', fontSize: 13, color: C.text, opacity: 0.85 }}>{v.descricao}</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' as const }}>
                  {v.status !== 'pausada' && v.status !== 'encerrada' && (
                    <button onClick={() => void mudarStatus(v.id, 'pausada')} style={actionBtnStyle}>
                      <Pause size={13} /> Pausar
                    </button>
                  )}
                  {v.status === 'pausada' && (
                    <button onClick={() => void mudarStatus(v.id, 'ativa')} style={actionBtnStyle}>
                      <Play size={13} /> Reativar
                    </button>
                  )}
                  {v.status !== 'encerrada' && (
                    <button onClick={() => void mudarStatus(v.id, 'encerrada')} style={actionBtnStyle}>
                      <Ban size={13} /> Encerrar
                    </button>
                  )}
                  <button onClick={() => void verInteresses(v.id)} style={actionBtnStyle}>
                    <Users size={13} /> Candidaturas
                  </button>
                </div>

                {vagaExpandida === v.id && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
                    {!interesses[v.id] || interesses[v.id].length === 0 ? (
                      <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Nenhuma candidatura ainda.</p>
                    ) : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {interesses[v.id].map((i) => (
                          <div key={i.id} style={{ fontSize: 12 }}>
                            <p style={{ margin: 0, fontWeight: 600 }}>{i.nome}</p>
                            <p style={{ margin: '2px 0 0', color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Phone size={11} /> {i.telefone}
                            </p>
                            {i.mensagem && <p style={{ margin: '2px 0 0', color: C.muted }}>{i.mensagem}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* rodape — uso gratuito, sem cobranca adicional em nenhum plano */}
        <div style={{ textAlign: 'center', fontSize: 12, color: C.muted, padding: '16px 8px 4px' }}>
          O Mural de Empregos é gratuito e não gera cobrança adicional, independente do plano contratado.
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: C.base,
  border: `1px solid ${C.line}`,
  borderRadius: 10,
  padding: '10px 12px',
  color: C.text,
  fontSize: 14,
  outline: 'none',
};

const actionBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5, background: 'transparent',
  border: `1px solid ${C.line}`, borderRadius: 8, padding: '6px 10px',
  fontSize: 12, color: C.text, cursor: 'pointer',
};
