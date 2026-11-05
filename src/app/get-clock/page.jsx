import fs from "fs";
import path from "path";
import { qrDataUrl, verifyUrl } from "@/lib/qr";

export const metadata = { title: "Get the Clocking app — Qalibrated", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const COAL = "#161310", GOLD = "#F5A800", INK = "#26221C", MUTE = "#6b6355";

// Public page handed to staff: install the clocking-only app (clock in/out +
// worker registration). QR + "Add to Home Screen" steps, and a direct .apk
// download when one has been published to /public/qsl-clock.apk.
export default async function GetClockPage() {
  const clockUrl = verifyUrl("/clock");
  const qr = await qrDataUrl(clockUrl);
  let hasApk = false;
  try { hasApk = fs.existsSync(path.join(process.cwd(), "public", "qsl-clock.apk")); } catch {}

  const card = { background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 1px 4px #0001" };
  const stepBadge = { display: "inline-flex", width: 24, height: 24, borderRadius: "50%", background: GOLD, color: COAL, fontWeight: 800, alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 };
  const li = { display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10, fontSize: 14, color: INK };

  return (
    <div style={{ minHeight: "100vh", background: "#f3eee2", fontFamily: "system-ui, sans-serif", color: INK }}>
      <div style={{ background: COAL, color: "#fff", padding: "16px 18px" }}>
        <div style={{ fontWeight: 800, fontSize: 17 }}>QSL Clocking app</div>
        <div style={{ fontSize: 12.5, color: "#c9c1b0" }}>Staff attendance — clock in/out &amp; register workers</div>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: 16, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        {/* Scan to open */}
        <div style={card}>
          <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Scan to open</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code to open the clocking app" style={{ width: 200, height: 200, display: "block", margin: "0 auto", border: "1px solid #e6e0d2", borderRadius: 10, background: "#fff" }} />
          <p style={{ fontSize: 13, color: MUTE, textAlign: "center", marginTop: 10 }}>
            Point the phone camera here, or open<br /><b style={{ color: INK, wordBreak: "break-all" }}>{clockUrl}</b>
          </p>
          <a href="/clock" style={{ display: "block", textAlign: "center", marginTop: 12, padding: 12, borderRadius: 10, background: GOLD, color: COAL, fontWeight: 800, textDecoration: "none" }}>Open clocking app</a>
        </div>

        {/* Install */}
        <div style={card}>
          <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Install it as an app</h2>
          {hasApk && (
            <a href="/qsl-clock.apk" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 13, borderRadius: 10, background: COAL, color: "#fff", fontWeight: 800, textDecoration: "none", marginBottom: 14 }}>
              ⬇ Download Android app (.apk)
            </a>
          )}
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>Android (no download)</div>
          <div style={li}><span style={stepBadge}>1</span><span>Open the link above in <b>Chrome</b>.</span></div>
          <div style={li}><span style={stepBadge}>2</span><span>Tap the <b>⋮</b> menu → <b>Add to Home screen</b>.</span></div>
          <div style={li}><span style={stepBadge}>3</span><span>Open <b>QSL Clocking</b> from your home screen.</span></div>

          <div style={{ fontWeight: 700, fontSize: 13.5, margin: "14px 0 8px" }}>iPhone / iPad</div>
          <div style={li}><span style={stepBadge}>1</span><span>Open the link above in <b>Safari</b>.</span></div>
          <div style={li}><span style={stepBadge}>2</span><span>Tap <b>Share</b> → <b>Add to Home Screen</b>.</span></div>
          <div style={li}><span style={stepBadge}>3</span><span>Open <b>QSL Clocking</b> from your home screen.</span></div>

          <p style={{ fontSize: 12, color: MUTE, marginTop: 12 }}>
            It opens only to clocking and worker registration. Allow <b>camera</b> (and location) the first time. A manager signs in once per device.
          </p>
        </div>
      </div>
    </div>
  );
}
