// Validation helpers for base64 image data URLs (report photos, LPO scans).
// Server-side callers must never trust client size limits — a crafted request
// could POST arbitrary or oversized blobs straight to the API, bloating storage
// or acting as a denial-of-service vector.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB decoded

// Is this a base64 image data URL (data:image/<type>;base64,....)?
export function isImageDataUrl(s) {
  return typeof s === "string" && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(s);
}

// Decoded byte size of a base64 data URL (0 if malformed).
export function dataUrlBytes(s) {
  if (typeof s !== "string") return 0;
  const i = s.indexOf(",");
  if (i < 0) return 0;
  const b64 = s.slice(i + 1);
  return Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
}

// True when the string is an image data URL within the size cap.
export function isValidImageUpload(s, maxBytes = MAX_IMAGE_BYTES) {
  return isImageDataUrl(s) && dataUrlBytes(s) <= maxBytes;
}
