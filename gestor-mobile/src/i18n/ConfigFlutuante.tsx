import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import { SeletorIdioma } from './SeletorIdioma';
import { MiarEditaMenu } from '@workspace/api-client-react';
import { useTranslation } from './IdiomaContext';

export function ConfigFlutuante() {
  const { t } = useTranslation();
  const [aberto, setAberto] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        type="button"
        aria-label={t('config.titulo')}
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-100 shadow-lg hover:border-slate-500"
      >
        <Settings2 size={14} />
        <span>{t('config.titulo')}</span>
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('config.titulo')}
          className="mt-2 w-64 rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t('config.idioma_titulo')}</p>
              <p className="mt-1 text-xs text-slate-400">{t('config.idioma_texto')}</p>
            </div>
          </div>
          <SeletorIdioma />
            <MiarEditaMenu />
        </div>
      )}
    </div>
  );
}
