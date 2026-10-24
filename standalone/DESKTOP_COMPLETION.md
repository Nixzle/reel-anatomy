# Reel Anatomy Studio desktop candidate

Extract the entire archive, then run ReelAnatomyStudio.exe. Keep its _internal folder beside it. The app opens at http://127.0.0.1:8766 and serves only this computer. Closing the desktop process stops local speech jobs; the previously cached browser library remains on the device.

This is the same research, Creative Lab and Reel Factory workspace as the current public app, with bundled English speech recognition. It is a release candidate, not a claim that every original 1.0 requirement has passed. It does not inherit your ChatGPT account, memory, permissions or reasoning model.

## Use

Import permitted videos in Library. With the desktop speech setting enabled, videos without supplied subtitles are transcribed locally using the included English model. No model download, account, API key or cloud speech bill is required. The narration/caption controls in Reel Factory can recognise a saved recording, show editable timed subtitles, and apply them only after your explicit action. The timing is estimated by speech recognition, not perfect forced alignment. Check words and timing against the actual audio before approving a production version.

In the public phone app, import SRT/VTT to attach the same timed track. Its speech button does not send recordings to a desktop or cloud server. Transfer work with project packs. This is explicit transfer, not live sync.

## Storage and upgrading

This desktop edition uses the browser library at its own localhost origin. Existing public-app and older Windows-app data are not overwritten or silently migrated. Export a project pack from the prior browser app and restore it in Settings; original media and documents can be included. For legacy Windows v0.2.0, export its research/analysis JSON and import it using the existing Settings workflow. Never clear website storage as an update method.

The desktop host accepts at most one local speech job at a time, at most 100 MB and fifteen minutes per recording. CPU use is limited to two model threads. Jobs have a four-minute deadline, a cancellation route and temporary-file cleanup. It exposes no arbitrary URL-fetch, terminal, account or private filesystem action. Browser requests need the local host, permitted origin and the session token. It is not intended to be proxied or exposed to the internet.

## Important limitations

English speech recognition can make mistakes. Word timestamps are estimates. A transcript is not semantic video understanding. The optional local text-model feature still requires its own explicit setup, and actual reasoning/vision quality, social-account intake, authenticated sync, physical-iPhone acceptance and real campaign outcomes remain original open requirements. No guaranteed reach, automatic social publication or independent human review is claimed.

The executable is unsigned. Only run archives whose provenance you trust and whose checksum matches the published record. This portable archive includes third-party notices and the existing licensed English speech model, not font files or private libraries. It is separate from the older stable Windows release.
