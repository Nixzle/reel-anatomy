# Reel Anatomy rc.3: production delivery and explicit limits

## Status

The current web app is live at https://nixzle.github.io/reel-anatomy/ . Candidate: 1.0.0-rc.3, build `6d8bc9c379b46f3a`, implementation `30c79d2c82e876d2eead43b2fc9bd7acdd031353`, Pages commit `3ccdbc21c3878458bf1bfa1e33cb2ff98bc64904`. All 77 manifest files and the service worker match the tested build. The original full application is not qualified as stable 1.0.

The new desktop host is implemented and tested from source. **There is no new Windows executable or ZIP.** OpenAI blocked the packaging command before execution because it could not determine the request's safety status. Reconciliation confirmed that no build directory, executable or archive was created. The operation was not retried through a different shell, tool, connector or CI. The existing stable Windows v0.2.0 download is unchanged.

## Delivered

Reel Factory now accepts editable timestamped SRT/VTT tracks. The desktop source host can recognise the saved English narration using the already cached local Whisper model, propose word-timed captions and preserve silence. Applying the proposed track remains an explicit action. The phone web app uses imported subtitles; it does not upload recordings to a desktop or cloud service.

Caption tracks bind the narration file hash and spoken-script/timeline fingerprint. Changing audio or script makes the track stale. Caption edits clear prior review. Reviewed export rejects caption wording that differs from the source-linked script, and the explicit performance-guarantee check also covers caption text. This is consistency checking, not proof that the recording or the claim is correct. Listen, inspect and correct recognition before human review.

Both renderers consume the same timed track. Actual browser and native portrait MP4s with audio were produced and decoded. Frame inspection confirmed visible captions during the spoken interval and no caption through the intended pause. Planned proportional timing is still the labelled fallback for old packages and deliberate silent edits. Three-variant production, source checks, recovery and explicit draft/result registration remain.

The desktop source host serves the same current research, Creative Lab and Factory workspace on loopback. Subtitle-free video imports can run the existing English recogniser locally. Silent or audio-free videos keep their visual analysis without a fabricated transcript or stuck queue. There is one speech job at a time, bounded file/duration/decoded samples, two CPU threads, a cancellable child process and a runtime deadline. Host/origin/token guards reject unrelated requests. There is no arbitrary command or URL-fetch API and no cloud-model fallback.

The native Sanctum renderer was requalified with the new timed-captions dependency in its exact source pins. Doctor, package inspection, a real timed render, a backward-compatible three-variant batch, existing-output rejection and altered-pin rejection passed through the wrapper. That capability is local production machinery, not a new global ChatGPT connector or private-memory transfer.

## Verification

220 Python tests and 53 JavaScript checks passed. The final public HTTPS build passed 119 browser checks: 17 timed-caption/render checks, 31 production/recovery checks, 51 Sanctum checks and 20 Creative Lab checks. The separate source-mode desktop run passed 19 checks including actual speech inference, narration timing, a silent video, local playback and both renderers. Local speech cancellation was exercised separately.

Tests used generated media and synthetic data in isolated Chrome profiles on the same Windows host. They are not physical iPhone qualification, independent human editorial approval, a calibrated semantic-model benchmark, real campaign improvement or a tested Windows distributable. No new model weights, installers, paid services or account connections were activated.

The final shared UI explicitly distinguishes desktop speech from standalone-phone capabilities. A prior localhost-subdirectory probe was removed when the privacy regression caught it; the test allowlist was not weakened. All final public runtime assets are hash-verified, and rollback commits remain in Git history.

## Use

Open Reel Factory, attach and save narration, then use **Captions that follow the narration**. On the phone, import SRT/VTT. On the configured development computer, the desktop source can recognise saved narration locally. Inspect or edit the result, apply it, reconcile any script-word mismatch and review the actual exported video.

To run the tested source on the already configured Windows computer, use `.venv\Scripts\python.exe desktop_studio.py` from the project directory. It opens the app at `http://127.0.0.1:8766`. This is not a new installer or portable download. See DESKTOP_COMPLETION.md. A recipient without the configured runtime still needs a separately approved and verified distribution build.

Desktop, hosted-phone and legacy app libraries are separate origins. Use the existing project packs or research/analysis JSON transfer, not an assumed automatic sync. Save work before updating and close old app tabs; do not delete browser storage just to update.

## Remaining original scope

Stable 1.0 still requires measured generative/vision quality, physical iPhone/Safari acceptance, authorised social-account intake, authenticated live sync and actual cohort/campaign outcomes. The account/sync capabilities are not implemented merely because an import form exists. Speech recognition does not establish deep-research or semantic-video quality. Packaging is additionally blocked in this session. The original acceptance ledger and owner are retained in RELEASE_TARGET.json and HANDOFF.md.

Default source integration is tracked in repository PR #1, whose live GitHub status is authoritative. This source integration does not trigger the manual-only build workflow, rerun the blocked packaging command, change existing released assets or promote the candidate to stable. Detailed machine-readable evidence is in PRODUCTION_VERIFICATION.json.
