import { createRoot } from 'react-dom/client';
import { setBaseUrl, setExtraHeadersGetter } from '@workspace/api-client-react';

import App from './App';

import './index.css';

// Aponta as chamadas de API para o endereço do backend (api-server).
// Em desenvolvimento, se VITE_API_URL não estiver definido, as chamadas
// relativas (/api/...) são encaminhadas pelo proxy do Vite (ver vite.config.ts).
const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(apiUrl);
}

// Perímetro de segurança física: reserva de GPS caso o Wi-Fi do restaurante
// não seja suficiente. Se o navegador negar a permissão, nenhum header é
// enviado e o servidor cai de volta só na verificação de rede Wi-Fi.
let _posicaoAtual: string | null = null;
if (typeof navigator !== 'undefined' && navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (pos) => { _posicaoAtual = `${pos.coords.latitude},${pos.coords.longitude}`; },
    () => { /* sem permissão — continua só com o Wi-Fi */ },
    { enableHighAccuracy: false, maximumAge: 60_000 },
  );
}
setExtraHeadersGetter(() => {
  const headers: Record<string, string> = {};
  if (_posicaoAtual) headers['X-Miar-Geo'] = _posicaoAtual;
  // Multi-loja (14/08/2026): identifica qual loja este dispositivo opera.
  const lojaId = window.localStorage.getItem('miar-loja-ativa-id');
  if (lojaId) headers['x-loja-id'] = lojaId;
  return headers;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(<App />);
