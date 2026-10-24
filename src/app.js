import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
let FilesetResolverClass = null;
let HolisticLandmarkerClass = null;

async function loadMediaPipeModule() {
  if (FilesetResolverClass && HolisticLandmarkerClass) return;
  const visionModule = await import("@mediapipe/tasks-vision");
  const visionApi = visionModule.default ?? visionModule;
  FilesetResolverClass = visionApi.FilesetResolver;
  HolisticLandmarkerClass = visionApi.HolisticLandmarker;
  if (!FilesetResolverClass || !HolisticLandmarkerClass) {
    throw new Error("MediaPipe Tasks Vision did not expose FilesetResolver/HolisticLandmarker.");
  }
}

const CONFIG = Object.freeze({
  threeVersion: "0.186.1",
  mediaPipeVersion: "1.0.1",
  mediaPipeWasmRoot: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm",
  holisticModelUrl: "https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task",
  xbotUrl: "https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/models/gltf/Xbot.glb",
  dracoDecoderPath: "https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/libs/draco/gltf/",
  ktx2TranscoderPath: "https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/libs/basis/",
  maxUploadBytes: 120 * 1024 * 1024,
  avatarHipHeight: 1.0,
  normalizedFallbackScale: 2.0,
  minRenderVisibility: 0.3,
  trackingLossGraceMs: 280,
  longTrackingLossResetMs: 1200,
  maxPixelRatio: 2,
});

const POSE_BONES = Object.freeze([
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [15, 17], [15, 19], [15, 21], [17, 19],
  [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
  [27, 29], [27, 31], [29, 31],
  [28, 30], [28, 32], [30, 32],
  [7, 0], [0, 8],
]);

const HAND_BONES = Object.freeze([
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
]);

const MAJOR_JOINTS = Object.freeze([11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]);
const SIGNAL_LABELS = Object.freeze({
  11: "L.SHLD", 12: "R.SHLD", 13: "L.ELBW", 14: "R.ELBW",
  15: "L.WRST", 16: "R.WRST", 23: "L.HIP", 24: "R.HIP",
  25: "L.KNEE", 26: "R.KNEE", 27: "L.ANKL", 28: "R.ANKL",
});

const SOLID_LIMBS = Object.freeze([
  ["hipMid", "shoulderMid", 0.15, "shirt"],
  [23, 24, 0.10, "pants"],
  [11, 12, 0.075, "shirt"],
  ["shoulderMid", 0, 0.055, "skin"],
  [11, 13, 0.055, "skin"], [13, 15, 0.045, "skin"],
  [12, 14, 0.055, "skin"], [14, 16, 0.045, "skin"],
  [23, 25, 0.075, "pants"], [25, 27, 0.060, "pants"],
  [24, 26, 0.075, "pants"], [26, 28, 0.060, "pants"],
]);

const SOLID_JOINTS = Object.freeze([
  { idx: 11, radius: 0.060, material: "skin" },
  { idx: 12, radius: 0.060, material: "skin" },
  { idx: 13, radius: 0.050, material: "skin" },
  { idx: 14, radius: 0.050, material: "skin" },
  { idx: 23, radius: 0.090, material: "pants" },
  { idx: 24, radius: 0.090, material: "pants" },
  { idx: 25, radius: 0.065, material: "pants" },
  { idx: 26, radius: 0.065, material: "pants" },
]);

const ROLE_TARGETS = Object.freeze([
  { role: "leftUpperLeg", ref: "leftLowerLeg", lmA: 23, lmB: 25 },
  { role: "leftLowerLeg", ref: "leftFoot", lmA: 25, lmB: 27 },
  { role: "leftFoot", ref: "leftToes", lmA: 27, lmB: 31 },
  { role: "rightUpperLeg", ref: "rightLowerLeg", lmA: 24, lmB: 26 },
  { role: "rightLowerLeg", ref: "rightFoot", lmA: 26, lmB: 28 },
  { role: "rightFoot", ref: "rightToes", lmA: 28, lmB: 32 },
  { role: "leftUpperArm", ref: "leftLowerArm", lmA: 11, lmB: 13 },
  { role: "leftLowerArm", ref: "leftHand", lmA: 13, lmB: 15 },
  { role: "leftHand", ref: "leftMiddleProximal", lmA: 15, lmB: 19 },
  { role: "rightUpperArm", ref: "rightLowerArm", lmA: 12, lmB: 14 },
  { role: "rightLowerArm", ref: "rightHand", lmA: 14, lmB: 16 },
  { role: "rightHand", ref: "rightMiddleProximal", lmA: 16, lmB: 20 },
]);

const MIXAMO_NAME_BY_ROLE = Object.freeze({
  hips: "mixamorig:Hips",
  spine: "mixamorig:Spine",
  leftUpperLeg: "mixamorig:LeftUpLeg",
  leftLowerLeg: "mixamorig:LeftLeg",
  leftFoot: "mixamorig:LeftFoot",
  leftToes: "mixamorig:LeftToeBase",
  rightUpperLeg: "mixamorig:RightUpLeg",
  rightLowerLeg: "mixamorig:RightLeg",
  rightFoot: "mixamorig:RightFoot",
  rightToes: "mixamorig:RightToeBase",
  leftUpperArm: "mixamorig:LeftArm",
  leftLowerArm: "mixamorig:LeftForeArm",
  leftHand: "mixamorig:LeftHand",
  leftMiddleProximal: "mixamorig:LeftHandMiddle1",
  rightUpperArm: "mixamorig:RightArm",
  rightLowerArm: "mixamorig:RightForeArm",
  rightHand: "mixamorig:RightHand",
  rightMiddleProximal: "mixamorig:RightHandMiddle1",
});

const ROLE_ALIASES = Object.freeze({
  hips: ["hips", "hip", "pelvis", "rootpelvis"],
  spine: ["spine", "spine1", "chest", "torso", "abdomen", "upperbody", "jbipspine"],
  leftUpperLeg: ["leftupperleg", "leftupleg", "leftthigh", "upperlegl", "thighl", "jbiplupperleg"],
  leftLowerLeg: ["leftlowerleg", "leftleg", "leftshin", "leftcalf", "lowerlegl", "shinl", "calfl", "jbipllowerleg"],
  leftFoot: ["leftfoot", "footl", "jbiplfoot"],
  leftToes: ["lefttoes", "lefttoe", "lefttoebase", "toesl", "toel", "jbipltoebase"],
  rightUpperLeg: ["rightupperleg", "rightupleg", "rightthigh", "upperlegr", "thighr", "jbiprupperleg"],
  rightLowerLeg: ["rightlowerleg", "rightleg", "rightshin", "rightcalf", "lowerlegr", "shinr", "calfr", "jbiprlowerleg"],
  rightFoot: ["rightfoot", "footr", "jbiprfoot"],
  rightToes: ["righttoes", "righttoe", "righttoebase", "toesr", "toer", "jbiprtoebase"],
  leftUpperArm: ["leftupperarm", "leftarm", "upperarml", "arml", "jbiplupperarm"],
  leftLowerArm: ["leftlowerarm", "leftforearm", "forearml", "lowerarml", "jbipllowerarm"],
  leftHand: ["lefthand", "handl", "jbiplhand"],
  leftMiddleProximal: ["leftmiddleproximal", "leftmiddle1", "middle1l", "jbiplmiddle1"],
  rightUpperArm: ["rightupperarm", "rightarm", "upperarmr", "armr", "jbiprupperarm"],
  rightLowerArm: ["rightlowerarm", "rightforearm", "forearmr", "lowerarmr", "jbiprlowerarm"],
  rightHand: ["righthand", "handr", "jbiprhand"],
  rightMiddleProximal: ["rightmiddleproximal", "rightmiddle1", "middle1r", "jbiprmiddle1"],
});

const REQUIRED_ROLES = Object.freeze([
  "hips", "spine",
  "leftUpperLeg", "leftLowerLeg", "leftFoot", "leftToes",
  "rightUpperLeg", "rightLowerLeg", "rightFoot", "rightToes",
  "leftUpperArm", "leftLowerArm", "leftHand", "leftMiddleProximal",
  "rightUpperArm", "rightLowerArm", "rightHand", "rightMiddleProximal",
]);

const state = {
  running: false,
  booted: false,
  mirror: true,
  showPip: true,
  overlay2d: true,
  trackHands: true,
  showGrid: true,
  showSkeleton: true,
  showSolid: true,
  modelSource: "procedural",
  autorotate: false,
  smoothing: 0.55,
  minDetectionConfidence: 0.5,
  minPresenceConfidence: 0.5,
  startTime: null,
  lastInferenceAt: 0,
  lastPoseSeenAt: 0,
  lastVideoTime: -1,
  fpsHistory: [],
  latestExport: null,
  smoothedJoints: new Map(),
  smoothedHands: { L: [], R: [] },
  stream: null,
  frameRequestId: null,
  frameRequestKind: null,
  cameraGeneration: 0,
  inferenceFailures: 0,
  engineDelegate: "—",
  optionsTimer: null,
  errorTimer: null,
};

const $ = (id) => document.getElementById(id);
const dom = {
  loadingOverlay: $("loading-overlay"),
  loadingMessage: $("loading-message"),
  video: $("input-video"),
  pip: $("pip"),
  pipOverlay: $("pip-overlay"),
  viewportHint: $("viewport-hint"),
  errorBanner: $("err-banner"),
  statusPill: $("status-pill"),
  statusText: $("status-text"),
  fps: $("fps-val"),
  landmarks: $("lm-val"),
  toggleCamera: $("btn-toggle-cam"),
  toggleCameraLabel: $("btn-toggle-label"),
  exportPose: $("btn-export"),
  resetView: $("btn-reset-view"),
  modelSource: $("model-source-select"),
  uploadButton: $("btn-upload-model"),
  uploadInput: $("model-upload-input"),
  uploadStatus: $("model-upload-status"),
  optXbot: $("opt-xbot"),
  optCustom: $("opt-custom"),
  detectionSlider: $("dc-slider"),
  detectionValue: $("dc-val"),
  presenceSlider: $("pc-slider"),
  presenceValue: $("pc-val"),
  smoothingSlider: $("sm-slider"),
  smoothingValue: $("sm-val"),
  statResolution: $("stat-res"),
  statConfidence: $("stat-conf"),
  statInference: $("stat-inference"),
  statUptime: $("stat-uptime"),
  statEngine: $("stat-engine"),
  statModel: $("stat-model"),
  signalList: $("signal-list"),
  canvas3d: $("canvas3d"),
};

const pipContext = dom.pipOverlay.getContext("2d", { alpha: true });

let renderer;
let scene;
let camera3d;
let controls;
let floorGrid;
let skeletonGroup;
let humanGroup;
let resizeObserver;
let holisticLandmarker = null;
let gltfLoader = null;
let dracoLoader = null;
let ktx2Loader = null;
let xbotHumanoid = null;
let customHumanoid = null;

const jointMeshes = new Map();
const boneMeshes = [];
const boneMeshByPair = new Map();
const handJointMeshes = { L: [], R: [] };
const handBoneLines = { L: null, R: null };
let headSphere;
const solidLimbMeshes = [];
const solidJointMeshes = [];
let solidHead;
let solidEyeL;
let solidEyeR;
const solidHandMeshes = { L: null, R: null };
const solidFootMeshes = { L: null, R: null };
const signalBars = new Map();
const synthPoints = {};
const synthPointsGltf = {};

const scratch = {
  a: new THREE.Vector3(),
  b: new THREE.Vector3(),
  c: new THREE.Vector3(),
  d: new THREE.Vector3(),
  q1: new THREE.Quaternion(),
  q2: new THREE.Quaternion(),
  q3: new THREE.Quaternion(),
  m1: new THREE.Matrix4(),
  yAxis: new THREE.Vector3(0, 1, 0),
};

function setStatus(mode, text) {
  dom.statusPill.className = `status-pill ${mode}`;
  dom.statusText.textContent = text;
}

function setLoadingMessage(message) {
  dom.loadingMessage.textContent = message;
}

function showError(message, timeoutMs = 7000) {
  window.clearTimeout(state.errorTimer);
  dom.errorBanner.textContent = message;
  dom.errorBanner.classList.add("show");
  if (timeoutMs > 0) {
    state.errorTimer = window.setTimeout(() => dom.errorBanner.classList.remove("show"), timeoutMs);
  }
}

function hideError() {
  window.clearTimeout(state.errorTimer);
  dom.errorBanner.classList.remove("show");
}

function setUploadStatus(message, tone = "neutral") {
  dom.uploadStatus.textContent = message;
  dom.uploadStatus.classList.remove("error", "success");
  if (tone === "error") dom.uploadStatus.classList.add("error");
  if (tone === "success") dom.uploadStatus.classList.add("success");
}

function formatError(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  return error.message || error.name || String(error);
}

function getCameraErrorMessage(error) {
  const name = error?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission was denied. Allow camera access for this site and try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No usable camera was found.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The camera is already in use by another application or could not be started.";
  }
  if (name === "OverconstrainedError") {
    return "The camera cannot satisfy the requested video constraints.";
  }
  if (!window.isSecureContext) {
    return "Camera access requires HTTPS or localhost. Serve this project through a local web server instead of file://.";
  }
  return `Camera access failed: ${formatError(error)}`;
}

function normalizeBoneName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function signalColor(visibility) {
  if (visibility > 0.7) return "var(--accent)";
  if (visibility > 0.4) return "var(--amber)";
  return "var(--red)";
}

function initSignalBars() {
  dom.signalList.textContent = "";
  for (const index of MAJOR_JOINTS) {
    const row = document.createElement("div");
    row.className = "signal-item";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = SIGNAL_LABELS[index];

    const track = document.createElement("div");
    track.className = "signal-track";
    const bars = [];
    for (let i = 0; i < 10; i += 1) {
      const bar = document.createElement("div");
      bar.className = "signal-bar";
      track.appendChild(bar);
      bars.push(bar);
    }

    const percentage = document.createElement("div");
    percentage.className = "signal-pct";
    percentage.textContent = "0%";

    row.append(name, track, percentage);
    dom.signalList.appendChild(row);
    signalBars.set(index, { bars, percentage });
  }
}

function updateSignalBars(poseLandmarks) {
  for (const index of MAJOR_JOINTS) {
    const landmark = poseLandmarks?.[index];
    const visibility = Number.isFinite(landmark?.visibility) ? landmark.visibility : 0;
    const ui = signalBars.get(index);
    const lit = Math.max(0, Math.min(10, Math.round(visibility * 10)));
    const color = signalColor(visibility);
    ui.bars.forEach((bar, i) => {
      if (i < lit) {
        bar.style.background = color;
        bar.style.height = `${40 + (i / 9) * 60}%`;
      } else {
        bar.style.background = "var(--border)";
        bar.style.height = "30%";
      }
    });
    ui.percentage.textContent = `${Math.round(visibility * 100)}%`;
  }
}

function smoothingLerpFactor(deltaMs) {
  const smoothing = THREE.MathUtils.clamp(state.smoothing, 0, 0.95);
  if (smoothing <= 0.001) return 1;
  const tauMs = THREE.MathUtils.lerp(1, 220, smoothing);
  const boundedDelta = THREE.MathUtils.clamp(deltaMs || 16.67, 1, 100);
  return 1 - Math.exp(-boundedDelta / tauMs);
}

function smoothVector(target, source, deltaMs) {
  target.lerp(source, smoothingLerpFactor(deltaMs));
  return target;
}

function makeLabelSprite(text, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 72;
  const context = canvas.getContext("2d");
  context.font = '600 32px "Space Grotesk", sans-serif';
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 160, 36);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1, 0.225, 1);
  return sprite;
}

function createMaterial(color, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    roughness: 0.42,
    metalness: 0.12,
  });
}

function initThree() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0d12, 0.045);

  camera3d = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
  camera3d.position.set(0, 1.55, 5.0);

  renderer = new THREE.WebGLRenderer({
    canvas: dom.canvas3d,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  controls = new OrbitControls(camera3d, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 1.0, 0);
  controls.minDistance = 1.5;
  controls.maxDistance = 12;
  controls.maxPolarAngle = Math.PI * 0.92;
  controls.saveState();

  scene.add(new THREE.HemisphereLight(0x9fb7c8, 0x111318, 1.0));
  const key = new THREE.DirectionalLight(0xb8fff0, 1.5);
  key.position.set(2.5, 4.5, 3.5);
  scene.add(key);
  const rim = new THREE.PointLight(0x4fe3c1, 2.2, 12);
  rim.position.set(-2.5, 2.5, -2.0);
  scene.add(rim);

  floorGrid = new THREE.GridHelper(10, 24, 0x2c7a6c, 0x161b24);
  floorGrid.material.transparent = true;
  floorGrid.material.opacity = 0.35;
  scene.add(floorGrid);

  const floorDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 64),
    new THREE.MeshBasicMaterial({ color: 0x0d1720, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  floorDisc.rotation.x = -Math.PI / 2;
  floorDisc.position.y = -0.002;
  scene.add(floorDisc);

  skeletonGroup = new THREE.Group();
  skeletonGroup.position.x = -1.08;
  scene.add(skeletonGroup);

  humanGroup = new THREE.Group();
  humanGroup.position.x = 1.08;
  scene.add(humanGroup);

  const skeletonLabel = makeLabelSprite("SKELETON", "#4FE3C1");
  skeletonLabel.position.set(0, 2.25, 0);
  skeletonGroup.add(skeletonLabel);

  const solidLabel = makeLabelSprite("SOLID MODEL", "#E3B08C");
  solidLabel.position.set(0, 2.25, 0);
  humanGroup.add(solidLabel);

  const jointGeometry = new THREE.SphereGeometry(0.028, 14, 14);
  for (let i = 0; i < 33; i += 1) {
    const mesh = new THREE.Mesh(jointGeometry, createMaterial(0x4fe3c1, 0x1a6f60, 0.8));
    mesh.visible = false;
    skeletonGroup.add(mesh);
    jointMeshes.set(i, mesh);
  }

  headSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 20, 20),
    new THREE.MeshStandardMaterial({ color: 0x162129, emissive: 0x1a6f60, emissiveIntensity: 0.25, roughness: 0.5 }),
  );
  headSphere.visible = false;
  skeletonGroup.add(headSphere);

  for (const [a, b] of POSE_BONES) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 1, 8, 1),
      createMaterial(0x2fbfa0, 0x0e3a32, 0.7),
    );
    mesh.visible = false;
    skeletonGroup.add(mesh);
    const item = { mesh, a, b };
    boneMeshes.push(item);
    boneMeshByPair.set(`${a}-${b}`, mesh);
  }

  for (const side of ["L", "R"]) {
    const color = side === "L" ? 0xffb454 : 0xff6b4a;
    const emissive = side === "L" ? 0x3b260f : 0x3b160f;
    const material = createMaterial(color, emissive, 0.55);
    for (let i = 0; i < 21; i += 1) {
      const joint = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), material);
      joint.visible = false;
      skeletonGroup.add(joint);
      handJointMeshes[side].push(joint);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(HAND_BONES.length * 2 * 3), 3));
    const lines = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.88 }),
    );
    lines.visible = false;
    skeletonGroup.add(lines);
    handBoneLines[side] = lines;
  }

  const solidMaterials = {
    skin: new THREE.MeshStandardMaterial({ color: 0xe3b08c, roughness: 0.65, metalness: 0.05 }),
    shirt: new THREE.MeshStandardMaterial({ color: 0x3a4a5c, roughness: 0.6, metalness: 0.1 }),
    pants: new THREE.MeshStandardMaterial({ color: 0x232b36, roughness: 0.6, metalness: 0.1 }),
    shoe: new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.5, metalness: 0.15 }),
    eye: new THREE.MeshStandardMaterial({ color: 0x0b0e12, roughness: 0.3 }),
  };

  for (const [a, b, radius, materialName] of SOLID_LIMBS) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 14, 1), solidMaterials[materialName]);
    mesh.visible = false;
    humanGroup.add(mesh);
    solidLimbMeshes.push({ mesh, a, b });
  }

  for (const spec of SOLID_JOINTS) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(spec.radius, 16, 16), solidMaterials[spec.material]);
    mesh.visible = false;
    humanGroup.add(mesh);
    solidJointMeshes.push({ mesh, idx: spec.idx });
  }

  solidHead = new THREE.Mesh(new THREE.SphereGeometry(0.115, 22, 22), solidMaterials.skin);
  solidHead.visible = false;
  humanGroup.add(solidHead);

  solidEyeL = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), solidMaterials.eye);
  solidEyeR = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), solidMaterials.eye);
  solidEyeL.visible = false;
  solidEyeR.visible = false;
  humanGroup.add(solidEyeL, solidEyeR);

  for (const side of ["L", "R"]) {
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.13, 0.035), solidMaterials.skin);
    hand.visible = false;
    humanGroup.add(hand);
    solidHandMeshes[side] = hand;

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.05, 0.21), solidMaterials.shoe);
    foot.visible = false;
    humanGroup.add(foot);
    solidFootMeshes[side] = foot;
  }

  dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(CONFIG.dracoDecoderPath);
  ktx2Loader = new KTX2Loader();
  ktx2Loader.setTranscoderPath(CONFIG.ktx2TranscoderPath);
  ktx2Loader.detectSupport(renderer);

  gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.setKTX2Loader(ktx2Loader);
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);

  resizeObserver = new ResizeObserver(resizeRenderer);
  resizeObserver.observe(dom.canvas3d.parentElement);
  resizeRenderer();
  renderer.setAnimationLoop(renderScene);
}

function resizeRenderer() {
  if (!renderer || !camera3d) return;
  const parent = dom.canvas3d.parentElement;
  const width = Math.max(1, parent.clientWidth);
  const height = Math.max(1, parent.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio));
  renderer.setSize(width, height, false);
  camera3d.aspect = width / height;
  camera3d.updateProjectionMatrix();
}

function renderScene() {
  controls?.update();
  renderer?.render(scene, camera3d);
}

function poseWorldToScene(landmark) {
  const mirrorFactor = state.mirror ? -1 : 1;
  return new THREE.Vector3(
    landmark.x * mirrorFactor,
    -landmark.y + CONFIG.avatarHipHeight,
    -landmark.z,
  );
}

function normalizedPoseToScene(landmark) {
  const mirrorFactor = state.mirror ? -1 : 1;
  return new THREE.Vector3(
    (landmark.x - 0.5) * CONFIG.normalizedFallbackScale * mirrorFactor,
    (-(landmark.y - 0.5) * CONFIG.normalizedFallbackScale) + CONFIG.avatarHipHeight,
    -landmark.z * CONFIG.normalizedFallbackScale,
  );
}

function setCylinderTransform(mesh, a, b) {
  scratch.a.subVectors(b, a);
  const length = scratch.a.length();
  if (length < 1e-5) return false;
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.scale.set(1, length, 1);
  mesh.quaternion.setFromUnitVectors(scratch.yAxis, scratch.a.normalize());
  return true;
}

function updateAvatarFromResults(poseLandmarks, poseWorldLandmarks, deltaMs) {
  if (!poseLandmarks?.length) return false;
  let anyVisible = false;

  for (let i = 0; i < 33; i += 1) {
    const normalized = poseLandmarks[i];
    const world = poseWorldLandmarks?.[i];
    const mesh = jointMeshes.get(i);
    if (!normalized) {
      mesh.visible = false;
      continue;
    }

    const visibility = Number.isFinite(normalized.visibility) ? normalized.visibility : 1;
    const visible = visibility >= CONFIG.minRenderVisibility;
    const target = world ? poseWorldToScene(world) : normalizedPoseToScene(normalized);

    let smoothed = state.smoothedJoints.get(i);
    if (!smoothed) {
      smoothed = target.clone();
      state.smoothedJoints.set(i, smoothed);
    } else {
      smoothVector(smoothed, target, deltaMs);
    }

    mesh.position.copy(smoothed);
    mesh.visible = visible;
    anyVisible ||= visible;

    mesh.material.emissiveIntensity = 0.4 + visibility * 0.9;
    mesh.material.color.setHex(visibility > 0.6 ? 0x4fe3c1 : (visibility > 0.3 ? 0xffb454 : 0xff5470));
  }

  for (const item of boneMeshes) {
    const a = state.smoothedJoints.get(item.a);
    const b = state.smoothedJoints.get(item.b);
    const visible = a && b && jointMeshes.get(item.a)?.visible && jointMeshes.get(item.b)?.visible;
    item.mesh.visible = Boolean(visible && setCylinderTransform(item.mesh, a, b));
  }

  updateHeadTransform();
  updateSignalBars(poseLandmarks);
  return anyVisible;
}

function updateHeadTransform() {
  const nose = state.smoothedJoints.get(0);
  const leftEar = state.smoothedJoints.get(7);
  const rightEar = state.smoothedJoints.get(8);
  const noseVisible = jointMeshes.get(0)?.visible;

  if (!nose || !noseVisible) {
    headSphere.visible = false;
    return;
  }

  headSphere.visible = true;
  headSphere.position.copy(nose);

  if (!leftEar || !rightEar) return;
  const earMid = scratch.a.addVectors(leftEar, rightEar).multiplyScalar(0.5);
  const right = scratch.b.subVectors(rightEar, leftEar);
  const forward = scratch.c.subVectors(nose, earMid);
  if (right.lengthSq() < 1e-6 || forward.lengthSq() < 1e-6) return;

  right.normalize();
  forward.normalize();
  const up = scratch.d.crossVectors(forward, right);
  if (up.lengthSq() < 1e-6) return;
  up.normalize();
  forward.crossVectors(right, up).normalize();
  scratch.m1.makeBasis(right, up, forward);
  headSphere.quaternion.setFromRotationMatrix(scratch.m1);
}

function updateHandsFromResults(result, deltaMs) {
  for (const side of ["L", "R"]) {
    const normalizedList = side === "L" ? result.leftHandLandmarks?.[0] : result.rightHandLandmarks?.[0];
    const worldList = side === "L" ? result.leftHandWorldLandmarks?.[0] : result.rightHandWorldLandmarks?.[0];
    const wristIndex = side === "L" ? 15 : 16;
    const wristPosition = state.smoothedJoints.get(wristIndex);
    const joints = handJointMeshes[side];
    const lines = handBoneLines[side];

    if (!state.trackHands || !normalizedList?.length || !wristPosition) {
      joints.forEach((joint) => { joint.visible = false; });
      lines.visible = false;
      state.smoothedHands[side] = [];
      continue;
    }

    const mirrorFactor = state.mirror ? -1 : 1;
    const worldOrigin = worldList?.[0];
    const normalizedOrigin = normalizedList[0];
    const points = [];

    for (let i = 0; i < 21; i += 1) {
      const worldPoint = worldList?.[i];
      const normalizedPoint = normalizedList[i];
      if (!normalizedPoint) continue;

      let offset;
      if (worldPoint && worldOrigin) {
        offset = new THREE.Vector3(
          (worldPoint.x - worldOrigin.x) * mirrorFactor,
          -(worldPoint.y - worldOrigin.y),
          -(worldPoint.z - worldOrigin.z),
        );
      } else {
        const scale = 0.55;
        offset = new THREE.Vector3(
          (normalizedPoint.x - normalizedOrigin.x) * scale * mirrorFactor,
          -(normalizedPoint.y - normalizedOrigin.y) * scale,
          -(normalizedPoint.z - normalizedOrigin.z) * scale,
        );
      }

      const target = wristPosition.clone().add(offset);
      if (!state.smoothedHands[side][i]) state.smoothedHands[side][i] = target.clone();
      else smoothVector(state.smoothedHands[side][i], target, deltaMs);

      const point = state.smoothedHands[side][i];
      points[i] = point;
      joints[i].position.copy(point);
      joints[i].visible = true;
    }

    lines.visible = true;
    const positionAttribute = lines.geometry.attributes.position;
    HAND_BONES.forEach(([aIndex, bIndex], segmentIndex) => {
      const a = points[aIndex];
      const b = points[bIndex];
      if (!a || !b) return;
      positionAttribute.setXYZ(segmentIndex * 2, a.x, a.y, a.z);
      positionAttribute.setXYZ(segmentIndex * 2 + 1, b.x, b.y, b.z);
    });
    positionAttribute.needsUpdate = true;
  }
}

function computeSyntheticPoints() {
  const joints = state.smoothedJoints;
  const leftShoulder = joints.get(11);
  const rightShoulder = joints.get(12);
  const leftHip = joints.get(23);
  const rightHip = joints.get(24);

  if (leftShoulder && rightShoulder) {
    synthPoints.shoulderMid ||= new THREE.Vector3();
    synthPoints.shoulderMid.addVectors(leftShoulder, rightShoulder).multiplyScalar(0.5);
  }
  if (leftHip && rightHip) {
    synthPoints.hipMid ||= new THREE.Vector3();
    synthPoints.hipMid.addVectors(leftHip, rightHip).multiplyScalar(0.5);
  }
}

function trackedPoint(key) {
  return typeof key === "number" ? state.smoothedJoints.get(key) : synthPoints[key];
}

function trackedPointVisible(key) {
  if (typeof key === "number") return Boolean(jointMeshes.get(key)?.visible);
  if (key === "shoulderMid") return Boolean(jointMeshes.get(11)?.visible && jointMeshes.get(12)?.visible);
  if (key === "hipMid") return Boolean(jointMeshes.get(23)?.visible && jointMeshes.get(24)?.visible);
  return false;
}

function updateSolidHuman() {
  computeSyntheticPoints();

  for (const item of solidLimbMeshes) {
    const skeletonMesh = typeof item.a === "number" && typeof item.b === "number"
      ? boneMeshByPair.get(`${item.a}-${item.b}`)
      : null;

    if (skeletonMesh) {
      item.mesh.visible = skeletonMesh.visible;
      if (skeletonMesh.visible) {
        item.mesh.position.copy(skeletonMesh.position);
        item.mesh.quaternion.copy(skeletonMesh.quaternion);
        item.mesh.scale.set(1, skeletonMesh.scale.y, 1);
      }
      continue;
    }

    const a = trackedPoint(item.a);
    const b = trackedPoint(item.b);
    item.mesh.visible = Boolean(
      a && b && trackedPointVisible(item.a) && trackedPointVisible(item.b) && setCylinderTransform(item.mesh, a, b),
    );
  }

  for (const item of solidJointMeshes) {
    const source = jointMeshes.get(item.idx);
    item.mesh.visible = Boolean(source?.visible);
    if (source?.visible) item.mesh.position.copy(source.position);
  }

  if (headSphere.visible) {
    solidHead.visible = true;
    solidHead.position.copy(headSphere.position);
    solidHead.quaternion.copy(headSphere.quaternion);

    const forward = scratch.a.set(0, 0, 1).applyQuaternion(solidHead.quaternion);
    const right = scratch.b.set(1, 0, 0).applyQuaternion(solidHead.quaternion);
    const up = scratch.c.set(0, 1, 0).applyQuaternion(solidHead.quaternion);
    solidEyeL.visible = true;
    solidEyeR.visible = true;
    solidEyeL.position.copy(solidHead.position).addScaledVector(right, -0.045).addScaledVector(up, 0.02).addScaledVector(forward, 0.09);
    solidEyeR.position.copy(solidHead.position).addScaledVector(right, 0.045).addScaledVector(up, 0.02).addScaledVector(forward, 0.09);
  } else {
    solidHead.visible = false;
    solidEyeL.visible = false;
    solidEyeR.visible = false;
  }

  for (const side of ["L", "R"]) {
    const hand = solidHandMeshes[side];
    const handPoints = state.smoothedHands[side];
    const wrist = handPoints?.[0];
    const middle = handPoints?.[9];
    if (state.trackHands && wrist && middle) {
      hand.visible = true;
      hand.position.copy(wrist).lerp(middle, 0.45);
      scratch.a.subVectors(middle, wrist);
      if (scratch.a.lengthSq() > 1e-6) hand.quaternion.setFromUnitVectors(scratch.yAxis, scratch.a.normalize());
    } else {
      const wristIndex = side === "L" ? 15 : 16;
      const indexIndex = side === "L" ? 19 : 20;
      const fallback = boneMeshByPair.get(`${wristIndex}-${indexIndex}`);
      hand.visible = Boolean(fallback?.visible);
      if (fallback?.visible) {
        hand.position.copy(fallback.position);
        hand.quaternion.copy(fallback.quaternion);
      }
    }
  }

  for (const side of ["L", "R"]) {
    const ankleIndex = side === "L" ? 27 : 28;
    const footIndex = side === "L" ? 31 : 32;
    const foot = solidFootMeshes[side];
    const source = boneMeshByPair.get(`${ankleIndex}-${footIndex}`);
    foot.visible = Boolean(source?.visible);
    if (!source?.visible) continue;
    foot.position.copy(source.position);
    foot.position.y -= 0.02;
    foot.quaternion.copy(source.quaternion).multiply(scratch.q1.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)));
  }
}

function buildFrameQuaternion(rightVector, upVector, targetQuaternion) {
  const right = scratch.a.copy(rightVector);
  const up = scratch.b.copy(upVector);
  if (right.lengthSq() < 1e-8 || up.lengthSq() < 1e-8) return false;
  right.normalize();
  up.addScaledVector(right, -up.dot(right));
  if (up.lengthSq() < 1e-8) return false;
  up.normalize();
  const forward = scratch.c.crossVectors(right, up);
  if (forward.lengthSq() < 1e-8) return false;
  forward.normalize();
  scratch.m1.makeBasis(right, up, forward);
  targetQuaternion.setFromRotationMatrix(scratch.m1);
  return true;
}

function vrmNodeIndexForRole(json, role) {
  const extensions = json?.extensions;
  if (!extensions) return null;

  const vrm1 = extensions.VRMC_vrm?.humanoid?.humanBones?.[role];
  if (Number.isInteger(vrm1?.node)) return vrm1.node;

  const vrm0Bones = extensions.VRM?.humanoid?.humanBones;
  if (Array.isArray(vrm0Bones)) {
    const match = vrm0Bones.find((entry) => entry?.bone === role && Number.isInteger(entry?.node));
    if (match) return match.node;
  }
  return null;
}

function heuristicRoleScore(role, normalizedName) {
  const aliases = ROLE_ALIASES[role] || [];
  let score = -1;
  for (const alias of aliases) {
    if (normalizedName === alias) score = Math.max(score, 1000 + alias.length);
    else if (normalizedName.includes(alias)) score = Math.max(score, 500 + alias.length);
  }
  return score;
}

function resolveHumanoidBones(root, json) {
  const boneByName = new Map();
  const boneByNormalizedName = [];
  root.traverse((object) => {
    if (!object.isBone) return;
    boneByName.set(object.name, object);
    boneByNormalizedName.push({
      bone: object,
      name: object.name,
      normalized: normalizeBoneName(object.name),
    });
  });

  const roleToBone = {};
  const roleSource = {};
  const usedBones = new Set();

  for (const role of REQUIRED_ROLES) {
    const nodeIndex = vrmNodeIndexForRole(json, role);
    const nodeName = Number.isInteger(nodeIndex) ? json?.nodes?.[nodeIndex]?.name : null;
    const vrmBone = nodeName ? boneByName.get(nodeName) : null;
    if (vrmBone && !usedBones.has(vrmBone)) {
      roleToBone[role] = vrmBone;
      roleSource[role] = "vrm";
      usedBones.add(vrmBone);
      continue;
    }

    const mixamoName = MIXAMO_NAME_BY_ROLE[role];
    const mixamoBone = mixamoName ? boneByName.get(mixamoName) : null;
    if (mixamoBone && !usedBones.has(mixamoBone)) {
      roleToBone[role] = mixamoBone;
      roleSource[role] = "mixamo";
      usedBones.add(mixamoBone);
      continue;
    }

    let best = null;
    let bestScore = -1;
    for (const entry of boneByNormalizedName) {
      if (usedBones.has(entry.bone)) continue;
      const score = heuristicRoleScore(role, entry.normalized);
      if (score > bestScore) {
        best = entry.bone;
        bestScore = score;
      }
    }
    if (best && bestScore >= 500) {
      roleToBone[role] = best;
      roleSource[role] = "alias";
      usedBones.add(best);
    }
  }

  return { roleToBone, roleSource, boneCount: boneByName.size };
}

function captureBindPose(root, roleToBone) {
  root.updateMatrixWorld(true);
  const retarget = [];
  const resetBones = new Map();

  for (const bone of Object.values(roleToBone)) {
    if (bone && !resetBones.has(bone)) resetBones.set(bone, bone.quaternion.clone());
  }

  for (const target of ROLE_TARGETS) {
    const bone = roleToBone[target.role];
    const refBone = roleToBone[target.ref];
    if (!bone || !refBone) continue;

    const boneWorldPosition = bone.getWorldPosition(new THREE.Vector3());
    const refWorldPosition = refBone.getWorldPosition(new THREE.Vector3());
    const bindDirection = refWorldPosition.sub(boneWorldPosition);
    if (bindDirection.lengthSq() < 1e-8) continue;

    retarget.push({
      role: target.role,
      lmA: target.lmA,
      lmB: target.lmB,
      bindDirection: bindDirection.normalize(),
      bindWorldQuaternion: bone.getWorldQuaternion(new THREE.Quaternion()),
      bone,
    });
  }

  let hipsFrame = null;
  const hips = roleToBone.hips;
  const spine = roleToBone.spine;
  const leftUpperLeg = roleToBone.leftUpperLeg;
  const rightUpperLeg = roleToBone.rightUpperLeg;
  if (hips && spine && leftUpperLeg && rightUpperLeg) {
    const hipsPosition = hips.getWorldPosition(new THREE.Vector3());
    const spinePosition = spine.getWorldPosition(new THREE.Vector3());
    const leftLegPosition = leftUpperLeg.getWorldPosition(new THREE.Vector3());
    const rightLegPosition = rightUpperLeg.getWorldPosition(new THREE.Vector3());
    const right = rightLegPosition.sub(leftLegPosition);
    const up = spinePosition.sub(hipsPosition);
    const bindFrameQuaternion = new THREE.Quaternion();
    if (buildFrameQuaternion(right, up, bindFrameQuaternion)) {
      hipsFrame = {
        bone: hips,
        bindFrameQuaternion,
        bindWorldQuaternion: hips.getWorldQuaternion(new THREE.Quaternion()),
      };
    }
  }

  return { retarget, hipsFrame, resetBones };
}

function resetHumanoidPose(model) {
  if (!model?.resetBones) return;
  for (const [bone, quaternion] of model.resetBones.entries()) {
    bone.quaternion.copy(quaternion);
  }
  model.root?.updateMatrixWorld(true);
}

function autoFitModel(root, targetHeight = 1.75) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  if (size.y > 0.001 && Number.isFinite(size.y)) {
    const scale = THREE.MathUtils.clamp(targetHeight / size.y, 0.001, 1000);
    root.scale.multiplyScalar(scale);
    root.updateMatrixWorld(true);
    box.setFromObject(root);
  }

  const center = box.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);
}

function applyVrmFacingFix(root, json) {
  if (json?.extensions?.VRM && !json?.extensions?.VRMC_vrm) {
    root.rotation.y += Math.PI;
    root.updateMatrixWorld(true);
  }
}

function tuneModelMaterials(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      if ("metalness" in material) material.metalness = Math.min(Number(material.metalness) || 0, 0.3);
      if ("roughness" in material && !Number.isFinite(material.roughness)) material.roughness = 0.7;
      material.needsUpdate = true;
    }
    object.frustumCulled = true;
  });
}

function disposeObject3D(root) {
  if (!root) return;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  root.traverse((object) => {
    if (!object.isMesh) return;
    if (object.geometry) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of objectMaterials) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
    }
  });

  textures.forEach((texture) => {
    texture.source?.data?.close?.();
    texture.dispose();
  });
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

function createHumanoidRecord(root, resolved, name) {
  const bind = captureBindPose(root, resolved.roleToBone);
  return {
    root,
    name,
    retarget: bind.retarget,
    hipsFrame: bind.hipsFrame,
    resetBones: bind.resetBones,
    mappedRoles: Object.keys(resolved.roleToBone).length,
    boneCount: resolved.boneCount,
    roleSource: resolved.roleSource,
  };
}

async function loadBundledXbot() {
  try {
    const gltf = await gltfLoader.loadAsync(CONFIG.xbotUrl);
    const root = gltf.scene;
    tuneModelMaterials(root);
    autoFitModel(root);
    root.visible = false;
    humanGroup.add(root);

    const json = gltf.parser?.json || null;
    const resolved = resolveHumanoidBones(root, json);
    xbotHumanoid = createHumanoidRecord(root, resolved, "Xbot");
    dom.optXbot.disabled = false;
    updateSolidModelStat();
    setSolidModelMode(state.modelSource);
    console.info(`[MOCAP] Xbot ready: ${xbotHumanoid.retarget.length}/${ROLE_TARGETS.length} driven limb roles.`);
  } catch (error) {
    console.error("[MOCAP] Xbot failed to load:", error);
    dom.optXbot.disabled = true;
    dom.optXbot.textContent = "Realistic — Xbot (unavailable)";
    updateSolidModelStat();
  }
}

function parseGltf(data, resourcePath = "") {
  return new Promise((resolve, reject) => {
    gltfLoader.parse(data, resourcePath, resolve, reject);
  });
}

function readFile(file, asText) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("FileReader failed."));
    reader.onload = () => resolve(reader.result);
    if (asText) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  });
}

async function loadCustomModel(file) {
  if (!file) return;
  const name = file.name || "model";
  const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  if (!["glb", "gltf", "vrm"].includes(extension)) {
    setUploadStatus(`Unsupported file type ".${extension || "unknown"}". Use GLB, self-contained GLTF, or VRM.`, "error");
    return;
  }
  if (file.size > CONFIG.maxUploadBytes) {
    setUploadStatus(`"${name}" is ${(file.size / 1048576).toFixed(1)} MB. The upload limit is 120 MB.`, "error");
    return;
  }

  dom.uploadButton.disabled = true;
  setUploadStatus(`Reading "${name}"…`);

  try {
    const isTextGltf = extension === "gltf";
    const data = await readFile(file, isTextGltf);
    setUploadStatus("Parsing model and resolving humanoid bones…");
    const gltf = await parseGltf(data, "");
    const root = gltf.scene;

    let boneCount = 0;
    root.traverse((object) => { if (object.isBone) boneCount += 1; });
    if (boneCount === 0) {
      disposeObject3D(root);
      throw new Error("The model has no bone skeleton. Upload a rigged humanoid model.");
    }

    const json = gltf.parser?.json || null;
    applyVrmFacingFix(root, json);
    autoFitModel(root);
    tuneModelMaterials(root);
    const resolved = resolveHumanoidBones(root, json);
    const record = createHumanoidRecord(root, resolved, name);

    if (record.retarget.length < 4) {
      disposeObject3D(root);
      throw new Error(`Only ${record.retarget.length}/${ROLE_TARGETS.length} driven limb roles could be resolved. This rig is too non-standard for reliable retargeting.`);
    }

    if (customHumanoid?.root) {
      humanGroup.remove(customHumanoid.root);
      disposeObject3D(customHumanoid.root);
    }

    root.visible = false;
    humanGroup.add(root);
    customHumanoid = record;
    dom.optCustom.disabled = false;
    dom.optCustom.textContent = `Your model — ${name}`;

    const vrmTag = json?.extensions?.VRM || json?.extensions?.VRMC_vrm ? " · VRM" : "";
    const tone = record.retarget.length >= 10 ? "success" : "neutral";
    setUploadStatus(`Loaded "${name}"${vrmTag}: ${record.retarget.length}/${ROLE_TARGETS.length} driven limb roles mapped across ${record.boneCount} bones.`, tone);
    setSolidModelMode("custom");
    updateSolidModelStat();
  } catch (error) {
    console.error("[MOCAP] Custom model load failed:", error);
    let message = formatError(error);
    if (extension === "gltf" && /fetch|buffer|uri|resource|load/i.test(message)) {
      message += " External .bin or texture sidecar files are not supported by this uploader; export a self-contained GLB instead.";
    }
    setUploadStatus(message, "error");
  } finally {
    dom.uploadButton.disabled = false;
    dom.uploadInput.value = "";
  }
}

function updateSolidModelStat() {
  if (state.modelSource === "xbot" && xbotHumanoid) {
    dom.statModel.textContent = `Xbot · ${xbotHumanoid.retarget.length}/${ROLE_TARGETS.length} driven roles`;
  } else if (state.modelSource === "custom" && customHumanoid) {
    dom.statModel.textContent = `${customHumanoid.name} · ${customHumanoid.retarget.length}/${ROLE_TARGETS.length} driven roles`;
  } else {
    dom.statModel.textContent = xbotHumanoid ? "Procedural · Xbot ready" : "Procedural";
  }
}

function hideProceduralSolid() {
  solidLimbMeshes.forEach(({ mesh }) => { mesh.visible = false; });
  solidJointMeshes.forEach(({ mesh }) => { mesh.visible = false; });
  solidHead.visible = false;
  solidEyeL.visible = false;
  solidEyeR.visible = false;
  for (const side of ["L", "R"]) {
    solidHandMeshes[side].visible = false;
    solidFootMeshes[side].visible = false;
  }
}

function setSolidModelMode(requestedSource) {
  const previousSource = state.modelSource;
  const source = requestedSource === "xbot" && xbotHumanoid
    ? "xbot"
    : requestedSource === "custom" && customHumanoid
      ? "custom"
      : "procedural";

  if (source !== previousSource) {
    if (source === "xbot") resetHumanoidPose(xbotHumanoid);
    if (source === "custom") resetHumanoidPose(customHumanoid);
  }

  state.modelSource = source;
  dom.modelSource.value = source;

  const procedural = source === "procedural";
  if (!procedural) hideProceduralSolid();

  if (xbotHumanoid) xbotHumanoid.root.visible = state.running && state.showSolid && source === "xbot";
  if (customHumanoid) customHumanoid.root.visible = state.running && state.showSolid && source === "custom";

  updateSolidModelStat();
}

function trackedGltfPoint(key) {
  return typeof key === "number" ? state.smoothedJoints.get(key) : synthPointsGltf[key];
}

function trackedGltfPointVisible(key) {
  if (typeof key === "number") return Boolean(jointMeshes.get(key)?.visible);
  if (key === "hipMid") return Boolean(jointMeshes.get(23)?.visible && jointMeshes.get(24)?.visible);
  if (key === "shoulderMid") return Boolean(jointMeshes.get(11)?.visible && jointMeshes.get(12)?.visible);
  return false;
}

function updateGltfSyntheticPoints() {
  const leftShoulder = state.smoothedJoints.get(11);
  const rightShoulder = state.smoothedJoints.get(12);
  const leftHip = state.smoothedJoints.get(23);
  const rightHip = state.smoothedJoints.get(24);
  if (leftShoulder && rightShoulder) {
    synthPointsGltf.shoulderMid ||= new THREE.Vector3();
    synthPointsGltf.shoulderMid.addVectors(leftShoulder, rightShoulder).multiplyScalar(0.5);
  }
  if (leftHip && rightHip) {
    synthPointsGltf.hipMid ||= new THREE.Vector3();
    synthPointsGltf.hipMid.addVectors(leftHip, rightHip).multiplyScalar(0.5);
  }
}

function setBoneWorldQuaternion(bone, worldQuaternion, alpha) {
  const parentWorld = bone.parent?.getWorldQuaternion(scratch.q1) || scratch.q1.identity();
  const localTarget = scratch.q2.copy(parentWorld).invert().multiply(worldQuaternion);
  bone.quaternion.slerp(localTarget, alpha);
  bone.updateMatrixWorld(true);
}

function updateRiggedHumanoid(model, deltaMs) {
  if (!model?.root) return;
  updateGltfSyntheticPoints();
  const alpha = smoothingLerpFactor(deltaMs);

  if (model.hipsFrame) {
    const leftHip = state.smoothedJoints.get(23);
    const rightHip = state.smoothedJoints.get(24);
    const hipMid = synthPointsGltf.hipMid;
    const shoulderMid = synthPointsGltf.shoulderMid;
    if (leftHip && rightHip && hipMid && shoulderMid && trackedGltfPointVisible("hipMid") && trackedGltfPointVisible("shoulderMid")) {
      const targetRight = scratch.a.subVectors(rightHip, leftHip).clone();
      const targetUp = scratch.b.subVectors(shoulderMid, hipMid).clone();
      const targetFrame = scratch.q2.identity();
      if (buildFrameQuaternion(targetRight, targetUp, targetFrame)) {
        const delta = scratch.q3.copy(targetFrame).multiply(model.hipsFrame.bindFrameQuaternion.clone().invert());
        const worldTarget = delta.multiply(model.hipsFrame.bindWorldQuaternion.clone());
        setBoneWorldQuaternion(model.hipsFrame.bone, worldTarget, alpha);
      }
    }
  }

  for (const item of model.retarget) {
    const a = trackedGltfPoint(item.lmA);
    const b = trackedGltfPoint(item.lmB);
    if (!a || !b || !trackedGltfPointVisible(item.lmA) || !trackedGltfPointVisible(item.lmB)) continue;

    const targetDirection = scratch.a.subVectors(b, a);
    if (targetDirection.lengthSq() < 1e-7) continue;
    targetDirection.normalize();

    const delta = scratch.q2.setFromUnitVectors(item.bindDirection, targetDirection);
    const worldTarget = scratch.q3.copy(delta).multiply(item.bindWorldQuaternion);
    setBoneWorldQuaternion(item.bone, worldTarget, alpha);
  }

  model.root.updateMatrixWorld(true);
}

function hideTrackingVisuals({ keepModels = false } = {}) {
  jointMeshes.forEach((mesh) => { mesh.visible = false; });
  boneMeshes.forEach(({ mesh }) => { mesh.visible = false; });
  headSphere.visible = false;
  for (const side of ["L", "R"]) {
    handJointMeshes[side].forEach((mesh) => { mesh.visible = false; });
    handBoneLines[side].visible = false;
  }
  hideProceduralSolid();
  if (!keepModels) {
    if (xbotHumanoid) xbotHumanoid.root.visible = false;
    if (customHumanoid) customHumanoid.root.visible = false;
  }
}

function clearTrackingState() {
  state.latestExport = null;
  state.smoothedJoints.clear();
  state.smoothedHands = { L: [], R: [] };
  state.fpsHistory.length = 0;
  state.lastInferenceAt = 0;
  state.inferenceFailures = 0;
  state.lastPoseSeenAt = 0;
  state.lastVideoTime = -1;
  updateSignalBars(null);
  dom.exportPose.disabled = true;
  dom.fps.textContent = "—";
  dom.landmarks.textContent = "0";
  dom.statConfidence.innerHTML = "0<span>%</span>";
  dom.statInference.innerHTML = "0<span>ms</span>";
}

function drawLine2D(context, points, aIndex, bIndex, strokeStyle, lineWidth) {
  const a = points?.[aIndex];
  const b = points?.[bIndex];
  if (!a || !b) return;
  if (Number.isFinite(a.visibility) && a.visibility < CONFIG.minRenderVisibility) return;
  if (Number.isFinite(b.visibility) && b.visibility < CONFIG.minRenderVisibility) return;
  context.beginPath();
  context.moveTo(a.x * context.canvas.width, a.y * context.canvas.height);
  context.lineTo(b.x * context.canvas.width, b.y * context.canvas.height);
  context.strokeStyle = strokeStyle;
  context.lineWidth = lineWidth;
  context.stroke();
}

function drawPoints2D(context, points, fillStyle, radius, respectVisibility = true) {
  if (!points) return;
  context.fillStyle = fillStyle;
  for (const point of points) {
    if (!point) continue;
    if (respectVisibility && Number.isFinite(point.visibility) && point.visibility < CONFIG.minRenderVisibility) continue;
    context.beginPath();
    context.arc(point.x * context.canvas.width, point.y * context.canvas.height, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function drawOverlay(result) {
  if (!state.showPip) return;
  const width = dom.video.videoWidth || 640;
  const height = dom.video.videoHeight || 480;
  if (dom.pipOverlay.width !== width || dom.pipOverlay.height !== height) {
    dom.pipOverlay.width = width;
    dom.pipOverlay.height = height;
  }

  pipContext.clearRect(0, 0, width, height);
  if (!state.overlay2d) return;

  const pose = result.poseLandmarks?.[0];
  const leftHand = result.leftHandLandmarks?.[0];
  const rightHand = result.rightHandLandmarks?.[0];

  pipContext.save();
  pipContext.lineCap = "round";
  pipContext.lineJoin = "round";

  if (pose) {
    for (const [a, b] of POSE_BONES) drawLine2D(pipContext, pose, a, b, "#4FE3C1", 2);
    drawPoints2D(pipContext, pose, "#4FE3C1", 2.5, true);
  }

  if (state.trackHands && leftHand) {
    for (const [a, b] of HAND_BONES) drawLine2D(pipContext, leftHand, a, b, "#FFB454", 1.5);
    drawPoints2D(pipContext, leftHand, "#FFB454", 2, false);
  }
  if (state.trackHands && rightHand) {
    for (const [a, b] of HAND_BONES) drawLine2D(pipContext, rightHand, a, b, "#FF6B4A", 1.5);
    drawPoints2D(pipContext, rightHand, "#FF6B4A", 2, false);
  }

  pipContext.restore();
}

function extractFirst(list) {
  return Array.isArray(list) && list.length > 0 ? list[0] : [];
}

function handleTrackingResult(result, inferenceMs, timestampMs) {
  state.inferenceFailures = 0;
  const now = performance.now();
  const deltaMs = state.lastInferenceAt ? Math.min(100, now - state.lastInferenceAt) : 16.67;
  state.lastInferenceAt = now;

  const instantaneousFps = 1000 / Math.max(deltaMs, 1);
  state.fpsHistory.push(instantaneousFps);
  if (state.fpsHistory.length > 30) state.fpsHistory.shift();
  const averageFps = state.fpsHistory.reduce((sum, value) => sum + value, 0) / state.fpsHistory.length;
  dom.fps.textContent = Number.isFinite(averageFps) ? averageFps.toFixed(0) : "—";
  dom.statInference.innerHTML = `${inferenceMs.toFixed(1)}<span>ms</span>`;

  const pose = extractFirst(result.poseLandmarks);
  const poseWorld = extractFirst(result.poseWorldLandmarks);
  const detected = pose.filter((landmark) => (Number.isFinite(landmark.visibility) ? landmark.visibility : 1) >= CONFIG.minRenderVisibility).length;
  dom.landmarks.textContent = String(detected);

  const confidence = pose.length
    ? pose.reduce((sum, landmark) => sum + (Number.isFinite(landmark.visibility) ? landmark.visibility : 1), 0) / pose.length
    : 0;
  dom.statConfidence.innerHTML = `${Math.round(confidence * 100)}<span>%</span>`;

  if (pose.length && detected > 5) {
    state.lastPoseSeenAt = now;
    setStatus("tracking", "TRACKING");
    dom.viewportHint.classList.add("hidden");
    updateAvatarFromResults(pose, poseWorld, deltaMs);
    updateHandsFromResults(result, deltaMs);

    if (state.showSolid) {
      if (state.modelSource === "xbot" && xbotHumanoid) {
        xbotHumanoid.root.visible = true;
        updateRiggedHumanoid(xbotHumanoid, deltaMs);
      } else if (state.modelSource === "custom" && customHumanoid) {
        customHumanoid.root.visible = true;
        updateRiggedHumanoid(customHumanoid, deltaMs);
      } else {
        updateSolidHuman();
      }
    }
  } else {
    setStatus("searching", "SEARCHING…");
    const lostForMs = now - state.lastPoseSeenAt;
    if (lostForMs > CONFIG.trackingLossGraceMs) {
      hideTrackingVisuals({ keepModels: true });
      if (state.modelSource === "xbot" && xbotHumanoid) xbotHumanoid.root.visible = false;
      if (state.modelSource === "custom" && customHumanoid) customHumanoid.root.visible = false;
    }
    if (lostForMs > CONFIG.longTrackingLossResetMs) {
      state.smoothedJoints.clear();
      state.smoothedHands = { L: [], R: [] };
    }
  }

  drawOverlay(result);
  state.latestExport = {
    timestamp: new Date().toISOString(),
    videoTimestampMs: timestampMs,
    engine: {
      task: "MediaPipe Holistic Landmarker",
      packageVersion: CONFIG.mediaPipeVersion,
      delegate: state.engineDelegate,
    },
    poseLandmarks: pose,
    poseWorldLandmarks: poseWorld,
    leftHandLandmarks: extractFirst(result.leftHandLandmarks),
    leftHandWorldLandmarks: extractFirst(result.leftHandWorldLandmarks),
    rightHandLandmarks: extractFirst(result.rightHandLandmarks),
    rightHandWorldLandmarks: extractFirst(result.rightHandWorldLandmarks),
  };
  dom.exportPose.disabled = !pose.length;
}

function scheduleNextVideoFrame(generation) {
  if (!state.running || generation !== state.cameraGeneration) return;
  if (typeof dom.video.requestVideoFrameCallback === "function") {
    state.frameRequestKind = "video";
    state.frameRequestId = dom.video.requestVideoFrameCallback(() => processVideoFrame(generation));
  } else {
    state.frameRequestKind = "raf";
    state.frameRequestId = requestAnimationFrame(() => processVideoFrame(generation));
  }
}

function cancelScheduledVideoFrame() {
  if (state.frameRequestId == null) return;
  if (state.frameRequestKind === "video" && typeof dom.video.cancelVideoFrameCallback === "function") {
    dom.video.cancelVideoFrameCallback(state.frameRequestId);
  } else if (state.frameRequestKind === "raf") {
    cancelAnimationFrame(state.frameRequestId);
  }
  state.frameRequestId = null;
  state.frameRequestKind = null;
}

function processVideoFrame(generation) {
  state.frameRequestId = null;
  if (!state.running || generation !== state.cameraGeneration || !holisticLandmarker) return;

  if (document.visibilityState === "hidden" || dom.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    scheduleNextVideoFrame(generation);
    return;
  }

  if (dom.video.currentTime === state.lastVideoTime) {
    scheduleNextVideoFrame(generation);
    return;
  }
  state.lastVideoTime = dom.video.currentTime;

  const timestampMs = performance.now();
  const startedAt = performance.now();
  try {
    const result = holisticLandmarker.detectForVideo(dom.video, timestampMs);
    const inferenceMs = performance.now() - startedAt;
    handleTrackingResult(result, inferenceMs, timestampMs);
  } catch (error) {
    state.inferenceFailures += 1;
    console.error("[MOCAP] Inference failed:", error);
    if (state.inferenceFailures >= 3) {
      const message = `Tracking inference failed repeatedly: ${formatError(error)}`;
      stopCamera();
      setStatus("error", "TRACKING ERROR");
      showError(message, 0);
    } else {
      showError(`Tracking inference failed (${state.inferenceFailures}/3): ${formatError(error)}`);
      setStatus("searching", "RETRYING…");
    }
  } finally {
    scheduleNextVideoFrame(generation);
  }
}

async function initializeHolisticLandmarker() {
  setLoadingMessage("LOADING MEDIAPIPE TASK RUNTIME…");
  await loadMediaPipeModule();
  const vision = await FilesetResolverClass.forVisionTasks(CONFIG.mediaPipeWasmRoot);
  const baseOptions = {
    modelAssetPath: CONFIG.holisticModelUrl,
  };
  const taskOptions = {
    runningMode: "VIDEO",
    minFaceDetectionConfidence: state.minDetectionConfidence,
    minFacePresenceConfidence: state.minPresenceConfidence,
    minPoseDetectionConfidence: state.minDetectionConfidence,
    minPosePresenceConfidence: state.minPresenceConfidence,
    minHandLandmarksConfidence: state.minPresenceConfidence,
    outputFaceBlendshapes: false,
    outputPoseSegmentationMasks: false,
  };

  setLoadingMessage("LOADING HOLISTIC LANDMARKER MODEL…");
  try {
    holisticLandmarker = await HolisticLandmarkerClass.createFromOptions(vision, {
      ...taskOptions,
      baseOptions: { ...baseOptions, delegate: "GPU" },
    });
    state.engineDelegate = "GPU";
  } catch (gpuError) {
    console.warn("[MOCAP] GPU delegate unavailable; falling back to CPU.", gpuError);
    holisticLandmarker = await HolisticLandmarkerClass.createFromOptions(vision, {
      ...taskOptions,
      baseOptions: { ...baseOptions, delegate: "CPU" },
    });
    state.engineDelegate = "CPU";
  }
  dom.statEngine.textContent = `MediaPipe Tasks ${CONFIG.mediaPipeVersion} · ${state.engineDelegate}`;
}

function scheduleTaskOptionsUpdate() {
  window.clearTimeout(state.optionsTimer);
  state.optionsTimer = window.setTimeout(async () => {
    if (!holisticLandmarker) return;
    try {
      await holisticLandmarker.setOptions({
        minFaceDetectionConfidence: state.minDetectionConfidence,
        minFacePresenceConfidence: state.minPresenceConfidence,
        minPoseDetectionConfidence: state.minDetectionConfidence,
        minPosePresenceConfidence: state.minPresenceConfidence,
        minHandLandmarksConfidence: state.minPresenceConfidence,
      });
    } catch (error) {
      console.error("[MOCAP] Failed to update MediaPipe options:", error);
      showError(`Could not update tracking thresholds: ${formatError(error)}`);
    }
  }, 140);
}

async function startCamera() {
  if (state.running || !state.booted || !holisticLandmarker) return;
  hideError();

  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    showError("Camera access requires a secure context (HTTPS or localhost) and a browser with getUserMedia support.", 0);
    setStatus("error", "CAMERA UNAVAILABLE");
    return;
  }

  dom.toggleCamera.disabled = true;
  setStatus("loading", "REQUESTING CAMERA…");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 60 },
      },
      audio: false,
    });

    state.stream = stream;
    dom.video.srcObject = stream;
    await dom.video.play();

    if (!dom.video.videoWidth || !dom.video.videoHeight) {
      await new Promise((resolve) => {
        const onLoaded = () => resolve();
        dom.video.addEventListener("loadedmetadata", onLoaded, { once: true });
        window.setTimeout(resolve, 1000);
      });
    }

    state.running = true;
    state.startTime = performance.now();
    state.cameraGeneration += 1;
    state.inferenceFailures = 0;
    state.lastInferenceAt = 0;
    state.lastPoseSeenAt = 0;
    state.lastVideoTime = -1;
    state.fpsHistory.length = 0;

    dom.statResolution.textContent = `${dom.video.videoWidth || "?"}×${dom.video.videoHeight || "?"}`;
    dom.toggleCameraLabel.textContent = "Stop camera";
    dom.toggleCamera.classList.remove("primary");
    dom.toggleCamera.classList.add("danger");
    dom.pip.classList.toggle("hidden", !state.showPip);
    dom.pip.classList.toggle("mirrored", state.mirror);
    dom.viewportHint.classList.add("hidden");
    setSolidModelMode(state.modelSource);
    setStatus("searching", "SEARCHING…");
    scheduleNextVideoFrame(state.cameraGeneration);
  } catch (error) {
    console.error("[MOCAP] Camera start failed:", error);
    stopMediaStream(state.stream);
    state.stream = null;
    dom.video.srcObject = null;
    showError(getCameraErrorMessage(error), 0);
    setStatus("error", "CAMERA ERROR");
  } finally {
    dom.toggleCamera.disabled = false;
  }
}

function stopMediaStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

function stopCamera() {
  if (!state.running && !state.stream) return;
  state.cameraGeneration += 1;
  cancelScheduledVideoFrame();
  stopMediaStream(state.stream);
  state.stream = null;
  dom.video.pause();
  dom.video.srcObject = null;

  state.running = false;
  state.startTime = null;
  dom.toggleCameraLabel.textContent = "Start camera";
  dom.toggleCamera.classList.add("primary");
  dom.toggleCamera.classList.remove("danger");
  dom.pip.classList.add("hidden");
  pipContext.clearRect(0, 0, dom.pipOverlay.width, dom.pipOverlay.height);
  dom.viewportHint.classList.remove("hidden");
  setStatus("idle", "IDLE");

  hideTrackingVisuals();
  resetHumanoidPose(xbotHumanoid);
  resetHumanoidPose(customHumanoid);
  clearTrackingState();
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function applyToggle(key, enabled) {
  state[key] = enabled;
  if (key === "showPip") dom.pip.classList.toggle("hidden", !enabled || !state.running);
  if (key === "mirror") {
    dom.pip.classList.toggle("mirrored", enabled);
    state.smoothedJoints.clear();
    state.smoothedHands = { L: [], R: [] };
    resetHumanoidPose(xbotHumanoid);
    resetHumanoidPose(customHumanoid);
  }
  if (key === "showGrid" && floorGrid) floorGrid.visible = enabled;
  if (key === "autorotate" && controls) controls.autoRotate = enabled;
  if (key === "showSkeleton" && skeletonGroup) skeletonGroup.visible = enabled;
  if (key === "showSolid" && humanGroup) {
    humanGroup.visible = enabled;
    setSolidModelMode(state.modelSource);
  }
  if (key === "trackHands" && !enabled) {
    for (const side of ["L", "R"]) {
      handJointMeshes[side].forEach((mesh) => { mesh.visible = false; });
      handBoneLines[side].visible = false;
    }
  }
}

function bindUiEvents() {
  document.querySelectorAll(".switch[data-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.toggle;
      const enabled = !state[key];
      button.classList.toggle("on", enabled);
      button.setAttribute("aria-checked", String(enabled));
      applyToggle(key, enabled);
    });
  });

  dom.detectionSlider.addEventListener("input", (event) => {
    state.minDetectionConfidence = Number.parseFloat(event.target.value);
    dom.detectionValue.textContent = state.minDetectionConfidence.toFixed(2);
    scheduleTaskOptionsUpdate();
  });

  dom.presenceSlider.addEventListener("input", (event) => {
    state.minPresenceConfidence = Number.parseFloat(event.target.value);
    dom.presenceValue.textContent = state.minPresenceConfidence.toFixed(2);
    scheduleTaskOptionsUpdate();
  });

  dom.smoothingSlider.addEventListener("input", (event) => {
    state.smoothing = Number.parseFloat(event.target.value);
    dom.smoothingValue.textContent = state.smoothing.toFixed(2);
  });

  dom.toggleCamera.addEventListener("click", () => {
    if (state.running) stopCamera();
    else void startCamera();
  });

  dom.exportPose.addEventListener("click", () => {
    if (!state.latestExport) {
      showError("No tracking data is available yet. Start the camera and wait for a pose to be detected.");
      return;
    }
    downloadJson(state.latestExport, `mocap-pose-${Date.now()}.json`);
  });

  dom.resetView.addEventListener("click", () => controls?.reset());

  dom.modelSource.addEventListener("change", (event) => setSolidModelMode(event.target.value));

  dom.uploadButton.addEventListener("click", () => dom.uploadInput.click());
  dom.uploadInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) void loadCustomModel(file);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.running && state.frameRequestId == null) {
      scheduleNextVideoFrame(state.cameraGeneration);
    }
  });

  window.addEventListener("beforeunload", cleanup, { once: true });
}

function updateUptime() {
  if (state.running && state.startTime) {
    const seconds = Math.floor((performance.now() - state.startTime) / 1000);
    dom.statUptime.innerHTML = `${seconds}<span>s</span>`;
  } else {
    dom.statUptime.innerHTML = "0<span>s</span>";
  }
}

function cleanup() {
  stopCamera();
  window.clearTimeout(state.optionsTimer);
  resizeObserver?.disconnect();
  renderer?.setAnimationLoop(null);
  holisticLandmarker?.close?.();
  dracoLoader?.dispose?.();
  ktx2Loader?.dispose?.();
  if (customHumanoid?.root) disposeObject3D(customHumanoid.root);
  if (xbotHumanoid?.root) disposeObject3D(xbotHumanoid.root);
  renderer?.dispose();
}

async function boot() {
  try {
    setStatus("loading", "INITIALIZING…");
    initSignalBars();
    bindUiEvents();

    setLoadingMessage("INITIALIZING 3D RENDERER…");
    initThree();

    await initializeHolisticLandmarker();
    state.booted = true;
    window.__MOCAP_BOOT_COMPLETE__ = true;
    dom.toggleCamera.disabled = false;
    setStatus("idle", "IDLE");
    updateSignalBars(null);
    dom.loadingOverlay.setAttribute("aria-busy", "false");
    dom.loadingOverlay.classList.add("hidden");

    void loadBundledXbot();
    window.setInterval(updateUptime, 500);
  } catch (error) {
    console.error("[MOCAP] Boot failed:", error);
    state.booted = false;
    dom.toggleCamera.disabled = true;
    setStatus("error", "STARTUP ERROR");
    dom.loadingOverlay.classList.add("failed");
    dom.loadingOverlay.setAttribute("aria-busy", "false");
    setLoadingMessage(`STARTUP FAILED — ${formatError(error)}. Check the browser console and network access, then reload.`);
    showError(`Failed to initialize motion capture: ${formatError(error)}`, 0);
  }
}

void boot();
