// artifacts/gestor/src/pages/convite-entregador.tsx
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Plus, Copy, Check, Trash2, QrCode, Share2, Bike } from 'lucide-react';

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? '';
}

// QR sem dependência: usa serviço de imagem por URL (mesmo padrão do resto do app)
function qrUrl(data: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=1&data=${encodeURIComponent(data)}`;
}

type Convite = {
  id: string;
  token: string;
  accessPath: string;
  active: boolean;
  createdAt: string;
};

export default function ConviteEntregador() {
  const [, setLocation] = useLocation();
  const [convites, setConvites] = useState<Convite[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const base = window.location.origin;
  const urlCompleta = (path: string) => `${base}${path}`;

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch('/api/delivery-invites', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await r.json().catch(() => []);
      if (!r.ok) {
        setErro((data as any)?.error ?? 'Não foi possível carregar os convites.');
        return;
      }
      setConvites(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Falha de conexão.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const gerar = async () => {
    setGerando(true);
    setErro(null);
    try {
      const r = await fetch('/api/delivery-invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({}),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro((data as any)?.error ?? 'Não foi possível gerar o convite.');
        return;
      }
      await carregar();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Falha de conexão.');
    } finally {
      setGerando(false);
    }
  };

  const revogar = async (token: string) => {
    try {
      const r = await fetch(`/api/delivery-invites/${token}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (r.ok) await carregar();
    } catch {
      /* silencioso */
    }
  };

  const copiar = async (texto: string, id: string) => {
    let sucesso = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
        sucesso = true;
      }
    } catch {
      // Usa o fallback abaixo quando o preview não oferece Clipboard API.
    }

    if (!sucesso) {
      const area = document.createElement('textarea');
      area.value = texto;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        sucesso = document.execCommand('copy');
      } finally {
        document.body.removeChild(area);
      }
    }

    if (sucesso) {
      setCopiado(id);
      setTimeout(() => setCopiado(null), 1500);
    } else {
      setErro('Não foi possível copiar automaticamente. Selecione e copie o link exibido.');
    }
  };

  const compartilhar = async (url: string) => {
    const texto = `Você foi convidado como entregador no MIAR AI/FOOD. Acesse: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Convite de entregador', text: texto, url });
        return;
      } catch {
        /* usuário cancelou */
      }
    }
    await copiar(url, 'share');
  };

  const ativos = convites.filter((c) => c.active);

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-3xl">
        <button
          type="button"
          onClick={() => setLocation('/painel')}
          className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
          data-testid="button-voltar-convite"
        >
          <ArrowLeft size={15} />
          Voltar ao painel
        </button>

        <header className="mb-7">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
            <Bike size={20} />
          </div>
          <h1 className="text-3xl font-bold">Convite de entregador</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Entregador só entra no MIAR AI/FOOD por convite. Gere o convite, mande o link ou o QR
            para o entregador. Ele confirma o WhatsApp e entra já vinculado ao seu restaurante.
          </p>
        </header>

        <button
          type="button"
          onClick={gerar}
          disabled={gerando}
          data-testid="button-gerar-convite"
          className="mb-6 flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-violet-400 disabled:opacity-60"
        >
          <Plus size={16} />
          {gerando ? 'Gerando' : 'Gerar novo convite'}
        </button>

        {erro && (
          <p className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {erro}
          </p>
        )}

        {carregando ? (
          <p className="text-sm text-slate-500">Carregando convites.</p>
        ) : ativos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
            <QrCode size={28} className="mx-auto mb-3 text-slate-600" />
            <p className="text-sm text-slate-400">
              Nenhum convite ativo. Gere o primeiro para liberar um entregador.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {ativos.map((convite) => {
              const url = urlCompleta(convite.accessPath);
              return (
                <div
                  key={convite.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="mx-auto shrink-0 rounded-xl bg-white p-2 sm:mx-0">
                      <img
                        src={qrUrl(url)}
                        alt="QR do convite"
                        width={140}
                        height={140}
                        className="h-[140px] w-[140px]"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">
                        Convite ativo
                      </p>
                      <p className="mt-1 break-all text-sm text-slate-300">{url}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Criado em{' '}
                        {new Date(convite.createdAt).toLocaleString('pt-BR')}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => copiar(url, convite.id)}
                          data-testid={`button-copiar-${convite.id}`}
                          className="flex items-center gap-1.5 rounded-lg border border-violet-400/50 bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:border-violet-300 hover:bg-slate-700"
                        >
                          {copiado === convite.id ? (
                            <>
                              <Check size={13} className="text-violet-400" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy size={13} />
                              Copiar link
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => compartilhar(url)}
                          data-testid={`button-compartilhar-${convite.id}`}
                          className="flex items-center gap-1.5 rounded-lg border border-violet-400/50 bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:border-violet-300 hover:bg-slate-700"
                        >
                          <Share2 size={13} />
                          Enviar
                        </button>
                        <button
                          type="button"
                          onClick={() => revogar(convite.token)}
                          data-testid={`button-revogar-${convite.id}`}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-2 text-xs text-red-300 hover:border-red-500/40"
                        >
                          <Trash2 size={13} />
                          Revogar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-xs text-slate-600">
          Revogar um convite bloqueia novos acessos por aquele link. Quem já entrou continua ativo.
        </p>
      </div>
    </div>
  );
}
