"use client";
import { useEffect, useState } from "react";

// A brief branded launch screen shown when the clocking app opens, so the
// installed PWA feels like a native app on both Android and iOS (iOS has no
// automatic splash). It fades out after a moment and then unmounts.
export default function ClockSplash() {
  const [hide, setHide] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setHide(true), 1150);
    const t2 = setTimeout(() => setGone(true), 1650);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (gone) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed", inset: 0, zIndex: 9999, background: "#161310",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 20, opacity: hide ? 0 : 1, transition: "opacity .45s ease",
        pointerEvents: hide ? "none" : "auto",
        paddingBottom: "env(safe-area-inset-bottom)", paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-512.png" alt="" width={108} height={108} style={{ width: 108, height: 108, borderRadius: 26, boxShadow: "0 10px 34px #0008" }} />
      <div style={{ color: "#fff", fontFamily: "system-ui, sans-serif", fontWeight: 800, fontSize: 19, letterSpacing: 0.3 }}>QSL Clocking</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#F5A800", animation: `qslSplashDot 1s ${i * 0.15}s infinite ease-in-out` }} />
        ))}
      </div>
      <style>{`@keyframes qslSplashDot{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}`}</style>
    </div>
  );
}
