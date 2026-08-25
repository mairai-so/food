/**
 * MIAR AI/FOOD — camada partilhada de idioma.
 *
 * Esta lib é a única fonte partilhada de identidade linguística do frontend:
 * códigos oficiais, rótulos, bandeiras e resolução do idioma inicial.
 * Os dicionários completos vivem em cada `traducoes.ts` de cada aplicativo,
 * que importam os símbolos daqui.
 *
 * Códigos: pt (Português, padrão), es (Español), gn (Guarani), en (English).
 * O Guarani é uma língua nativa da região de Pedro Juan Caballero e recebe
 * tratamento de primeira classe — nunca como tradução secundária.
 */

export type Idioma = 'pt' | 'es' | 'gn' | 'en';

export const IDIOMAS_ORDENADOS: Idioma[] = ['pt', 'es', 'gn', 'en'];

export const IDIOMA_LABEL: Record<Idioma, string> = {
  pt: 'Português',
  es: 'Español',
  gn: 'Guarani',
  en: 'English',
};

export const IDIOMA_BANDEIRA: Record<Idioma, string> = {
  pt: '🇧🇷',
  es: '🇪🇸', // España — a bandeira do Paraguai pertence somente ao Guarani
  gn: '🇵🇾',
  en: '🇺🇸',
};

/**
 * BCP-47 correspondente a cada idioma da aplicação.
 * `pt` usa `pt-BR` porque a voz da marca e o texto do produto são
 * em Português do Brasil.
 */
export const IDIOMA_BCP47: Record<Idioma, string> = {
  pt: 'pt-BR',
  es: 'es',
  gn: 'gn',
  en: 'en',
};

export function isIdioma(value: string | null | undefined): value is Idioma {
  return !!value && value in IDIOMA_LABEL;
}

/**
 * Resolve o idioma inicial a partir da preferência do navegador,
 * com fallback seguro para Português quando não há preferência detectada.
 */
export function resolveIdiomaPeloNavegador(nav?: string): Idioma {
  const locale = (nav ?? navigator.language ?? '').toLowerCase();

  if (locale.startsWith('gn') || locale.includes('py')) return 'gn';
  if (locale.startsWith('es')) return 'es';
  if (locale.startsWith('en')) return 'en';
  return 'pt';
}

/**
 * Atualiza `document.documentElement.lang` com o código BCP-47 do idioma.
 */
export function aplicarLangDocumento(idioma: Idioma): void {
  try {
    document.documentElement.lang = IDIOMA_BCP47[idioma];
  } catch {
    // fora do browser (SSR/testes) — ignora
  }
}

/**
 * Verifica a saúde dos dicionários de um aplicativo:
 * - `ausentes`: chaves de `pt` que faltam num idioma-alvo;
 * - `pendentes`: chaves cujo valor ainda está em Português fora do idioma `pt`;
 * - `duplicadas`: chaves repetidas dentro do mesmo idioma.
 */
export interface AuditoriaIdiomas {
  ausentes: Record<Idioma, string[]>;
  pendentes: Record<Idioma, string[]>;
  duplicadas: Record<Idioma, string[]>;
}

/**
 * Palavras cuja grafia é legítima e idêntica em Português e Espanhol
 * (e, por extensão, aceites em Guarani/Inglês quando coincidem).
 * A auditoria não as trata como "ainda em Português".
 */
export const GRAFIA_IGUAL_PT_ES: string[] = [
  'Confirmar', 'Confirmar…', 'Confirmando…', 'Confirmando...', 'Enviando...', 'Enviando…', 'Total', 'Subtotal', 'Feed', 'Mensagem',
  'Mensagens', 'Reserva', 'Reservas', 'Menu', 'Idioma', 'Salão', 'Salon',
  'Salón', 'Salone', 'Email', 'E-mail', 'Correio', 'Login', 'Senha',
  'Cancel', 'Cancelar', 'Confirmar reserva', 'item(s)', 'MIAR', 'Confirm', 'All', 'Buscar', 'Total:', 'Total/GN',
];

export function auditarDicionario(
  traducoes: Record<Idioma, Record<string, string>>,
  alvos: Idioma[] = ['es', 'gn', 'en'],
): AuditoriaIdiomas {
  const chavesPt = Object.keys(traducoes.pt);
  const ausentes: Record<string, string[]> = {};
  const pendentes: Record<string, string[]> = {};
  const duplicadas: Record<string, string[]> = {};

  for (const alvo of alvos) {
    const dicionario = traducoes[alvo];
    const chaves = Object.keys(dicionario);
    ausentes[alvo] = chavesPt.filter((k) => !(k in dicionario));
    pendentes[alvo] = chaves.filter((k) => {
      const valorPt = traducoes.pt[k];
      const valorAlvo = dicionario[k];
      if (valorAlvo !== valorPt || !chavesPt.includes(k)) return false;
      // símbolos de placeholder (••••••) não são "português"
      if (/^[•●·\s]+$/.test(valorAlvo)) return false;
      // grafias legítimas idênticas em pt/es
      if (GRAFIA_IGUAL_PT_ES.includes(valorAlvo)) return false;
      return true;
    });
    const vistas = new Set<string>();
    const repetidas: string[] = [];
    for (const k of chaves) {
      if (vistas.has(k)) repetidas.push(k);
      vistas.add(k);
    }
    duplicadas[alvo] = repetidas;
  }
  duplicadas.pt = [];

  return { ausentes, pendentes, duplicadas } as AuditoriaIdiomas;
}
