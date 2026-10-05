# Mes Comptes Android

Release status (2.1.1): the owner validated Android document export. A stable-key
release with Google configured was built from commit eda54ea. Full native Google
sign-in remains to be confirmed on device. The preview instructions below describe
test variants, not the signed release linked from the README.

An Android project now lives in `android/`, sharing the V2 React screens with the web app. Package ID: `fr.louislepoulpe.mescomptes`. The APK packages assets locally, uses no web service worker, supports Android back navigation, adjusts for keyboard/safe areas and disables OS backup of app storage. Minimum Android API is 24; target/compile API is 36 (Capacitor 8). The device must have an up-to-date Android System WebView.

## Preview build

```sh
npm ci --legacy-peer-deps
npm run android:sync
cd android
./gradlew assembleDebug
```

Requires Java 21 and Android SDK 36. The GitHub workflow **Android preview APK** does this and attaches `mes-comptes-android-preview`. Its debug signing key is for build verification only and can change between CI runs. This is not the stable signing identity to distribute to the ten users.

**The preview APK is not a working production app:** it cannot log into Google until Firebase Android configuration is provided. The native Firebase authentication plugin is excluded from preview to avoid startup crashes without that configuration. The login screen explains the missing configuration. No real Firebase data is accessed by this build. Do not present compilation as on-device validation of login or exports.

## Configure a usable build (owner action)

1. Add an Android app with package `fr.louislepoulpe.mescomptes` to Firebase project `comptes-44440`.
2. Enable Google authentication and register the SHA-1 and SHA-256 of the certificate actually signing the APK. Keep the release signing key private and backed up; use the same key for updates.
3. Place the matching `google-services.json` at `android/app/google-services.json` (gitignored). No service-account private key is needed in the application.
4. Rehearse/approve the V2 data and rules cutover described in `V2-MIGRATION.md` before any production deployment.
5. Run `npm run android:sync -- --production`. This validates the project/package, enables the native authentication plugin, and builds the frontend for real Firebase. JavaScript Firestore receives the Google credential from the native sign-in flow and continues using uid-scoped paths.
6. Produce a signed release APK in Android Studio (or an appropriately configured private CI signing step). No signing key/password is stored in this repository.

## Exports

- **Export Excel** opens Android's document picker (`ACTION_CREATE_DOCUMENT`) to let the user choose the destination. The app writes only to the returned URI and requests no broad storage permission. Cancellation is distinct from success.
- **Partager l’export** shares a temporary file from the private app cache via Capacitor Share. Old temporary exports are removed on the next share after the new file has been handed over.
- In Chrome/PWA, Excel download uses a Blob URL retained long enough for the browser to open it. Supported browsers also expose file sharing; cancellation never triggers a surprise download. The export always includes all transactions, independently of search/month filters.

Physical Android acceptance remains required: install/update signed APK, Google login/logout, theme/keyboard/back button, file picker import, save to Downloads, cancelled save, share to a chosen app, open Excel externally, and reload full history. Browser tests simulate file-sharing success/cancellation/failure; they do not validate Android's operating-system dialogs.

References: [Capacitor Android](https://capacitorjs.com/docs/android), [native authentication](https://capawesome.io/docs/sdks/capacitor/firebase/authentication/), [Google setup](https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/authentication/docs/setup-google.md), [Capacitor Share](https://capacitorjs.com/docs/apis/share).

## Email authentication build

V2 also supports email/password accounts from any email provider, verification and password reset. These use Firebase's JavaScript SDK in both web and Android. The vault passphrase is separate; a password reset does not decrypt the vault.

After the coordinated production cutover, `npm run android:sync -- --production --email-only` builds against production Firebase without the native Google plugin or `google-services.json`. Google login is unavailable in this variant. Enable Email/Password in Firebase Authentication first and test email delivery and the app's WebView origin on a physical device. This option does not deploy rules or migrate any data. A stable signed release APK is still required for distribution. The default preview continues to use local emulators; it is not connected to production.

## Connected acceptance APK

The **Android connected email test** workflow packages the production email-only frontend as a debug-signed APK for owner acceptance testing. Unlike the emulator preview, sign-in and subsequent operations use the real Firebase project. It does not deploy any rules, register any user or migrate records during compilation. Publish the reviewed coexistence rules before installing/using it. Create the new email user through the app, verify the email, keep the new vault passphrase/recovery key privately, and follow the export/import comparison procedure. Old shared V1 data is never read by this app.

This APK is a device-test build, not the final ten-user release. Its temporary debug certificate can change across CI runs; replacing it with the final signed release may require uninstalling this build and signing in again. Keep the passphrase/recovery key and original exports outside the app before replacing it. A successful build does not validate Android login or native file dialogs. The final release still needs a stable private signing key and physical acceptance.
