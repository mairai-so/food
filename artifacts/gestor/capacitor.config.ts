import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.miarai.food.gestor',
  appName: 'MIAR Gestor',
  webDir: 'dist/public',
  server: { androidScheme: 'https' },
};

export default config;
