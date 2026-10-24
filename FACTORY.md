# Reel Factory 0.7.0 / production candidate rc.3

## Purpose

A local production tool within Reel Anatomy and the Sanctum. It turns an original saved filming brief, evidence-linked claims, owned/licensed visuals and narration into editable opening variants and actual portrait video exports. It does not promise viral reach, generate a trained virality score or publish social posts.

## Working path

1. In Sanctum, collect relevant sources, mark the content coverage, review the material and link exact passages to claims. Retain counterevidence.
2. In Studio, write an original brief and save its script. The included planner is transparent and structured, not a trained viral-generation model.
3. In Reel Factory, select that brief and the claims it may use. Create variants A, B and C. Edit the supplied openings rather than blindly copying a creator.
4. Classify each shot's statement, map factual assertions to current support and include material limitations in the actual spoken/on-screen text. Attach owned/licensed images or video, or explicitly choose text cards.
5. Attach a narration/audio file or deliberately select a silent caption-led edit. Confirm rights. Source video audio is muted; the selected narration supplies the output audio track. No voice clone, paid generation or model download is triggered.
6. Save, review the actual edit and record the four attestations. Human-reviewed export is available only while the exact source, script and asset fingerprints still match. This is human attestation, not automatic fact verification.
7. Render one variant or all three sequentially. Keep the app visible. Browser exports use the supported MP4 or WebM encoder without relabelling the container. Choose 720 x 1280 or 1080 x 1920. Save the video and its production package, SRT, source record, caption and test card.

A draft can be exported with unresolved review items, but it stays visibly marked. Nothing is posted automatically. A stopped or backgrounded browser export is not recorded as completed. Completed prior items in a batch remain available. Browser rendering runs in real time and can fail if the device lacks codec support or resources.

## Evidence and review rules

Current reviewed non-metadata support is required for an assertion. Changed/deleted source content or claim records invalidate prior approval. Opposing evidence requires a limitation in the actual script/headline, not just hidden notes. Visual/audio rights, clip lengths, continuous shot timing and narration length are checked. Sparse sources and dense speech produce warnings, not invented confidence.

The guarantee detector flags explicit performance promises as a review blocker, but it is a narrow language check, not a comprehensive semantic fact checker. Questions, opinions and demonstrations also need human scrutiny. A claim must remain within the evidence's population, setting and limitations. The renderer checks data consistency, not whether the world agrees with the script.

Captions default to proportional written-script timing. The narration-timing editor can instead import SRT/VTT, or use the desktop bundle's existing local English speech model to estimate word times. Inspect recognised wording, then explicitly apply the timed track. Its audio SHA and script/timeline binding are retained; changed narration or script requires rechecking and rebinding. Reviewed export also requires the caption words to match the source-linked spoken script. Silence remains a gap rather than filled caption time. Both browser and native renderers use the same track. Recognition is not perfect forced alignment, and a matching script does not prove audio accuracy or factual truth. The current style remains an editorial portrait compositor, not a generative animation suite.

## Sanctum local binding

Project implementation: scripts/reel_factory.py. The private Sanctum receives runtime/reel_factory.py, runtime/REEL_FACTORY.md and a capability record with exact checked source hashes. These are a local callable tool binding, not a new native ChatGPT connector or a transfer of private memories/tools into the public app.

Actions: doctor, inspect, render and batch. Rendering uses the already installed Pillow and FFmpeg, local hash-matched media and a new output directory. It never installs dependencies or changes existing files. FFmpeg inputs are limited to file and pipe protocols. A changed source pin fails closed until a reviewed requalification.

The browser can export one package or a batch of three. Desktop packages contain metadata and scripts, not original video/audio. Supply a dedicated local asset folder; files are found by SHA-256. Native output includes the MP4, source records, captions, test card, retained render logs and a probe receipt with actual dimensions, duration and audio-track presence.

## Original output examples

examples/reel-factory-A-draft.mp4 and its B/C variants are original 24-second, 1080 x 1920 caption-led drafts. They deliberately have no synthetic narration or third-party footage. A feature description is paraphrased from Meta's Trial Reels announcement and linked in examples/README.md. They are examples of render output, not a human-approved campaign, creative-quality benchmark or evidence of virality.

## Data and recovery

Factory source assets and rendered videos stay in the device's IndexedDB. The normal library backup includes campaign scripts and evidence but excludes the original media/audio and rendered files. Portable project packs can additionally carry original media and documents. Reattach exact source media when using metadata-only backups. Imported campaigns lose prior approval and export receipts, so a restored backup does not resurrect review authority. Export important videos and backups; browser storage can be cleared or evicted.

A source package hash is an integrity check, not a signature or identity credential. The native renderer verifies the frozen source snapshot; it cannot independently learn that a source changed later. Refresh current evidence in the application before a new reviewed release.

## Acceptance still open

Physical iPhone/Safari export and resource use remain untested. Real semantic-model quality, automatic research depth, social-account connectors, synced accounts and real campaign performance remain earlier open requirements. A positive test with generated media proves the exercised render path, not artistic quality or a viral outcome. Generative imagery/narration and automatic publishing are not included in this release.
