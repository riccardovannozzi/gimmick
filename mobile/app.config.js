const IS_DEV = process.env.APP_VARIANT === 'development';

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
        NSPhotoLibraryUsageDescription: "Gimmick needs photo library access to select images"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: IS_DEV ? "./assets/adaptive-icon-dev.png" : "./assets/adaptive-icon.png",
        backgroundColor: IS_DEV ? "#FF8C00" : "#1E1E1E"
      },
      package: IS_DEV ? "com.gimmick.dev" : "com.gimmick.app",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.MODIFY_AUDIO_SETTINGS"
      ],
      edgeToEdgeEnabled: true
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
      ]
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