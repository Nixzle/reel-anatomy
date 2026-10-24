# Reel Anatomy rc.4: authorised connections and encrypted metadata sync

## Delivery

Live app: https://nixzle.github.io/reel-anatomy/ . Open **Settings > Account connections and encrypted sync**.

Candidate `1.0.0-rc.4`, build `28d36471bbde7386`, implementation `4268d27df11bb9c7e5151f9592b2c7151ffb82b1`, public Pages commit `62943ddab2244b6f44b16312e85291d8a0f6d333`. All 83 manifest files and the service worker were fetched and matched the tested bytes. Public checks completed at 2026-10-24T12:55:46.948888+00:00. The previous public commit `3ccdbc21c3878458bf1bfa1e33cb2ff98bc64904` remains available for rollback.

**No real Google account is connected or authorised by this delivery.** The implementation is available, but an operator-owned Google OAuth web client, correct origins/APIs/consent configuration and the user's explicit sign-in are still required. Existing Google connectors in ChatGPT do not supply that app registration or transfer their credentials. This remains a release candidate, not qualified stable 1.0.

## Implemented account intake

The optional connection uses Google's official browser Identity Services token model. YouTube and Drive permissions are requested separately. SDK loading itself requires a clear action and privacy consent; simply opening the app makes no Google account request. Tokens stay in memory rather than URLs, browser storage, backups or sync. Disconnect, expiry, revocation and page exit clear session data. Drive's opaque account-binding ID remains with its vault so a different account can be rejected; display names are not persisted.

The YouTube connector reads channels returned by the authorising account, owned upload metadata in explicit pages of up to 50, and selected-date Analytics/retention reports. It preserves exact returned counts, missing values and ratio definitions. It does not publish, edit, download videos, read another creator's private insights or automatically collect Instagram/TikTok data.

API report data is a session-only raw view. It does not enter our custom exploratory scores, research database, assistant context, model training, library export or encrypted sync. This separation follows the reviewed official YouTube data/derived-metric policy boundaries rather than silently treating any public count as unrestricted input. An API response is not a virality forecast or causal conclusion.

## Implemented sync

The app can synchronise reviewed metadata checkpoints through Drive's hidden application-data folder using only drive.appdata. The user must approve transfer of **the whole device metadata library, including all research projects**, not merely the selected project. Original videos, audio, PDFs, model caches and YouTube account-report sessions are excluded. Project packs remain the way to carry original media.

A randomly generated recovery secret derives separate non-extractable AES-256-GCM and HMAC-SHA-256 keys. Contents are encrypted before upload; index parents and ciphertext hashes are authenticated. The recovery key is saved separately and is not included in ordinary backups. Google can see opaque file identifiers, sizes, timing and network requests. A compromised device or any script with access to the same web origin can still use local keys and research. URL paths on one GitHub Pages origin are not separate security boundaries; use a dedicated app origin for broad account-enabled deployment.

Writes create immutable checkpoints under a reserved Drive file ID. The pending identity and exact encrypted body are retained locally before upload. A lost acknowledgement does not trigger a new checkpoint: the same file is read back and, only if explicitly requested and missing, retried under that same reserved ID. Unknown outcomes remain pending rather than being described as successful.

The merge uses the last common checkpoint and exposes overlapping edits, edit/delete conflicts and concurrent cloud histories. Conflict choices are bound to the actual versions shown, so an old choice cannot overwrite a newer change. The preview lists additions, updates and removals for both device and cloud. Local edits after preview are refused by a final revision check and a single IndexedDB transaction. An unchanged sync does not rewrite the library or erase local approval. Imported/merged metadata still requires current editorial review. A pre-restore recovery copy is retained.

This is an explicit foreground workflow, not an always-running service. Limits are 8 MB plaintext metadata per checkpoint, 200 immutable checkpoints and two cloud branch heads for automatic planning. Larger or incomplete histories stop for recovery instead of silently pruning files or selecting a winner. Losing the recovery key can make encrypted cloud content unrecoverable. Revoking access, forgetting a device key and deleting cloud app data are different operations, explained in the privacy page.

## What actually passed

- 220 existing Python tests passed.
- 46 new cryptography/protocol/concurrency checks and 53 existing JavaScript checks passed, 99 total.
- On the exact public app, 22 new connection/sync workflow checks passed alongside 119 existing research/production/recovery checks.
- Three additional checks loaded the real official Google SDK under the app's CSP without initiating account consent or requesting a token.
- Every public manifest asset and the service worker matched the clean source build.

The two-device workflow used separate Chrome storage contexts with actual application code, WebCrypto and IndexedDB. **OAuth, YouTube and Drive account responses were synthetic transport fixtures.** No actual owner credentials, API account data or real Drive cloud files were used. Tests covered encryption, wrong-key/tampered-data rejection, disjoint edits, explicit conflicts, stale previews, a lost upload acknowledgement, token expiration, revocation, backup/project-pack exclusion of keys and reports, atomic recovery and offline restart. The existing checks also exercised actual local MP4 output, captions, document reading and media recovery.

These checks do not establish real Google registration/consent, live-provider acceptance, independent security certification, physical iPhone/Safari support or real campaign improvement. Exact evidence is in CONNECTIONS_VERIFICATION.json. No new installer, model weight, paid provider, social publication or account connection was activated.

## Reproducibility and regression fixes

An existing Git source defect had normalised 248 upstream WebLLM CRLF line endings despite an exact-byte pin. The retained donor and public runtime were already correct. The source was restored byte-for-byte from that retained, hash-matching donor without changing its pin; the staged Git blob was verified. This fixes rebuilding from source without altering model behaviour or downloading weights.

Real-browser testing also caught native fetch being invoked with the wrong receiver and a stale ready-state message during a new preview. Both were corrected while retaining the original acceptance assertions and failed receipts. The app now reports busy/current result state, rejects stale merge choices, preserves custom empty projects, and clears expired account display identity. No existing validation was removed to obtain a pass.

## Activation and remaining original requirements

The one-time connection setup is documented in CONNECTIONS.md and in the app's expandable setup panel. It needs the registered **public web client ID**, not a Google password, client secret, ChatGPT token or another app's credentials. Google may require consent-screen testing/verification before broad use. The available connector discovery did not provide an OAuth-client management action; existing Drive/Gmail integrations are separate services.

Platform and sync qualification are now marked **pending verification**, not complete. They need actual owner-app registration, real consent, real API retrieval and a real two-device conflict/recovery test. Instagram/TikTok account adapters were not added. Model reasoning/semantic-video evaluation, physical iPhone/Safari and real cohort/campaign outcomes remain open. The earlier Windows packaging and relay blocks remain in force and were not retried through another tool, wrapper or CI. No new Windows binary exists from this iteration.

The private Sanctum native renderer's source hashes remain unchanged. Save work, close old app tabs and reopen to receive the new cached build. Do not clear website storage merely to update. Before enabling cloud sync, save an independent project pack and keep the recovery key secure.
