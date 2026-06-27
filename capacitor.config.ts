import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.authenticator.app',
  appName: 'Authenticator',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    BarcodeScanner: {
      // No extra config needed
    },
  },
};

export default config;
