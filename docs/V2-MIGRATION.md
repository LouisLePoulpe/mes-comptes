# Mes Comptes V2 foundations

This branch is a preview, not a production cutover. Main and the published gh-pages app are unchanged. Do not deploy `firestore.v2.rules` over V1: it intentionally denies the root collections used by V1.

## Data model

All browser access uses `users/{Firebase Authentication uid}/{transactions|categories|accounts|config}/{id}`. Rules enforce ownership independently of client paths. No fallback reads or automatic copying from V1 shared collections are allowed. Account documents are encrypted `{name,color}`. The encrypted transaction's existing `banque` field now contains a stable account document ID. Keeping BB/CMB/TR as migrated IDs preserves ciphertext and history; labels can change without rewriting transactions. New accounts use generated IDs. Accounts are not deleted in this foundation.

One provider subscribes to each collection for the unlocked session and survives page navigation. Transactions retain their entire date range. Graphs always use all dates; monthly filters only affect monthly summaries. Percentages now use income across all accounts. An unreadable document raises an error rather than silently disappearing. Authentication changes unmount the provider, remove decrypted state and scope local keys to the uid. V1 local key entries are preserved and never reused implicitly. Firestore uses memory caching; the service worker no longer caches Firestore requests.

New vaults wrap the actual encryption key with the recovery key. The V1 `recoveryVerif` only proves possession of recovery words and cannot recover the original encryption key. Migrated users must keep their original passphrase or an unlocked V1 device. Never reset V1 encryption to “recover” old records.

## Local checks

Node 22+ and Java 21+ are required for emulator tests.

```sh
npm ci --legacy-peer-deps
npm test
npm run lint
npm run build
npm run test:rules
npx playwright install chromium
npm run test:e2e
```

The existing Vite/PWA peer dependency mismatch requires `--legacy-peer-deps`. Existing dependency audit findings remain a separate upgrade task. For interactive preview, start Firestore and Auth with `npx firebase emulators:start --config firebase.v2.json --project demo-mes-comptes-v2`, then `npm run dev`. Default builds use these emulators; `VITE_V2_USE_PRODUCTION=true` is an explicit opt-in, only after the cutover checklist. No real Firebase credentials are needed for emulator tests.

## Browser regression coverage

`npm run test:e2e` starts Auth and Firestore emulators plus the local Vite server. It runs Chromium at desktop and mobile sizes with synthetic accounts only. It covers Google emulator login, vault creation, customizable accounts, old/recent transactions, full-history Excel export (including totals and account names), reload, wrong passphrase, recovery, and switching users in the same browser. A second scenario copies a synthetic V1 archive through the migration planner, unlocks it with the original passphrase, checks the V1 recovery limitation, and verifies the source ciphertext is unchanged. Damaged ciphertext must stop display of partial history; a repaired snapshot restores the view.

Form labels and icon actions are accessible by name. Users can leave setup/locked screens, retry data loading, and correct transaction validation errors without losing their entries. The local emulator warning no longer covers the mobile navigation. CI runs browser checks in addition to build, lint, unit and Firestore tests. None of these tests accesses production Firebase or proves that an actual production export is ready for cutover.

## Copy rehearsal (no production writer)

1. Obtain a consistent, trusted offline JSON export from V1 using a separately reviewed read-only export procedure. Preserve an untouched backup. Keep exports in `.migration/` (gitignored), never in source control. Format: `{ "config": [{"id":"crypto","data":{...}}, {"id":"verif","data":{...}}], "transactions": [{"id":"original-id","data":{"iv":"...","data":"..."}}], "categories": [...] }`. Include every record and all config documents, with exact encrypted fields.
2. Independently verify the original owner's Firebase Auth uid. V1 has no ownership metadata, so the script must not guess ownership from a login or email. No real owner uid or export has been supplied or assumed in this PR.
3. Supply the original passphrase through `MIGRATION_PASSPHRASE` in a private shell environment (not a command argument, file in git, or logs).
4. Run `node scripts/migrate-v1.mjs .migration/export.json OWNER_UID --dry-run`. This runs entirely offline, checks every transaction/category can be decrypted, validates dates/amounts/account references, and reports only counts. Unknown legacy bank codes become accounts too. No dates are filtered out.
5. For emulator copying only: `npm ci --prefix import-comptes`, start the emulator, then run `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/migrate-v1.mjs .migration/export.json OWNER_UID --copy-to-emulator`. The target is fixed to `demo-mes-comptes-v2`. Remote hosts and production writes are refused.
6. The target namespace must be empty. Every write uses create-only semantics. All source IDs/ciphertexts/config are preserved. Every written record is read back and compared. A second run refuses to overwrite. If interrupted, retain the partial copy for diagnosis and repeat in a clean emulator; no automatic cleanup or deletion exists.
7. Verify source/target counts, decrypted values, oldest/newest dates, totals per account, categories, exports and chart history. Log in with the matching emulator uid to validate the original passphrase. Test a second user cannot read any records or crypto configuration. Test account creation/renaming, reload, logout/login, and category/transaction editing.

## Production cutover gate (future reviewed change)

This PR does not include a production migration command. Before adding one: rehearse with the real backup privately; independently validate the uid mapping; verify restore of V1 backup; review existing production rules (not available in this repository); agree on a short V1 write freeze; take a fresh consistent export after the freeze; copy and verify all records; then coordinate rule and frontend releases. A V2 vault already created in the target uid must be investigated rather than overwritten.

Do not allow V1 and V2 to write diverging copies during cutover. Keep V1 root collections and backup intact. Before V2 writes begin, rollback can restore V1 app/rules; after V2 writes begin, reconciliation is required before reverting. Never “rollback” by deleting original data. Merge alone is not permission to deploy rules or migrate live data.
