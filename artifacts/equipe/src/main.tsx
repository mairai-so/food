import { createRoot } from 'react-dom/client';
import { setExtraHeadersGetter } from '@workspace/api-client-react';
import App from './App';
import './index.css';

// Perímetro de segurança: envia localização GPS em toda chamada
// (reserva caso o Wi-Fi do restaurante não bata)
let _posicaoAtual: string | null = null;
if ('geolocation' in navigator) {
  navigator.geolocation.watchPosition(
    (pos) => { _posicaoAtual = `${pos.coords.latitude},${pos.coords.longitude}`; },
    () => { /* sem permissão: Wi-Fi cobre sozinho */ },
    { enableHighAccuracy: false, maximumAge: 60000 }
  );
}

// Patch global do fetch para injetar token + geo em toda chamada à API
const _origFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const token = localStorage.getItem('miar-equipe-token');
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> ?? {}),
  };
  if (token && !headers['Authorization']) headers['Authorization'] = `Bearer ${token}`;
  if (_posicaoAtual && !headers['X-Miar-Geo']) headers['X-Miar-Geo'] = _posicaoAtual;
  return _origFetch(input, { ...init, headers });
};

// CORRIGIDO (20/08/2026, achado em auditoria) — mesma classe de bug já
// corrigida ontem no Caixa embutido do App Equipe: o app Cozinha standalone
// registra x-loja-id via setExtraHeadersGetter (ver artifacts/cozinha/src/
// main.tsx), mas o Equipe embute a MESMA CozinhaView (via
// @workspace/api-client-react) sem nunca registrar esse getter. O patch
// global de window.fetch acima cobre Authorization/Geo, mas não cobre esse
// mecanismo — o cliente gerado só lê x-loja-id através do
// setExtraHeadersGetter, não do window.fetch. Sem isso, a Cozinha (e
// qualquer outra tela do Equipe que use os hooks gerados em vez de fetch
// manual) nunca informava a loja ativa em contas multi-loja.
setExtraHeadersGetter(() => {
  const headers: Record<string, string> = {};
  const lojaId = window.localStorage.getItem('miar-loja-ativa-id');
  if (lojaId) headers['x-loja-id'] = lojaId;
  return headers;
});

createRoot(document.getElementById('root')!).render(<App />);

// PWA — registra o service worker pra funcionar offline/instalado.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {});
  });
}
