const IS_DEV = process.env.APP_VARIANT === 'development';

/**
 * Plugin Sentry, aggiunto SOLO quando org e progetto sono noti.
 *
 * Serve al caricamento delle source map durante la build EAS: senza, gli errori
 * arrivano lo stesso ma con stack trace illeggibili (nomi di funzione di una
 * lettera, righe del bundle). Non c'entra col DSN, che è a runtime.
 *
 * È condizionale perché `expo start` in locale non ha queste variabili, e un
 * plugin che pretende una configurazione assente farebbe fallire l'avvio a chi
 * sta solo sviluppando. `SENTRY_AUTH_TOKEN` non compare qui: lo legge il plugin
 * dall'ambiente della build, e va messo fra i secret EAS — mai in un file
 * versionato.
 */
const sentryPlugin =
  process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? [
        [
          '@sentry/react-native',
          {
            organization: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
          },
        ],
      ]
    : [];

export default {
  expo: {
    name: IS_DEV ? "Gimmick Dev" : "Gimmick",
    slug: "gimmick",
    version: "1.0.0",
    orientation: "portrait",
    icon: IS_DEV ? "./assets/icon-dev.png" : "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    scheme: IS_DEV ? "gimmick-dev" : "gimmick",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#1E1E1E"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_DEV ? "com.gimmick.dev" : "com.gimmick.app",
      infoPlist: {
        NSCameraUsageDescription: "Gimmick needs camera access to capture photos",
        NSMicrophoneUsageDescription: "Gimmick needs microphone access to record audio",
        NSPhotoLibraryUsageDescription: "Gimmick needs photo library access to select images",
        NSSpeechRecognitionUsageDescription: "Gimmick usa il riconoscimento vocale per dettare le note."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: IS_DEV ? "./assets/adaptive-icon-dev.png" : "./assets/adaptive-icon.png",
        backgroundColor: IS_DEV ? "#000000" : "#ffffff"
      },
      package: IS_DEV ? "com.gimmick.dev" : "com.gimmick.app",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.MODIFY_AUDIO_SETTINGS"
      ],
      edgeToEdgeEnabled: true,
      // Esplicito, non implicito: con edge-to-edge attivo è questo che fa
      // rimpicciolire la finestra all'apertura della tastiera invece di
      // lasciarla coprire i campi. Le form (login in testa) si appoggiano a
      // questo comportamento più uno ScrollView interno.
      softwareKeyboardLayoutMode: "resize"
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro"
    },
    plugins: [
      "expo-router",
      [
        "expo-camera",
        {
          cameraPermission: "Allow Gimmick to access your camera to capture photos."
        }
      ],
      [
        "expo-av",
        {
          microphonePermission: "Allow Gimmick to access your microphone to record audio."
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Allow Gimmick to access your photos to select images."
        }
      ],
      [
        "expo-speech-recognition",
        {
          microphonePermission: "Gimmick usa il microfono per dettare le note.",
          speechRecognitionPermission: "Gimmick usa il riconoscimento vocale per dettare le note.",
          androidSpeechServicePackages: ["com.google.android.googlequicksearchbox"]
        }
      ],
      // Pixel Arcade design system fonts. Files must be downloaded manually
      // from Google Fonts and dropped in mobile/assets/fonts/ before the
      // next prebuild — the build will fail otherwise.
      [
        "expo-font",
        {
          fonts: [
            "./assets/fonts/PressStart2P-Regular.ttf",
            "./assets/fonts/JetBrainsMono-Regular.ttf",
            "./assets/fonts/JetBrainsMono-Bold.ttf"
          ]
        }
      ],
      ...sentryPlugin
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {},
      eas: {
        projectId: "b208f960-8b3d-4bd6-b8c8-93d79a2abaff"
      }
    }
  }
};