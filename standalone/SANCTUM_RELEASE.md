# Reel Anatomy Sanctum 0.5.0: public delivery record

## Live application

https://nixzle.github.io/reel-anatomy/

Published and publicly verified on 2026-10-23T01:05:27.680638+00:00. Implementation commit: 2bd7414a11d737487f7c8d3a101d2066e04cdb13. Public gh-pages commit: 1e083d72466a83979f46af072ac65fac6884598a. Build: e38edc810e3c3a9a. All 42 manifest files and the service worker matched the tested local build byte-for-byte. The prior public commit b892394a7887e1e026deec7bd15907a55977485a remains in Git history for rollback. The original Windows v0.2.0 release is unchanged.

## What changed

The default screen is now Sanctum, with Archives, Cerebro, an evidence board and Ask Ultron. The existing Library, video breakdowns, pattern comparisons, production Studio and Results remain available.

Archives stores up to 2,000 sources per project, including supplied text/Markdown/CSV, abstracts, source links and imported local video transcripts. It has full-text search, pagination, source type, content coverage, provenance, review status and stable citation identities. This limit is a software bound, not a demonstrated 2,000-source phone performance claim.

Cerebro runs editable, explicitly approved public queries against Crossref and Wikipedia. It retains query steps, timestamps, errors and explicit resume history. Each run is bounded to twelve requests with up to eight results each. Crossref records may be metadata only; Wikipedia snippets are background excerpts. Neither provider substitutes for reading and evaluating primary evidence. Social links can be recorded or imported; automatic Instagram/TikTok/YouTube account retrieval is not included.

The evidence board records supporting, opposing or contextual quotations. A quotation must occur in its saved source. Contradictory links are visible, and source edits/deletions make old citations stale. Matching text verifies the quotation, not the claim or causal relationship. A claim can enter the existing production Studio as a hypothesis, without inventing supporting proof.

Ask Ultron is an embedded public-safe identity and research interface. Its default evidence mode retrieves and presents actual project excerpts and uncertainties; it is not a disguised language model. Optional WebLLM 0.2.86 adds a separately chosen on-device text model after explicit download consent and compatible WebGPU checks. Context and the exact bounded model prompt are inspectable. Unknown source IDs and quotations absent from the supplied excerpts are rejected; stopped/truncated generation is not stored as a completed answer. Valid citations still do not establish reasoning quality or entailment.

The public Ultron profile does not inherit this ChatGPT session, its model, personal history, connected accounts, tools or permissions. Private canonical Sanctum files were not published. The Council panel is a structured review checklist, not independent agents. No paid fallback, account credential, remote desktop relay or automatic model download was activated.

## Privacy and offline behavior

Project evidence, messages, scripts, metadata and media remain in the device's IndexedDB. Default work and evidence replies operate offline after successful app caching. Explicit discovery sends the entered query to the chosen public service; optional model setup downloads weights/runtime files from the publisher. There is no cloud-chat fallback. Public source links opened manually navigate to their original sites.

Backups now retain sources, claims, run history and assistant messages alongside existing research/production data. They do not contain original videos or model weights. Browser storage may be evicted; export important work. Dossier exports are readable reports, not a separate restore format. Cross-device exchange remains explicit JSON export/import, not live sync.

## Verification

- 120 Python tests passed, including 23 research-specific tests.
- 17 research JavaScript checks and 11 existing frontend checks passed.
- 51 complete browser workflow checks passed against the actual public HTTPS site.
- 19 existing desktop Studio browser regression checks passed.
- Real public Crossref and Wikipedia requests each returned eight records through the deployed app's browser connector. These are transport/coverage checks, not a relevance or research-quality benchmark.
- A synthetic 400-source archive was stored in 2603 ms and one targeted query completed in 349 ms in the checked build-host Chrome profile. This is not a physical-iPhone or video-throughput measurement.
- The actual pinned WebLLM JavaScript runtime and both configured model records loaded. Model weights were not downloaded and actual model inference was not executed.

Browser tests used isolated Chrome profiles at a 390-pixel phone viewport and generated media/metrics. Controlled provider-failure fixtures were separate from the real public discovery tests. No physical iPhone, Safari codec, real campaign uplift, semantic quality or independent-agent consensus is claimed. Full details are in SANCTUM_VERIFICATION.json.

## Use the upgraded workflow

Open Sanctum, select a research project, then use Cerebro for public discovery or Archives for supplied sources. Inspect content coverage, record a claim and counterevidence, and ask Ultron for an evidence map. To use generative local reasoning, open Ask Ultron > Local reasoning setup and explicitly approve the chosen model download; compatibility and model quality remain device-dependent and unqualified by this release.

Existing installations may keep the previous cached version until the old app tabs are closed. Open the live site, then fully close and reopen the app if the Sanctum tab is absent. Do not clear website storage merely to update: export a library backup before any storage deletion.

## Remaining original scope

The next acceptance gates remain owned by Ultron Prime in ACCEPTANCE.md: measured model inference/grounding on representative research, physical iPhone/Safari, authorised social-platform connectors, richer full-text/PDF ingestion, large real-media cohorts, cross-device sync and empirical usefulness for our posts. This release is a verified research-workbench iteration, not a claim that all deep research is finished or that it outperforms every competing tool.
