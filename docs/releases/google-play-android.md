# Google Play Android release

Runbook for building a signed Android App Bundle (AAB) and uploading it to a Google Play testing track. The Play Console account, payment, identity verification and every release rollout belong to the owner.

## What the repository provides

- `motiontimisoaraApp/android/app/build.gradle` signs the `release` build type only when all four upload-key values are present. Each value comes from an environment variable or from `motiontimisoaraApp/android/keystore.properties` (ignored by Git):

  | `keystore.properties` | Environment variable |
  |---|---|
  | `storeFile` (absolute, or relative to `android/`) | `MT_UPLOAD_STORE_FILE` |
  | `storePassword` | `MT_UPLOAD_STORE_PASSWORD` |
  | `keyAlias` | `MT_UPLOAD_KEY_ALIAS` |
  | `keyPassword` | `MT_UPLOAD_KEY_PASSWORD` |

  Without them `bundleRelease` still compiles but produces an unsigned bundle that Play rejects; debug builds and CI are unaffected.
- `versionCode` increases automatically: minutes since 2026-01-01 UTC, so every build is higher than the previous one without a manual bump. Override with `MT_VERSION_CODE` or `-PmtVersionCode=<n>`. `versionName` defaults to `1.0.0`; override with `MT_VERSION_NAME` or `-PmtVersionName=<name>`.
- `npm run android:bundle` (from `motiontimisoaraApp/`) checks `android/app/google-services.json`, the upload key and the `VITE_SUPABASE_*` build variables, then runs `npm run build:native` (web build with `VITE_NATIVE_BUILD=1`, which leaves out every subscription price, plan, page and payment link, followed by an automatic scan of `dist` that fails on any of them), `npx cap sync android` and `gradlew :app:bundleRelease`. It uses the default SDK location (`%LOCALAPPDATA%\Android\Sdk`, `~/Library/Android/sdk` or `~/Android/Sdk`) when neither `ANDROID_HOME` nor `sdk.dir` is set, and fails unless `jarsigner` verifies the result and prints the bundle path and the upload certificate SHA-256. `--skip-web` reuses the last web build and sync, but still scans the synced assets in `android/app/src/main/assets/public`.

## One-time setup on the release machine

1. Install Android Studio (bundled JBR 21) or a JDK 21 and the Android SDK platform 36; set `JAVA_HOME` and `ANDROID_HOME` if Gradle cannot find them.
2. Put the Firebase file at `motiontimisoaraApp/android/app/google-services.json`; it is never committed.
3. Create `motiontimisoaraApp/.env` (or `.env.production`) with the product Supabase values from authorized local configuration, and `VITE_STRIPE_PUBLISHABLE_KEY` if card payments must work in the build.
4. Create the upload key outside the repository and record its location and passwords only in `keystore.properties`:

   ```powershell
   New-Item -ItemType Directory -Force "$env:USERPROFILE\.motion-keys" | Out-Null
   keytool -genkeypair -v -keystore "$env:USERPROFILE\.motion-keys\motion-upload.jks" -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```

   ```properties
   storeFile=C:/Users/<user>/.motion-keys/motion-upload.jks
   storePassword=<store password>
   keyAlias=upload
   keyPassword=<key password>
   ```

   Back up the `.jks` file and passwords outside the machine. With Play App Signing, Google holds the app signing key and a lost upload key can be reset through Play Console.

## Building and uploading

1. Check out the verified `master` SHA in a clean worktree and run `npm ci` in `motiontimisoaraApp/`.
2. Run `npm run android:bundle`. The bundle is written to `motiontimisoaraApp/android/app/build/outputs/bundle/release/app-release.aab`.
3. In Play Console, open Testing › Internal testing › Create new release, accept Play App Signing on the first upload, upload the AAB and add release notes.
4. Roll out only after the owner approves that release; share the opt-in link with the tester list.
5. Record the tested SHA, `versionCode`, upload certificate SHA-256 and device results in the task evidence.

## Play policy notes

- New personal developer accounts need a closed test with at least 12 testers opted in for 14 consecutive days before production access; internal testing does not count toward it.
- The coach live-location feature uses a `location` foreground service from `@capgo/background-geolocation`. Play Console requires the foreground service declaration with a video of the user-initiated flow. The app does not request `ACCESS_BACKGROUND_LOCATION`.
- Google sign-in uses Supabase OAuth in a Custom Tab with the `com.motiontimisoara.app://auth/callback` deep link, so no Android OAuth client or SHA-1 registration is needed. FCM does not need SHA-1 either.
- The application ID stays `com.motiontimisoara.app` (see `docs/project-decisions.md`, rebrand entry).
