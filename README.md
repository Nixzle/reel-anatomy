# Reel Anatomy

A local-first workbench for breaking down short-form video, speech, edits and manually supplied performance metrics.

## What it does

- Import MP4, MOV, M4V or WEBM files up to 200 MB.
- Transcribe English speech when the optional faster-whisper package and base.en model are available. Otherwise import SRT/VTT or paste the transcript.
- Segment spoken material with timestamps, editable narrative roles (Hook, Problem, Context, Explanation, Demonstration, Proof, Payoff, Objection, CTA, Other) and visible classification reasons.
- Estimate video cut boundaries using FFmpeg, inspect frame thumbnails, seek and edit shot labels.
- Save projects privately and compare entered views, likes, comments, saves and shares. No invented Instagram data or causal performance claims.
- Export project JSON, sentence CSV and cross-project comparison CSV.

These classifications are heuristics, not Jev predictions or an equivalent proprietary model. Shot-boundary detection cannot identify camera intentions. Uploaded video and metrics must come from authorised sources.

## Windows packaged download

Open the repository's Releases page. When a verified build exists, download ReelAnatomy-Windows-x64.zip, extract the entire folder and run ReelAnatomy.exe. A tagged release is built by GitHub Actions with a local English speech model and packaged FFmpeg. The executable is not code-signed. Check its provenance and respect your device policy.

## Source installation

Python 3.10+ and FFmpeg are recommended. No internet connection or third-party AI account is required to run basic local analysis.

1. Open a terminal in this folder.
2. Run: python app.py
3. Visit: http://127.0.0.1:8765

For optional local speech recognition install the packages isolated to an environment:

    python -m venv .venv
    .venv\Scripts\python.exe -m pip install -r requirements-speech.txt
    .venv\Scripts\python.exe app.py

The application uses local_files_only for the speech model and will not silently download weights. Put a compatible faster-whisper base.en model under models/base.en, or use an existing local Hugging Face cache.

## Security and data

All requests use the local 127.0.0.1 interface. The app does not send video, transcripts or metrics to Instagram or an AI provider. Uploaded assets and projects are stored under LOCALAPPDATA/ReelAnatomy on Windows or HOME/ReelAnatomy elsewhere. REEL_ANATOMY_HOME overrides the storage location; REEL_ANATOMY_PORT overrides port 8765.

Delete that folder to remove local data. Never commit imported third-party videos, credentials, private transcripts or personal information. Import only footage you are entitled to analyse.

## Tests

    python -m unittest -v test_app
    node --check web/app.js

The tests cover caption parsing, role rules, path validation, project persistence, HTTP routes, origin checks, a synthetic MP4 upload, cut detection and partial-range playback.

## Evidence limits

- User-entered metrics are not independently verified.
- Views and engagement ratios can be compared descriptively, not treated as proof that editing caused performance.
- Speech accuracy varies with noise, accent, model and language. This initial packaged model is English-specific.
- A shot change is not the same as a camera-shot-type classification. Thumbnail labels start as "Detected shot" and are editable.
- The app does not scrape Instagram or connect to professional-account Insights.
- The local server is intended for one trusted user, not public network deployment.

This original code is MIT licensed. Third-party binaries and model weights retain their own licenses; verify notices and redistribution conditions for the chosen packaged components.
