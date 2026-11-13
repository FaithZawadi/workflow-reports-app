import fs from "fs";
import path from "path";

// The company (Qalibrated Systems) mark as a data URL for the server-side PDF
// renderer. Official documents carry the registered company logo, not the
// QaliMetric app brand, so this reads company-mark.png rather than the app
// mark. Cached after first read; returns null if the file is missing so the PDF
// falls back to the text-only header.
let cached;

export function logoDataUrl() {
  if (cached !== undefined) return cached;
  try {
    const file = path.join(process.cwd(), "public", "brand", "company-mark.png");
    cached = `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
  } catch {
    cached = null;
  }
  return cached;
}
