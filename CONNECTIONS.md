# Authorised connections and encrypted metadata sync

This implementation adds two deliberately separate optional routes: YouTube read-only account reports, and client-encrypted metadata sync through Google Drive appDataFolder. It does not reuse ChatGPT connector credentials. The Windows packaging and prior relay operations that were safety-blocked are untouched.

## Owner setup, not an inherited connection

Register a Google OAuth **Web application** client owned by this app's operator. Enable YouTube Data API v3, YouTube Analytics API and Google Drive API. Configure the consent screen, the public app identity, privacy policy, required scopes and any test users. Add exact authorised JavaScript origins, including https://nixzle.github.io for the deployed Pages app and the chosen localhost origin/port only when using the desktop source. An origin contains no /reel-anatomy/ path. Google's app verification and publishing requirements still apply. Browser storage and OAuth origins are not isolated by URL path: other applications on the same origin share that security boundary. Use a dedicated app origin for broad account-enabled deployment, and register that exact origin.

Enter only the public client ID in Settings > Account connections. Never enter a client secret or token. Load Google's official sign-in library after reading the privacy notice, then connect YouTube or app-specific Drive separately. Token grants stay in memory and expire; no background refresh credential is stored. A new sign-in requires a user action. Use Disconnect for this session or Revoke for Google's grant. No account is connected automatically.

No registered client ID, account approval or provider acceptance is claimed merely because this source exists. The release's verification record distinguishes actual Google consent from protocol/network test fixtures. The operator must complete consent on the actual deployment to close live-account qualification.

## Read-only YouTube

The connector lists channels returned by channels.list(mine=true), reads up to 50 uploads per explicit page request, then retrieves owned video metadata and selected-date Analytics summary/retention reports. Counts remain exactly as returned, and absent fields remain unknown. API data is memory-only. It does not feed our derived exploratory scores, AI prompts, database, exports or encrypted sync. No posting, commenting, video download or arbitrary third-party channel access is provided. Analytics dates are YouTube's reporting periods, not automatically comparable elapsed-age snapshots.

The separation is intentional: Google's current YouTube API rules restrict derived metrics and retention/revocation behavior. Adding a connected raw-report view is not permission to invent scores or retain private channel data indefinitely. Real campaign decisions still require the original evaluation process.

## Encrypted sync

Connect Drive using only the non-sensitive drive.appdata scope. Create a vault, save its private recovery-key file outside the browser and confirm that it is saved. The active AES/HMAC CryptoKeys are non-extractable, stored separately in IndexedDB, and never included in project backups. The vault also retains the opaque Drive permissionId needed to match the authorising account; the display name is not persisted. On another device with the same registered client and Google account, import the recovery key, authorise Drive, then review sync.

The implementation uses WebCrypto HKDF to derive separate AES-256-GCM content and HMAC-SHA-256 index keys from 32 random bytes. Each checkpoint has a fresh 96-bit nonce. Source titles and scripts are encrypted; index metadata reveals only opaque IDs, authenticated parents and ciphertext hashes. Encryption does not protect a compromised browser or device, and losing the recovery key can make checkpoints unrecoverable.

Cloud writes are immutable. Drive supplies a reserved file ID before a create request; that exact identity and encrypted body are persisted locally first. An uncertain upload stops and requires reconciliation. A missing write can be retried only with its same reserved ID. There is no silent replay as a second checkpoint. Concurrent changes become separate authenticated graph heads. Three-way record merging preserves disjoint changes and requires explicit choices for overlapping edits or edit/delete conflicts. New local edits after preview are protected by expected-revision checks and a single IndexedDB transaction. Previous local metadata remains recoverable.

Before applying, finish media/research jobs and save editors. Sync covers every research project in the current device library, not only the project selected on screen. The preview shows additions, updates and removals for both device and cloud. Original video/audio/PDF bytes do not sync. Use existing project packs for those. Prior editorial approvals and export receipts are deliberately not promoted across sync. Limits: 8 MB plaintext metadata per checkpoint, 200 cloud checkpoints per vault and two concurrent branch heads for automated planning. At larger history or divergence, stop and use explicit recovery rather than deleting or choosing a winner. This is user-driven network sync, not an always-running hosted account service.

## Privacy, recovery and deletion

See CONNECTIONS_PRIVACY.html. YouTube reports disappear at disconnect/expiry/page exit. Encrypted Drive history is not deleted by disconnect or by forgetting the device key. Manage the app's stored data through Google Drive settings. Keep independent project packs and recovery keys. No tokens, recovery keys, source titles or private prompts belong in diagnostics, public source, test receipts or issue reports.

## Official sources checked for this implementation

- Google browser token model: https://developers.google.com/identity/oauth2/web/guides/use-token-model
- OAuth web client setup: https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid
- Google Identity Services CSP/setup: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- Drive application data: https://developers.google.com/workspace/drive/api/guides/appdata
- Drive idempotent reserved file IDs: https://developers.google.com/workspace/drive/api/guides/create-file
- Drive generateIds / appDataFolder: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds
- YouTube channels and uploads: https://developers.google.com/youtube/v3/docs/channels/list and https://developers.google.com/youtube/v3/docs/playlistItems/list
- YouTube report query and retention definitions: https://developers.google.com/youtube/analytics/reference/reports/query and https://developers.google.com/youtube/analytics/metrics
- YouTube policy and derived-metric boundaries: https://developers.google.com/youtube/terms/developer-policies and https://developers.google.com/youtube/terms/derived-metrics-policy

No licensed library was newly installed. The implementation uses the existing app Store/backup transaction, browser IndexedDB, WebCrypto and Google's official SDK loaded only after user consent. Runtime behavior, setup, account acceptance and external policy approval remain distinct.
