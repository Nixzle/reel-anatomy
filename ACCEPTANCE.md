# Sanctum research edition 0.5.0

## Delivery contract

Keep the existing static, installable, device-local Reel Anatomy workflow and add a real evidence workspace. No relay, desktop connection, account credential, paid inference service or private Sanctum repository is distributed. The stable Windows v0.2.0 release remains unchanged.

## Implemented workflow

The Sanctum includes Archives (project-scoped sources and search), Cerebro (explicit public discovery plans), an evidence board (claims with exact quotations and supporting/opposing relationships), and Ask Ultron (inspectable source retrieval and optional local-model reasoning). Social sources can be imported as text/Markdown/CSV and from the existing video transcripts. The original media, patterns, filming and outcome workflow is preserved.

Public discovery supports Crossref bibliographic records/abstracts and Wikipedia background excerpts, not arbitrary web crawling or social-account scraping. Queries are disclosed and explicitly approved. A run has at most twelve requests and eight results per request, can be stopped, and preserves failures before explicit resume. Returned metadata is not labelled as a read paper. Sources default to unreviewed. A source count is not an independence or quality score.

Sources have stable citation IDs, revision hashes, provenance and content coverage. Claims must quote text found in a saved source. Changed/deleted sources make existing claims and assistant citations stale. User-assessed evidence relationships and matched quotations do not establish truth or causal effects. The local archive supports at most 2,000 sources per project; uploads are bounded and the source list is paginated. This is a safety limit, not proof of practical performance at that ceiling.

Ask Ultron defaults to a deterministic, labelled evidence map. Optional WebLLM inference requires explicit device-side download consent and compatible WebGPU hardware. The public profile uses Ultron's evidence-first identity; it does not inherit this ChatGPT session, its model, personal history, connected accounts or tools. Private canonical instructions are not copied into the app. Model citations must match the excerpts actually supplied in the bounded prompt. Unsupported reasoning remains possible; a valid citation does not prove entailment. Model messages do not execute application actions.

## Verification classes

Deterministic Python and JavaScript regressions cover source isolation, quotations, revisions, coverage labels, bounded inputs, failure receipts, hostile IDs and cancellation. Browser acceptance covers the full media-to-research-to-script workflow, source conflicts, extractive answers, consent boundaries, backup restoration and offline reopening. Network tests against the real public providers are distinct from deterministic failure fixtures. The pinned WebLLM module can be verified without downloading weights; that is not a completed model-inference test.

A 400-source synthetic archive is used for a bounded storage/search measurement on the build host. It is not an iPhone benchmark, 400-video analysis benchmark or evidence of unlimited scale.

## Privacy and recovery

Research is stored in the active browser's IndexedDB. Default offline work needs no outgoing research request. Explicit discovery sends only the typed queries to the chosen public services; those services see the query and network address. Optional local-model setup downloads weights/runtime files from the model publisher; inference is device-local and has no cloud fallback. Source links opened by the user navigate to their original sites.

Full library backups include the research evidence extension, analyses, scripts and outcomes, not original video or model caches. Old backups remain accepted, but importing one replaces the local metadata and may omit later research; a pre-restore recovery copy is retained by the existing UI. Dossier exports are reports, not a separate restore format. Important work still needs exported backups because browser storage can be cleared or evicted.

## Rebuild and gates

Fetch the hash-pinned Pyodide files using scripts/fetch_standalone_runtime.py, then run scripts/build_standalone.py from reviewed source. No model weights are fetched by the builder. The WebLLM package source is pinned in MODEL_RUNTIME_PIN.json. Use test_research.py, test_research.mjs, scripts/sanctum-smoke.mjs and scripts/sanctum-live-probe.mjs. Public builds require a clean source commit, exact BUILD.json/file hash readback and browser verification against the actual HTTPS site.

## Remaining original acceptance

Owner: Ultron Prime. Continue toward the original heavy social-media research objective; do not call a checked beta a universally best or completed research system.

- Local model: actual selected-model inference, grounding quality, device memory/heat and physical Safari support remain unqualified until an explicitly approved model download and representative evaluation. No weights were downloaded as part of this delivery.
- Social research: authorised platform account connectors, automatic retrieval, richer full-text research providers, PDF ingestion and large real-video cohorts are not implemented in this edition.
- Video intelligence: automatic phone speech and learned visual/semantic video analysis are not included. Windows analysis can be imported explicitly.
- Cross-device work: file exchange remains explicit; no live synchronisation is claimed.
- Independent review: the Council checklist is a procedure, not a multi-agent panel; no autonomous reviewers are invented.
- Physical iPhone installation, Safari codec coverage and real campaign performance need direct evidence. Browser emulation and synthetic data do not close those gates.


## Reel Factory 0.6.0 acceptance extension

The same application gains evidence-bound three-opening campaigns, editable shot/media/audio assembly, actual local browser video exports, native package rendering, captions and source/test sidecars. Source/script/asset edits invalidate review; imported backups require fresh approval. Draft exports are visible as drafts; there is no guaranteed-virality label or automatic social post. See FACTORY.md for the exact distinction between production checks, human attestation, model quality and empirical outcomes.

Tests must exercise an actual downloaded browser video with ffprobe, real audio presence, batch exports, cancellation without false completion, unchanged old workflows, byte-preserving browser-to-native package transfer, native MP4 output and the actual local Sanctum binding. The gate is not satisfied by a generated filename, a package-only test or unverified UI screenshots. Physical iPhone and content/performance acceptance remain distinct.
