# Reel Anatomy on-device phone edition 0.4.0

## Published app

https://nixzle.github.io/reel-anatomy/

The public HTTPS static app is deployed and verified. Build fe74032a5f637b18 comes from source commit 00017cbd5ea15a3e26db6703e0b7fbad07ebaa70. Publication commit: b892394a7887e1e026deec7bd15907a55977485a. All 33 files in the build manifest matched their public SHA-256 values.

## What runs on the phone

Research projects, the library, local video inspection, imported captions, timed metrics, descriptive patterns, structured scripts and shot lists, rough-cut checks, prospective result tracking, exports and restore all run on-device. No desktop connection, pairing token or account is required. The full engine and saved work reopen offline after the first successful load.

Local videos are capped at 100 MB. Visual changes are sampled, not frame-accurate cuts or learned camera-shot descriptions. Keep the application in the foreground during video inspection. The desktop version remains the heavier processing option.

Automatic speech transcription and learned semantic inference are not bundled in the phone edition. Supply SRT/VTT, paste a transcript, or import completed Windows analysis JSON. The planner is structured, not a learned AI model. There are no promised viral outcomes.

## Privacy and exchange

Tests observed only same-origin static GET requests. No library, media, transcript or metric was uploaded by the app. Research and media are stored in IndexedDB in the active browser context. A separate user context started empty.

Cross-device work uses explicit JSON export/import, not automatic live synchronisation. Backups include metadata, analyses, scripts and observations, not original videos. Source media can be reattached locally. Browser storage may be cleared or evicted; export important work. Safari and the Home Screen app may have separate storage, so install before importing important work.

## Reuse

The existing Python Store and production UI were reused rather than rewritten. Pyodide runs the Python/SQLite engine in a Web Worker. Unmodified idb-keyval 6.2.2 provides IndexedDB operations. Version pins, hashes, licences and donor sources are retained in DONORS.md, RUNTIME_PINS.json and vendor notices.

## Verification

32 browser acceptance checks passed against the actual public HTTPS site using an isolated Chrome profile at a 390-pixel phone viewport. They exercised import/reuse, supplied captions, metrics, sparse-evidence warnings, script editing and history, draft review, result tracking, safe areas, JSON exchange, invalid-backup rejection, separate-user isolation, full offline reopening and offline editing. 19 existing desktop Studio browser regressions and 11 frontend checks also passed.

These are generated media/metrics fixtures, not a real campaign. A physical iPhone, Safari codec behaviour, automatic speech on-phone, actual semantic quality and large-corpus throughput remain unverified. The previous Cloudflare desktop-relay safety denials were not replayed or redirected; that different candidate stays undeployed. Stable Windows v0.2.0 is unchanged.

## Install

Open the published app in Safari. Use Share (or More, then Share), Add to Home Screen, enable Open as Web App, then Add. If the action is missing, use Edit Actions in the share sheet. The app also includes an Install button with these instructions. This is a web app, not an App Store or TestFlight binary.
