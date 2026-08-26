import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.miarai.food.gestor.mobile',
  appName: 'MIAR Gestor Mobile',
  webDir: 'dist/public',
  server: { androidScheme: 'https' },
};

export default config;
