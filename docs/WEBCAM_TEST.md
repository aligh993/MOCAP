# 📷 Physical webcam test — v3.1.0

Date: October 26, 2026. Browser: desktop app Chromium in-app browser, localhost. Test performed with the user's permission on the user's physical camera, after the user enabled browser and Windows camera access.

## Equipment and configuration

- Physical device: **USB2.0 HD UVC WebCam (322e:2233)**.
- Actual negotiated stream: **1280×720 at 30 camera fps**. The requested 1920×1080 resolution was not supported by this source.
- Precision: local Pose Heavy + Face + Hand tasks, **Worker · GPU**, maximum-detail preset.
- Camera sensor frame rate and processed result rate are different measurements.
- No camera video, private source-feed screenshot or captured landmark recording is included in the release. The short replay test stayed in browser memory. Included evidence contains aggregated timings/availability and screenshots of the avatar with the private feed hidden.

## Observations

The original v3.0 UI showed approximately **4 processed results/s**, **241.9 ms** for a sampled inference and **273 ms rolling p95**. This was an observational baseline, without a saved controlled camera sequence.

The revised default temporal full-frame hand mode produced the following rolling window, saved in [webcam-diagnostics.json](webcam-diagnostics.json):

| Measurement | Observed value |
|---|---:|
| Window | 120 delivered results over 13.38 seconds |
| Result rate | 8.89 fps |
| Neural inference median / p95 | 41.2 / 208.7 ms |
| Pipeline median / p95 | 42.2 / 209.3 ms |
| Body component median | 17.6 ms |
| Face component median | 7.6 ms |
| Hands component median | 14.8 ms |
| Face detected in the variable-framing window | 33.3% of results |
| Both hands detected in the window | 75.8% of results |
| Feet reliably visible | 0% of results |

The final sample of that window contained **478 facial points, 42 hand points and the UI showed all 52 expression coefficient channels**. Body/arm tracking, finger visualization and avatar response were observed on the real source. A live take recorded **314 frames over 33.9 seconds**, then played successfully in memory after stopping the camera.

A separate generated-build window is retained in [webcam-packaged-diagnostics.json](webcam-packaged-diagnostics.json): **7.72 fps**, **49.3 ms median inference**, **138.3 ms p95**. Its framing/detection mix differed, so it is not an equivalent workload. Earlier in that run the rolling pipeline median was 214.3 ms and p95 249.9 ms, illustrating substantial workload variation.

These windows include changing poses, distance, hand orientation and face visibility. They are **not** a paired before/after speed benchmark. They do not establish an accuracy percentage, a universal 2× speedup or continuous detection of every channel. Face and hand dropouts remain possible; the low face availability is reported explicitly rather than hidden. A full-body feet-in-frame sequence and geometric ground truth were not obtained, so complete lower-body motion accuracy is not certified.

## Fixes exercised

- Browser/Windows permission failure produced actionable messages. Camera retry succeeded after the user enabled Windows access.
- Camera preview appears before tracker initialization. Startup has a cancellation button and a deadline; late streams are stopped by the tested lifecycle helper.
- Physical camera stop/restart and an unexpected disconnection were handled with retry available. An old stream's disconnect callback is generation-gated.
- The default uses VIDEO hand tracking. Optional pose-guided hand crops use IMAGE mode, remap results into source coordinates and fall back to a full frame when the crop regions overlap. Both input paths were exercised. In this test, crops did not establish a reliable quality gain, so they are opt-in and are not advertised as universally better.
- Body/hand filters reject unreliable updates and reset stale history on reacquisition. Pelvis/head frames require visible source anchors. Neutral head reference averages the same 30 detected samples as the expression baseline.
- Graph-option changes and inference are serialized; worker failure rejects pending operations. Idle views render on change.
- The removed demo button and generated-motion branch are absent from both shipped application builds.
- Diagnostic export includes timing and detection availability without camera images, video or landmark data.

## Acceptance limits

This is a functional physical-webcam test, not a calibrated motion-capture validation. Webcam position, lighting, exposure, motion blur and occlusion materially affect output. A single wide shot cannot simultaneously provide close-up fingertip/face detail and full-body visibility at this camera's pixel count. No contact foot IK, recovered global root trajectory, individual toe/tongue capture or measured eye gaze is provided. Test the intended movement and lighting before production capture.
