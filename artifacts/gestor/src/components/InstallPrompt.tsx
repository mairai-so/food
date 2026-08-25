import { useEffect, useState } from 'react';
import appIcon from '@/assets/miar-icon.png';

/**
 * MIAR AI/FOOD — Gestor
 * Faixa de primeiro impacto: "Instale o aplicativo".
 * Identidade: fundo escuro, marca em ciano, apetite em magenta.
 * - Android / desktop: usa beforeinstallprompt.
 * - iPhone / iPad: instrucao Compartilhar > Adicionar a Tela de Inicio.
 */

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'miar-install-dismissed';

function isIos(): boolean {
  const ua = window.navigator.userAgent.toLowerCase();
  const iDevice = /iphone|ipad|ipod/.test(ua);
  const iPadOs = ua.includes('mac') && 'ontouchend' in document;
  return iDevice || iPadOs;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);
  const [installMessage, setInstallMessage] = useState('');

  useEffect(() => {
    if (isStandalone()) return;
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    setVisible(true);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener('beforeinstallprompt', onBIP);

    if (isIos()) {
      setShowIosHint(true);
    }
    return () => window.removeEventListener('beforeinstallprompt', onBIP);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(DISMISS_KEY, '1');
  };

  const install = async () => {
    if (!deferred) {
      setInstallMessage('A instalação será disponibilizada pelo navegador quando estiver pronta.');
      return;
    }
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') setVisible(false);
    setDeferred(null);
  };

  return (
    <aside
      role="status"
      aria-label="Instalar o aplicativo MIAR AI/FOOD Gestor"
      style={{
        position: 'fixed',
        zIndex: 9999,
        right: 20,
        bottom: 20,
        width: 'min(calc(100% - 40px), 440px)',
        padding: 20,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ position: 'relative', width: '100%', maxWidth: 440, padding: 28, border: '1px solid rgba(0,230,242,0.35)', borderRadius: 18, background: '#0D161D', color: '#F5EEE6', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
        <img src={appIcon} alt="MIAR AI/FOOD" width={56} height={56} style={{ borderRadius: 14 }} />
        <div style={{ marginTop: 18, fontWeight: 700, fontSize: 20, lineHeight: 1.2, color: '#00E6F2' }}>
          Instale a MIAR neste aparelho
        </div>
        <div style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.45, marginTop: 8 }}>
          Tenha navegação em tela cheia e acesso mais rápido à MIAR.
          {showIosHint && ' No iPhone ou iPad, use Compartilhar e Adicionar à Tela de Início.'}
        </div>
        {installMessage && <div style={{ marginTop: 12, fontSize: 12, color: '#FFD166' }}>{installMessage}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 24 }}>
        <button
          onClick={install}
          style={{
            border: 'none',
            borderRadius: 10,
            padding: '10px 18px',
            fontWeight: 700,
            fontSize: 14,
            background: '#00E6F2',
            color: '#050F19',
            cursor: 'pointer',
          }}
        >
          {deferred ? 'Instalar aplicativo' : 'Como instalar'}
        </button>
          <button onClick={dismiss} style={{ border: '1px solid rgba(245,238,230,0.25)', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 14, background: 'transparent', color: '#F5EEE6', cursor: 'pointer' }}>
            Continuar no navegador
          </button>
        </div>
      </div>
    </aside>
  );
}
