# Standalone phone edition: reuse and provenance

This edition uses the existing Reel Anatomy research and production interface and Python Store. It does not publish or operate the experimental desktop relay.

## Reused components

- **Reel Anatomy Studio**, Nixzle/reel-anatomy, base commit 4b3a3f2c66aa47545c8bbbfe76f245b7e79913ab. Kept the interface, comparison engine, planner, snapshot validation and outcome history. The static builder extracts the caption/validation functions and CSV importer without importing the desktop HTTP server. Original project MIT licence applies.
- **Pyodide**, requested distribution v0.29.3 from https://cdn.jsdelivr.net/pyodide/v0.29.3/full/. Used unmodified WebAssembly Python runtime and SQLite package in a module worker. Upstream source: https://github.com/pyodide/pyodide/tree/0.29.3 . Mozilla Public License 2.0 retained in vendor/pyodide.LICENSE; upstream source remains available. It is a runtime, not an AI model.
- **idb-keyval 6.2.2**, Jake Archibald. Unmodified ES module from https://cdn.jsdelivr.net/npm/idb-keyval@6.2.2/dist/index.js . Apache 2.0 notice retained in vendor/idb-keyval.LICENSE and full licence in vendor/Apache-2.0.txt. Source: https://github.com/jakearchibald/idb-keyval . Used for promise-based IndexedDB storage and atomic compare-and-swap updates.
- **Browser-native video and canvas APIs** provide sampled local visual transitions. This is an original integration, not imported FFmpeg and not learned shot understanding.

Exact runtime/download hashes are retained in RUNTIME_PINS.json and the deployed BUILD.json. The builder publishes an explicit source list. It does not copy the desktop library, credentials, model cache, relay worker or private process logs.

## Safety review

This is Ultron's single-session adversarial review, not independent worker approval. The previous safety-denied Cloudflare deployment-list and authenticated relay-browser test were not retried or redirected. The new app has no relay, desktop connection, cookie sessions, cloud data API or secrets. The public host serves code only; research lives in the browser's IndexedDB. File exchange is explicit and not automatic synchronisation.

Key trade-offs: browser storage can be evicted; exports exclude original media; native phone codecs vary; leaving the app can interrupt inspection; first use needs application downloads. Offline, restore and data-isolation checks are separate from physical iPhone testing. Automatic phone transcription and learned semantic video analysis remain unqualified. The 0.5.0 edition adds an explicit local text-model option; the difference between installed code, loaded runtime and measured model quality remains visible.

## Official references

- https://pyodide.org/en/0.29.3/usage/index.html
- https://github.com/jakearchibald/idb-keyval
- https://support.apple.com/guide/iphone/iphea86e5236/ios
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site


## Sanctum 0.5.0 reuse

- **WebLLM @mlc-ai/web-llm 0.2.86**, official npm package. The unmodified self-contained ESM library is retained as vendor/webllm.mjs with its Apache 2.0 notice in vendor/webllm.LICENSE. Exact URL, bytes and SHA-256 are recorded in MODEL_RUNTIME_PIN.json. No model weights are committed or included in the public app cache. The module is loaded only by the optional reasoning setup; the default evidence workflow does not require it. Source: https://github.com/mlc-ai/web-llm ; official worker integration: https://webllm.mlc.ai/docs/using-webllm/advanced_usage.html .
- **Crossref REST API** and **MediaWiki Action API**: official public discovery protocols, not copied implementation. Source records retain returned provenance, URLs and excerpt coverage. Crossref bibliographic metadata may omit abstracts; full papers are never assumed read. Wikipedia snippets are attributed background material. References: https://www.crossref.org/documentation/retrieve-metadata/rest-api/ and https://www.mediawiki.org/wiki/API:Search .
- **Existing Reel Anatomy + SQLite FTS5**: kept the local Store, research projects, snapshot validation, production planner, browser worker, IndexedDB compare-and-swap and backup format. Added an evidence extension rather than a replacement repository or separate cloud database.

The public SANCTUM_PROFILE.json is a newly authored, task-scoped identity and capability profile. It contains no private canonical files, personal user history, account access or remote tool authority. Names identify the interface/procedures; they do not establish independent workers or shared live ChatGPT memory.

The optional model publisher may change weights under a named model repository. The application runtime is pinned, but this release does not claim immutable weight provenance or a measured reasoning benchmark. User-visible model identity and the bounded cited input are retained with each generated proposal.


## Reel Factory 0.6.0 reuse

Kept the existing Studio planner, research claim/source ledger, Pyodide/SQLite, IndexedDB and versioned backup path. Browser output uses standard Canvas captureStream, MediaRecorder and Web Audio rather than adding a new renderer dependency. The native local tool uses already installed Pillow and FFmpeg for typography, clip assembly, ASS/SRT captions and H.264/AAC MP4 output. Nothing installs or republishes those dependencies. System fonts are used locally but no font files are shared.

Official implementation references inspected: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static ; https://www.w3.org/TR/mediacapture-fromelement/ ; https://www.ffmpeg.org/ffmpeg-filters.html . Codec support is probed, not assumed from the browser's name. An available codec can still fail due to resource limits.

The factory examples are original text-card designs and authored wording. Their limited platform-feature description is a paraphrase linked to Meta's primary Trial Reels announcement. No creator footage, copyrighted music, unauthorised voice likeness or synthetic performance result was used. Test media and audio use generated patterns/tones and are not represented as real creative assets.


## 1.0 candidate document and transfer donors

Unmodified npm packages are pinned by distribution integrity and individual-file hashes in DOCUMENT_RUNTIME_PINS.json: Mozilla pdfjs-dist 6.4.299 (Apache-2.0), @mozilla/readability 0.6.0 (Apache-2.0), and fflate 0.8.3 (MIT). PDF.js uses its display/worker layer. Readability is not a sanitizer; original HTML is stripped in an inert template and only extracted text enters source records. Archive decoding uses a restrictive stored-entry format validated before the library runs. Version 0.8.3 is retained rather than the older ZIP64-affected 0.8.2 line. No package installer or model download was run.

Primary references: https://mozilla.github.io/pdf.js/getting_started/ ; https://github.com/mozilla/readability ; https://github.com/101arrowz/fflate/releases/tag/v0.8.3 ; https://europepmc.org/RestfulWebService . The public app includes the required donor notices but no font files. Reuse was reviewed in this implementation session; no independent worker review is implied.


## Production completion rc.3

Reuses the existing cached Systran faster-whisper base.en English model and already-installed faster-whisper 1.2.1, CTranslate2 and PyAV 17.1.0. No new package, model weight, paid service or account is installed. The supervised desktop host uses word timestamps to propose caption timing; this is recognizer alignment, not a guarantee of transcript accuracy or a forced-alignment model. The existing source/rights review, SQLite/browser storage, browser media recorder and native Pillow/FFmpeg renderer are retained. Runtime/model notices are copied into the portable package. No font files are redistributed.
