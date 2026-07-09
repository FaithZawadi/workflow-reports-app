"use client";
import { useEffect, useState } from "react";
import { GOLD, COAL } from "@/lib/theme";

// Encourages installing the PWA as a real home-screen app that works offline.
// On Android/desktop Chrome it uses the native `beforeinstallprompt`; on iOS
// Safari (which never fires that event) it shows the Add-to-Home-Screen steps.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (standalone) return; // already installed
    try {
      if (localStorage.getItem("qsl-install-dismissed") === "1") return;
    } catch {}

    const ua = window.navigator.userAgent || "";
    const ios = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
    setIsIOS(ios);

    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // iOS never fires beforeinstallprompt — offer the manual banner there.
    if (ios) setShow(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    setIosHelp(false);
    try {
      localStorage.setItem("qsl-install-dismissed", "1");
    } catch {}
  };

  const install = async () => {
    if (isIOS) {
      setIosHelp(true);
      return;
    }
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    setDeferred(null);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Install the QSL app"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 45,
        maxWidth: 520,
        margin: "0 auto",
        background: COAL,
        color: "#fff",
        border: `1px solid ${GOLD}`,
        borderRadius: 6,
        padding: 14,
        boxShadow: "0 8px 24px rgba(0,0,0,.28)",
      }}
    >
      {!iosHelp ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span aria-hidden style={{ fontSize: 22 }}>📲</span>
          <div style={{ flex: "1 1 220px" }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Install QSL Reports</div>
            <div style={{ fontSize: 12, color: "#e7e0cf" }}>
              Add it to your home screen — opens full-screen, works offline, and syncs when you&apos;re back online.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={dismiss} className="btn" style={{ fontSize: 12, padding: "8px 10px", background: "transparent", color: "#fff", borderColor: "#5a5348" }}>
              Not now
            </button>
            <button onClick={install} className="btn" style={{ fontSize: 12, padding: "8px 12px", background: GOLD, color: COAL, borderColor: GOLD, fontWeight: 800 }}>
              {isIOS ? "How to install" : "Install app"}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>Install on iPhone / iPad</div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#e7e0cf", lineHeight: 1.5 }}>
            <li>Tap the <b>Share</b> button (the square with an arrow) in Safari.</li>
            <li>Choose <b>Add to Home Screen</b>.</li>
            <li>Tap <b>Add</b> — the QSL icon appears with your apps.</li>
          </ol>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button onClick={dismiss} className="btn" style={{ fontSize: 12, padding: "8px 12px", background: GOLD, color: COAL, borderColor: GOLD, fontWeight: 800 }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
