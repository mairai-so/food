import { useEffect, useState, useCallback } from 'react';
import { X, Copy, Check, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getClientToken } from '../lib/storage';

type Estado = 'gerando' | 'pronto' | 'pago' | 'erro';

export default function PagamentoPix({
  valor,
  descricao,
  onFechar,
  onPago,
}: {
  valor: number;
  descricao?: string;
  onFechar: () => void;
  onPago?: (paymentId: string) => void;
}) {
  const [estado, setEstado] = useState<Estado>('gerando');
  const [erro, setErro] = useState('');
  const [qrBase64, setQrBase64] = useState('');
  const [copiaECola, setCopiaECola] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [copiado, setCopiado] = useState(false);

  const gerar = useCallback(async () => {
    setEstado('gerando');
    setErro('');
    setQrBase64('');
    setCopiaECola('');
    setPaymentId('');
    try {
      const clientToken = getClientToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (clientToken) headers['Authorization'] = `Bearer ${clientToken}`;
      const res = await fetch('/api/pix/cobrar', {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount: valor, description: descricao }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string; detalhe?: string };
        throw new Error(data.error || data.detalhe || 'O Pix não está configurado ou não foi possível criar a cobrança.');
      }

      const data = await res.json();
      const temQrReal = typeof data.qrBase64 === 'string' && data.qrBase64.length > 100;
      const temCopia = typeof data.copiaECola === 'string' && data.copiaECola.length > 20;

      if ((data.status !== 'pending' && data.status !== 'approved') || (!temQrReal && !temCopia)) {
        throw new Error('O provedor não confirmou uma cobrança Pix válida. Nenhum pagamento foi criado.');
      }
      if (temQrReal || temCopia) {
        setQrBase64(temQrReal ? data.qrBase64 : '');
        setCopiaECola(temCopia ? data.copiaECola : '');
        setPaymentId(data.paymentId ? String(data.paymentId) : '');
        setEstado('pronto');
      } else {
        throw new Error('O provedor de pagamentos não retornou uma cobrança Pix válida.');
      }
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : 'Não foi possível criar a cobrança Pix.');
      setEstado('erro');
    }
  }, [valor, descricao]);

  useEffect(() => {
    gerar();
  }, [gerar]);

  // Confere pagamento a cada 4s (so faz sentido no caminho real com paymentId)
  useEffect(() => {
    if (estado !== 'pronto' || !paymentId) return;
    const iv = setInterval(async () => {
      try {
        const clientToken = getClientToken();
        const headers: Record<string, string> = {};
        if (clientToken) headers['Authorization'] = `Bearer ${clientToken}`;
        const r = await fetch(`/api/pix/status/${paymentId}`, { headers });
        if (!r.ok) return;
        const d = await r.json();
        if (d?.status === 'approved') {
          setEstado('pago');
          onPago?.(paymentId);
        }
      } catch {}
    }, 4000);
    return () => clearInterval(iv);
  }, [estado, paymentId, onPago]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(copiaECola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl bg-slate-900 p-5 text-slate-100 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Pagar com Pix</h3>
          <button onClick={onFechar} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-400">
          Valor <span className="font-bold text-slate-100">R$ {valor.toFixed(2)}</span>
        </p>

        {estado === 'gerando' && (
          <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Gerando o Pix</span>
          </div>
        )}

        {estado === 'erro' && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-300">
            {erro}
            <button onClick={gerar} className="mt-3 block w-full rounded-xl bg-amber-500 py-2 font-semibold text-slate-950">
              Tentar de novo
            </button>
          </div>
        )}

        {estado === 'pronto' && (
          <div className="flex flex-col items-center gap-4">
            {qrBase64 ? (
              <img
                src={`data:image/png;base64,${qrBase64}`}
                alt="QR code Pix"
                className="h-56 w-56 rounded-2xl bg-white p-2"
              />
            ) : copiaECola ? (
              <div className="rounded-2xl bg-white p-4">
                <QRCodeSVG value={copiaECola} size={216} level="M" />
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-800 p-4 text-center text-xs text-slate-400">
                QR indisponivel. Use o codigo copia-e-cola abaixo.
              </div>
            )}

            <button
              onClick={copiar}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950"
            >
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiado ? 'Codigo copiado' : 'Copiar codigo Pix'}
            </button>

            {copiaECola && (
              <p className="w-full break-all rounded-xl bg-slate-800 p-3 text-[11px] text-slate-400">
                {copiaECola}
              </p>
            )}

            <p className="text-center text-xs text-slate-500">
               Abra o app do seu banco, escaneie o QR ou cole o código. A confirmação só aparece depois que o provedor confirmar o pagamento.
            </p>
          </div>
        )}

        {estado === 'pago' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500">
              <Check className="h-8 w-8 text-slate-950" />
            </div>
            <p className="text-lg font-bold text-emerald-400">Pagamento confirmado</p>
            <button onClick={onFechar} className="mt-2 w-full rounded-xl bg-slate-800 py-3 font-semibold">
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
