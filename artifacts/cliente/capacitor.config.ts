import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.miarai.food.cliente',
  appName: 'MIAR Cliente',
  webDir: 'dist/public',
  server: { androidScheme: 'https' },
};

export default config;
