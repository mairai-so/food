import { useEffect, useState, useCallback } from 'react';

/**
 * MIAR AI — tema dia / noite / sistema.
 * Raiz do ecossistema: verde medicina. Noite e a assinatura (fundo escuro + neon).
 * Dia e a versao clara. "Sistema" segue o aparelho.
 * Guarda a escolha em localStorage e aplica a classe no <html>.
 */

export type ThemeMode = 'dia' | 'noite' | 'sistema';
const KEY = 'miar-theme';

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(mode: ThemeMode) {
  const dark = mode === 'noite' || (mode === 'sistema' && systemPrefersDark());
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);
  const theme = dark ? '#050F19' : '#F4FBF7';
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', theme);
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(
    () => (localStorage.getItem(KEY) as ThemeMode) || 'sistema',
  );

  useEffect(() => {
    apply(mode);
    localStorage.setItem(KEY, mode);
    if (mode !== 'sistema') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('sistema');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  const cycle = useCallback(() => {
    setMode((m) => (m === 'dia' ? 'noite' : m === 'noite' ? 'sistema' : 'dia'));
  }, []);

  return { mode, setMode, cycle };
}
