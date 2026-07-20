import QRCode from "qrcode";

const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

// A QR-code PNG data URL for a verification link. Returns null on failure so a
// PDF simply omits the QR rather than breaking.
export async function qrDataUrl(text) {
  if (!text) return null;
  try {
    return await QRCode.toDataURL(String(text), {
      margin: 1,
      width: 240,
      errorCorrectionLevel: "M",
      color: { dark: "#161310", light: "#ffffff" },
    });
  } catch {
    return null;
  }
}

// Build an absolute verification URL from an app-relative path.
export function verifyUrl(path) {
  return `${appUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
}
