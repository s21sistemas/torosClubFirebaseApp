import withFixedFirebaseModularHeaders from "./expo-plugins/withFixedFirebaseModularHeaders";

export default {
  expo: {
    name: "ClubPotros",
    slug: "TorosClub",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/logoPotros.jpg",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    permissions: [
      "CAMERA",
      "MEDIA_LIBRARY"
    ],
    splash: {
      image: "./assets/logoPotros.jpg",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: ["**/*"],
    fonts: [
      {
        name: "MiFuente",
        file: "./assets/fonts/MiFuente.ttf"
      }
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.mx.s1sistem.ClubPotros",
      icon: "./assets/logoPotros.jpg",
      buildNumber: "1.0.0",
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
      package: "com.mx.s1sistem.ClubPotros",
      adaptiveIcon: {
        foregroundImage: "./assets/potrosIcon.png",
        backgroundColor: "#ffffff"
      },
      icon: "./assets/logoPotros.jpg",
      permissions: [
        "android.permission.USE_BIOMETRIC",
        "android.permission.USE_FINGERPRINT"
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      eas: {
        projectId: "940bd2e2-f080-48f0-9ef7-9723472315f9"
      }
    },
    owner: "vicyoshioka",
    plugins: [
      "expo-signature",
      withFixedFirebaseModularHeaders // <- referencia directa al plugin
    ]
  }
};
