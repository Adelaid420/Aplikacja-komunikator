import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.miku.communicator',
  appName: 'Komunikator Miku',
  webDir: '../client/dist',
  server: {
    androidScheme: 'https'
  },
  loggingBehavior: 'production',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 0
    }
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
