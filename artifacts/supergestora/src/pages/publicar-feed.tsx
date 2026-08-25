import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Megaphone, Image as ImageIcon, Video, Star, Send, Lock } from 'lucide-react';

/**
 * MIAR AI/FOOD — Gestor · Publicar no Feed
 * O que o ESTABELECIMENTO consegue postar pra se divulgar varia por plano
 * (texto/imagem/vídeo/publicidade). Isso é diferente da descoberta/Top10 do
 * Feed, que é igual em todos os planos e alimentada pelo cliente.
 */

const C = {
  base: 'var(--miar-base, #050F19)',
  surface: 'var(--miar-surface, #0D161D)',
  text: 'var(--miar-text, #F5EEE6)',
  muted: 'var(--miar-muted, #A99FB2)',
  line: 'var(--miar-line, #1E2A34)',
  ciano: 'var(--miar-ciano, #00E6F2)',
};

type MediaType = 'texto' | 'imagem' | 'video' | 'publicidade';
type PlanoMiar = 'tio-do-dog' | 'inicial' | 'intermediario' | 'premium';

const FEED_MEDIA_POR_PLANO: Record<PlanoMiar, MediaType[]> = {
  'tio-do-dog': ['texto'],
  inicial: ['texto', 'imagem'],
  intermediario: ['texto', 'imagem', 'video'],
  premium: ['texto', 'imagem', 'video', 'publicidade'],
};

const PLANO_LABEL: Record<PlanoMiar, string> = {
  'tio-do-dog': 'Tio do Dog',
  inicial: 'Inicial',
  intermediario: 'Intermediário',
  premium: 'Premium',
};

const MEDIA_LABEL: Record<MediaType, { label: string; icon: typeof ImageIcon }> = {
  texto: { label: 'Texto', icon: Megaphone },
  imagem: { label: 'Imagem', icon: ImageIcon },
  video: { label: 'Vídeo', icon: Video },
  publicidade: { label: 'Publicidade', icon: Star },
};

interface FeedPost {
  id: string;
  restaurantName: string;
  mediaType: MediaType;
  title: string;
  content: string;
  mediaUrl?: string;
  emoji: string;
  createdAt: string;
}

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? '';
}

export default function PublicarFeedPage() {
  const [plano, setPlano] = useState<PlanoMiar>('tio-do-dog');
  const [loadingPlano, setLoadingPlano] = useState(true);
  const [mediaType, setMediaType] = useState<MediaType>('texto');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [meusPosts, setMeusPosts] = useState<FeedPost[]>([]);

  const permitidos = FEED_MEDIA_POR_PLANO[plano] ?? FEED_MEDIA_POR_PLANO['tio-do-dog'];

  useEffect(() => {
    const carregar = async () => {
      try {
        const r = await fetch('/api/settings', { headers: { Authorization: `Bearer ${getToken()}` } });
        if (r.ok) {
          const data = await r.json();
          if (data.plano) setPlano(data.plano as PlanoMiar);
        }
      } finally {
        setLoadingPlano(false);
      }
    };
    void carregar();
  }, []);

  // Se o mediaType selecionado deixou de ser permitido (plano mudou), volta pro texto
  useEffect(() => {
    if (!permitidos.includes(mediaType)) setMediaType('texto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plano]);

  const publicar = async () => {
    if (!title.trim() || !content.trim()) {
      setErro('Preencha título e conteúdo do post.');
      return;
    }
    if ((mediaType === 'imagem' || mediaType === 'video') && !mediaUrl.trim()) {
      setErro(`Cole a URL do arquivo de ${mediaType} pra publicar nesse formato.`);
      return;
    }
    setSaving(true);
    setErro('');
    setSucesso(false);
    try {
      const r = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          mediaType,
          title: title.trim(),
          content: content.trim(),
          mediaUrl: mediaUrl.trim() || undefined,
        }),
      });
      if (r.ok) {
        const post = await r.json();
        setMeusPosts((prev) => [post, ...prev]);
        setTitle('');
        setContent('');
        setMediaUrl('');
        setSucesso(true);
        setTimeout(() => setSucesso(false), 3000);
      } else {
        const data = await r.json().catch(() => ({}));
        setErro(data.error ?? 'Não foi possível publicar.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: C.base, minHeight: '100vh', color: C.text }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 40px' }}>
        <Link href="/painel" style={{ fontSize: 13, color: C.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>← Voltar</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Megaphone size={22} color={C.ciano} />
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Publicar no Feed</h1>
        </div>
        <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 20px' }}>
          Seu plano atual{loadingPlano ? '' : `: ${PLANO_LABEL[plano]}`}. A visibilidade e a descoberta no Feed são
          iguais em todos os planos — o que muda por plano é só o formato que você pode postar.
        </p>

        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16 }}>
          {/* seletor de formato */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' as const }}>
            {(Object.keys(MEDIA_LABEL) as MediaType[]).map((mt) => {
              const disponivel = permitidos.includes(mt);
              const Icon = MEDIA_LABEL[mt].icon;
              const ativo = mediaType === mt;
              return (
                <button
                  key={mt}
                  disabled={!disponivel}
                  onClick={() => disponivel && setMediaType(mt)}
                  title={disponivel ? undefined : `Disponível a partir de um plano superior ao ${PLANO_LABEL[plano]}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    border: `1px solid ${ativo ? C.ciano : C.line}`,
                    background: ativo ? 'rgba(0,230,242,0.12)' : 'transparent',
                    color: disponivel ? C.text : C.muted,
                    borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 600,
                    cursor: disponivel ? 'pointer' : 'not-allowed',
                    opacity: disponivel ? 1 : 0.5,
                  }}
                >
                  {disponivel ? <Icon size={14} /> : <Lock size={14} />}
                  {MEDIA_LABEL[mt].label}
                </button>
              );
            })}
          </div>

          {!permitidos.includes('publicidade') && plano !== 'premium' && (
            <p style={{ fontSize: 12, color: C.muted, marginTop: -6, marginBottom: 14 }}>
              Formatos com cadeado exigem upgrade de plano pra publicar.
            </p>
          )}

          <div style={{ display: 'grid', gap: 10 }}>
            <input
              placeholder="Título do post"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />
            <textarea
              placeholder="Conteúdo — o que você quer divulgar"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' as const }}
            />
            {(mediaType === 'imagem' || mediaType === 'video') && (
              <input
                placeholder={`URL do ${mediaType === 'imagem' ? 'arquivo de imagem' : 'arquivo de vídeo'}`}
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                style={inputStyle}
              />
            )}

            {erro && <p style={{ color: '#FF6B6B', fontSize: 13, margin: 0 }}>{erro}</p>}
            {sucesso && <p style={{ color: '#4ADE80', fontSize: 13, margin: 0 }}>Post publicado no Feed!</p>}

            <button
              onClick={() => void publicar()}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: C.ciano, color: '#031018', border: 'none', borderRadius: 10,
                padding: '10px 14px', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Send size={15} />
              {saving ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </div>

        {meusPosts.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 10 }}>Publicados nesta sessão</p>
            <div style={{ display: 'grid', gap: 10 }}>
              {meusPosts.map((p) => (
                <div key={p.id} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{p.title}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>{p.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: 12, color: C.muted, padding: '20px 8px 4px' }}>
          A descoberta e o Top 10 do Feed são gratuitos em todos os planos — não são recurso pago à parte.
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
