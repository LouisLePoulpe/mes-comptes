# Requested V2 features

All changes remain on the development branch; none imply production data migration or deployment.

| Request | Implementation | Remaining validation |
|---|---|---|
| Personal accounts for up to ten users | Firebase uid isolation, owner rules, session-scoped keys and shared collection subscriptions | Actual production rules and accounts before cutover |
| Custom banks | Create/rename accounts and change their colors; stable references across historical transactions | User acceptance |
| Light mode | Light/dark toggle available from login onwards, persistent device preference, semantic colors for all screens and chart tooltips | Physical Android |
| History name search | Accent/case-insensitive multi-word description search combined with existing filters; no effect on export/chart data | User acceptance |
| Old application export import | XLSX/CSV picker, validation, bank mapping, preview, confirmation and create-only encrypted writes | Rehearse with the owner's actual export privately |
| Android export | Browser download and file sharing plus Android native document save/share | Firebase Android setup, release signing and actual device checks |
| Calculations in amount fields | +, -, multiplication, division, parentheses, French decimals, exact final cent rounding; add and edit forms | User acceptance |

## Import behavior

The UI import consumes the **plain Excel export from V1** (Type, Montant, Banque, Catégorie, Description, Date), not a Firestore encrypted backup. It can populate an already-configured V2 vault using its current encryption key. The separate migration tool preserves a complete encrypted V1 vault, including its original crypto settings. Choose one route; do not blindly perform both.

No source file or existing transaction is modified. The user explicitly confirms an import preview. Invalid records block the entire import; blank rows are ignored, formulas rejected, unknown categories become `Non classé`. UTF-8 and Windows-1252 CSV are supported; dates may be French, ISO days or Excel serial dates. No history date range is dropped. Files over 10 MB or sheets over 50,000 rows/50 columns are rejected rather than truncated.

Identical rows use occurrence counts so two identical legitimate transactions in the same file can be preserved. Existing identical transactions are skipped by content; known import IDs remain skipped even after editing. Deterministic IDs and read-before-create transactions permit resuming partially completed batches without overwriting records. Batches hold at most 100 documents, with accounts/categories created before transactions. Imports can be partially committed on network failure; the UI says so and permits retry. Do not delete imported records to resume an import.

Without transaction IDs in the V1 Excel format, an identical new real-world transaction cannot be distinguished from an already imported transaction. The preview explicitly reports skipped rows. Imported dates have day precision because the V1 export only contains calendar dates. Bank mapping is important: mapping the same source to a different destination treats those as different transactions.

No quota-based cap of ten users is enforced; ten is the intended audience, not a Firebase authorization rule. Firestore reads/storage must still be observed with actual usage. Historical data is kept intact.

The import reader uses the [official SheetJS distribution](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/), since the registry version previously used by the app was older. Other existing dependency audit alerts are not all resolved by this change.

## Email accounts

Email/password signup, sign-in, address verification and password-reset requests work with any email provider. Verification precedes vault setup. Existing Google sign-in remains available. Account passwords and vault passphrases are separate; resetting the former does not recover the latter. Firebase's hosted action page handles verification/reset links, then the user returns to the app. Enable the Email/Password provider in Firebase Console before release, configure password policy (at least 12 characters), French mail templates, authorized domains and email enumeration protection. Test actual message delivery before inviting users. Production activation is not performed by the code change.

For an existing Google account, use its same address and “Mot de passe oublié” to establish email/password access; do not create another user or move records based only on a typed email address. The automated emulator test checks that this flow keeps the same uid. Confirm this once in the release acceptance environment as well.
