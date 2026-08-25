// artifacts/gestor/src/pages/pos-cadastro.tsx
// Tela pós-cadastro: boas-vindas dramáticas e início da Jornada de Configuração.
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowRight, Rocket } from 'lucide-react';
import { useGetMe } from '@workspace/api-client-react';

export default function PosCadastro() {
  const [, setLocation] = useLocation();
  const { data: me } = useGetMe();
  const [contagemIniciou, setContagemIniciou] = useState(false);

  // Após 400ms começa a contagem visual, auto-redireciona em 3.5s
  useEffect(() => {
    const t1 = setTimeout(() => setContagemIniciou(true), 400);
    const t2 = setTimeout(() => setLocation('/jornada'), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [setLocation]);

  const nome = me?.name ?? me?.restaurantName ?? 'Bem-vindo';

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-6 text-slate-100">
      {/* Fundo gradiente sutil */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_120%,rgba(124,58,237,0.12),transparent)]" />

      {/* Anel animado */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'backOut' }}
        className="relative mb-8 flex h-28 w-28 items-center justify-center"
      >
        {/* Anel pulsante */}
        <motion.div
          animate={{ scale: [1, 1.18, 1], opacity: [0.3, 0.1, 0.3] }}
          transition={{ duration: 2.4, repeat: Infinity }}
          className="absolute inset-0 rounded-full bg-violet-500/20"
        />
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.25, 0.08, 0.25] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: 0.4 }}
          className="absolute inset-[-16px] rounded-full bg-violet-400/10"
        />
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-violet-500/15 text-6xl shadow-2xl shadow-violet-500/20">
          🚀
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        className="text-center"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.4em] text-violet-400">
          Conta ativa
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          {nome},<br />seu Miar está de pé!
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
          Agora vamos configurar seu restaurante em menos de 5 minutos. Segmento, cardápio e equipe — tudo guiado.
        </p>
      </motion.div>

      {/* Barra de progresso automática */}
      {contagemIniciou && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mt-10 w-full max-w-xs"
        >
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 3.1, ease: 'linear' }}
              className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400"
            />
          </div>
          <p className="mt-2 text-center text-xs text-slate-600">
            Iniciando configuração automaticamente…
          </p>
        </motion.div>
      )}

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        type="button"
        onClick={() => setLocation('/jornada')}
        className="mt-8 flex items-center gap-2 rounded-2xl bg-violet-600 px-8 py-4 text-base font-bold text-[#0d1b1a] shadow-lg shadow-violet-500/20 transition hover:bg-violet-500 active:scale-[0.97]"
      >
        Configurar agora <ArrowRight className="h-5 w-5" />
      </motion.button>

      <p className="mt-4 text-xs text-slate-700">
        Você também pode fazer isso depois no painel.
      </p>
    </div>
  );
}
