// Multi-Loja (14/08/2026) — loja ativa selecionada pelo gestor.
// Contas de loja única nunca precisam mexer nisso: o backend resolve
// automaticamente pra "Loja Principal" quando nenhum header é mandado.

const CHAVE = "miar-loja-ativa-id";

export function getLojaAtivaId(): string | null {
  return window.localStorage.getItem(CHAVE);
}

export function setLojaAtivaId(id: string): void {
  window.localStorage.setItem(CHAVE, id);
}

/** Espalha no objeto de headers de qualquer fetch: { ...headers, ...lojaHeaders() } */
export function lojaHeaders(): Record<string, string> {
  const id = getLojaAtivaId();
  return id ? { "x-loja-id": id } : {};
}

export interface Loja {
  id: string;
  nome: string;
  endereco?: string;
  ativa: boolean;
  padrao: boolean;
  criadaEm: string;
}
