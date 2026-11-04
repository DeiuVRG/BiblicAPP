import type { ExpoConfig } from 'expo/config';

// Base path for static web hosting under a subpath (GitHub Pages project site: "/BiblicAPP").
// Leave unset for local development and root-hosted deployments.
function webBaseUrl(): string | undefined {
  const raw = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? process.env.WEB_BASE_URL;
  if (!raw || raw === '/') return undefined;
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

const baseUrl = webBaseUrl();

// `newArchEnabled` is no longer part of the ExpoConfig type in SDK 58 (the New Architecture is
// the only architecture), but the key is kept explicit as required by the project spec.
const config = {
  newArchEnabled: true,
  name: 'Biblioteca',
  slug: 'biblioteca',
  scheme: 'biblioteca',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'ro.biblioteca.app',
    supportsTablet: true,
  },
  android: {
    package: 'ro.biblioteca.app',
    adaptiveIcon: {
      // The ink of the app (dark palette); the layers are drawn by scripts/generate-icons.mjs.
      backgroundColor: '#222320',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Reading data must not be extractable through `adb backup` or cloud backup.
    allowBackup: false,
  },
  web: {
    // A single-page app: no pre-rendering, so there is no server HTML for the client to hydrate
    // (a build-time light render hydrated under a dark scheme kept the light styles).
    output: 'single',
    lang: 'ro',
    description: 'Cărți vechi, traduse cu grijă.',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        // The paper and ink backgrounds of the app (src/theme/palettes.ts).
        backgroundColor: '#F6F3F2',
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
        dark: {
          backgroundColor: '#222320',
          image: './assets/images/splash-icon-dark.png',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    ...(baseUrl ? { baseUrl } : {}),
  },
} satisfies ExpoConfig & { newArchEnabled: boolean };

export default config as ExpoConfig;
