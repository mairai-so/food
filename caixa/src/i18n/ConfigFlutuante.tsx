import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { useTranslation } from './IdiomaContext';
import { SeletorIdioma } from './SeletorIdioma';
import { MiarEditaMenu } from '@workspace/api-client-react';

/**
 * Botão fixo de Configurações — hoje só tem idioma dentro, mas é o lugar
 * certo pra crescer (fica no canto, não atrapalha o app operacional).
 * Cada pessoa logada neste app escolhe o próprio idioma aqui, independente
 * de quem usa outro app do ecossistema.
 */
export function ConfigFlutuante() {
  const { t } = useTranslation();
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={t('config.titulo')}
        style={{
          position: 'fixed', bottom: 16, left: 16, zIndex: 40,
          width: 40, height: 40, borderRadius: 999,
          background: 'var(--miar-surface, #0D161D)',
          border: '1px solid var(--miar-line, #1E2A34)',
          color: 'var(--miar-muted, #A99FB2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Settings size={17} />
      </button>

      {aberto && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setAberto(false)}
        >
          <div
            role="dialog"

            aria-modal="true"

            aria-label={t('config.titulo')}

            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 380, margin: '0 auto 16px', marginLeft: 16,
              borderRadius: 16, padding: 16,
              background: 'var(--miar-surface, #0D161D)',
              border: '1px solid var(--miar-line, #1E2A34)',
              color: 'var(--miar-text, #F5EEE6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <strong style={{ fontSize: 14 }}>{t('config.titulo')}</strong>
              <button type="button" onClick={() => setAberto(false)} style={{ color: 'var(--miar-muted, #A99FB2)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--miar-muted, #A99FB2)', marginBottom: 6, fontWeight: 600 }}>{t('config.idioma_titulo')}</p>
            <p style={{ fontSize: 11, color: 'var(--miar-muted, #A99FB2)', marginBottom: 10 }}>{t('config.idioma_texto')}</p>
            <SeletorIdioma />
            <MiarEditaMenu />
          </div>
        </div>
      )}
    </>
  );
}
