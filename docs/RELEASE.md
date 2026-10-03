# Poulpécule 2.0.0

Android export to the document picker was validated by the owner after the fix.
The website production build is `npm run build:production`; `npm run deploy`
builds with the real Firebase project and publishes only static assets to gh-pages.
It never deploys Firestore rules, migrates records or removes user accounts.

Android release builds use versionCode 20000 and a stable private signing key.
Increment versionCode for each subsequent release. Debug builds have a -test suffix.
The manual Android signed release workflow requires three repository secrets:
ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_GOOGLE_SERVICES_JSON.
The keystore alias is poulpecule. Keep an independent private backup of the key and
password; losing them prevents compatible updates. Never commit them to Git.

Register fr.louislepoulpe.mescomptes in Firebase project comptes-44440, add the
release certificate SHA-1 and SHA-256, enable Google and download the updated
google-services.json with its OAuth clients. The production Android build
requires this configuration; it does not silently downgrade to email-only.

Switching from the debug APK to this release may require uninstalling the debug
APK because the certificates differ. Preserve exports and the vault passphrase
or recovery key first; Firestore data survives app removal.

The owner’s V1 data remains in its original root collections. V2 reads only the
signed-in uid's collections. V1 users must explicitly import their exports into
their V2 vaults. No automatic migration or old-account deletion accompanies release.
