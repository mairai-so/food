import { useTheme } from '../theme';

/**
 * Botao de tema dia / noite / sistema.
 * Verde medicina (raiz MIAR AI) na acao ativa.
 */
export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  // 'dia' removido temporariamente: componentes usam cores fixas de modo escuro.
  // Reativar após migração para variáveis CSS. (PARTE 3 — OPÇÃO B)
  const opts: { id: 'noite' | 'sistema'; label: string }[] = [
    { id: 'noite', label: 'Noite' },
    { id: 'sistema', label: 'Sistema' },
  ];
  return (
    <div
      role="group"
      aria-label="Tema"
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: 4,
        borderRadius: 999,
        background: 'var(--miar-surface, rgba(127,127,127,0.12))',
        border: '1px solid var(--miar-line, rgba(127,127,127,0.25))',
      }}
    >
      {opts.map((o) => {
        const active = mode === o.id;
        return (
          <button
            key={o.id}
            onClick={() => setMode(o.id)}
            aria-pressed={active}
            style={{
              border: 'none',
              cursor: 'pointer',
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              background: active ? '#00A86B' : 'transparent',
              color: active ? '#FFFFFF' : 'var(--miar-muted, #8A8A8A)',
              transition: 'background .15s',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
