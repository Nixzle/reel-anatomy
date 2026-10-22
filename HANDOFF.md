# Reel Anatomy delivery checkpoint

## Active objective

Deliver a shareable Windows app and GitHub source for timestamped speech/shot breakdowns, editable hook/content labels, batch imports, actual performance comparisons and exports. Keep media local and do not invent analytical certainty.

## v0.1.1 changes

Fixed the obsolete FFmpeg sync option, selected the packaged media engine, and stopped turning failed detection into a fake single-shot result. Added finite-value validation, local Host/origin protections, revision conflict checks and bounded CPU speech reuse. Missing engagement counts stay unknown. Plain-text timing estimates stay inside the video. Added report export, malformed CSV rejection and duplicate-title safeguards.

## Verification gates

Run Python regressions, JavaScript checks, and scripts/browser-smoke.mjs. The package builder then runs real offline speech, known-cut, thumbnail and range-playback checks with an empty external cache and no Python/FFmpeg on PATH. Download the published archive back and repeat the executable and browser checks before a final handback. Exact local logs are retained in .local/resume-20261022; they are not public project data.

## Remaining original-scope acceptance

Owner: Ultron Prime. Milestone: semantic-analysis version after this reliability release.

- Learned semantic hook/content classification and automatic camera-shot descriptions are not implemented. Current roles are transparent editable rules; shot descriptions are user-reviewed. Acceptance: inspect actual audiovisual evidence, show uncertainty and provenance, and evaluate on representative labelled videos. No paid provider or new model download is authorised by this checkpoint.
- Personalised generated scripts/filming plans are not implemented; the exported report provides observations and a generic test checklist. Acceptance: produce evidence-grounded suggestions without copying a creator's protected script or claiming causal virality.
- Account connections/link imports remain optional; current inputs are uploaded videos and user-supplied metrics. Acceptance: authorised platform access and rights checks, never private-insight guessing.
- A real second computer and human usability review remain untested. A fresh extracted directory and isolated environment on the build host are not a second physical machine.

## Publication rules

Keep tags, source commit, BUILD_INFO and checksum aligned. Create a new version after code changes; do not replace a released ZIP under an old tag. The workflow builds an artifact for review and has no release-write permission. Publishing is a separate verified action. Earlier v0.1.0 had a tag/checksum mismatch and is superseded, not a trusted build provenance example.
