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
