# Reel Anatomy Studio checkpoint

## Active objective

Deliver the complete research-to-creation loop proposed to the owner: authorised bulk imports, evidence-linked breakdowns, honest comparisons, original filming briefs, rough-cut review and prospective result tracking. Preserve the existing Windows executable, GitHub distribution, local privacy and correct release provenance. Do not replace required learned analysis with rules while calling it complete.

## v0.2.0 implemented scope

Research projects and collections; SQLite metadata and append-only snapshots; persistent single-worker queue; media/transcript reuse without merging publication records; timed metrics with provenance; creator/cohort/format/duration comparisons and counterexamples; pattern-to-brief handoff; structured original scripts and filming plans; revision history; offline phone-friendly exports; timestamp-linked draft review; prospective tests with frozen script revisions; real outcome comparisons to earlier own posts.

A bounded, opt-in local Ollama adapter supports structured text and sampled-frame evidence, multi-label suggestions and script refinement. It rejects declared cloud models, hides performance metadata, validates evidence identities and does not auto-install or download models. The structured planner is explicitly labelled as such. Sparse evidence is never promoted to a winning formula.

## Verification and recovery

Source regressions, legacy media browser workflow and studio browser workflow live in test_*.py and scripts/*smoke*. Exact logs for this iteration are under .local/studio-v020 and .local/studio-browser-*; generated fixtures and browser profiles remain ignored. Recovered intermediate code from the interrupted run is preserved by hash and diff in .local/studio-v020.

Package from a clean committed tree, align APP_VERSION, release tag, BUILD_INFO source hashes and archive checksum. Build logs and receipts are in .local/release-0.2.0. Download the uploaded draft release into a new directory, repeat executable and browser checks, then publish only that verified asset. Never replace an already released ZIP under the same tag.

## Material corrections retained

The first browser acceptance test exposed an async DOM event.currentTarget lifetime bug: project creation persisted but the form could not refresh. Capture the form before awaiting the request. Subtitle matching must use the same filename normaliser on both sides. Reset snapshot inputs between different posts. Compare feature states only within overlapping creator/cohort strata, and do not silently substitute a 24-hour outcome for a recorded 72-hour test. Do not claim full frame coverage when model output omits sampled frames. No unrelated settings or project state was changed.

## Remaining acceptance, owner: Ultron Prime

- Learned semantic quality and actual inference: no compatible local service/model was available on this host. The adapter's protocol, privacy and validation are tested with synthetic responses only. Milestone: explicitly configured licensed local vision model plus authorised representative videos and independent human labels. Acceptance: measured timestamp/role/visual accuracy, error analysis, hardware usage and a real end-to-end provider run. No existing checkpoint authorises an unrequested installer, paid fallback or model download.
- Empirical effectiveness: no real campaign corpus or outcomes have been imported into the release. Milestone: one actual research cohort, ordinary and weak posts included, followed by prospective own-post trials. Acceptance: out-of-time evaluation, counterexamples and improvement measured against a stated baseline. No promise of virality or returns.
- Platform account connections and automatic retrieval: remain outside the shipped upload/CSV path. Milestone: separately authorised platform integration. Acceptance: permissions, platform policy, provenance and data-scope checks; no private-insight guessing.
- Native text/carousel ingestion, a shared hosted workspace and a native phone app remain deferred. Mobile filming briefs are supported as offline exports; the localhost server is not exposed publicly.
- A second physical computer and human usability review remain untested. Fresh extraction, empty cache and clean browser profile on the build host are separate evidence classes, not a second device.

## 0.3.0 mobile candidate, 23 October 2026 Sydney

Implemented public installable shell, icons/manifest, safe-area controls, explicit IndexedDB filming copies, single-use device pairing protocol, expiring/revocable cookie sessions, an independent allowlisted HTTPS relay, desktop mutation receipts and chunked uploads. The Windows local listener remains loopback-only; remote access defaults off. Production credentials are absent.

Tool safety blocked the combined authenticated-browser test-script write and the Wrangler deployment-list command. Do not replay these calls or route through backups to bypass them. No live worker or phone URL was created. Existing stable v0.2.0 release remains untouched. The permitted public-shell browser test is not authenticated end-to-end acceptance. Read MOBILE.md before resuming hosting. Current evidence is retained under .local/mobile-v030 and .local/pwa-public-*; no private libraries were used.

Owner: Ultron Prime. Next acceptance: allowed deployment, owner secret provisioning, real relay/phone tests and physical iOS installation. Preserve all earlier semantic-model/campaign limitations.


## 0.4.0 standalone phone edition, 23 October 2026

The relay candidate remains undeployed and its denied operations were not replayed. A different public-static application runs the existing Python Store/planner and SQLite inside a Pyodide module worker, using idb-keyval for device-local persistence. No desktop access, pairing, secret provisioning, cloud data API or automatic synchronisation is present. The publishing allowlist excludes relay code and owner data. Source branch: feature/standalone-ios-20261023. See standalone/DONORS.md for exact reuse/licensing and standalone/ACCEPTANCE.md for boundaries.

Actual browser acceptance now covers the research/production workflow, sampled local video inspection with supplied captions, pause/resume/reuse, metrics and sparse-evidence warnings, script revisions, outcome tracking, safe areas, desktop JSON exchange, backup recovery, hostile-ID rejection, separate-user isolation and full offline engine/library reopening. Original video is excluded from metadata backups. Phone media sampling remains approximate and is not pooled with imported cut methods. No phone speech model or actual semantic inference is claimed.

The shared Studio metadata editor now preserves partly entered metrics during a same-post asynchronous refresh and does not reopen a dismissed modal. The browser harness waits for a new document time origin before asserting offline reload success. Pending delivery at this checkpoint: public static deployment, exact BUILD readback and repeat browser suite against HTTPS. Physical iPhone, learned-model, live-sync and empirical campaign gates remain open with Ultron Prime as owner; do not silently remove them.


### Standalone publication acceptance closed

Published https://nixzle.github.io/reel-anatomy/ from public gh-pages commit b892394a7887e1e026deec7bd15907a55977485a. BUILD pins source 00017cbd5ea15a3e26db6703e0b7fbad07ebaa70 and build fe74032a5f637b18. All 33 manifest files were fetched publicly and hash-matched. The actual public HTTPS site passed 32 browser checks, including full offline engine/library reopening, desktop JSON exchange, backup rejection/recovery and separate-user isolation. Existing desktop Studio regressions: 19; frontend: 11. Raw evidence: .local/standalone-v040 and .local/standalone-browser-1792714651189. Public verification summary: standalone/VERIFICATION.json and standalone/RELEASE.md. No user data was used; no relay credential or remote desktop service was deployed.

Physical iPhone acceptance, actual Safari codec coverage, large-corpus throughput, learned model quality and automatic sync remain explicitly open. The stable Windows release and the blocked relay candidate are unchanged. Do not imply that installation on the owner's physical phone was performed.


## 0.5.0 Sanctum research iteration, 23 October 2026

Objective continues: one useful heavy social-media/deep-research workspace with Ultron's public-safe identity. Added project-scoped SQLite evidence tables/FTS, source coverage/provenance/revisions, quoted claim links and counterevidence, explicitly consented public discovery runs with stop/resume history, cited evidence maps, context inspection, script handoff and backup/offline integration. Optional WebLLM 0.2.86 runs text inference in a dedicated worker after explicit download consent. No private canonical Sanctum files are published, no ChatGPT tools/memory are inherited, and no model weights or paid fallback were activated during implementation.

Verification is split: deterministic evidence and model-response contract tests; full synthetic browser acceptance; real Crossref/Wikipedia browser queries; a synthetic 400-source storage/search measurement; WebLLM runtime/model-record loading without weights. The evidence map is not a language model, and module loading is not actual inference. Existing media/production and data recovery behavior must remain green.

A real review found cancellation and prompt-boundary gaps: stopped generations now cannot be saved, unload cancels a pending load, and model citations must refer to excerpts actually included in the bounded prompt. Backup sources must match their content hashes. Existing Windows release and blocked relay remain unchanged. Work branch: feature/sanctum-research-20261023. Exact receipts are under .local/sanctum-v050 and .local/sanctum-browser-*.

Owner: Ultron Prime. At this checkpoint the publication gate is still open: clean commit, exact public static build readback, full HTTPS browser suite and separate live-provider probe. After publication, retain source/build/public-commit identities in standalone/SANCTUM_RELEASE.md. Remaining original requirements, owners and gates are in standalone/ACCEPTANCE.md, including actual local-model inference/quality, physical iPhone, social-account connectors, rich full-text/PDF ingestion, large real-media throughput, sync and empirical campaign outcomes. No claim of universal superiority or completed autonomous deep research is authorised by tests of this bounded beta.


### Sanctum 0.5.0 publication gate closed

Live build e38edc810e3c3a9a is deployed from implementation 2bd7414a11d737487f7c8d3a101d2066e04cdb13 and public commit 1e083d72466a83979f46af072ac65fac6884598a. All 42 files plus the service worker hash-match. The HTTPS site passed 51 browser checks; both real public discovery connectors returned results; the synthetic 400-source storage/search probe passed. Source/contract gates: 120 Python tests, 17 research JS checks, 11 previous frontend checks and 19 desktop Studio browser checks. Detailed release boundaries and ongoing owner acceptance are in standalone/SANCTUM_RELEASE.md. No model weights, actual model inference, private memory/tools or physical-iPhone acceptance are implied. Source receipt logs remain in .local/sanctum-v050.


## Reel Factory 0.6.0 iteration, 23 October 2026

Owner request: make the project a Sanctum tool that produces researched Reels. Preserve honest uncertainty: guaranteed virality is not an acceptance claim. Implemented three-opening campaigns from existing briefs, source-bound assertion mapping, rights/timing/claim checks, exact-version human review, native browser visual/audio recording and batch variants, captions/source/test sidecars, and a local Python/Pillow/FFmpeg CLI. Private Sanctum binding has been prepared with direct argv and source-hash checks; qualification/promotion and publication remain separately tracked.

An actual browser output exposed numeric JSON fingerprint drift at the native handoff (Python whole-number floats versus JavaScript numbers). Fixed by canonicalising whole-number floats inside factory fingerprints. Added exact roundtrip regressions and retained the failed original package. No validation was removed. Native and browser generation are separate exercised renderers, not assumed identical pixels.

The output examples are original, silent 24-second caption-led drafts citing a primary Meta feature description; no human approval, synthetic voice or real campaign outcome is claimed. Public examples contain no private data or font files. Test output uses generated colour/motion/audio fixtures, explicitly not human review evidence. Exact receipts remain in .local/factory-v060 and .local/factory-browser-*.

Release still requires clean source commit, full existing/research/factory checks, public byte/hash readback and live-browser exports. Keep Windows v0.2.0 and the denied relay unchanged. Physical iPhone/Safari export, large real media workloads, actual local-model reasoning, social connectors, cross-device sync and campaign uplift remain open with the original acceptance owners; factory implementation does not erase them.


### Reel Factory 0.6.0 delivery and canonical registration closed

Verified public build b3c0db4b47ec4896 from source bc3b15ba504799f58068b7e1a0d2b40ae30e2859 and public commit 524bc24086503920ec2ff7ccb658c457c28ca9b5. All 54 files and service worker hash-match; live Factory 14 and research 51 browser checks pass. Source gates: 146 Python, 35 JS, desktop Studio 19. Private Sanctum tool merged through PR 90 at 4c8944c7169188b35fd5d923f9f4d9da10234feb, with direct doctor/inspect/single/batch execution and exact source pins. The original local checkout branch and unrelated untracked media remain untouched; the owned local binding files carry the qualified record. Source/resume evidence is in .local/factory-resume; original recovered evidence remains in .local/factory-v060. Actual public examples are silent caption-led drafts, not human-approved campaigns. Public capability and outstanding gates are in standalone/FACTORY_RELEASE.md. No guaranteed reach, background iteration, automatic posting, physical-iPhone qualification or real model-quality claim is made.


## 1.0 readiness iteration, 23 October 2026

Owner requested continued iterations until 1.0. Current working candidate is 1.0.0-rc.1 on release/v1-readiness-20261023, not a stable completion claim. Added page-grounded PDF and saved-HTML intake, original PDF inspection, named public full-text reading, full project packs with atomic metadata/media restore, privacy-safe diagnostics, accessible phone navigation and exact-render-to-draft registration. Stable release is checked against the original gate ledger; model/device/platform/sync/outcome requirements remain open, not deleted. No model, installer or paid fallback was activated.

The existing Sanctum native factory pins are unchanged. Reused read-only source parsing and rendering paths plus licensed PDF.js/Readability/fflate. New source metadata is unreviewed; original images/tables are not claimed understood. JSON-only backups remain supported; project ZIP packs additionally preserve media and original documents, while imported campaign approval is cleared.

At this checkpoint the focused browser suite passed real PDF/HTML ingestion, renderer-to-draft reuse, actual MP4 playback, hostile/changed pack rejection, aborted transaction rollback, cancellation, media/document recovery and full offline restart. Live Wikipedia/Europe PMC text retrieval passed separately. Release still needs the final full regression pass, clean commit, exact publication readback and public-browser checks. Receipts are in .local/v1-readiness-20261023. An early harness clicked before source rendering and another used top-level await in a classic CDP expression; corrected waits/async expressions retain original assertions. Interrupted-upload orphan handling was corrected rather than weakening archive restore validation.


### 1.0.0-rc.1 public candidate verification closed

Published build ddaded4d5868ed1d from clean implementation f66e5d4d8c1aea07a690916050a42e8279a2f464 at Pages commit bbb815ffe64acf0b713e87c40b1b60e760662bae. All 70 assets plus the service worker hash-match. Public acceptance: 31 readiness/Factory workflow checks, 51 Sanctum regressions and actual Wikipedia/Europe PMC article retrieval. Local contracts: 160 Python, 51 JS and 19 desktop Studio browser checks. The qualified native factory pins remain unchanged. Exact receipts are retained in .local/v1-readiness-20261023 and public READINESS_VERIFICATION.json.

This remains a candidate: stable promotion is explicitly refused while model, physical iPhone, authorised platforms, sync and empirical outcome gates remain open. Full ownership/acceptance is preserved in RELEASE_TARGET.json. Do not claim all of deep research or the originally requested complete product is finished. No new installer, model weight download, paid fallback or social publication occurred. Developer bundle SHA-256: b00aea015a533526ed5e730bb6f41f40bbbdded3e064dd1c4416c3386cbaf4a7.


### Candidate downloadable release verified

GitHub prerelease v1.0.0-rc.1 is public at https://github.com/Nixzle/reel-anatomy/releases/tag/v1.0.0-rc.1. The public ZIP was downloaded and SHA-256 checked: b00aea015a533526ed5e730bb6f41f40bbbdded3e064dd1c4416c3386cbaf4a7. Tag points to implementation f66e5d4d8c1aea07a690916050a42e8279a2f464; site and downloadable bytes are separately verified. Stable Windows v0.2.0 remains latest. No released asset was replaced. Source worktree is clean after this receipt commit.


## Creative Lab iteration, 24 October 2026

Owner requested comparison against others and implementation of useful gaps. Added project-authored voice playbooks, permission-gated audience CSV/text intake with deduplication and partial identifier removal, audience-to-brief snapshots, metric-blind editorial checks, reference-wording review and actual retention-to-transcript inspection. Uses existing Store/player/script editor/backup stack; no extra packages, paid services, account scraping or model downloads. Native factory pins unchanged. The comparator documents primary vendor sources and avoids claiming unverified uniqueness. Original 1.0 acceptance gates are preserved. Candidate identity: 1.0.0-rc.2; branch feature/creative-lab-20261024.

Focused evidence: 30 Python tests and the first 19-browser-check pass. An early harness asserted async brief-note content before render; retained failure and added a wait for the unchanged assertion. Final integration, portable-pack coverage and public exact-build verification are still required at this checkpoint. Raw receipts: .local/creative-lab-20261024 and .local/creative-lab-browser-*. Scope and limits: standalone/CREATIVE_LAB.md.


### Creative Lab rc.2 public verification closed

Public build 3155c7028f009c07 from source e7fcb5f3260e019fab34bbc4547ce336860e3a05 and Pages 9d2fb9a624b79a876740baeedc417848a92378b9 verified. All 74 files plus service worker match. Public checks: Creative Lab 20, readiness 31, Sanctum 51. Local contracts: 190 Python, 51 JavaScript and 19 desktop Studio checks. New data survives metadata/project packs and offline reload. Native factory pins unchanged. Final report: standalone/CREATIVE_LAB_RELEASE.md; full comparative basis and precise implementation limits: standalone/CREATIVE_LAB.md. No claim of a learned voice model, automated comment understanding, causal retention analysis, competitor-wide uniqueness or stable 1.0. The existing model, device, social-account, sync and campaign gates remain open. Evidence: .local/creative-lab-20261024.


## Production completion iteration, 24 October 2026

Owner asked to finish the app. Concentrated on core missing work rather than additional report panels: a new Windows host of the same current PWA, actual cached English speech recognition for subtitle-free videos and narration, and editable narration-timed captions used by browser and native renderers. Candidate is 1.0.0-rc.3; branch feature/production-completion-20261024. No model weights, installers, paid services or social connections were activated. The older Windows releases and the denied remote relay remain unchanged.

The loopback desktop host has same-origin/Host/session-token checks, one speech job, bounded upload/duration/sample decoding, two model CPU threads, cancellation in a supervised subprocess, a deadline and temporary-file cleanup. The hosted PWA never probes another host. Local static copies under a subdirectory also do not probe a root companion service: a browser privacy assertion caught that unnecessary request and it was removed rather than broadening the test's allowlist. Original failure logs are retained.

Timed captions bind narration SHA and the source-linked spoken-script/timeline fingerprint. Replacing narration or editing the script makes them stale, including draft exports until rebound. Changed captions clear editorial approval. Reviewed exports also reject caption wording that differs from the script and unsupported performance guarantees in caption text. Recognition and matching words are not independent evidence of truth or audio accuracy; actual listening/review remains required. Silent/no-audio video intake preserves the visual analysis without inventing speech. Older planned-caption packages remain supported.

At this checkpoint source tests and actual speech inference have run; static browser acceptance covers timed SRT, real browser/native MP4 output, preservation of the narration pause, cancellation, batch output and recovery plus all existing research/Creative Lab flows. Final delivery still requires a clean implementation commit, new portable binary, fresh extracted/downloaded-binary tests, exact public site readback and requalification of the changed native Sanctum pins including timed_captions.py. Records are under .local/production-completion-20261024. Never report a generated filename or source-mode pass as a tested distributable.

Original stable gates remain open for measured generative/vision quality, physical iPhone, authorised social-account intake, authenticated live sync and empirical cohort/campaign outcomes. These are not silently removed or satisfied by speech recognition. The new desktop and public phone library remain separate origins with explicit project-pack transfer, not automatic sync.


### Desktop packaging blocked; no retry or alternative packaging route

The direct `.venv/Scripts/python.exe scripts/package_desktop_studio.py` call was blocked by OpenAI because it could not determine safety status. This is not a Bifrost outage or permission problem to route around. Read-only reconciliation confirmed that .local/desktop-1.0.0-rc.3, dist/ReelAnatomyStudio and its ZIP do not exist. Do not replay that command through another shell, wrapper, connector or CI. No fresh executable test or downloadable Windows release can be claimed. Source-mode tests, the independent static web release and scoped native renderer qualification remain separate permitted work. The app links to honest source/delivery status instead of a nonexistent Windows download. Receipt: .local/production-completion-20261024/desktop-packaging-block.json.


### rc.3 web/source delivery verified; full app remains unfinished

Final public build 6d8bc9c379b46f3a is verified at Pages 3ccdbc21c3878458bf1bfa1e33cb2ff98bc64904 from source 30c79d2c82e876d2eead43b2fc9bd7acdd031353: all 77 files plus service worker hash-match and 119 browser checks pass. Contracts: 220 Python, 53 JS. Fresh source desktop: 19 checks with actual cached-model English ASR, silence handling and both video renderers. Native Factory 0.7 requalified and merged in private Sanctum PR 91 at 56248be7d101ab997a8dbbcfca25c98b8163652a; owned local record and doctor match. New Windows packaging was blocked before execution and never retried; no executable, ZIP or fresh-binary acceptance exists. Do not convert source-mode proof into portable-distribution proof. Public release/source docs: PRODUCTION_RELEASE.md and PRODUCTION_VERIFICATION.json. Default source integration is tracked in public repo PR 1. All original stable gates remain open as recorded.


## Authorised connections and metadata sync, 24 October 2026

Owner requested the remaining functionality. Branch: feature/authorised-connections-20261024; candidate rc.4. Added an optional official Google browser OAuth path, separate minimal YouTube/Drive scope grants, memory-only read-only YouTube channel/video/Analytics reports, and client-encrypted foreground metadata synchronisation through Drive appDataFolder. A registered OAuth web client and actual owner consent remain required. No existing ChatGPT/connector credentials were inspected or transferred. Google account responses in acceptance tests are explicit fixtures, not live account qualification.

Sync uses existing WebCrypto/IndexedDB and the real metadata validator, not a new relay. It encrypts the entire device metadata library (all research projects) with separate derived AES-GCM/HMAC keys, keeps the recovery secret outside ordinary backups, authenticates opaque history parents and hashes, reserves an immutable Drive file ID before writing, and reconciles unknown outcomes instead of creating duplicates. Three-way merge exposes edit/edit and edit/delete conflicts, binds choices to exact conflicting values, previews adds/updates/removals, and checks the local revision again inside the atomic restore. Unchanged sync does not rewrite the library or erase local approval. Actual imports still clear old approval. Keys, tokens, YouTube report sessions and original media are excluded from sync metadata and regular project packs.

Current evidence includes deterministic crypto/protocol/race checks, two isolated browser contexts using actual app/crypto/IDB over simulated OAuth/Drive/YouTube transport, and a separate successful fetch of the real official Google SDK without any sign-in or account request. No cloud permission, real account connection, live Drive transfer, physical device or external security audit is claimed. The platform and sync gates move to pending verification, not checked; all original model/device/outcome gates remain open. The denied Windows packaging and earlier remote-relay operations were not retried, rewrapped or routed through CI.

Failures retained: native window.fetch receiver caused Illegal invocation and was explicitly bound; a test saw a previous ready preview during a new asynchronous operation, so stale UI status/Apply availability now clear at start and the unchanged assertions await the actual busy state. Build also found an old Git source defect: WebLLM's tracked upstream bytes had 248 CRLF line endings normalised although the pinned retained donor and live asset were correct. Restored the exact retained donor bytes only after verifying the expected SHA and line-ending-only difference. The pin was not changed. Verify the staged Git blob and future clean checkout, not just working-tree bytes.

Acceptance to close this iteration: final exact-source regression pass, current docs, clean commit, exact GitHub Pages manifest readback and the same browser suites against public HTTPS. The original owner-account OAuth setup and real cross-device/network qualification remain a separate explicit requirement. Raw receipts are in .local/authorised-connections-20261024. Native Sanctum factory hashes are unchanged. No installer, new model weight, paid provider, social publication or arbitrary Drive-file permission was used.


### rc.4 public implementation delivery verified; live consent remains pending

Public build 28d36471bbde7386 from source 4268d27df11bb9c7e5151f9592b2c7151ffb82b1 at Pages 62943ddab2244b6f44b16312e85291d8a0f6d333 is hash-verified across all 83 files plus service worker. Tests: 220 Python, 99 JavaScript, 22 new public connection/sync browser checks, 119 existing public workflows and three real-SDK-load checks. Two isolated browser contexts exercised actual cryptography and app storage using explicitly simulated Google account transport; no real Google account or Drive cloud data was touched. The real SDK loaded without an authentication request. Detailed records: CONNECTIONS_RELEASE.md and CONNECTIONS_VERIFICATION.json. Native Factory hashes unchanged.

Original operator/client registration, Google consent and live account/cross-device verification are still required. Both platform and sync gates are pending verification, not checked. Remaining model/vision, physical iPhone and empirical campaign requirements remain open; Instagram/TikTok direct account intake is not implemented. Prior Windows packaging and relay denials were not replayed. Final source should be integrated to main through exact-head review, preserving the manual-only packaging workflow and all previous released assets.
