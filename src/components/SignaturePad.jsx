"use client";
import { useEffect, useRef, useState } from "react";

// A lightweight draw-to-sign pad: the signer draws with mouse / finger / stylus,
// and the PNG data URL is reported via onChange on each stroke end. No external
// library. Clearing reports an empty string.
export default function SignaturePad({ onChange, height = 150, label }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [hasInk, setHasInk] = useState(false);

  // Size the canvas backing store to its displayed size × DPR for crisp lines.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      // Preserve any existing drawing across a resize.
      const prev = hasInk ? canvas.toDataURL() : null;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#14110c";
      if (prev) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, height);
        img.src = prev;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  const pos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };
  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk) setHasInk(true);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasInk) onChange && onChange(canvasRef.current.toDataURL("image/png"));
  };
  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange && onChange("");
  };

  return (
    <div>
      {label ? <div style={{ fontSize: 11, fontWeight: 700, color: "#6b6354", marginBottom: 4 }}>{label}</div> : null}
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height, border: "1px dashed #b7ad98", borderRadius: 6, background: "#fffef9", touchAction: "none", display: "block", cursor: "crosshair" }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <span style={{ fontSize: 11, color: "#8a8171" }}>{hasInk ? "Signed ✓" : "Sign above"}</span>
        <button type="button" onClick={clear} style={{ background: "none", border: 0, color: "#8a6d00", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>
          Clear
        </button>
      </div>
    </div>
  );
}
