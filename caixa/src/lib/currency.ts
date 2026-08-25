// Formatação de moeda em Real (BRL) — utilitário local pra não repetir
// `new Intl.NumberFormat('pt-BR', ...)` espalhado pelo app.
export function formatBRL(value: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);
}
