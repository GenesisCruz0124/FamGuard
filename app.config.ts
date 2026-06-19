import type { ExpoConfig } from "expo/config";

// Bump `version` and `android.versionCode` on every build per release policy.
const VERSION = "1.0.0";
const ANDROID_VERSION_CODE = 1;

const config: ExpoConfig = {
  name: "FamGuard",
  slug: "FamGuard",
  version: VERSION,
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "famguard",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    bundleIdentifier: "ph.famguard.app",
    supportsTablet: true,
    googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST ?? "./GoogleService-Info.plist",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "FamGuard uses your location while the app is open so your family can see where you are on the shared map.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "FamGuard needs background location access to keep sharing your location with your family for safety, even when the app is closed.",
      UIBackgroundModes: ["location", "fetch", "remote-notification"],
    },
  },
  android: {
    package: "ph.famguard.app",
    versionCode: ANDROID_VERSION_CODE,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
    permissions: [
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
      "POST_NOTIFICATIONS",
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "FamGuard needs background location access to keep sharing your location with your family for safety, even when the app is closed.",
        locationAlwaysPermission:
          "FamGuard needs background location access to keep sharing your location with your family for safety, even when the app is closed.",
        locationWhenInUsePermission:
          "FamGuard uses your location while the app is open so your family can see where you are on the shared map.",
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/icon.png",
      },
    ],
    "@react-native-firebase/app",
    "@react-native-google-signin/google-signin",
    "@maplibre/maplibre-react-native",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    googleSignInWebClientId: process.env.GOOGLE_SIGNIN_WEB_CLIENT_ID ?? "",
  },
};

export default config;
