"use client";
// Self-hosted face recognition (face-api.js by @vladmandic) for 1:1 verification
// at clock-in. The library and model weights are served from /vendor and /models
// (same-origin, so they satisfy the app's strict CSP). Everything here is
// best-effort: if models can't load, callers fall back to selfie-only clocking.

let _ready = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.faceapi) return resolve(window.faceapi);
    const existing = document.querySelector("script[data-faceapi]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.faceapi));
      existing.addEventListener("error", () => reject(new Error("load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.faceapi = "1";
    s.onload = () => resolve(window.faceapi);
    s.onerror = () => reject(new Error("load failed"));
    document.head.appendChild(s);
  });
}

// Load the library + the three models once. Resolves with the faceapi object.
export async function ensureFace() {
  if (_ready) return _ready;
  _ready = (async () => {
    const faceapi = await loadScript("/vendor/face-api.js");
    if (!faceapi) throw new Error("faceapi unavailable");
    await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
    await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
    await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
    return faceapi;
  })().catch((e) => { _ready = null; throw e; });
  return _ready;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Compute a 128-d face descriptor from an image data URL, or null if no single
// face is found / models unavailable.
export async function descriptorFromDataUrl(dataUrl) {
  try {
    const faceapi = await ensureFace();
    const img = await loadImage(dataUrl);
    const det = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    return det ? Array.from(det.descriptor) : null;
  } catch {
    return null;
  }
}

const centroid = (pts) => {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
};

// Assess a captured frame for registration quality: there must be exactly one
// clear, upright, reasonably-sized, centred face. Returns
// { ok, message, descriptor }. ok === null means the face models aren't
// available, so the caller should fall back to accepting the photo as-is.
export async function assessFace(dataUrl) {
  let faceapi;
  try { faceapi = await ensureFace(); } catch { return { ok: null, message: "Face check unavailable." }; }
  try {
    const img = await loadImage(dataUrl);
    const dets = await faceapi
      .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
      .withFaceLandmarks()
      .withFaceDescriptors();
    if (!dets || dets.length === 0) return { ok: false, message: "No face detected — look straight at the camera in good light." };
    if (dets.length > 1) return { ok: false, message: "More than one face in view — only the worker should be in frame." };
    const det = dets[0];
    const box = det.detection.box;
    const iw = img.width || img.naturalWidth || box.width;
    const ih = img.height || img.naturalHeight || box.height;
    // Big enough: the face should fill a good part of the frame.
    const frac = (box.width * box.height) / (iw * ih);
    if (frac < 0.05) return { ok: false, message: "Move closer — the face is too small in the frame." };
    // Upright: the eyes should be roughly level (small roll angle).
    const lm = det.landmarks;
    const lc = centroid(lm.getLeftEye());
    const rc = centroid(lm.getRightEye());
    const roll = Math.abs((Math.atan2(rc.y - lc.y, rc.x - lc.x) * 180) / Math.PI);
    const rollTilt = roll > 90 ? Math.abs(180 - roll) : roll;
    if (rollTilt > 13) return { ok: false, message: "Hold the phone upright and keep the head level, then retake." };
    // Centred: the face shouldn't be jammed against an edge.
    const cx = (box.x + box.width / 2) / iw;
    if (cx < 0.18 || cx > 0.82) return { ok: false, message: "Centre the face in the frame, then retake." };
    // Confident detection = a clear, non-blurry face.
    if (det.detection.score < 0.55) return { ok: false, message: "The face isn't clear — steady the phone in good light and retake." };
    return { ok: true, message: "Looks good.", descriptor: Array.from(det.descriptor) };
  } catch {
    return { ok: null, message: "Face check unavailable." };
  }
}

// Euclidean distance between two descriptors (lower = more similar).
export function faceDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; sum += d * d; }
  return Math.sqrt(sum);
}

// Typical 1:1 verification threshold for face-api descriptors.
export const MATCH_THRESHOLD = 0.5;
