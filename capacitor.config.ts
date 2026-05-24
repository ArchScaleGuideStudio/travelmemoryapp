import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.atlas.memoryvault',
  appName: 'Atlas',
  webDir: 'dist',
  server: {
    // For development, set this to your local IP so the app loads from Vite.
    // For production builds, leave undefined so the bundled web assets are used.
    // url: 'http://192.168.1.X:5173',
    // cleartext: true,
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#F6F3EC',
    preferredContentMode: 'mobile',
  },
  android: {
    backgroundColor: '#F6F3EC',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,    // turn on for development only
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#F6F3EC',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DEFAULT',
      backgroundColor: '#F6F3EC',
    },
    Camera: {
      // Permissions are configured in iOS/Android native manifests
      iosPresentationStyle: 'fullscreen',
    },
    Keyboard: {
      resize: 'body',
      style: 'LIGHT',
      resizeOnFullScreen: true,
    },
  },
}

export default config
