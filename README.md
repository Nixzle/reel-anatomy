# Reel Anatomy: Sanctum research edition

**Phone/browser app:** https://nixzle.github.io/reel-anatomy/

The published 0.5.0 phone edition adds project-scoped sources, indexed search, explicit Crossref/Wikipedia discovery, claim/counterevidence links, revision-aware citations, an embedded Ultron evidence interface and an optional local WebLLM text model. Default evidence mode is labelled retrieval, not generative AI. The on-device model requires a separate explicit download and compatible hardware; real model quality has not been qualified. See standalone/ACCEPTANCE.md and standalone/DONORS.md for exact capabilities and boundaries.

The original Windows release and video production workflow remain below. Exact public deployment and verification are retained in standalone/SANCTUM_RELEASE.md and standalone/SANCTUM_VERIFICATION.json.

# Reel Anatomy Studio

A local-first Windows research and production app for short-form video.

**This branch: 0.3.0 phone/PWA candidate, not deployed. Stable public release: 0.2.0 beta.** It joins a research library, resumable video processing, descriptive pattern comparisons, filming briefs, rough-cut checks and outcome tracking. It does not promise virality.

## Phone candidate status

The iPhone-installable web-app shell, explicit offline filming copies and outbound authenticated desktop relay are implemented in this candidate. Hosting and authenticated phone-browser verification were blocked by current tool safety checks. There is no live iPhone installation URL yet. Do not treat the Windows ZIP as an iOS app. See [MOBILE.md](MOBILE.md) for the exact privacy model, completed checks and remaining acceptance.

## Download and run

Download **ReelAnatomy-Windows-x64.zip** from the v0.2.0 GitHub Release, extract the entire folder, and run **ReelAnatomy.exe**. Keep the `_internal` directory beside the executable. The interface opens in your browser; the server and analysis run on your computer. The portable Windows x64 package includes Python, English speech recognition and FFmpeg. It is unsigned; verify its checksum and respect device policy.

Existing v0.1.1 analyses remain in the same local data directory. They appear under **My research** with unknown creator, rights and distribution metadata until you supply those details. Do not run two versions against the same library simultaneously.

## The workflow

### Library: define a question and collect relevant posts

Create a research project with its topic, audience, platform and objective. Keep **References**, **Our published posts** and **Our drafts** separate. Include ordinary and unsuccessful posts as well as strong ones.

Upload authorised MP4, MOV, M4V or WEBM footage. Each file may be up to 200 MB; the queue accepts up to 200 unfinished jobs. Optional SRT/VTT/TXT files are matched by filename. Processing uses one worker, survives browser reloads, reuses identical media/transcript analysis and keeps distinct publication records separate. Interrupted jobs pause for explicit resume after an app restart; queued work can continue while the app is running. Pause affects the next job, not a currently running operation.

Enter creator, topic cohort, publication time, source link, collection and whether distribution was organic, paid or unknown. Source links document provenance; they do not trigger downloading or scraping. Metadata CSV templates use exact post IDs to avoid ambiguous matches.

### Breakdown: inspect evidence

Speech transcription and estimated scene boundaries have separate seekable timelines. Edit the transcript, primary narrative role and shot descriptions. Roles from the included deterministic rules are suggestions, not semantic-model predictions. Imported plain-text timestamps are explicitly approximate; timed captions preserve their supplied timing.

### Patterns: compare similar observations

Append actual snapshots with a source and a timezone-aware capture timestamp. Supported windows are 24 hours, 72 hours, seven days and lifetime. Age-window checks reject mislabeled snapshots. Missing metrics remain unknown. The app accepts observed views, engagement counts, qualified conversions, average watch time, three-second retention and completion percentages when supplied by your source.

The Patterns screen keeps view definitions separate. It normalises to at least three earlier matched posts from the same creator, then compares only creator/topic/duration/format strata containing both feature states. It shows sample sizes, supporting examples, counterexamples and exploratory creator-cluster bootstrap intervals when enough matched data exists. Lifetime totals do not become age-matched data. There is no calibrated virality score, causal-effect claim or guarantee that patterns generalise.

Choose **Use as a test hypothesis** to bring a pattern into Studio. The evidence state, comparison window and counterexamples are retained with the new brief. Sparse evidence remains visibly sparse.

### Studio: plan an original post

Supply a topic, audience, goal, honest promise, actual proof, method, available footage and call to action. The included **structured planner** creates three opening alternatives and a five-beat filming plan from those facts. It retrieves relevant reference structures without copying reference scripts. This default planner is not learned AI.

Edit and save the script with revision history. Export a standalone, phone-friendly HTML filming brief or Markdown. Exported HTML has no application scripts and does not expose the local server. Upload a rough cut to compare actual length, speech timing, role-based demonstration timing and CTA observations with the plan. Visual truth, caption readability and claim support still need human review unless supported by inspected evidence.

### Results: learn from our own posts

Before publishing, record the one change, hypothesis, primary metric, observation window and draft. The app freezes the script revision. After publication, enter the real publication time and append outcomes. Earlier comparable own posts form a descriptive baseline when at least three are available. Save what happened, including disappointing outcomes. Organic uploads are not randomised A/B experiments.

## Optional learned semantic analysis

A local-only Ollama connector is implemented at **127.0.0.1:11434**. Settings lists already installed models. No runtime, weights or paid service is installed or purchased by this app. Declared cloud-backed models are rejected, and no cloud fallback is made. A modified local service could still forward requests; control and trust your local service configuration.

A configured text model can suggest multiple narrative roles and refine scripts. A vision-capable model can describe sampled still frames. Inference uses the documented Ollama chat/schema API, validates returned evidence indices, pins model identity, caches results and keeps performance metadata out of the classification prompt. Suggestions require explicit application. Frame descriptions do not establish camera movement, sound design or unsampled content.

**Release verification boundary:** this version's local-model transport and validation are tested with synthetic responses. No compatible service/model was available on the build host. Real semantic quality, throughput and accuracy on representative creator videos have not been measured. The default research/planning/media workflow works without that optional service.

Official integration references: https://docs.ollama.com/api/chat and https://docs.ollama.com/capabilities/structured-outputs .

## Privacy and storage

Data stays under `%LOCALAPPDATA%/ReelAnatomy` on Windows or `~/ReelAnatomy` elsewhere. The studio stores metadata in `studio.sqlite3`; original analyses remain JSON files. `REEL_ANATOMY_HOME` selects a different directory and `REEL_ANATOMY_PORT` changes localhost port 8765. The server binds only to loopback and checks Host and browser-origin boundaries. It is for one trusted local user, not public internet hosting.

Back up the entire data directory with the app closed to include media and all research state. The research JSON export includes metadata, snapshots, plans and experiments, not videos. It is an export, not a claimed full restore/import format. Close the app before moving or deleting its data.

## Developer setup and verification

Python 3.13 is used for the verified Windows build. Create an isolated virtual environment and install the reviewed requirements only when intentionally setting up a developer environment:

    python -m venv .venv
    .venv\Scripts\python.exe -m pip install -r requirements-build.txt
    .venv\Scripts\python.exe app.py

Speech uses an existing cached `Systran/faster-whisper-base.en` model or `models/base.en`; it never downloads one during analysis. Model weights are not in Git. Python 3.10+ source use is intended, but other operating systems and Python versions are not independently qualified by this release.

    .venv\Scripts\python.exe -m unittest discover -v
    node test_frontend.cjs
    node scripts/browser-smoke.mjs
    node scripts/studio-smoke.mjs

Browser tests use an existing Chrome installation and Node, with isolated profiles and synthetic media. They install nothing. `scripts/package_release.py` requires a clean committed tree, packages the current application version and runs real executable media checks with an empty external model cache. The release must be downloaded again, hash-checked and tested before handback. The model-contract fixtures are not semantic-model benchmarks.

## Boundaries still open

No native Instagram/TikTok/YouTube account connectors, private analytics, automatic web scraping, automatic publishing or generated imagery are included. Native text posts and carousels are not ingestion formats in this video-first release. A native iPhone application, shared hosted workspace, a second physical test computer and human usability review remain separate acceptance gates. See HANDOFF.md for ownership and next acceptance criteria.

Original source is MIT licensed. Bundled libraries, the speech model and FFmpeg retain their own notices and licences; see THIRD_PARTY_NOTICES.md and the packaged licenses directory.


## Standalone phone edition (0.4.0)

**Live app: https://nixzle.github.io/reel-anatomy/**. See standalone/RELEASE.md for verified capabilities, installation and limits.

The feature/standalone-ios-20261023 branch contains a static, on-device phone edition. Unlike the older undeployed relay candidate, it does not connect to a desktop or require pairing. It reuses the existing research engine through Pyodide and stores data privately in IndexedDB. See standalone/ACCEPTANCE.md and standalone/DONORS.md. Build with scripts/fetch_standalone_runtime.py and scripts/build_standalone.py. The generated phone-dist directory is the only static publication source.

This is a companion with explicit JSON exchange, not automatic cloud sync. Automatic speech transcription stays in the Windows edition; the phone can import SRT/VTT and desktop analysis JSON and sample local visual changes. Preserve the stable Windows release; no already-published ZIP is replaced by this work.
