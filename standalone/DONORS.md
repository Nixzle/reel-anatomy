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

Key trade-offs: browser storage can be evicted; exports exclude original media; native phone codecs vary; leaving the app can interrupt inspection; first use needs application downloads. Offline, restore and data-isolation checks are separate from physical iPhone testing. Automatic transcription and learned semantic inference remain available only where independently configured and tested on desktop; none is claimed for this edition.

## Official references

- https://pyodide.org/en/0.29.3/usage/index.html
- https://github.com/jakearchibald/idb-keyval
- https://support.apple.com/guide/iphone/iphea86e5236/ios
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
