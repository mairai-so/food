import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.miarai.food.garcom',
  appName: 'MIAR Garcom',
  webDir: 'dist/public',
  server: { androidScheme: 'https' },
};

export default config;
