import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';

import './index.css';

// Aponta as chamadas de API para o endereço do backend (api-server).
// Em desenvolvimento, se VITE_API_URL não estiver definido, as chamadas
// relativas (/api/...) são encaminhadas pelo proxy do Vite (ver vite.config.ts).
const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(apiUrl);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(<App />);
