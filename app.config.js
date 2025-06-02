import withFixedFirebaseModularHeaders from "./expo-plugins/withFixedFirebaseModularHeaders";

export default() => ({
  expo: {
    name: "ClubToros",
    slug: "TorosClub",
    version: "2.0.3",
    orientation: "portrait",
    icon: "./assets/logoToros.jpg",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    permissions: [
      "CAMERA",
      "MEDIA_LIBRARY"
    ],
    splash: {
      image: "./assets/logoToros.jpg",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    updates: {
      url: "https://u.expo.dev/940bd2e2-f080-48f0-9ef7-9723472315f9",
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    runtimeVersion: "1.0.0",
    assetBundlePatterns: ["**/*"],
    fonts: [
      {
        name: "MiFuente",
        file: "./assets/fonts/MiFuente.ttf"
      }
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.mx.s1sistem.ClubToros",
      icon: "./assets/logoToros.jpg",
      buildNumber: "4.0.1",
      usesAppleSignIn: true,
      config: {
        usesNonExemptEncryption: false
      },
      infoPlist: {
        NSPhotoLibraryUsageDescription: "Permite acceder a tus fotos para subir imágenes",
        NSCameraUsageDescription: "Permite tomar fotos para subir a la aplicación",
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      package: "com.mx.s1sistem.ClubToros",
      
      adaptiveIcon: {
        foregroundImage: "./assets/torosIcon.png",
        backgroundColor: "#ffffff"
      },
      icon: "./assets/logoToros.jpg",
      permissions: [
        "android.permission.USE_BIOMETRIC",
        "android.permission.USE_FINGERPRINT"
      ]
    },
    web: {
      favicon: "./assets/torosIcon.png"
    },
    extra: {
      eas: {
        projectId: "940bd2e2-f080-48f0-9ef7-9723472315f9"
      }
    },
    owner: "21sistema",
    plugins: [
      "expo-signature",
      withFixedFirebaseModularHeaders // <- referencia directa al plugin
    ]
  }
});
