"use client";
import { useEffect, useState } from "react";

const COAL = "#161310", GOLD = "#F5A800", INK = "#26221C";

// One-tap install for the clocking PWA. On Android/Chrome it captures the
// browser's install prompt and installs directly; on iOS (which has no such
// prompt) it shows the Share → Add to Home Screen hint; once installed it
// confirms. If none applies, the page's manual steps still cover it.
export default function InstallClockButton() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const onBIP = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    try {
      const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone;
      if (standalone) setInstalled(true);
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
      if (isIos && !standalone) setIos(true);
    } catch {}
    return () => { window.removeEventListener("beforeinstallprompt", onBIP); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch {}
    setDeferred(null);
  };

  const box = { borderRadius: 12, padding: "14px 16px", fontWeight: 700, fontSize: 14, textAlign: "center" };

  if (installed) return <div style={{ ...box, background: "#eaf4ee", color: "#1d6b3a", border: "1px solid #bfe0cb" }}>✓ Installed — open <b>QSL Clocking</b> from your home screen.</div>;
  if (deferred) return (
    <button onClick={install} style={{ ...box, width: "100%", border: 0, background: GOLD, color: COAL, fontWeight: 800, cursor: "pointer" }}>
      ⤓ Install the Clocking app
    </button>
  );
  if (ios) return <div style={{ ...box, background: "#fff", color: INK, border: "1px solid #e6e0d2" }}>On iPhone: tap <b>Share</b> → <b>Add to Home Screen</b> to install.</div>;
  return null;
}
