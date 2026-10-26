# Changelog

## 3.1.0 — 2026-10-26

- Removed the synthetic demo UI and runtime from source and generated HTML.
- Added timeout/cancellation and late-stream cleanup to camera startup, actual source settings, Windows privacy guidance and reliable retry.
- Serialized inference and graph changes; terminate failed workers and reject pending operations promptly.
- Added optional pose-guided hand crops with overlap fallback, visibility-aware/global hand assignment and crop coordinate remapping.
- Preserve temporal full-frame hand tracking by default; hand detail mode is an explicit compute tradeoff.
- Filter relative finger offsets, reset filters after occlusion, confidence-gate pelvis/head frames and average neutral head rotation.
- Render the 3D view on change, report correct elapsed-time FPS and export rolling component/pipeline diagnostics.
- Added local-module cache versioning and server cache revalidation.
- Tested a physical USB2.0 HD UVC WebCam at its actual 1280×720 resolution; see docs/WEBCAM_TEST.md.

# 🗂️ Changelog

## 3.0.0 — 2026-10-24

- Added background inference with a classic-worker MediaPipe loader, transferable images, one in-flight frame, timeouts and GPU/CPU/main-thread fallbacks.
- Added locally vendored runtime/model assets and SHA-256 integrity checks.
- Made inference initialization lazy so the viewport and local character appear independently.
- Added adaptive One Euro filtering, confidence-gated body updates and single-stage limb smoothing.
- Added the MIT-licensed, textured Studio Male adaptation with semantic bone metadata; corrected mirror-side mapping.
- Added 553-landmark capture, the full 52-channel facial coefficient vector and head-pose matrices.
- Added dedicated Heavy body, Face and Hand tasks in the Precision pipeline, with an Efficient Holistic alternative.
- Added 51 sparse facial morphs, both palm frames and all 30 finger segments.
- Added neutral-face calibration, independent face/hand/body filtering, close-up inspection and detailed CSV output.
- Added byte-bounded dense facial recording and face/hand-only frame export and replay.
- Added camera selection, processing presets, fullscreen and local-photo analysis.
- Added bounded recording, JSON/CSV export, validated session import and timeline playback.
- Added synthetic motion demo, rolling p95 diagnostics and optional local settings persistence.
- Added a local launcher, unit tests, asset checks and a reproducible filter benchmark.

## 2.x — Supplied baseline

The supplied v2 archive introduced MediaPipe Tasks, world-space pose landmarks, camera lifecycle handling, Three.js humanoid retargeting, custom rig uploads and a generated HTML distribution. Its original source and archive are preserved outside this v3 folder.
