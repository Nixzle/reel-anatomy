# On-device phone edition 0.4.0

## Delivery contract

Installable, static web app using the existing research and production engine inside a browser worker. No relay, desktop connection, pairing token, account or cloud data API. The original relay candidate and its safety-denied operations remain untouched.

Current validation uses generated media and an isolated Chrome profile at a 390-pixel mobile viewport. It checks the actual WebAssembly Python/SQLite engine, native video inspection, caption imports, queue persistence, research/metrics, scripts/history, outcomes, safe areas, file exports, restore integrity and offline reopening. A separate user context must remain empty. These checks are not physical Safari or iPhone acceptance.

## Scope

The phone edition can inspect local videos up to 100 MB, preserve captions and imported desktop analysis, compare genuinely supplied metrics, create structured filming plans, review rough cuts and record prospective results. Videos stay in browser storage. Keep the app visible while inspecting media.

This does not silently replace original requirements: automatic phone speech transcription, learned semantic video analysis, automatic desktop/mobile synchronisation and platform account retrieval remain unimplemented or unqualified. The Windows speech engine remains available; transfer its JSON explicitly. Phone planning is structured, not a learned language-model result. Browser scene sampling is approximate and kept separate from imported cut methods in comparison groups.

## Data recovery and privacy

Export library backup before clearing browser data. Backups contain analysis, research, scripts and observations, not original video. Importing a backup replaces the device metadata only after validation. The UI retains a pre-restore recovery copy. Importing research or analysis creates a new copy and does not overwrite existing edits. Browser storage can still be evicted and is not guaranteed permanent. Safari and the installed web app may have separate storage.

No authentication or private relay test is part of this edition. Publishing serves an explicit allowlist of public application/runtime files. User library files, source video, tokens, private logs and desktop bridge code are not in that allowlist.

## Rebuild

Run `python scripts/fetch_standalone_runtime.py` to obtain hash-pinned application runtime files, then `python scripts/build_standalone.py`. No model or system package is installed. Serve `phone-dist` from HTTPS or local loopback. Browser acceptance is `node scripts/standalone-smoke.mjs` with RA_PHONE_ORIGIN set to the actual site root (including any subpath). Preserve the output receipt and build hash.

## Remaining acceptance

Owner: Ultron Prime. Physical iPhone Home Screen installation, actual Safari video-codec handling and large real-corpus throughput remain to be measured. Prototype/source tests, public deployment verification and device installation are distinct claims. No campaign uplift or causal virality is established by this release.
