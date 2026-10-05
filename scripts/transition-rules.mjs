import { userPath } from '../src/data/paths.js'

export function transitionRules(legacyUids) {
  if (!Array.isArray(legacyUids) || legacyUids.length < 1 || legacyUids.length > 10) throw new Error('Specify 1–10 verified legacy owner UIDs')
  for (const uid of legacyUids) {
    userPath(uid, 'config')
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error('Unsupported legacy UID')
  }
  return `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Preserve V1 only for independently verified legacy identities.
    function legacyOwner() {
      return request.auth != null && request.auth.uid in ${JSON.stringify([...new Set(legacyUids)])};
    }
    match /{group}/{id} {
      allow read, write: if legacyOwner() && group in ['transactions', 'categories', 'config'];
    }
    // V2 remains isolated by uid, including from legacy identities.
    function owner(uid) {
      return request.auth != null && request.auth.uid == uid
        && (request.auth.token.get('firebase', {}).get('sign_in_provider', '') != 'password'
          || request.auth.token.get('email_verified', false) == true);
    }
    match /users/{uid}/{group}/{id} {
      allow read, write: if owner(uid) && group in ['transactions', 'categories', 'accounts', 'initialBalances', 'recurringRules', 'config'];
    }
  }
}
`
}
