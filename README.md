# 🕺 MOCAP — Whole-Body Webcam Motion Capture Dashboard

A browser-based motion capture studio: point a webcam at yourself and a
live wireframe skeleton plus a solid 3D character mirror your entire
body — arms, legs, torso, head, and hands — in real time. Upload your own
rigged 3D character and it moves with you too.

Everything runs **100% client-side** — no backend, no server, no API
keys. All pose estimation happens locally in your browser using
MediaPipe. Nothing is uploaded anywhere.

![status](https://img.shields.io/badge/status-experimental-orange)
![stack](https://img.shields.io/badge/stack-vanilla%20JS%20%2B%20WebGL-blue)
![license](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

### 🧍 Dual live 3D avatars (`mocap-dashboard.html`)
- A wireframe skeleton and a solid humanoid figure stand side by side,
  both driven by the exact same tracking data — the solid model directly
  copies the skeleton's own computed bone transforms, so the two can never
  visually drift apart.
- 33-point full-body pose plus 21-point tracking on each hand, via
  [MediaPipe Holistic](https://developers.google.com/mediapipe) — arms,
  legs, torso, head orientation, and individual finger spread all track
  live.
- Glowing joints and bones color-code per-limb tracking confidence in
  real time (teal → amber → red as confidence drops).
- Orbit-controllable 3D viewport — drag to rotate, scroll to zoom, toggle
  the floor grid, auto-rotate, or reset the camera to a default framing.

### 🤖 Built-in realistic model
- A free, properly rigged humanoid ("Xbot") loads in the background as an
  alternative to the procedural figure — real bone-based forward
  kinematics, not just repositioned shapes.

### 📤 Bring your own 3D model
- Upload any **rigged** `.glb` or `.vrm` humanoid character and it
  animates with your movement.
- Automatic bone-name recognition across a three-tier resolver: the
  **VRM standard's** official bone mapping, **exact Mixamo names**, then a
  validated **fuzzy matcher** covering Unity Humanoid, Ready Player Me,
  Blender `.L`/`.R` suffixes, and raw VRM (`J_Bip_`) naming — tested
  against real rigs with zero false positives on unrelated bone/prop
  names.
- Auto-scales and repositions any uploaded model to a sensible height
  with feet on the floor, corrects the known VRM 0.x backward-facing
  quirk, and reports exactly how many bones were recognized — with a
  clear, specific message for every failure case (no skeleton found,
  unsupported file type, oversized file, corrupt/unparseable file)
  instead of failing silently.

### 🎛️ Live tracking dashboard
- FPS, tracked-landmark count, camera resolution, average confidence, and
  frame time, updated live.
- Per-joint "tracking signal" bars (shoulders, elbows, wrists, hips,
  knees, ankles) — an at-a-glance readout of exactly which limbs are
  confidently tracked right now.
- Detection/tracking confidence sliders and an adjustable motion
  smoothing control.
- A small picture-in-picture source feed with an optional 2D
  landmark/skeleton overlay.

### 💾 Export
- Download the current frame's raw pose landmark data as JSON.

---

## 📁 Project structure

```
.
├── mocap-dashboard.html   # The entire application — single file, no build step
└── README.md
```

Everything — markup, styling, and logic — lives in one self-contained
HTML file. Open it (via a local server, see below) and go.

---

## 🚀 Getting started

### Requirements
- A modern desktop browser — **Chrome or Edge recommended** (WebGL2,
  `getUserMedia`, and ES module support required).
- A webcam.
- An internet connection on first load (MediaPipe, Three.js, and the
  built-in Xbot model are fetched from public CDNs at runtime).

### Important: run it from a local server, not `file://`
Camera access (`getUserMedia`) and ES module imports both require a
**secure context**. A double-clicked `file://` page doesn't count, so the
webcam and 3D libraries will silently fail to load. Serve the folder
instead:

```bash
# from the project folder
python -m http.server 8000
# then open:
http://localhost:8000/mocap-dashboard.html
```

Any other static server works too (`npx serve`, VS Code's Live Server,
GitHub Pages, Netlify, Vercel, etc.) — `localhost` and `https://` both
count as secure contexts.

### First run
1. Open `mocap-dashboard.html` via `http://localhost:...`. It boots the
   tracking models (a couple of seconds) while the built-in Xbot model
   loads quietly in the background.
2. Click **Start camera** and grant webcam permission.
3. Move — the skeleton and solid model should track your whole body live.
4. Optionally, switch the **Active model** dropdown to Xbot, or click
   **Upload your 3D model** to drive your own rigged character instead.

---

## 🧠 How it works

### Tracking
1. [MediaPipe Holistic](https://developers.google.com/mediapipe) runs a
   pose + hand landmark model on each webcam frame, entirely client-side
   via WebAssembly/WebGL, returning 33 body landmarks (with visibility
   confidence) plus 21 landmarks per hand.
2. Every tracked point is exponentially smoothed frame-to-frame to reduce
   jitter without adding noticeable lag.
3. Points are mapped from MediaPipe's normalized image space into 3D
   world space for rendering.

### Skeleton & solid model
The skeleton renders joints and bones directly from the smoothed
landmark positions. The procedural solid model then **copies those exact
same computed transforms** — position, rotation, and length — for every
matching limb, rather than recalculating independently. The two are
structurally incapable of drifting apart, because they're reading the
same values.

### Rigged models (Xbot / uploaded)
A rigged character has fixed bone lengths, so it can't simply be
repositioned like the procedural model. Instead, each frame computes the
*rotation* needed to swing each bone from its bind-pose direction to the
direction implied by live tracking, applied as proper parent-to-child
forward kinematics — an elbow bends relative to the already-rotated upper
arm, not in isolation.

### Custom model bone resolution
For an uploaded model, each of ~13 tracked bone roles (hips, upper/lower
arms, hands, upper/lower legs, feet) is resolved by trying, in order: the
VRM extension's authoritative bone mapping, exact Mixamo bone names, then
a fuzzy name matcher validated against several real-world rig-naming
conventions.

---

## 🔒 Privacy

- Webcam video and all pose/landmark data **never leave your browser** —
  there is no backend, no analytics, and no network calls other than
  fetching the static MediaPipe/Three.js/model files on first load
  (cached by the browser afterward).
- Uploaded 3D models are read and parsed entirely in-browser via
  `FileReader` — they are never transmitted anywhere.
- Nothing is stored in cookies or `localStorage`; closing the tab clears
  everything.

---

## 🛠️ Customization

**Tune avatar scale/positioning** — near the top of the 3D-mapping code:
```js
var AVATAR_SCALE = 2.0;      // overall size of the tracked skeleton/solid model
var AVATAR_Y_OFFSET = 1.0;   // vertical offset so feet land near the floor
```

**Tune default tracking behavior** — in the `state` object:
```js
smoothing:   0.55,  // higher = smoother but less responsive
minDetConf:  0.5,   // MediaPipe minimum detection confidence
minTrackConf:0.5,   // MediaPipe minimum tracking confidence
```
All three are also adjustable live from the sidebar sliders.

**Swap the built-in realistic model** — change the source URL:
```js
var GLTF_MODEL_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Xbot.glb';
```

**Adjust the custom-upload file size limit**:
```js
var MAX_BYTES = 120 * 1024 * 1024; // 120 MB
```

**Extend bone-name recognition for a new rig convention** — add candidate
names to `ROLE_CANDIDATES`, keyed by canonical role (`leftUpperArm`,
`rightLowerLeg`, etc.), split into `exact` (strict) and `loose`
(substring) match tiers.

**Re-theme the colors** — the stylesheet uses CSS custom properties at
the top of the `<style>` block:
```css
--bg:#0A0D12;
--accent:#4FE3C1;
--warn:#FF6B4A;
--amber:#FFB454;
--red:#FF5470;
```
Swap the palette to restyle the whole dashboard in one place.

---

## ⚠️ Known limitations

- **Sandboxed previews** (e.g. viewing this inside a chat product's
  inline preview) typically block camera access entirely for security
  reasons. Download the file and serve it yourself as described above.
- **Rigged models don't move root position** — the Xbot/uploaded
  character's limbs rotate with you, but the character stays planted in
  place; walking sideways won't make it slide across the floor.
- **Single-person tracking only** — MediaPipe Holistic tracks one person
  per frame.
- **Fuzzy bone-name matching isn't guaranteed** for every possible custom
  rig — highly nonstandard bone naming may result in partial tracking; the
  upload status line always reports exactly how many bones were
  recognized.
- **Multi-file `.gltf` exports** (with separate `.bin`/texture files)
  aren't supported by the single-file upload dialog — export as
  self-contained `.glb` instead.
- **Lighting and webcam quality** materially affect tracking accuracy —
  confidence will visibly drop in poor lighting or with a low-quality
  camera.
- **VRM support covers skeletal tracking only** — spring bones and facial
  expression blendshapes from the VRM spec aren't implemented.

---

## 🧰 Tech stack

| Piece | Library | Purpose |
|---|---|---|
| 3D rendering | [Three.js](https://threejs.org/) (r160) | Avatars, camera, lighting, `GLTFLoader`, `OrbitControls` |
| Body & hand tracking | [MediaPipe Holistic](https://developers.google.com/mediapipe) | 33-point body pose + 21-point hand landmarks |
| Fonts | [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk), [JetBrains Mono](https://www.jetbrains.com/lp/mono/) | Dashboard typography |

No build step, no bundler, no `npm install` — every dependency loads from
a CDN via `<script>`/`import` at runtime.

---

## 📄 License

MIT — do whatever you'd like with this, a credit back to the repo is
appreciated but not required. 

Third-party assets keep their own licenses: the bundled **Xbot** model
ships with [three.js](https://github.com/mrdoob/three.js)'s MIT-licensed
example assets (originally Mixamo-rigged); **MediaPipe** is Apache 2.0;
**Three.js** is MIT.

---

## 🙏 Credits

Built on [MediaPipe](https://developers.google.com/mediapipe) and
[Three.js](https://threejs.org/). Not affiliated with or endorsed by
Google, Mixamo/Adobe, or any 3D model marketplace referenced above.
