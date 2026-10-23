# Reel Anatomy 1.0.0-rc.1

## Status and original acceptance

This is a release candidate, not stable 1.0. The original goal remains an evidence-led social research, creation and outcome platform with a useful Ultron interface. The source-controlled release checker rejects stable promotion while the required gates in RELEASE_TARGET.json are open. Requirements are not removed to make the number look complete.

Measured model reasoning/semantic quality, physical iPhone/Safari qualification, authorised social-account connectors, live cross-device sync and prospective real-world outcome validation remain open. Their owner remains Ultron Prime. Runtime modules, a generated-media test and a deployed app are different evidence classes.

## Documents

Import a PDF or saved HTML file under Sanctum > Archives. A PDF is limited to 20 MB, 200 pages, one million extracted characters and 60,000 characters per page. Each non-empty page becomes an unreviewed excerpt with the document hash, page number and source provenance. Blank/scanned pages are reported instead of being represented as understood evidence. Original pages can be rendered for inspection from the source editor.

Text extraction can misorder columns, equations or tables. Figure/image interpretation and OCR are not performed. Advanced image/font formats may need the original PDF application; the app does not claim perfect rendering for every PDF. Password-protected files require an authorised unlocked copy. Document scripts, actions and forms are not executed.

Saved HTML files are limited to 2 MB and 100,000 extracted characters. The reader removes active content and remote resource attributes from an inert template before extracting text. It never inserts the original article HTML into the live application. The saved canonical URL is attribution, not a claim that the URL was retrieved. Only supplied files are processed.

The source editor can explicitly fetch full available article text for Wikipedia and Europe PMC open-access article URLs. Requests are sent only after the user approves them. These are named public read APIs, not an arbitrary proxy, paywall bypass or unrestricted social scraper. Returned text remains unreviewed; figures, tables and references still require inspection. API errors do not replace existing evidence with fabricated text.

## Recoverable project packs

Settings offers a stored-ZIP project format with a 200 MB total budget. It can include the logical library, original media, source documents and completed rendered files. Downloaded model caches and credentials are excluded. Packs are not encrypted. Share them only with intended recipients.

The archive reader rejects unknown paths, compressed entries, ZIP64, encryption, conflicting sizes, duplicate paths and overlapping ranges before parsing its content. Every declared file has a size and SHA-256 check. These checks establish byte integrity, not authorship or trust in the contents.

Restore validates the metadata in the existing isolated worker, then commits the candidate state and media in one IndexedDB transaction with a revision check. A recovery copy of the previous metadata is retained. Corrupt files, cancellation, revision conflicts and failed writes must not commit a partial library. Current imports/render jobs must finish before restore. An interrupted upload's orphan original is omitted and disclosed rather than included as an unresolvable video record.

Restoring a campaign clears previous approval and live export receipts. Historical video exports are retained separately for download and are not fresh human approval. Media above the pack budget must be saved separately. Browser storage can still be cleared or evicted; an exported file outside that storage is the actual recovery copy. File transfer is not automatic synchronisation.

## Export-to-results workflow

A completed Factory video can be added to the local draft library. Its bytes are checked against the render receipt, and the production package is checked against the saved content fingerprint. Repeating the operation reuses the same draft. Captions and shots are labelled as authored timing, not automatic speech recognition or detected scene boundaries. No performance values, rights attestation or social publication is created. Use the existing Results workflow to record a hypothesis before publishing and then genuine observations afterwards.

## Device and update checks

The Start page links the complete workflow. At phone width, an accessible workspace selector replaces tiny horizontally scrolling tabs. Diagnostics expose capability flags, selected encoder, storage usage and build identity, but not source titles, media filenames, prompts or accounts. A feature flag is not proof of physical-device acceptance.

The service worker validates the exact build manifest and every precached asset hash before installation succeeds. A failed install removes only its candidate cache. Cache identities include the source commit; a partially updated build is not treated as ready. The app checks for service-worker updates but does not force a new version over active editors in other tabs. Save work, close old tabs and reopen; do not clear website data to update. Build identity is cached with the app so offline diagnostics can identify the installed version.

## Provenance

The existing Store, SQLite/Pyodide worker, reviewed factory, source index, renderer, UI and browser tests were reused. New licensed donors are unmodified Mozilla PDF.js/pdfjs-dist 6.4.299 (Apache-2.0), Mozilla Readability 0.6.0 (Apache-2.0) and fflate 0.8.3 (MIT). Exact npm integrity strings, bytes and SHA-256 values are in DOCUMENT_RUNTIME_PINS.json. Notices are retained in vendor. No font files are redistributed.

## Verification procedure

Run `python -m unittest discover -v`, the existing JavaScript contracts, `node test_release.mjs`, `python scripts/check_release_gate.py`, and the browser suites. `python scripts/check_release_gate.py --stable` must fail while critical gates remain open. Run `node scripts/release-smoke.mjs` against loopback and the actual public HTTPS build. `scripts/readiness-live-probe.mjs` separately checks actual public article providers; those calls are transport/coverage checks, not research-quality benchmarks.

All release assets must come from a clean source commit. Fetch and hash-check the deployed BUILD manifest and service worker, preserve the prior public commit for rollback, and distinguish the web candidate from the unchanged Windows stable executable. Tests use synthetic media/documents and isolated browser profiles, not a real campaign or a physical iPhone.
