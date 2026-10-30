import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'mg.fiaram.nomerika',
  appName: 'FIARAM NUMERIQUE',
  webDir: 'dist',
  // Android app is a web view wrapping the live Cloudflare Pages deployment:
  // every push to the website updates the app automatically, no APK reinstall
  // needed for content changes.
  server: {
    url: 'https://fiaram-nomerika.pages.dev',
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
