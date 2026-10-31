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

// Euclidean distance between two descriptors (lower = more similar).
export function faceDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; sum += d * d; }
  return Math.sqrt(sum);
}

// Typical 1:1 verification threshold for face-api descriptors.
export const MATCH_THRESHOLD = 0.5;
