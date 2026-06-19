# FamGuard

A privacy-first, **consent-required** family location-sharing app. Built with
Expo (React Native + TypeScript), Firebase (Auth/Firestore/Messaging), and
MapLibre + OpenFreeMap for the map (no API key, no billing account needed).

This is not a covert-tracking app: sharing only starts after an explicit
consent screen, every member can see who is sharing, and sharing can be
paused at any time from Settings.

## Setup checklist (cloud resources you need to provide)

Claude Code / CI cannot create these — follow this checklist yourself:

1. **Create a Firebase project** at https://console.firebase.google.com.
2. **Enable Google Sign-In**: Authentication → Sign-in method → enable Google.
3. **Register an Android app** (package `ph.famguard.app`) and an iOS app
   (bundle id `ph.famguard.app`) in Project settings. Download:
   - `google-services.json` → place at the repo root.
   - `GoogleService-Info.plist` → place at the repo root.
4. **Get the Web Client ID**: Authentication → Sign-in method → Google →
   copy the "Web client ID" (used by `@react-native-google-signin`). Set it
   as `GOOGLE_SIGNIN_WEB_CLIENT_ID` in a local `.env` (read via
   `app.config.ts` → `extra.googleSignInWebClientId`) and as a GitHub Actions
   secret for CI builds.
5. **Enable Cloud Firestore and Cloud Messaging** in the Firebase console.
6. **Deploy security rules**: `firebase deploy --only firestore:rules` using
   `firestore.rules` in this repo.
7. **Deploy the Cloud Function** in `functions/` (`cd functions && npm
   install && npm run deploy`) — it relays push notifications for geofence
   enter/exit, SOS, and check-in events, since clients aren't allowed to read
   each other's FCM tokens directly.
8. **EAS**: run `eas login`, confirm the bundle identifier `ph.famguard.app`
   (or tell Claude Code if you want a different one), and add an
   `EXPO_TOKEN` secret to GitHub Actions for CI builds
   (Account settings → Access tokens on expo.dev).

No map API key is required — MapLibre + OpenFreeMap tiles are free and don't
need an account.

## Development

```bash
npm install
npx expo prebuild   # generates native projects (custom dev client, not Expo Go)
npx expo run:android   # or: eas build --platform android --profile development
```

This app needs a **custom dev client** (not Expo Go) because of background
location and native Firebase modules.

## Releases

- Version is bumped in `app.config.ts` (`VERSION`, `ANDROID_VERSION_CODE`) on
  every build.
- Pushing a `v*` tag triggers `.github/workflows/build-release.yml`, which
  builds `FamGuard-v<version>.apk` via `eas build --platform android
  --profile preview --local` and publishes it as a GitHub release.
- **iOS** is not built in CI — it requires a Mac + Apple Developer account.
  Build locally with:

  ```bash
  eas build --platform ios --profile production
  ```

## Project structure

- `app/` — Expo Router screens (onboarding/consent, auth, family
  create/join, map/places/settings tabs, member detail).
- `lib/` — Firebase, auth, family, location/background-task, places/geofence,
  notifications, and session helpers.
- `i18n/` — English (`en.ts`) and Taglish (`tl.ts`) strings, toggled live from
  Settings.
- `functions/` — Cloud Function that turns Firestore `events` writes into
  FCM push notifications to other family members.
- `firestore.rules` — family-scoped, consent-gated security rules.
- `eas.json` — EAS build profiles (development/preview/production).
