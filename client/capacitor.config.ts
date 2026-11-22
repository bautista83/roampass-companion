import type { CapacitorConfig } from '@capacitor/cli';

// App para celulares (docs/specs/mobile-app.md). La interfaz es el mismo client de React:
// `npm run mobile:sync` lo compila con la API de produccion y lo copia a los proyectos nativos.
//
// CAP_DEV_API (solo para probar en el emulador/celular contra un backend local por http):
// permite contenido mixto y trafico sin cifrar. Nunca se usa para publicar.
const devApi = !!process.env.CAP_DEV_API;

const config: CapacitorConfig = {
  appId: 'com.playroamle.app',
  appName: 'Roamle',
  webDir: 'dist',
  server: {
    // Origen de la app (D12): https://app.playroamle.com en Android y capacitor://app.playroamle.com
    // en iOS. Debe estar en CORS_ORIGIN del servidor y en los hostnames de Turnstile.
    hostname: 'app.playroamle.com',
    androidScheme: 'https',
    ...(devApi && { cleartext: true }),
  },
  android: {
    allowMixedContent: devApi,
  },
  plugins: {
    // Pantalla de borde a borde: el webview respeta viewport-fit=cover (index.html) y la interfaz
    // deja libres el notch y las barras con env(safe-area-inset-*) (ver index.css).
    SystemBars: {
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover',
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#eaf2e6',
      showSpinner: false,
    },
  },
};

export default config;
