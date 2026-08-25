/**
 * MIAR AI/FOOD — Cozinha · Dicionário de idiomas
 *
 * Mesma lógica do app Cliente: cada pessoa que usa este app escolhe o
 * próprio idioma, independente do que o cliente final vê no app dele.
 * Ex.: dono pode ser paraguaio (espanhol/guarani), funcionário brasileiro
 * (português) — cada um configura o seu em Configurações.
 *
 * Cobertura desta rodada: navegação e tela de Configurações. Resto das
 * telas deste app segue em português até a próxima rodada de tradução —
 * volume de string por tela, não limitação técnica.
 */

export type Idioma = "pt" | "es" | "gn" | "en";

export const IDIOMA_LABEL: Record<Idioma, string> = {
  pt: "Português",
  es: "Español",
  gn: "Guarani",
  en: "English",
};

export const IDIOMA_BANDEIRA: Record<Idioma, string> = {
  pt: "🇧🇷",
  es: "🇪🇸",
  gn: "🇵🇾",
  en: "🇺🇸",
};

type Dicionario = Record<string, string>;

export const TRADUCOES: Record<Idioma, Dicionario> = {
  pt: {
    "nav.painel": "Painel",
    "nav.sair": "Sair",
    "config.titulo": "Configurações",
    "config.idioma_titulo": "Idioma",
    "config.idioma_texto": "Escolha o idioma deste app. É só seu — não muda o que outras pessoas veem.",
    "idioma.escolher": "Escolher idioma",
    "idioma.padrao": "Idioma padrão do Gestor",
  },
  es: {
    "nav.painel": "Panel",
    "nav.sair": "Salir",
    "config.titulo": "Configuración",
    "config.idioma_titulo": "Lenguaje",
    "config.idioma_texto": "Elegí el idioma de esta app. Es solo tuyo — no cambia lo que ven las demás personas.",
    "idioma.escolher": "Elegir idioma",
    "idioma.padrao": "Idioma predeterminado del Gestor",
  },
  gn: {
    "nav.painel": "Rogaguata",
    "nav.sair": "Esẽ",
    "config.titulo": "Ñemboheko",
    "config.idioma_titulo": "Ñe'ẽ",
    "config.idioma_texto": "Eiporavo ko app-pe g̃uarã ñe'ẽ. Nde reheguánte — ndojehe'ái ambuekuéra ohechávare.",
    "idioma.escolher": "Eiporavo ñe'ẽ",
    "idioma.padrao": "Gestor ñe'ẽ reko",
  },
  en: {
    "nav.painel": "Dashboard",
    "nav.sair": "Sign out",
    "config.titulo": "Settings",
    "config.idioma_titulo": "Language",
    "config.idioma_texto": "This app follows the Gestor default until its user chooses a personal language here.",
    "idioma.escolher": "Choose language",
    "idioma.padrao": "Use Gestor default",
  },
};
