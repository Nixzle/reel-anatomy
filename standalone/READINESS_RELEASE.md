# Reel Anatomy 1.0.0-rc.1: verified candidate

## Status

Live web app: https://nixzle.github.io/reel-anatomy/

The 1.0 release candidate is published and tested. **Stable 1.0 is not qualified.** Original acceptance gates remain open for measured generative/semantic quality, physical iPhone/Safari, authorised social-account intake, live cross-device sync and real campaign outcomes. The software refuses stable promotion while those gates remain open; they were not removed to satisfy a version label.

Implementation commit: `f66e5d4d8c1aea07a690916050a42e8279a2f464`. Public Pages commit: `bbb815ffe64acf0b713e87c40b1b60e760662bae`. Build: `ddaded4d5868ed1d`. Verified at 2026-10-23T10:54:08.232927+00:00. All 70 manifest files and the service worker matched the clean tested source build. Rollback commit: `524bc24086503920ec2ff7ccb658c457c28ca9b5`.

## Delivered in this iteration

- A Start workflow and readable phone workspace selector connect research, scripts, Reel Factory and Results.
- PDF page extraction and original-page inspection retain document hashes and exact page references. Blank/scanned pages remain unknown. Saved HTML is reduced to readable text without executing scripts or loading its remote resources.
- Full available article text can be explicitly requested from Wikipedia and Europe PMC open-access article endpoints. This is a named-provider reader, not an arbitrary crawler or access bypass. Retrieved content remains unreviewed and does not imply interpretation of figures or tables.
- Portable project packs can retain the library, original footage/audio/documents and historical exported videos. File hashes, strict archive bounds and metadata validation precede a single IndexedDB restore commit. A failed write or cancellation retains the committed old state. Prior editorial approval is not revived by restore.
- Actual completed render files can be registered idempotently as our draft posts, preserving authored timing and their file identity. No social publication, rights certification or metric is fabricated.
- Diagnostics omit private source titles, filenames and prompts. Offline installation checks the build identity and every precached file hash; a mismatched candidate is rejected without deleting the previous app cache. Updates do not force activation across active editors.

The original evidence board, source-linked Ultron interface, three-variant video compositor, draft/review separation and result-tracking workflows remain. The native Sanctum renderer's checked implementation hashes are unchanged and its doctor/inspect actions still pass. Windows v0.2.0 remains the existing stable executable; this candidate is a browser application, not a replacement Windows installer or App Store binary.

## Verification

160 Python tests passed. 51 JavaScript checks passed, including four checks of the exact generated service worker. The actual public HTTPS build passed 31 readiness/production browser checks plus 51 existing Sanctum workflow checks. Another 19 desktop Studio browser checks passed on the local source. Real Wikipedia and Europe PMC full-text requests succeeded separately from synthetic provider fixtures.

The readiness browser checks imported actual generated PDF/HTML files, rendered original PDF pages, produced and decoded a portrait MP4 with audio, linked its actual bytes to the draft library, produced three variants, verified an approximately 7.9 MB test project pack, rejected changed bytes, aborted a failed database transaction without partial restore, restored original media/documents, and reopened the library and PDF reader offline.

Tests used generated media/documents and isolated Chrome profiles at a 390-pixel viewport on the Windows build host. They are not physical-iPhone acceptance, real model inference, independent editorial approval or proof of campaign improvement. No model weights, paid service, installer, private account connection or automatic publication was activated.

## Limits and safeguards

PDF intake: 20 MB and 200 pages, with explicit text-size bounds. Saved HTML: 2 MB. Portable packs: 200 MB total. Packs are not encrypted; share them only with intended recipients. Browser storage can be cleared or evicted, so save important packs and rendered videos outside the app.

Text extraction may misorder tables, columns and equations; original-page inspection is available but no OCR or learned image interpretation is claimed. Captions remain authored/planned timing, not automatic narration alignment. The local assistant's existing model setup is optional and unqualified by actual inference in this release. Generative imagery/music/narration are not produced automatically. No virality guarantee or calibrated view prediction exists.

## Use this version

Open the same app link. Use Start to choose research, scripting, production or results. In Sanctum > Archives, open “Read a PDF or saved article.” In Settings, use “Portable project packs” to carry media and research together. In Reel Factory, a completed output now has “Use this render as our draft.”

Save edits before updating. Close all old Reel Anatomy tabs and reopen when an update is ready. Do not clear website storage just to obtain the update. The service worker may retain the old app until its existing clients close.

## Developer bundle

The web bundle `ReelAnatomy-Web-1.0.0-rc.1.zip` contains only public application files, licensed runtime notices and original examples. Its SHA-256 is `b00aea015a533526ed5e730bb6f41f40bbbdded3e064dd1c4416c3386cbaf4a7` (9634797 bytes). It contains no private library, model weights or font files. Serve it from HTTPS or local loopback; direct file:// launch is not supported. The candidate release is marked prerelease and does not replace the stable Windows download.

Exact checks and limits are recorded in READINESS_VERIFICATION.json, READINESS.md and RELEASE_TARGET.json. The continuing owner remains Ultron Prime; no unattended iteration or background completion is implied by this record.


## Published prerelease download verified

https://github.com/Nixzle/reel-anatomy/releases/tag/v1.0.0-rc.1

The prerelease was published, then the public ZIP was downloaded without authentication and checked against SHA-256 `b00aea015a533526ed5e730bb6f41f40bbbdded3e064dd1c4416c3386cbaf4a7`. Its 70 manifest files and ZIP integrity had also been verified from the uploaded draft asset. The prior latest stable release remains `v0.2.0`. This publication does not close the open 1.0 acceptance gates.
