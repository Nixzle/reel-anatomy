# Third-party components

The original Reel Anatomy application code is MIT licensed. Included dependencies retain their own licences. The Windows package contains a licenses directory, BUILD_INFO.json with versions and source hashes, and the FFmpeg build configuration.

## English speech

The model is Systran/faster-whisper-base.en, pinned to revision 3d3d5dee26484f91867d81cb899cfcf72b96be6c. The model card declares MIT and describes the conversion of OpenAI Whisper base.en to CTranslate2. The original Whisper MIT notice is retained in third_party/Whisper-MIT.txt.

Model and conversion provenance: https://huggingface.co/Systran/faster-whisper-base.en/tree/3d3d5dee26484f91867d81cb899cfcf72b96be6c
Original model: https://github.com/openai/whisper
Inference: https://github.com/SYSTRAN/faster-whisper and https://github.com/OpenNMT/CTranslate2

## Media engine

imageio-ffmpeg 0.6.0 supplies a separate Windows FFmpeg 7.1 executable. The wrapper and executable have different licences. The actual executable reports GPL version 3 or later; see third_party/FFmpeg-license.txt, GPL-3.0.txt and FFmpeg-build.txt. The executable has not been modified.

Wrapper and binary provenance: https://github.com/imageio/imageio-ffmpeg/tree/v0.6.0
FFmpeg source release: https://ffmpeg.org/releases/ffmpeg-7.1.tar.xz
Binary build/source information: https://www.gyan.dev/ffmpeg/builds/

The application's MIT licence does not relicense FFmpeg or other bundled libraries. Retain the notices and the component's applicable distribution conditions when repackaging. Source links above identify upstream provenance, not a claim that every third-party source dependency is vendored in this repository.

## Test material

The short synthetic speech fixture contains only: “Stop making this mistake. Watch this quick example.” It was generated for regression testing. Synthetic videos are generated from solid-colour frames during tests. No private videos, transcripts, metrics, account credentials or model caches are published.

## Reuse in the test harness

The Chrome DevTools Protocol test runner adapts the owner's existing local browser-test pattern. It uses installed Chrome and Node's built-in WebSocket, without installing a separate browser or importing another project's data.
