// Verificação de Segurança (15/08/2026) — nasceu de uma preocupação real do
// Robson: um caso de wi-fi sem isolamento onde qualquer aparelho na mesma
// rede podia enxergar tráfego de outros. Nenhum app consegue isolar a rede
// de dentro do celular — isso é hardware/configuração do roteador. O que
// esta tela faz de verdade: (1) checklist honesto do que o dono precisa
// configurar no PRÓPRIO roteador, (2) mostra os dispositivos que já
// acessaram a conta, pra detectar acesso estranho.
import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { ShieldCheck, Wifi, Smartphone, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';

interface DeviceInfo {
  deviceId: string;
  label: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

function getToken() { return window.localStorage.getItem('miar-owner-token') ?? ''; }
function getMeuDeviceId() {
  let id = window.localStorage.getItem('miar-device-id');
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem('miar-device-id', id);
  }
  return id;
}
function formatarData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const CHECKLIST = [
  {
    titulo: 'Ative o Isolamento de Cliente (AP Isolation) no roteador',
    texto: 'Impede que um aparelho conectado no wi-fi "veja" outro aparelho na mesma rede. É a configuração que mais protege contra o que aconteceu com a Sônia. Fica nas configurações avançadas do roteador — procure por "AP Isolation", "Isolamento de Cliente" ou "Wireless Isolation".',
  },
  {
    titulo: 'Use uma senha própria, forte, e troque periodicamente',
    texto: 'Evite senhas óbvias ou compartilhadas há anos. Se muita gente já sabe a senha do wi-fi do estabelecimento, é hora de trocar.',
  },
  {
    titulo: 'Separe a rede de clientes da rede do caixa/maquininha',
    texto: 'Se o roteador permitir, crie uma rede de convidados (guest network) separada pro wi-fi que os clientes usam, diferente da rede onde o Caixa, a maquininha e o Gestor operam.',
  },
  {
    titulo: 'Nunca compartilhe a senha da rede operacional (caixa/maquininha) com clientes',
    texto: 'Só a rede de convidados deve ser de acesso público.',
  },
];

export default function SegurancaRede() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const meuDeviceId = getMeuDeviceId();

  useEffect(() => {
    fetch('/api/auth/devices', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then(setDevices)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <Link href="/painel" className="text-sm text-slate-400 hover:text-slate-200">← Voltar</Link>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="h-6 w-6 text-emerald-400" /> Verificação de Segurança
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Nenhum aplicativo consegue proteger sozinho uma rede wi-fi mal configurada — isso é
          ajuste do roteador. Mas o MIAR nunca expõe suas credenciais de pagamento pro app do
          Caixa (só o servidor fala com o Mercado Pago), e aqui embaixo você confere os
          aparelhos que já acessaram sua conta.
        </p>

        <div className="mt-6 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <Wifi className="h-4 w-4" /> Checklist do roteador (fora do MIAR, mas essencial)
          </h2>
          {CHECKLIST.map((item, i) => (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <div className="font-medium">{item.titulo}</div>
                  <p className="mt-1 text-sm text-slate-400">{item.texto}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <Smartphone className="h-4 w-4" /> Dispositivos que já acessaram sua conta
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Não reconhece algum aparelho aqui? Troque sua senha agora.
          </p>
          {loading ? (
            <p className="mt-3 text-sm text-slate-500">Carregando...</p>
          ) : devices.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nenhum registro ainda.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {devices.map((d) => (
                <div key={d.deviceId} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      {d.deviceId === meuDeviceId && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">ESTE APARELHO</span>
                      )}
                      <span className="text-slate-300">{d.label || 'Aparelho desconhecido'}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Primeiro acesso {formatarData(d.firstSeenAt)} · Último acesso {formatarData(d.lastSeenAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 flex items-start gap-2 rounded-xl border border-amber-900/40 bg-amber-950/30 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-sm text-amber-200">
            Isso não substitui as configurações do roteador. É um reforço — a proteção real
            contra o que aconteceu com a Sônia acontece no wi-fi, não dentro de nenhum app.
          </p>
        </div>
      </div>
    </div>
  );
}
