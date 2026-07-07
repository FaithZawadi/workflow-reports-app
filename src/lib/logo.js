import fs from "fs";
import path from "path";

// The Qalibrated Systems mark (public/brand/mark.png) as a data URL for the
// server-side PDF renderer. Cached after first read; returns null if the file
// is missing so the PDF falls back to the text-only header.
let cached;

export function logoDataUrl() {
  if (cached !== undefined) return cached;
  try {
    const file = path.join(process.cwd(), "public", "brand", "mark.png");
    cached = `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
  } catch {
    cached = null;
  }
  return cached;
}
