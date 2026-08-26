import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.miarai.food.caixa',
  appName: 'MIAR Caixa',
  webDir: 'dist/public',
  server: { androidScheme: 'https' },
};

export default config;
