# Changelog

## 2.0.0 — 2026-10-02

### Changed
- Migrated tracking from legacy MediaPipe Holistic to MediaPipe Tasks Vision Holistic Landmarker.
- Reworked pose rendering around 3D world landmarks with normalized-landmark fallback.
- Replaced MediaPipe camera helper usage with a single explicit `getUserMedia()` pipeline.
- Split the application into HTML, CSS, and JavaScript source files.
- Updated Three.js to a pinned current release and modern addon imports.
- Reworked smoothing to be time-based rather than frame-count based.
- Reworked rigged-model retargeting with pelvis-frame orientation and bind-pose reset.

### Added
- GPU-to-CPU inference fallback.
- `requestVideoFrameCallback()` scheduling with RAF fallback.
- DRACO, KTX2/Basis, and Meshopt GLTF loader support.
- Correct text parsing for self-contained `.gltf` uploads.
- Robust model/resource disposal.
- Accessibility improvements for switches/status/errors.
- Export of pose/hand world landmarks and inference metadata.
- Responsive/reduced-motion styling.
- MIT license file.

### Fixed
- Duplicate camera ownership/acquisition path.
- Legacy overlay connector assumptions.
- Incorrect `.gltf` binary read path.
- Object URL leak after JSON export.
- Frame-rate-dependent smoothing behavior.
- Stale model pose after stopping capture.
- Overly broad custom-rig matching behavior.
- Loading overlay hiding before successful tracking-engine initialization.
