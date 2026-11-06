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
  plugins: {
    LiveUpdate: {
      // Télécharge uniquement les fichiers web qui ont changé, puis applique
      // le bundle au prochain démarrage. Rollback automatique si l'app ne
      // signale pas qu'elle est prête dans les 20 secondes (marge pour les
      // téléphones lents qui chargent les données Supabase au démarrage).
      autoBlockRolledBackBundles: true,
      autoDeleteBundles: true,
      readyTimeout: 20000
    }
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
