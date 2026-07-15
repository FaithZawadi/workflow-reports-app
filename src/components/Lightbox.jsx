"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { GOLD } from "@/lib/theme";

// Full-screen photo viewer with zoom (buttons, wheel, double-tap, pinch), pan,
// prev/next and download. `photos` is [{ dataUrl, caption, gpsLat, gpsLng }].
export default function Lightbox({ photos, index, onClose }) {
  const [i, setI] = useState(index || 0);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const drag = useRef(null);
  const pinch = useRef(null);

  const p = photos[i];
  const reset = useCallback(() => { setScale(1); setTx(0); setTy(0); }, []);
  const go = useCallback((d) => { setI((v) => (v + d + photos.length) % photos.length); reset(); }, [photos.length, reset]);
  const clampZoom = (z) => Math.min(6, Math.max(1, z));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") setScale((z) => clampZoom(z + 0.5));
      else if (e.key === "-") setScale((z) => clampZoom(z - 0.5));
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [go, onClose]);

  const onWheel = (e) => {
    e.preventDefault();
    setScale((z) => clampZoom(z + (e.deltaY < 0 ? 0.3 : -0.3)));
  };

  // Mouse drag to pan (only useful when zoomed).
  const onMouseDown = (e) => { if (scale > 1) drag.current = { x: e.clientX - tx, y: e.clientY - ty }; };
  const onMouseMove = (e) => { if (drag.current) { setTx(e.clientX - drag.current.x); setTy(e.clientY - drag.current.y); } };
  const onMouseUp = () => { drag.current = null; };

  // Touch: one finger pans, two fingers pinch-zoom.
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTouchStart = (e) => {
    if (e.touches.length === 2) pinch.current = { d: dist(e.touches), s: scale };
    else if (e.touches.length === 1 && scale > 1) drag.current = { x: e.touches[0].clientX - tx, y: e.touches[0].clientY - ty };
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinch.current) {
      e.preventDefault();
      setScale(clampZoom(pinch.current.s * (dist(e.touches) / pinch.current.d)));
    } else if (e.touches.length === 1 && drag.current) {
      setTx(e.touches[0].clientX - drag.current.x);
      setTy(e.touches[0].clientY - drag.current.y);
    }
  };
  const onTouchEnd = () => { pinch.current = null; drag.current = null; };

  const btn = { background: "rgba(255,255,255,.14)", color: "#fff", border: "1px solid rgba(255,255,255,.28)", borderRadius: 8, width: 40, height: 40, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <div
      role="dialog"
      aria-label="Photo viewer"
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.92)", display: "flex", flexDirection: "column" }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {/* top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", color: "#fff", gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{i + 1} / {photos.length}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={btn} title="Zoom out" onClick={() => setScale((z) => clampZoom(z - 0.5))}>−</button>
          <span style={{ fontSize: 12, minWidth: 42, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
          <button style={btn} title="Zoom in" onClick={() => setScale((z) => clampZoom(z + 0.5))}>+</button>
          <button style={btn} title="Reset" onClick={reset}>⟲</button>
          <a style={{ ...btn, textDecoration: "none", width: "auto", padding: "0 12px", fontSize: 13, fontWeight: 700, background: GOLD, color: "#161310", borderColor: GOLD }} href={p.dataUrl} download={`photo-${i + 1}.jpg`}>Download</a>
          <button style={btn} title="Close" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* image stage */}
      <div
        style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: scale > 1 ? "grab" : "zoom-in", touchAction: "none" }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onDoubleClick={() => (scale > 1 ? reset() : setScale(2.5))}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {photos.length > 1 && (
          <button style={{ ...btn, position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 46, height: 46, zIndex: 2 }} onClick={() => go(-1)} aria-label="Previous">‹</button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.dataUrl}
          alt={p.caption || "photo"}
          draggable={false}
          style={{ maxWidth: "96%", maxHeight: "100%", objectFit: "contain", transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transition: drag.current || pinch.current ? "none" : "transform .12s ease-out", userSelect: "none" }}
        />
        {photos.length > 1 && (
          <button style={{ ...btn, position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 46, height: 46, zIndex: 2 }} onClick={() => go(1)} aria-label="Next">›</button>
        )}
      </div>

      {/* caption */}
      <div style={{ color: "#e7e0cf", padding: "10px 16px", fontSize: 13, textAlign: "center" }}>
        {p.caption || "(no caption)"}
        {p.gpsLat != null && (
          <span className="mono" style={{ display: "block", fontSize: 11, color: "#b9b0a0", marginTop: 2 }}>
            GPS {p.gpsLat.toFixed(5)}, {p.gpsLng.toFixed(5)}
          </span>
        )}
      </div>
    </div>
  );
}
