import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Camera, CheckCircle2, CircleDashed, Search, CarFront, ShieldCheck } from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando atendimento',
  preparing: 'Em preparo',
  ready: 'Pronto para retirada',
  paid: 'Pago',
  completed: 'Concluído',
  delivered: 'Concluído',
};

type DriveThruVehicle = {
  id: string; plate?: string; vehiclePlate?: string;
  status: string;
  mode?: string; source?: string;
  customerName?: string;
  orderId?: string; total?: number;
  notes?: string;
  cameraId?: string;
  createdAt: string;
  updatedAt: string;
  eventLog?: Array<{ at: string; status: string; message: string }>;
};

export default function DriveThruPage() {
  const [plate, setPlate] = useState('ABC1D34');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [vehicles, setVehicles] = useState<DriveThruVehicle[]>([]);
  const [cameraState, setCameraState] = useState<'off' | 'live' | 'error'>('off');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receivedAmounts, setReceivedAmounts] = useState<Record<string, string>>({});

  const token = window.localStorage.getItem('miar-owner-token') ?? '';

  const loadVehicles = async () => {
    const response = await fetch('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const data = (await response.json()) as Array<DriveThruVehicle & { mode?: string }>;
      setVehicles(data.filter((order) => order.mode === 'pickup').map((order) => ({
        ...order,
        orderId: order.id,
        plate: order.vehiclePlate ?? order.plate,
      })));
    }
  };

  useEffect(() => {
    void loadVehicles();
  }, []);

  const onDetect = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/drive-thru/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          plate,
          cameraId: 'camera-1',
          source: 'camera',
          customerName: customerName || undefined,
          notes: notes || undefined,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((body as { error?: string }).error ?? 'Erro ao registrar veículo');
      }
      setCameraState('live');
      setPlate('');
      setCustomerName('');
      setNotes('');
      await loadVehicles();
    } catch (e) {
      setCameraState('error');
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const nextStatus = status === 'completed' ? 'delivered' : status;
    const response = await fetch(`/api/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (response.ok) {
      await loadVehicles();
    }
  };

  const liveVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.status !== 'delivered'), [vehicles]);

  return (
    <div className="min-h-screen bg-slate-950 p-5 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link href="/painel" className="text-sm text-slate-400 hover:text-slate-200">← Voltar</Link>
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">Drive-thru</p>
              <h1 className="text-2xl font-semibold">Operação por veículo e placa</h1>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-300">
              <span className={`h-2.5 w-2.5 rounded-full ${cameraState === 'live' ? 'bg-emerald-400' : cameraState === 'error' ? 'bg-red-400' : 'bg-slate-500'}`} />
              {cameraState === 'live' ? 'Câmera ativa' : cameraState === 'error' ? 'Erro de câmera' : 'Câmera desligada'}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-300">
                <Camera className="h-4 w-4 text-cyan-400" />
                Captura do veículo / leitura da placa
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300 sm:col-span-1">
                  <span>Placa</span>
                  <input value={plate} onChange={(e) => setPlate(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-base text-white" placeholder="ABC1D34" />
                </label>
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm text-cyan-100 sm:col-span-1">
                  Pedidos de retirada aparecem automaticamente aqui a partir do pedido real criado pelo Cliente.
                </div>
                <label className="space-y-2 text-sm text-slate-300 sm:col-span-1">
                  <span>Cliente</span>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-base text-white" placeholder="Fulano" />
                </label>
                <label className="space-y-2 text-sm text-slate-300 sm:col-span-1">
                  <span>Origem</span>
                  <input value="Câmera local" readOnly className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-300" />
                </label>
                <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
                  <span>Observações</span>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-base text-white" placeholder="Ex.: veículo com pedido de 2 itens, pickup, sem pagamento no balcão" />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button disabled={busy} onClick={onDetect} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
                  <Search className="h-4 w-4" />
                  {busy ? 'Registrando...' : 'Identificar veículo'}
                </button>
                <button onClick={() => setCameraState('live')} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200">Simular câmera ligada</button>
              </div>
              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-300">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Regras críticas
              </div>
              <ul className="space-y-3 text-sm text-slate-300">
                <li>• Leitura automática de placa: exige câmera/serviço externo real para OCR/LPR.</li>
                <li>• O sistema consegue capturar imagem da câmera local do navegador.</li>
                <li>• O registro de veículo e evento é isolado por loja.</li>
                <li>• O fluxo usa status do pedido e do veículo para separar atendimentos.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <CarFront className="h-5 w-5 text-cyan-400" />
            Painel operacional do drive-thru
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {liveVehicles.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950 p-6 text-sm text-slate-400 lg:col-span-2 xl:col-span-3">
                Nenhum veículo em fila no momento.
              </div>
            )}

            {liveVehicles.map((vehicle) => (
              <div key={vehicle.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Placa</p>
                    <p className="text-2xl font-bold tracking-[0.22em] text-cyan-300">{vehicle.plate}</p>
                  </div>
                  <div className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300">
                    {STATUS_LABEL[vehicle.status] ?? vehicle.status}
                  </div>
                </div>

                <div className="space-y-2 text-sm text-slate-300">
                  <p><span className="text-slate-500">Cliente:</span> {vehicle.customerName ?? '—'}</p>
                  <p><span className="text-slate-500">Pedido real:</span> {vehicle.orderId ?? '—'}</p>
                  <p><span className="text-slate-500">Total:</span> R$ {(vehicle.total ?? 0).toFixed(2)}</p>
                  <p><span className="text-slate-500">Notas:</span> {vehicle.notes ?? '—'}</p>
                </div>

                {vehicle.status !== 'paid' && vehicle.status !== 'delivered' && (
                  <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <label className="block text-xs font-medium text-amber-200" htmlFor={`received-${vehicle.id}`}>
                      Pagamento em dinheiro antes da chegada
                    </label>
                    <input
                      id={`received-${vehicle.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={receivedAmounts[vehicle.id] ?? ''}
                      onChange={(event) => setReceivedAmounts((current) => ({ ...current, [vehicle.id]: event.target.value }))}
                      placeholder="Quanto o cliente vai pagar"
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                    />
                    {Number(receivedAmounts[vehicle.id]) > 0 && (
                      <p className="mt-2 text-sm text-slate-300">
                        Troco:{' '}
                        <span className="font-semibold text-emerald-300">
                          R$ {Math.max(0, Number(receivedAmounts[vehicle.id]) - (vehicle.total ?? 0)).toFixed(2)}
                        </span>
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {['pending','preparing','ready','paid','completed'].map((status) => (
                    <button
                      key={status}
                      onClick={() => updateStatus(vehicle.id, status)}
                      disabled={status === 'paid' && Number(receivedAmounts[vehicle.id] ?? 0) < (vehicle.total ?? 0)}
                      className={`rounded-full border px-2.5 py-1.5 text-[11px] ${vehicle.status === status ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300' : 'border-slate-700 bg-slate-900 text-slate-300'}`}
                    >
                      {STATUS_LABEL[status] ?? status}
                    </button>
                  ))}
                </div>

                <div className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-400">
                  <p className="mb-2 flex items-center gap-2 font-medium text-slate-300"><CircleDashed className="h-3.5 w-3.5" /> Eventos</p>
                  {vehicle.eventLog?.slice(-3).map((event, idx) => (
                    <div key={`${vehicle.id}-${event.at}-${idx}`} className="mb-2 rounded-lg bg-slate-900 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span>{STATUS_LABEL[event.status] ?? event.status}</span>
                        <span>{new Date(event.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="mt-1 text-slate-400">{event.message}</p>
                    </div>
                  )) ?? <p>Nenhum evento registrado.</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            Estado do fluxo crítico
          </div>
          <div className="grid gap-4 md:grid-cols-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">Câmera local: disponível no navegador.</div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">Leitura automática de placa: depende de OCR/LPR externo.</div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">Veículo + pedido: mapeado no painel operacional por loja.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
