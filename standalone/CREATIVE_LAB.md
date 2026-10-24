# Creative Lab: competitor-informed iteration, 24 October 2026

## Evidence and decision

The original goal remains the complete research-to-production loop, with genuinely measured model quality and outcomes. This iteration does not close the outstanding model, physical iPhone, platform, sync or campaign acceptance gates.

Official vendor documentation was reviewed, not product claims independently benchmarked. Marketing performance claims are not treated as measured evidence for this app.

| Primary source | Documented capability | Decision for Reel Anatomy |
| --- | --- | --- |
| 1of10, https://1of10.com/chrome-extension and https://1of10.com/features/shorts-outliers | Creator-relative outlier discovery, view trajectories and title/thumbnail history. | Retain our existing matched-window creator baselines and counterexamples. Do not build a second conflicting ranking system. Live platform retrieval still requires authorised access. |
| Subscribr, https://subscribr.ai/ai-agents and https://subscribr.ai/help/channels/settings | Channel/audience context and voice-guided scripts, with agent integration. | Add a project playbook with owned writing examples, frozen brief context, and bounded assistant guidance. Do not describe user-authored rules as a trained voice model. |
| vidIQ, https://vidiq.com/agent-skills/vidiq-comment-insights/ | Comment questions, objections and phrases linked to source videos and usable in original briefs. | Add authorised audience text/CSV intake, partial identifier filtering, deduplication, user-labelled themes and a brief handoff. No silent account scraping or purchase. A vidIQ ChatGPT connector is discoverable but not connected; installing it would not automatically connect the public app. |
| OpusClip, https://www.opus.pro/home-a-b | Branded editing, aspect ratios, automatic clips, scheduling and a marketed virality score. | Keep licensed-media Factory assembly. Brand rendering templates and automatic caption alignment remain separate gaps; do not relabel editorial checks as a probability of virality. |
| Descript, https://www.descript.com/captions and https://www.descript.com/ | Transcript-based editing, captions, review/collaboration and generative media. | Record this as an editing-quality gap. Do not add a superficial button claiming transcription or generative video without its actual engine. |
| YouTube Help, https://support.google.com/youtube/answer/9314415?hl=en | Video-level retention interpretation, including ambiguous spikes and dips. | Add a measured retention importer and timeline inspection, preserving sample/segment/provenance and uncertainty about cause. No guessed competitor retention. |

## What is less emphasised in this comparison

This sample of vendor pages does not establish that no competitor has a feature. Useful differentiation for our app is an explicit chain from a real audience need, through original wording and reviewed evidence, to an exact creative decision and later measured outcome. The new checks are metric-blind, retain their input revisions and become stale when the script, voice rules or reference transcript changes. Duplicate audience text is not counted as additional people. Negative findings and unknown sample sizes remain visible.

## Implemented now

Creative Lab is inside Sanctum. It stores a versioned channel playbook; imports authorised audience observations without retaining author columns; groups by user-supplied theme/type; carries source observations and playbook context into the existing Studio; checks a saved script for avoid-list phrases, planned speaking density, absent visual directions, user-mapped payoff timing and long wording matches with saved reference transcripts; imports actual audience-percentage points and links observed intervals to transcript moments. It does not infer causality, independently verify quotes, calculate a virality probability or certify originality.

The original Store, existing script editor, video player, browser-local SQLite/IndexedDB, source provenance, backup/project-pack path and browser acceptance harness were reused. New code is original and uses Python/JavaScript standard facilities; no additional dependency, model, installer or paid service was activated. Native Sanctum factory implementation pins were not changed.

## Bounds and data handling

Audience CSV: at most 500 rows per import, 5,000 per project. Only approved text/theme/type/source/provenance/date columns are accepted. Email-like strings, handles and long numbers are filtered. This is not complete anonymisation: names and context can remain. Review before sharing. Counts identify observations, distinct text and source URLs, not unique people or independent demand.

Creative review: up to 200 distinct reference assets and 30,000 text characters each. Exact long-wording overlap, not semantic plagiarism detection. User-mapped payoff beats and configurable pace thresholds are explicit heuristics. No view/snapshot/outcome information informs review flags. A clear checklist is not an editorial approval. The profile is not learned training and script templates do not automatically reproduce a person's writing style.

Retention: up to 2,000 strictly increasing timestamp points per series and 500 series per project. Audience percentages only, with repeats above 100 allowed up to the schema bound of 500; not raw views or relative-retention indices. Missing fields reject the import rather than becoming zero. The chart only joins supplied points; it does not measure unsupplied seconds. Largest-drop intervals retain elapsed time and change-per-second. Causes remain unknown. No platform API is contacted.

All records remain project-scoped, are included in metadata backups and project packs, and can reopen offline. Profile/script/reference changes make old reviews stale. Imported data is untrusted text, not executable instructions. Script guidance passed to a local model is bounded and kept in the user-data payload; it does not override assistant source/privacy instructions.

## Remaining acceptance

Stable 1.0 is still gated by RELEASE_TARGET.json. Licensed model inference and semantic quality, actual social account ingestion, physical iPhone/Safari behavior, authenticated sync, real cohorts/campaign outcomes, and more capable audio/visual production remain outstanding. The optional external vidIQ connection is a distinct potential research source, not an implemented native app connection. No claim of category leadership or competitor-wide absence is made.
