import { createRoot } from 'react-dom/client';
import { setBaseUrl, setExtraHeadersGetter } from '@workspace/api-client-react';

import App from './App';

import './index.css';

// ─── Configuração de rede ─────────────────────────────────────────────────────
//
// Hierarquia de configuração do servidor de API:
//   1. URL param ?_miar_server=... (vem do QR code de onboarding)
//   2. Variável de ambiente VITE_API_URL (definida no build)
//   3. localStorage miar:local-server (configurado manualmente no app)
//   4. Sem base URL → chamadas relativas /api/... (proxy do Vite em dev)
//
// O modo "local" persiste entre sessões via localStorage.

// 1. URL param — usado quando o admin gera um QR code de onboarding
const params = new URLSearchParams(window.location.search);
const paramServer = params.get('_miar_server');
if (paramServer) {
  localStorage.setItem('miar:local-server', paramServer);
  localStorage.setItem('miar:mode', 'local');
  // Remove o param da URL para não aparecer no histórico
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete('_miar_server');
  window.history.replaceState({}, '', cleanUrl.toString());
}

// 2–4. Resolve a URL efetiva
const mode = localStorage.getItem('miar:mode');
const localServer = localStorage.getItem('miar:local-server');
const resolvedUrl = paramServer ?? import.meta.env.VITE_API_URL ?? (mode === 'local' ? localServer : null);

if (resolvedUrl) {
  setBaseUrl(resolvedUrl);
}

setExtraHeadersGetter(() => {
  const headers: Record<string, string> = {};
  const lojaId = window.localStorage.getItem('miar-loja-ativa-id');
  if (lojaId) headers['x-loja-id'] = lojaId;
  return headers;
});

createRoot(document.getElementById('root')!).render(<App />);

// PWA — registra o service worker pra funcionar offline/instalado.
// Lembrete: base pra evoluir pra APK depois, sem mudar essa peça.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=3`).catch(() => {});
  });
}
