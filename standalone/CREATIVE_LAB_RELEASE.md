# Creative Lab 1.0.0-rc.2: verified public delivery

## Live access

https://nixzle.github.io/reel-anatomy/

Open **Sanctum > Creative Lab**, or choose **Audience, voice & retention** on Start. Published build `3155c7028f009c07` was verified at 2026-10-24T06:22:26.893292+00:00. Implementation commit `e7fcb5f3260e019fab34bbc4547ce336860e3a05`; public gh-pages commit `9d2fb9a624b79a876740baeedc417848a92378b9`. All 74 manifest files and the service worker matched the tested clean source build. Previous public commit `bbb815ffe64acf0b713e87c40b1b60e760662bae` remains in Git history for rollback.

This updates the live browser/PWA app. It is not a new Windows installer, App Store release or claim of stable 1.0. The earlier downloadable rc.1 bundle and stable Windows v0.2.0 remain unchanged. No previously released asset was replaced.

## Why these changes

The owner asked what competitors do, what is missing, and to implement useful additions. Official documentation was compared for 1of10, Subscribr, vidIQ, OpusClip, Descript and YouTube Analytics. These are documented features, not independently verified vendor performance claims. The comparison and primary source links are retained in CREATIVE_LAB.md.

Creator-relative discovery already exists in our matched comparison engine and was reused, rather than replaced by another score. Channel voice context, questions from audience comments and retention inspection were material gaps. Richer editing, automatic caption alignment, genuine multimodal analysis and authorised live social intake remain larger gaps; this release does not claim to replace those engines with rules.

No exhaustive survey established that competitors lack our practices. The deliberate difference here is an inspectable chain: supplied audience need, original wording, evidence, saved creative decision, and actual measured response. A capability being less prominent in the reviewed product pages is not proof of uniqueness.

## Implemented

### Channel playbook

Per-project audience, editorial voice, preferred/avoided wording, an owned or authorised writing example, CTA and configurable pacing-review threshold. Revision conflicts are rejected. A snapshot of the playbook and selected audience observations is stored with a new filming brief. A bounded subset is available in the optional local assistant's inspectable context. This is user-authored guidance, not a trained voice model. The existing included planner remains structured, not learned generation.

### Audience questions

Manual text and CSV intake accepts only text, theme, type, source URL, provenance and observation time. Permission confirmation is required. Author/account columns are discarded. Basic email/handle/long-number filtering is not complete anonymisation; names or identifying context may remain and should be reviewed before sharing.

Duplicate text from the same source does not inflate the archive. Groups show observations, distinct texts and source URLs, not unique people or representative audience demand. Themes/types are supplied by the user. Selected observations can become inputs to our next brief, but an audience question is not factual proof of its answer. Limits: 500 rows per import and 5,000 observations per project.

### Metric-blind script review

Review saved scripts before using their performance to explain their quality. The rule checks do not consult view counts, analytics snapshots or outcome ranks. They flag avoid-list phrases, planned speaking density, missing visual direction, an early CTA, a user-mapped late payoff, and long repeated wording in supplied reference transcripts. The payoff must be marked by the user; the tool does not semantically certify that a promise was delivered.

Reference comparison covers up to 200 distinct reference assets and 30,000 characters each, excluding our own posts. Exact wording overlap is not a plagiarism verdict or originality certificate. Report flags link back to the saved script or reference video. Changed script, profile or reference text makes the old review stale. No virality probability or quality score is generated.

### Retention map

Import actual audience-percentage points with measurement source, audience segment, observation time and optional known sample size. Missing fields are rejected rather than becoming zero. Unknown sample size stays unknown. Repeat viewing above 100% is allowed; raw view counts and relative-retention indices are not silently treated as percentages.

The chart joins supplied points and highlights their largest observed drops/rises, retaining interval length and percentage-point change per second. Overlapping transcript moments link to real local playback. Lines between points do not create unobserved measurements. Drop or spike cause remains unknown. Limits: 2,000 increasing timestamp points per series and 500 series per project. No social account is contacted by the importer.

## Integration, privacy and recovery

All four panels are in the existing Sanctum. Mobile sub-navigation now wraps visibly, and Start links directly to the Lab. Data remains project-scoped in browser storage and is included in existing JSON backups and portable project packs. Original media, recovery checks and offline reopening are preserved. No additional package, installer, model weights, paid service or automatic external transfer was introduced.

The optional vidIQ connector was found and suggested in ChatGPT, but was not installed or connected and no vendor credit was spent. That possible external connection is distinct from an integration in this public app. The native Sanctum Factory implementation hashes are unchanged; no requalification was falsely claimed for a changed renderer.

## Verification

190 Python tests passed, including 30 new Creative Lab tests. 51 JavaScript checks passed, including the generated offline-installation checks. Against the actual public HTTPS app, 20 Creative Lab checks, 31 readiness/production checks and 51 Sanctum checks passed. Another 19 desktop Studio checks passed locally. All 74 public manifest files and the service worker were fetched and hash-matched.

These tests used isolated Chrome browser profiles at a 390-pixel viewport on the existing Windows host, synthetic audience text/analytics and generated media. They exercised actual local playback, rendered video with audio, PDF reading, backup/pack integrity, failed-transaction recovery, hostile-input rejection, source/profile revision checks and offline restart. They do not establish physical iPhone/Safari compatibility, model inference quality or improved real campaign outcomes.

An early browser harness asserted an asynchronous brief-note update before it completed; the exact text assertion was retained with a wait. A legacy readiness assertion still expected rc.1; it now compares against the exact reviewed RELEASE_TARGET.json version. Visual inspection caught a clipped mobile Lab tab and small chart labels; these were corrected and the new final view was retested. Original failed receipts remain in the local evidence directory.

## Remaining original requirements

Stable 1.0 remains unqualified. The original RELEASE_TARGET.json gates for real model/semantic evaluation, physical iPhone/Safari, authorised social-platform intake, authenticated cross-device sync and real-world cohort/campaign outcomes remain open. Automatic narration-caption alignment, richer branded/semantic editing, generative media and revenue/conversion attribution are not implemented by this iteration. More local report panels do not close those gaps.

Save your work before updating. Open the live page, then close old app tabs and reopen to allow the new cached build to activate. Do not clear browser storage just to update; save project packs before any storage deletion.
