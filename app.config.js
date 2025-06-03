import withFixedFirebaseModularHeaders from "./expo-plugins/withFixedFirebaseModularHeaders";

export default() => ({
  expo: {
    name: "ClubPotros",
    slug: "TorosClub",
    version: "2.0.3",
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
      bundleIdentifier: "com.mx.s1sistem.ClubPotros",
      icon: "./assets/logoPotros.jpg",
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
      favicon: "./assets/potrosIcon.png"
    },
    extra: {
      eas: {
        projectId: "940bd2e2-f080-48f0-9ef7-9723472315f9"
      }
    },
    owner: "21sistema",
    plugins: [
      "expo-signature",
      withFixedFirebaseModularHeaders 
    ]
  }
});
