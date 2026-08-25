// MIAR Acessibilidade (16/08/2026) — seção 38 do Manual Mestre.
// Guia por voz usa a Web Speech API nativa do navegador (speechSynthesis),
// funciona sem depender de nenhum serviço externo — importante justamente
// pra quem depende dela: não pode falhar por causa de uma API terceira
// fora do ar. Preferência fica salva localmente, persiste entre sessões.

const STORAGE_KEY = 'miar-guia-por-voz';

export function guiaPorVozAtiva(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function definirGuiaPorVoz(ativo: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, ativo ? 'true' : 'false');
  } catch {
    // localStorage indisponível (modo privado, etc.) — não quebra o app,
    // só não persiste a preferência entre sessões.
  }
}

/**
 * Fala um texto em português. Silenciosamente não faz nada se o navegador
 * não suportar (nunca lança erro que quebraria a tela).
 */
export function falar(texto: string): void {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // corta fala anterior, evita empilhar
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch {
    // nunca deixa a narração quebrar o app
  }
}

export function pararFala(): void {
  try {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  } catch {
    // ignora
  }
}

/** Fala automaticamente se o guia por voz estiver ativo — usar nas telas
 * principais pra narrar o conteúdo sem o usuário precisar pedir de novo. */
export function falarSeAtivo(texto: string): void {
  if (guiaPorVozAtiva()) falar(texto);
}
