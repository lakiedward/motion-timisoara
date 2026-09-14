# Android association preparation (unpublished)

`assetlinks.debug-unpublished.json` is derived from the existing locally built debug APK on 2026-09-14 with Android SDK 36.0.0 `apksigner verify --print-certs`. Certificate subject: `C=US, O=Android, CN=Android Debug`. Package: `com.motiontimisoara.app`.

This is evidence for the installed test build, not a production association. It is intentionally outside `motiontimisoaraApp/public` and is not copied into the frontend build or published by this stage. Do not publish this debug fingerprint on the production domain.

For the HTTPS distribution stage, obtain the actual distribution certificate (including Play App Signing when applicable), generate a separate association with its verified SHA-256 fingerprint, publish it as `https://motiontimisoara.com/.well-known/assetlinks.json` and add verified HTTPS Android intent filters for the accepted auth paths. Test Android domain verification and real email links after publication. iOS needs the owner's Apple team/application identifiers, entitlements, an independently verified AASA file and a real device/build.
