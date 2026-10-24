# 🕺 MOCAP — Whole-Body Webcam Motion Capture Dashboard

A production-oriented, browser-only motion-capture dashboard that tracks a single person from a webcam and drives:

- a live 33-landmark body skeleton,
- both 21-landmark hands,
- a procedural solid humanoid,
- the bundled rigged Xbot character, and
- compatible user-supplied rigged GLB / self-contained GLTF / VRM humanoids.

The application has **no backend and no build step**. Pose inference runs on-device with **MediaPipe Holistic Landmarker (Tasks Vision)** and rendering/retargeting runs in the browser with **Three.js**.

> **Important privacy detail:** webcam frames and returned landmarks are processed on-device and are not uploaded by this application. The page still downloads static JavaScript/WASM/model assets from third-party CDNs, and current MediaPipe Tasks documentation states that the library may send performance/utilization metrics to Google. Review the MediaPipe privacy notice before deploying this in a regulated or consent-sensitive environment.

---

## ✨ What changed in this professional rewrite

This version is a substantial engineering rewrite of the original single-file prototype rather than a visual-only refresh.

### Tracking engine

- Migrated from the **legacy `@mediapipe/holistic` solution** to the current **MediaPipe Tasks Vision `HolisticLandmarker`** API.
- Uses **pose world landmarks** when available, instead of approximating all 3D positions from normalized image-space `x/y/z` values.
- Falls back from the **GPU delegate to CPU** automatically when GPU initialization is unavailable.
- Uses `requestVideoFrameCallback()` when supported, with `requestAnimationFrame()` as a fallback.
- Owns exactly **one `getUserMedia()` stream**; there is no second camera helper competing for the same `<video>` element.
- Uses frame-rate-independent exponential smoothing, so the same smoothing setting behaves consistently across different camera/inference frame rates.
- Includes a short tracking-loss grace window to reduce visible one-frame flicker.

### 3D / retargeting

- Updated to **Three.js 0.186.1** with pinned CDN URLs.
- Improved rigged-model retargeting with a tracked pelvis/body frame, giving the hips a more stable yaw/roll orientation instead of only pointing a single bone direction.
- Preserves bind-pose twist while retargeting limb directions.
- Stores bind-pose local quaternions and resets loaded characters cleanly when capture stops.
- Uses stricter bone-role matching to prefer a missing role over an obviously wrong arbitrary bone.
- Supports common compressed GLTF assets through:
  - DRACO,
  - KTX2/Basis textures, and
  - Meshopt decoding.
- Disposes geometries, materials, and textures when replacing uploaded characters.

### Camera and runtime robustness

- Secure-context checks (`https://` or `localhost`) before requesting the camera.
- Clear handling for denied permission, missing camera, busy camera, and incompatible constraints.
- No duplicate camera acquisition.
- Cancels scheduled video-frame callbacks on stop.
- Cleans up MediaStream tracks, MediaPipe, Three.js loaders, renderer resources, and uploaded assets on page unload.
- Pinned dependency versions prevent an unannounced CDN `latest` release from changing behavior overnight.

### Upload pipeline

- `.glb` and `.vrm` are correctly read as binary.
- `.gltf` is correctly read as text JSON.
- Self-contained GLTF files are supported.
- A single `.gltf` file that references separate `.bin` or texture sidecars is intentionally not supported by the one-file upload control; export a self-contained `.glb` instead.
- Rejects models without a skeleton.
- Rejects oversized uploads (>120 MB).
- Requires a minimum number of resolvable driven roles before activating an uploaded rig.
- Auto-fits arbitrary character scale and places feet on the floor.
- Handles the legacy VRM 0.x facing convention.

### UX / accessibility

- Switches are real keyboard-focusable buttons with `role="switch"` and `aria-checked`.
- Status and error messages use live regions.
- Improved responsive layout for tablets/mobile widths.
- Honors `prefers-reduced-motion`.
- Camera preview mirroring is visualized consistently with the 3D mirror setting.
- Export is disabled until valid tracking data exists.

---

## 📁 Project structure

```text
.
├── index.html                 # Convenience redirect to the dashboard
├── mocap-dashboard.html       # Application markup / import map / controls
├── assets/
│   └── styles.css             # Responsive dashboard styling
├── src/
│   ├── bootstrap.js           # Early startup/module error reporting
│   └── app.js                 # Tracking, rendering, retargeting, upload logic
├── scripts/
│   ├── validate.py            # Zero-dependency static validation
│   └── build_single_file.py   # Builds the standalone distribution HTML
├── dist/
│   └── mocap-dashboard.single.html
├── CHANGELOG.md
├── README.md
└── LICENSE
```

There is intentionally **no JavaScript bundler and no `npm install` step**. The source is split into maintainable files but still runs as a static site. `dist/mocap-dashboard.single.html` is a generated single-file build for users who prefer the original one-file deployment style.

---

## 🚀 Quick start

### Requirements

Use a modern browser with:

- ES modules + import maps,
- WebGL,
- WebAssembly,
- `getUserMedia()`, and
- a webcam.

Chrome/Chromium or Edge are the primary recommended desktop browsers. Safari can also run MediaPipe Tasks on supported versions, but device/GPU behavior can differ.

An internet connection is required to download the pinned MediaPipe/Three.js runtime files, the Holistic model bundle, fonts, and optional Xbot character unless you vendor those assets locally.

### Run through a local server

Do **not** double-click the HTML file and run it from `file://`.

From the project directory:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

or directly:

```text
http://localhost:8000/mocap-dashboard.html
```

Other static servers are also fine, for example VS Code Live Server, `npx serve`, Caddy, nginx, GitHub Pages, Netlify, or Vercel.

### Single-file distribution

You can serve the generated file directly:

```text
dist/mocap-dashboard.single.html
```

Rebuild it after editing source files with:

```bash
python scripts/build_single_file.py
```

---

## 🎮 Usage

1. Open the page from `localhost` or HTTPS.
2. Wait for **MediaPipe Tasks** to initialize.
3. Click **Start camera**.
4. Grant camera permission.
5. Stand far enough back that shoulders, hips, knees, and feet can be seen.
6. The skeleton and procedural humanoid will begin tracking.
7. Optional:
   - choose **Realistic — Xbot** after it finishes loading,
   - upload a rigged character,
   - change detection/presence thresholds,
   - adjust motion smoothing,
   - toggle hands, PIP, landmarks, grid, mirroring, or auto-rotation,
   - export the current pose as JSON.

---

## 🧠 Architecture

### 1. MediaPipe Tasks Vision

The app initializes `HolisticLandmarker` in `VIDEO` mode.

Pinned package:

```text
@mediapipe/tasks-vision 1.0.1
```

Pinned model:

```text
holistic_landmarker/float16/1/holistic_landmarker.task
```

Initialization first attempts a **GPU delegate** and falls back to **CPU** if needed.

The live result is normalized into the first detected subject:

- `poseLandmarks[0]`
- `poseWorldLandmarks[0]`
- `leftHandLandmarks[0]`
- `leftHandWorldLandmarks[0]`
- `rightHandLandmarks[0]`
- `rightHandWorldLandmarks[0]`

Holistic Landmarker is used as a **single-person** motion-capture source in this project.

### 2. Pose world-space mapping

When world landmarks are present, body points are rendered from MediaPipe's metric 3D output and converted into Three.js coordinates:

```js
new THREE.Vector3(
  world.x * mirrorFactor,
  -world.y + hipHeight,
  -world.z,
)
```

Normalized pose coordinates remain as a defensive fallback.

This is materially better than treating image-space normalized depth as a complete body-space reconstruction.

### 3. Smoothing

Instead of a fixed per-frame interpolation coefficient, smoothing is converted into a time constant and applied using elapsed milliseconds:

```text
alpha = 1 - exp(-dt / tau)
```

That makes filtering much less dependent on whether the machine is currently tracking at 18 FPS or 55 FPS.

### 4. Skeleton renderer

The skeleton uses:

- 33 body joint spheres,
- cylinders for body bones,
- 21 joint markers per hand,
- line segments for hand bones,
- confidence-driven joint coloring.

All body geometry is generated once and updated in place.

### 5. Procedural solid model

The procedural avatar does not independently re-solve already available body segments.

Where possible, it copies the skeleton bone's exact:

- position,
- quaternion, and
- length.

Only synthetic central segments such as the torso center are computed separately.

### 6. Rigged GLTF / VRM retargeting

A loaded character goes through:

1. skeleton discovery,
2. role resolution,
3. auto-fit,
4. bind-pose capture,
5. live directional retargeting.

Role resolution tries:

1. VRM humanoid mappings,
2. exact Mixamo names,
3. curated normalized aliases.

The pelvis uses a 3D body frame based on:

- left/right hips, and
- hip midpoint → shoulder midpoint.

Limb bones use bind-direction → tracked-direction quaternion deltas and are converted back to parent-local rotations before being applied.

---

## 🤖 Supported character files

### Recommended

Use a **self-contained rigged `.glb`** whenever possible.

Also supported:

- `.vrm`
- self-contained `.gltf` with embedded resources/data URIs

### Requirements

The character must contain a real bone skeleton. A static mesh cannot be motion-captured by this project.

Best compatibility is expected with rigs based on conventions such as:

- VRM humanoid,
- Mixamo,
- Unity-style humanoid naming,
- common Blender left/right naming,
- common `J_Bip_*` names.

### Compression support

The loader is configured for:

- `KHR_draco_mesh_compression`,
- KTX2/Basis texture transcoding, and
- Meshopt-compressed geometry.

### Multi-file GLTF

A `.gltf` file may reference sibling files such as:

```text
character.gltf
character.bin
body.png
```

A browser `<input type="file">` selecting only `character.gltf` does not provide those sibling files to `GLTFLoader`.

For reliable uploads, export:

```text
character.glb
```

instead.

---

## 💾 Export format

**Export pose JSON** writes the most recent valid tracking frame.

The output includes:

```json
{
  "timestamp": "...",
  "videoTimestampMs": 12345.67,
  "engine": {
    "task": "MediaPipe Holistic Landmarker",
    "packageVersion": "1.0.1",
    "delegate": "GPU"
  },
  "poseLandmarks": [],
  "poseWorldLandmarks": [],
  "leftHandLandmarks": [],
  "leftHandWorldLandmarks": [],
  "rightHandLandmarks": [],
  "rightHandWorldLandmarks": []
}
```

No camera image is included in the export.

---

## 🎛️ Controls

### Pose detection confidence

Controls MediaPipe's pose/face detection threshold used when configuring Holistic Landmarker.

Higher values can reduce false detections but may make acquisition harder under poor lighting or partial occlusion.

### Pose/hand presence confidence

Applied to:

- pose presence confidence, and
- hand landmark presence confidence.

Higher values are stricter.

### Motion smoothing

- `0.00` → fastest response / most visible jitter
- `0.95` → strongest filtering / more latency

A middle value is normally the best starting point.

---

## 🔒 Privacy and network behavior

### What this application does not do

There is no project-owned:

- backend,
- account system,
- database,
- analytics endpoint,
- webcam upload endpoint, or
- landmark upload endpoint.

Uploaded 3D model files are read with browser file APIs and parsed in the page.

### Network requests that do occur

Unless you vendor dependencies locally, the browser downloads static assets from:

- jsDelivr — Three.js and MediaPipe Tasks runtime/WASM,
- Google Storage — MediaPipe Holistic model,
- Google Fonts — optional typography,
- GitHub raw content (pinned Three.js `r186` tag) — bundled Xbot GLB.

Current MediaPipe Tasks documentation additionally states that its APIs can send library **performance and utilization metrics** to Google, while input media processing remains on-device.

If your deployment requires zero third-party runtime network traffic, vendor all dependencies/models/fonts locally and evaluate the MediaPipe telemetry/privacy requirements for your environment.

---

## 🧰 Dependency pins

| Component | Version / asset |
|---|---|
| Three.js | `0.186.1` |
| MediaPipe Tasks Vision | `1.0.1` |
| Holistic model | `float16/1/holistic_landmarker.task` |
| Xbot | Three.js `0.186.1` example asset |

Pinned versions are deliberate. Upgrade them intentionally and re-test the application rather than replacing them with `@latest`.

---

## 🧪 Validation

Run the included validator:

```bash
python scripts/validate.py
```

It checks:


- JavaScript syntax with `node --check`,
- missing DOM IDs referenced by JavaScript,
- toggle keys that do not exist in application state,
- missing local source/style files,
- accidental duplicate camera ownership in source,
- correct binary-vs-text upload handling paths,
- pinned runtime dependencies, and
- removal of the legacy MediaPipe camera/Holistic code paths.

A real camera/inference integration test still needs to be run in a browser with network access and a webcam because those capabilities are unavailable in a restricted build sandbox.

---

## 🛠️ Configuration

Most runtime constants are centralized at the top of `src/app.js`:

```js
const CONFIG = Object.freeze({
  threeVersion: "0.186.1",
  mediaPipeVersion: "1.0.1",
  maxUploadBytes: 120 * 1024 * 1024,
  avatarHipHeight: 1.0,
  normalizedFallbackScale: 2.0,
  minRenderVisibility: 0.3,
  trackingLossGraceMs: 280,
  longTrackingLossResetMs: 1200,
  maxPixelRatio: 2,
});
```

### Upload size

Change:

```js
maxUploadBytes: 120 * 1024 * 1024
```

### Avatar height / vertical placement

Change:

```js
avatarHipHeight: 1.0
```

### Tracking-loss grace

Change:

```js
trackingLossGraceMs: 280
```

### Long tracking-loss reset

After a prolonged loss, stale smoothed coordinates are discarded:

```js
longTrackingLossResetMs: 1200
```

### Device pixel ratio cap

For low-power hardware you can reduce:

```js
maxPixelRatio: 2
```

to `1` or `1.5` to lower rendering cost.

---

## 🧯 Troubleshooting

### Camera button stays unavailable / startup failed

Check the browser console and confirm that the page can download:

- MediaPipe Tasks Vision,
- MediaPipe WASM files,
- the Holistic model.

Corporate firewalls, content blockers, strict CSP rules, or offline operation can block those assets.

### Camera permission denied

Use the browser's site-permission UI to allow the camera, then reload or press **Start camera** again.

### Camera works on localhost but not on another HTTP host

`getUserMedia()` requires a secure context. Use HTTPS in production.

### Very low FPS

Try:

- closing GPU-heavy tabs/apps,
- better lighting,
- a lower-resolution camera source at the OS/browser level,
- reducing `maxPixelRatio`,
- using the procedural model,
- disabling PIP/2D overlay if necessary.

The Holistic model still computes its configured holistic outputs; the **Track hands** switch controls this application's hand visualization/retarget usage, not the internal cost of the Holistic model graph.

### Uploaded character bends incorrectly

Likely causes:

- non-humanoid hierarchy,
- unusual bind pose,
- unsupported bone naming,
- missing arm/leg/hand/toe roles,
- negative/non-uniform transforms embedded in the rig,
- a character authored with a substantially different forward axis.

Check the upload message for the number of driven limb roles that were mapped.

### GLTF references missing files

Export the asset as a single `.glb`.

---

## ⚠️ Known limitations

- Single-person tracking.
- No root translation / locomotion solving for rigged characters; the character remains planted while bones rotate.
- No inverse-kinematics foot locking.
- No temporal motion prediction.
- No face mesh rendering or facial blendshape driving in the UI.
- No VRM spring-bone simulation.
- No VRM expression mapping.
- Custom rigs with unusual topology/naming may still require a project-specific mapping table.
- The browser main thread performs inference and Three.js updates; a Worker/OffscreenCanvas architecture would be the next step for a much larger production application.

---

## 🔧 Production hardening ideas

For a public production deployment, consider additionally:

- vendoring dependencies instead of loading from public CDNs,
- serving a strict Content Security Policy,
- adding Subresource Integrity where practical,
- hosting the MediaPipe model yourself,
- adding Playwright end-to-end tests with mocked camera media,
- adding telemetry only with explicit product/privacy requirements,
- moving ML inference to a Worker if supported by your target browser matrix,
- adding explicit device selection for multi-camera systems,
- implementing a calibration/T-pose step for arbitrary custom rigs,
- adding IK foot locking and root-motion estimation.

---

## 📄 License

MIT. See [`LICENSE`](./LICENSE).

Third-party software/assets retain their own licenses, including:

- MediaPipe — Apache 2.0,
- Three.js — MIT,
- Xbot example asset — distributed with the Three.js examples; review upstream asset/license information for your deployment.

---

## 🙏 Credits

Built with:

- [MediaPipe](https://developers.google.com/edge/mediapipe/solutions/vision/holistic_landmarker/web_js)
- [Three.js](https://threejs.org/)

This project is not affiliated with or endorsed by Google, Adobe/Mixamo, or the Three.js project.
