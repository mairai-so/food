import { Languages } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from './IdiomaContext';
import { IDIOMA_LABEL, IDIOMA_BANDEIRA, type Idioma } from './traducoes';
import { IDIOMA_BCP47 } from '@workspace/i18n/idioma';

/**
 * Seletor de idioma.
 *
 * Regras:
 * - o texto do idioma permanece sempre visível; a bandeira é só apoio visual;
 * - Espanhol usa a bandeira de Espanha (🇪🇸), nunca a do Paraguai;
 * - Guarani mantém a bandeira do Paraguai (🇵🇾) como identificação própria;
 * - a escolha é apenas preferência local do utilizador.
 */
export function SeletorIdioma() {
  const { idioma, setIdioma, t } = useTranslation();
  const [aberto, setAberto] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={t('idioma.escolher')}
        aria-expanded={aberto}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500"
      >
        <Languages size={13} aria-hidden="true" />
        <span aria-hidden="true">{IDIOMA_BANDEIRA[idioma]}</span>
        <span>{IDIOMA_LABEL[idioma]}</span>
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div
            role="listbox"
            aria-label={t('idioma.escolher')}
            className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl"
          >
            {(Object.keys(IDIOMA_LABEL) as Idioma[]).map((i) => (
              <button
                key={i}
                type="button"
                role="option"
                aria-selected={i === idioma}
                lang={IDIOMA_BCP47[i]}
                onClick={() => { setIdioma(i); setAberto(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-slate-800 ${
                  i === idioma ? 'bg-slate-800 text-emerald-400' : 'text-slate-200'
                }`}
              >
                <span aria-hidden="true">{IDIOMA_BANDEIRA[i]}</span>
                <span>{IDIOMA_LABEL[i]}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
