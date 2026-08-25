// Camada fina de acesso à API do caixa.
// Guarda o token do operador e injeta o Authorization em toda chamada.

const TOKEN_KEY = 'miar-caixa-token';
const NAME_KEY = 'miar-caixa-name';

export function getToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY) ?? ''; } catch { return ''; }
}
export function getOperador(): string {
  try { return localStorage.getItem(NAME_KEY) ?? 'Caixa'; } catch { return 'Caixa'; }
}
export function setSessao(token: string, nome: string, remember = true) {
  try {
    const storage = remember ? localStorage : sessionStorage;
    const otherStorage = remember ? sessionStorage : localStorage;
    otherStorage.removeItem(TOKEN_KEY); otherStorage.removeItem(NAME_KEY);
    storage.setItem(TOKEN_KEY, token); storage.setItem(NAME_KEY, nome);
  } catch { /* ignore */ }
}
export function limparSessao() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NAME_KEY);
  } catch { /* ignore */ }
}

function headers(json = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  const t = getToken();
  if (t) h['Authorization'] = `Bearer ${t}`;
  const geo = ultimaLocalizacao();
  if (geo) h['X-Miar-Geo'] = geo;
  // Multi-loja (14/08/2026): identifica qual loja este caixa está operando.
  const lojaId = localStorage.getItem('miar-loja-ativa-id');
  if (lojaId) h['x-loja-id'] = lojaId;
  return h;
}

// Camada de reserva do perímetro de segurança: se o Wi-Fi do restaurante não
// bater (ex.: celular em dados móveis), o servidor aceita a localização do
// GPS dentro de um raio. Guardamos a última posição conhecida em memória —
// se o navegador negar a permissão, simplesmente não manda (o Wi-Fi ainda
// cobre sozinho).
let posicaoAtual: string | null = null;
if (typeof navigator !== 'undefined' && navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (pos) => { posicaoAtual = `${pos.coords.latitude},${pos.coords.longitude}`; },
    () => { /* sem permissão — segue só com o Wi-Fi */ },
    { enableHighAccuracy: false, maximumAge: 60000 }
  );
}
function ultimaLocalizacao(): string | null {
  return posicaoAtual;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { headers: headers(false) });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `POST ${path} → ${res.status}`;
    try { const e = await res.json(); if (e?.error) msg = e.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'PATCH',
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export { formatBRL as brl } from '../lib/currency';
