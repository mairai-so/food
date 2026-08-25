import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';
import { TRADUCOES, type Idioma } from './traducoes';
import { IDIOMA_BCP47 } from '@workspace/i18n/idioma';

const CHAVE_LOCALSTORAGE = 'miar-idioma';
const CHAVE_LOCALSTORAGE_LEGADA = 'miar-gestor-mobile-idioma';

function idiomaSalvo(): Idioma | null {
  try {
    for (const chave of [CHAVE_LOCALSTORAGE, CHAVE_LOCALSTORAGE_LEGADA]) {
      const salvo = window.localStorage.getItem(chave) as Idioma | null;
      if (salvo && salvo in TRADUCOES) {
        if (chave !== CHAVE_LOCALSTORAGE) window.localStorage.setItem(CHAVE_LOCALSTORAGE, salvo);
        return salvo;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function idiomaPeloNavegador(): Idioma {
  const nav = navigator.language?.toLowerCase() ?? '';

  if (nav.startsWith('gn') || nav.includes('py')) return 'gn';
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('en')) return 'en';
  return 'pt';
}

interface IdiomaContextValue {
  idioma: Idioma;
  setIdioma: (i: Idioma) => void;
  /**
   * Resolve uma chave de tradução com fallback em cascata:
   * idioma atual -> Português -> string vazia (nunca exibe o identificador técnico).
   */
  t: (chave: string) => string;
}

const IdiomaContext = createContext<IdiomaContextValue | null>(null);

export function IdiomaProvider({ children }: { children: ReactNode }) {
  const [idioma, setIdiomaState] = useState<Idioma>(() => idiomaSalvo() ?? idiomaPeloNavegador());

  useEffect(() => {
    const sincronizarIdioma = (event: StorageEvent) => {
      const proximo = event.newValue as Idioma | null;
      if (event.key === CHAVE_LOCALSTORAGE && proximo && proximo in TRADUCOES) {
        setIdiomaState(proximo);
      }
    };
    window.addEventListener('storage', sincronizarIdioma);
    return () => window.removeEventListener('storage', sincronizarIdioma);
  }, []);

  // Se a pessoa ainda NÃO escolheu idioma neste app (nada salvo no
  // localStorage dela), busca o idioma padrão que o estabelecimento
  // definiu no cadastro e usa como ponto de partida — dono pode ser
  // paraguaio, funcionário/cliente brasileiro, cada um ainda pode trocar
  // depois. Se a pessoa já escolheu antes, essa escolha pessoal sempre
  // vence e a busca nem acontece.
  useEffect(() => {
    if (idiomaSalvo()) return; // já tem escolha pessoal, não sobrescreve
    // Só tenta herdar depois de autenticado — a rota exige token porque
    // settings agora é por-restaurante, sem token não tem de qual
    // estabelecimento puxar o idioma padrão.
    let token: string | null = null;
    try { token = window.localStorage.getItem('gestor_token'); } catch { /* ignora */ }
    if (!token) return;
    let cancelado = false;
    fetch('/api/settings/idioma-padrao', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { idiomaPadrao?: Idioma } | null) => {
        if (cancelado || !data?.idiomaPadrao) return;
        if (data.idiomaPadrao in TRADUCOES) setIdiomaState(data.idiomaPadrao);
      })
      .catch(() => { /* sem rede ou API fora — fica no idioma do navegador */ });
    return () => { cancelado = true; };
  }, []);

  const setIdioma = useCallback((i: Idioma) => {
    setIdiomaState(i);
    try {
      window.localStorage.setItem(CHAVE_LOCALSTORAGE, i);
    } catch { /* localStorage indisponível, segue só em memória */ }
  }, []);

  const t = useCallback((chave: string): string => {
    const dicionario = TRADUCOES[idioma];
    const valor = dicionario[chave] ?? TRADUCOES.pt[chave];
    // fallback em Português quando a chave não existe; nunca devolver o
    // identificador técnico (`tela.cadastro.titulo`) ao utilizador
    return valor ?? '';
  }, [idioma]);

  const value = useMemo(() => ({ idioma, setIdioma, t }), [idioma, setIdioma, t]);

  // document.documentElement.lang acompanha a seleção (BCP-47)
  useEffect(() => {
    document.documentElement.lang = IDIOMA_BCP47[idioma];
  }, [idioma]);

  return <IdiomaContext.Provider value={value}>{children}</IdiomaContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(IdiomaContext);
  if (!ctx) {
    throw new Error('useTranslation precisa estar dentro de <IdiomaProvider>');
  }
  return ctx;
}
