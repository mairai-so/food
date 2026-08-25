import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { ShieldCheck, MapPin, Wifi, Save, Info, Languages } from 'lucide-react';
import { useTranslation } from '@/i18n/IdiomaContext';
import { SeletorIdioma } from '@/i18n/SeletorIdioma';

function getToken() { return window.localStorage.getItem('miar-owner-token') ?? ''; }

interface Perimetro {
  ativo: boolean;
  aplicarNoGestor: boolean;
  raioMetros: number;
  latitude?: number;
  longitude?: number;
  redesLocaisPermitidas: string[];
}

const PADRAO: Perimetro = {
  ativo: false,
  aplicarNoGestor: false,
  raioMetros: 150,
  redesLocaisPermitidas: [],
};

export default function Seguranca() {
  const { t } = useTranslation();
  const [p, setP] = useState<Perimetro>(PADRAO);
  const [redeTexto, setRedeTexto] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [pegandoGps, setPegandoGps] = useState(false);

  useEffect(() => {
    fetch('/api/settings', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.json())
      .then((s) => {
        const perim = { ...PADRAO, ...(s.perimetro ?? {}) };
        setP(perim);
        setRedeTexto(perim.redesLocaisPermitidas.join(', '));
      })
      .finally(() => setCarregando(false));
  }, []);

  const usarLocalizacaoAtual = () => {
    setPegandoGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setP((prev) => ({ ...prev, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        setPegandoGps(false);
      },
      () => setPegandoGps(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const salvar = async () => {
    setSalvando(true);
    const redes = redeTexto.split(',').map((s) => s.trim()).filter(Boolean);
    const payload: Perimetro = { ...p, redesLocaisPermitidas: redes };
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ perimetro: payload }),
      });
      setP(payload);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <div className="p-6 text-slate-500">Carregando…</div>;

  return (
    <div className="mx-auto max-w-xl p-4 sm:p-6">
      <Link href="/painel" className="mb-4 inline-block text-sm text-slate-400 hover:text-slate-200">← Voltar</Link>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-100">
          ⚙️ {t('config.titulo')}
        </h1>
      </div>

      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <p className="mb-2 flex items-center gap-2 font-semibold text-slate-100">
          <Languages className="h-4 w-4 text-emerald-400" /> {t('config.idioma_titulo')}
        </p>
        <p className="mb-4 text-sm text-slate-400">{t('config.idioma_texto')}</p>
        <SeletorIdioma />
      </div>

      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-100">
          <ShieldCheck className="h-5 w-5 text-violet-400" /> Perímetro de segurança
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Trava o uso do caixa, garçom, cozinha e entregador a "dentro do restaurante".
          Você decide se quer ligar — pode ter um motivo pra não usar.
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div>
          <p className="font-semibold text-slate-100">Ativar perímetro</p>
          <p className="text-sm text-slate-400">Fora do restaurante, os apps da equipe param de funcionar.</p>
        </div>
        <button
          onClick={() => setP((prev) => ({ ...prev, ativo: !prev.ativo }))}
          className={`h-7 w-12 rounded-full transition ${p.ativo ? 'bg-violet-500' : 'bg-slate-700'}`}
        >
          <span className={`block h-5 w-5 translate-x-1 rounded-full bg-white transition ${p.ativo ? 'translate-x-6' : ''}`} />
        </button>
      </div>

      {p.ativo && (
        <>
          <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div>
              <p className="font-semibold text-slate-100">Aplicar no gestor também</p>
              <p className="text-sm text-slate-400">Desligado: você continua acessando de qualquer lugar.</p>
            </div>
            <button
              onClick={() => setP((prev) => ({ ...prev, aplicarNoGestor: !prev.aplicarNoGestor }))}
              className={`h-7 w-12 rounded-full transition ${p.aplicarNoGestor ? 'bg-violet-500' : 'bg-slate-700'}`}
            >
              <span className={`block h-5 w-5 translate-x-1 rounded-full bg-white transition ${p.aplicarNoGestor ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="mb-2 flex items-center gap-2 font-semibold text-slate-100">
              <Wifi className="h-4 w-4 text-cyan-400" /> Rede Wi-Fi do restaurante (principal)
            </p>
            <p className="mb-2 text-sm text-slate-400">
              Prefixo de IP da sua rede local — pergunte ao técnico que instalou o roteador/servidor. Vários, separados por vírgula.
            </p>
            <input
              value={redeTexto}
              onChange={(e) => setRedeTexto(e.target.value)}
              placeholder="Ex.: 192.168.1., 10.0.0."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="mb-2 flex items-center gap-2 font-semibold text-slate-100">
              <MapPin className="h-4 w-4 text-amber-400" /> Localização do restaurante (reserva, via GPS)
            </p>
            <p className="mb-3 text-sm text-slate-400">
              Usada só quando o Wi-Fi não bate (ex.: celular em dados móveis).
            </p>
            <button
              onClick={usarLocalizacaoAtual}
              disabled={pegandoGps}
              className="mb-3 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              {pegandoGps ? 'Obtendo…' : 'Usar minha localização atual (estando no restaurante agora)'}
            </button>
            {p.latitude != null && (
              <p className="mb-3 text-sm text-emerald-400">Local salvo: {p.latitude.toFixed(5)}, {p.longitude?.toFixed(5)}</p>
            )}
            <label className="mb-1 block text-sm text-slate-400">Raio permitido (metros)</label>
            <input
              type="number"
              value={p.raioMetros}
              onChange={(e) => setP((prev) => ({ ...prev, raioMetros: Number(e.target.value) }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-violet-500 focus:outline-none"
            />
          </div>
        </>
      )}

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-400">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>As duas camadas se cobrem: se uma falhar, a outra ainda protege. Sem nenhuma configurada, ninguém entra — configure ao menos uma antes de ativar.</p>
      </div>

      <button
        onClick={() => void salvar()}
        disabled={salvando}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 py-3 font-semibold text-[#0d1b1a] transition hover:bg-violet-400 disabled:opacity-50"
      >
        <Save className="h-4 w-4" /> {salvando ? 'Salvando…' : salvo ? 'Salvo!' : 'Salvar'}
      </button>
    </div>
  );
}
