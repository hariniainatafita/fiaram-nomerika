import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'mg.fiaram.nomerika',
  appName: 'FIARAM NUMERIQUE',
  webDir: 'dist',
  // Les fichiers web sont embarqués dans l'APK : l'application s'ouvre sans
  // réseau. Les appels API/médias et le manifeste de mise à jour ciblent la
  // plateforme publique via src/lib/appConfig.ts.
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
