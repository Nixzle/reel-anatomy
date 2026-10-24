# Reel Anatomy / Sanctum

A local-first workspace for researching short-form content, keeping evidence attached to decisions, making original Reels and recording actual outcomes.

**Open the web app:** https://nixzle.github.io/reel-anatomy/

**Current status:** 1.0.0-rc.4. The web app is a release candidate, not qualified stable 1.0. The new desktop host is tested from source, but its Windows packaging command was blocked before execution. There is no new portable executable to download. Existing released Windows v0.2.0 assets are unchanged.

## Workflow

1. In Sanctum, import sources, PDFs, saved articles and permitted transcripts. Read original material, retain counterevidence and link exact passages to claims.
2. Use Creative Lab for your channel playbook, supplied audience questions, metric-blind script checks and actual retention observations.
3. In Studio, create and edit an original filming brief, with an explicit hypothesis rather than a promised result.
4. In Reel Factory, assemble owned/licensed footage, images and narration. Create three opening variants, attach evidence, inspect the actual edit and render a draft or a genuinely reviewed version.
5. Register the actual exported file as our draft and use Results to preserve the original test and real observations.

The evidence interface is not this ChatGPT session. It does not inherit private memory, account connections or tools. Default evidence mode is labelled source retrieval. The included script planner is structured; optional language-model reasoning has its own setup and remains unqualified by broad semantic-quality evaluation.

## Optional authorised account reports and encrypted sync

Settings now contains a deliberately opt-in Google connection layer. The operator must register this app's OAuth web client and satisfy Google consent/verification requirements; users then authorise read-only YouTube or app-specific Drive access separately. No account is inherited from ChatGPT. The app does not contact Google merely by opening.

YouTube channel/upload/Analytics reports are displayed only for the authorised account and active session. They are not imported into custom scores, assistant prompts, library exports or sync. No social writing or video download is enabled. Tokens stay in memory and session reports clear on disconnect/expiry/revocation/page exit.

Encrypted metadata sync uses Drive's hidden appDataFolder, an independently saved recovery key, authenticated immutable checkpoints, explicit three-way conflict review and atomic local application. It covers all research projects in the device library, not only the selected project. Original media stays local and can be transferred with project packs. Upload outcomes are reconciled using the same reserved file ID; unknown writes are never silently duplicated. This is foreground, user-initiated sync, not a continuously running cloud account service.

See `standalone/CONNECTIONS.md` and `standalone/CONNECTIONS_PRIVACY.html` for setup, data handling, recovery and limits. Actual registered-client consent, owner-account retrieval and physical two-device sync remain unverified; mocked protocol tests are not live-provider acceptance. Stable 1.0 is not promoted by these additions.

## Narration-timed captions

The web app can import and edit SRT/VTT. A timed track binds the exact narration file and the spoken script/timeline. Changing the audio or script requires rechecking the track. Reviewed exports also reject caption wording that differs from the source-linked script. Both native and browser renderers use the timed track, including its silence gaps. Without a track, proportional planned captions remain explicitly labelled.

On the existing configured Windows development computer, the unified host runs with:

    .venv\Scripts\python.exe desktop_studio.py

It serves the same app at http://127.0.0.1:8766 and uses the existing local English Whisper model for video transcription and narration timing. This command is not a package installation. A recipient without the configured Python environment/model does not yet have a new one-click desktop release. See standalone/DESKTOP_COMPLETION.md for the tested scope and blocked delivery status.

Recognition and word times are estimates, not perfect forced alignment. Check the recording and text. Silent clips do not get fabricated speech. Nothing is automatically posted to a social account.

## Data and recovery

The library is stored in this browser. Desktop and hosted-phone origins are separate. Project packs transfer research and selected original media/documents explicitly. The separately configured encrypted sync route transfers metadata only, with review before application. Backups and packs require deliberate storage outside the browser because browser data can be evicted. Packs are not encrypted. Restoring a campaign clears previous approval, and invalid or interrupted restores must not replace committed work.

Save work and close old app tabs to activate an update. Do not clear website data just to update. Application-cache files are hash checked. Source footage, prompts and credentials are not published with the app.

## Verification and remaining work

The implementation has deterministic Python/JavaScript tests, actual browser and native video checks, generated-document tests, recovery tests and source-mode local speech inference. Exact current receipts are retained in standalone/PRODUCTION_RELEASE.md and standalone/PRODUCTION_VERIFICATION.json once the delivery record is complete. Historic release records remain in standalone and RELEASE_HISTORY.md.

Original stable-1.0 requirements remain in standalone/RELEASE_TARGET.json: measured generative/vision quality, physical iPhone/Safari qualification, authorised social-account intake, authenticated live sync and real-world cohort/campaign validation. A speech recogniser, synthetic fixture or successful renderer does not close those requirements. No guaranteed virality or calibrated view probability is claimed.

The old denied remote-relay deployment and the newly blocked Windows packaging operation were not retried through alternative routes. No new model download, installer, paid provider or account connection was activated in the rc.4 iteration.

## Source and licences

The standalone web build reuses the existing Store, Pyodide, SQLite, PDF.js, Readability, WebLLM runtime and browser media APIs. Licensed donors and exact pins are recorded in standalone/DONORS.md and the runtime-pin JSON files. Model weights, private libraries and generated test output are not committed. Do not redistribute system font files.

The checked local Sanctum Reel Factory binding pins its implementation and refuses unexpected source changes. That binding is a local production tool, not a new global ChatGPT connector or publishing authority.
