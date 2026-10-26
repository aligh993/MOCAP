# Validation report — v3.1.0

Date: October 26, 2026. Scope: the delivered local static project.

## Physical webcam revision

See [the measured webcam report](WEBCAM_TEST.md) and [aggregate diagnostic JSON](webcam-diagnostics.json). The source and generated distributions contain no demo button or synthetic capture generator.

## Automated checks

- **27 Node tests pass:** adaptive filtering; invalid and irregular samples; frame-count and serialized-byte recording budgets; data copies; JSON/CSV validation; timeline boundaries; quality budgets; complete 553-landmark and 52-coefficient/matrix preservation; neutral-reference averaging; pose-anchored hand assignment; malformed face payload removal; face-only replay; worker timeouts, disposal, overlap prevention and stale-work termination; camera cancellation/timeout/late grants; serialized options; filter reacquisition; elapsed-time FPS/p95; crop remapping/overlap fallback and hand task mode changes.
- Python validation checks authored files, DOM/state bindings, all JavaScript syntax and pinned runtime/model SHA-256 hashes.
- GLB validation checks container integrity, embedded resources, all 51 expression targets on each primitive, 80 skin joints, semantic roles, triangle/size budgets and the output checksum.
- The facial morph authoring report confirms nonzero vertex deformation for every one of the 51 expression controls.

## Browser verification

The project was served from localhost and exercised through the desktop app's Chromium-based in-app browser.

- The viewer renders the textured character before camera permission or inference initialization.
- The supplied rig maps **12/12 limb direction pairs, 30/30 finger segments, 2/2 palm frames and 51/51 expression morphs**.
- The **Precision pipeline initializes all three specialized tasks** as **Heavy body + face + hands · Worker · GPU**, using locally stored runtime/WASM/model files.
- A real public face-and-hands test photo produced **478 face points, 21 left-hand points, 21 right-hand points, 52 facial coefficients and a 16-value head matrix**. These counts were checked in the downloaded frame JSON, not only in the UI. The cropped photograph did not produce a body pose; independent face/hand capture remained exportable.
- A separate full-height public photo produced a raw **33-point Heavy body result**, with **27/33 points above the display visibility threshold** and approximately **73% mean reported body visibility**. This is model-reported visibility, not measured geometric accuracy.
- The demo UI and generated-motion runtime have been removed. Real-camera testing is recorded in [WEBCAM_TEST.md](WEBCAM_TEST.md).
- Neutral calibration collects a fixed sample window, and reset restores the uncalibrated reference.
- JSON session recording, export/import, playback and timeline controls were exercised. An earlier body-only take contained **2,887 frames / 120.4 seconds**; a separate full-detail take recorded **1,002 frames / 41.8 seconds**, automatically stopped at the **32 MiB** byte budget, exported as **33,544,838 bytes**, and re-imported and replayed with 478 face points, 42 hand points, 52 coefficients and a 16-value matrix preserved per frame. A three-frame full-detail CSV contained exactly **2,089 lines**, including every landmark stream, coefficients and matrix values.
- The supplied GLB also loads through the custom upload path with the same semantic rig mapping.
- The generated HTML distribution embeds the application, worker, pipeline module and character, while retaining relative access to the local runtime/model folders. The generated file was separately initialized with its embedded pipeline module and reached **Heavy body + face + hands · Worker · GPU** before the v3.1 revision. The v3.1 generated build was rebuilt and separately checked on the real webcam.

First specialized inference in this virtualized browser included cold GPU setup and took roughly **8.1 seconds** for the face/hand photo. A subsequent body-photo pass took approximately **886 ms** for the combined pipeline. These are environment-specific still-image timings, not a warmed physical-webcam FPS benchmark. Those earlier still-image timings are retained as historical observations and are not the current live-camera throughput.

The application supports a main-thread fallback and per-task CPU fallback. The integrated Holistic GPU path and main-thread GPU fallback were also initialized during verification; CPU-only behavior and every browser combination were not exhaustively measured.

## Deterministic filter comparison

Run `node scripts/benchmark_filter.js`.

At smoothing 0.55 and 30 Hz, with a 0.02 m sinusoidal disturbance around a stationary coordinate and an independent 1 m step:

| Metric | v2 exponential filter | v3 adaptive filter |
|---|---:|---:|
| Stationary RMS error | 2.285 mm | 1.810 mm |
| Time to 90% of step | 300 ms | 100 ms |

This specific signal gives approximately **20.8% lower stationary RMS jitter** and a faster step response. It is a filter-only comparison, not a live-camera accuracy score or a universal performance claim.

## Provenance and integrity

The official Google model endpoint returned a regional HTTP 403 during the build. Models were obtained from pinned public mirrors and their sources and SHA-256 values are retained in `vendor/manifest.json`. The included checks verify the distributed bytes; they do not claim independent authentication against an inaccessible official download. The models retain their Apache-2.0 notices.

The avatar retains Microsoft Rocketbox's MIT attribution. Its original base mesh and textures are preserved, with semantic bone names, explicit role metadata and 51 authored sparse expression morphs. The shapes are derived from the existing facial skin weights, not a newly measured FACS scan.

## Practical limits

- A physical USB webcam was tested at 1280×720; see the separate webcam report. No geometric motion-capture ground truth or complete feet-visible take was obtained.
- Precision mode is more computationally expensive. A Heavy model and a higher source resolution do not guarantee a more accurate result in every lighting, distance, motion or occlusion condition.
- Full-body framing makes fingers/face smaller. Close framing improves those details while potentially losing the feet. Single-camera depth and occluded joints remain estimates.
- No contact-constrained foot IK, recovered global root translation, multi-camera triangulation, individual toe capture or tongue capture is implemented. Facial gaze is approximate, not a calibrated eye tracker.
- All 52 MediaPipe coefficient channels are captured; neutral does not deform the mesh, so the character has 51 expression morphs. A custom avatar's visible coverage depends on its own morph and bone rig.
- Morph deformation and head/body retargeting are approximate real-time animation, not a clinical/anatomical measurement system.

## Deployment acceptance checks

Start `python scripts/serve.py`, grant the intended camera on localhost, select the pipeline/preset and inspect warmed inference/p95 plus the detail counters. Check left/right behavior with a raised arm and a single blink, calibrate a relaxed neutral face, then export and reopen a short real take. Repeat on the target device and with internet disconnected if offline use is required; the application assets are local, subject to MediaPipe's own telemetry behavior and browser policy.
