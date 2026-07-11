"use client";
import { useState } from "react";
import { SectionBar } from "./ui";
import { FAIL, WAIT } from "@/lib/theme";

export default function Photos({ photos, setPhotos, max = 6 }) {
  const [msg, setMsg] = useState("");

  const getGps = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      const t = setTimeout(() => resolve(null), 8000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(t);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy || 0) });
        },
        () => {
          clearTimeout(t);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
      );
    });

  const addPhoto = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith("image/")) return setMsg("That file is not a photo.");
    setMsg("Adding photo and reading GPS…");
    const gps = await getGps();
    const takenAt = new Date();
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, 900 / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        const ctx = cv.getContext("2d");
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        const stamp =
          "QSL " +
          takenAt.toLocaleString() +
          (gps ? `  GPS ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)} (±${gps.acc}m)` : "  GPS UNAVAILABLE");
        const bh = Math.max(18, Math.round(cv.height * 0.045));
        ctx.fillStyle = "rgba(0,0,0,0.62)";
        ctx.fillRect(0, cv.height - bh, cv.width, bh);
        ctx.fillStyle = "#FFD75E";
        ctx.font = "bold " + Math.round(bh * 0.55) + "px monospace";
        ctx.textBaseline = "middle";
        ctx.fillText(stamp, 6, cv.height - bh / 2);
        setPhotos((p) => [...p, { src: cv.toDataURL("image/jpeg", 0.7), caption: "", gps, takenAt: takenAt.toISOString() }]);
        setMsg(gps ? "" : "Photo added — GPS unavailable. Allow location access to authenticate the site.");
      };
      img.onerror = () => setMsg("Could not open that photo.");
      img.src = reader.result;
    };
    reader.onerror = () => setMsg("Could not read that photo.");
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <SectionBar>Photos ({photos.length}/{max})</SectionBar>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))" }}>
        {photos.map((p, i) => (
          <div key={i} className="card" style={{ padding: 4 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.src} alt={"photo " + (i + 1)} style={{ width: "100%", height: 130, objectFit: "contain", background: "#f3eee2", borderRadius: 2 }} />
            <input
              className="input"
              spellCheck
              autoCapitalize="sentences"
              style={{ fontSize: 12, marginTop: 4, padding: "6px 8px" }}
              placeholder="What does it show?"
              value={p.caption}
              onChange={(e) => setPhotos((ps) => ps.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
            />
            <button type="button" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} style={{ background: "none", border: 0, color: FAIL, fontSize: 12, marginTop: 4 }}>
              Remove
            </button>
          </div>
        ))}
        {photos.length < max && (
          <label
            className="card"
            style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 150, borderStyle: "dashed", color: "#8a8171", cursor: "pointer" }}
          >
            <span style={{ fontSize: 30 }}>+</span>
            <span style={{ fontSize: 12, fontWeight: 800 }}>ADD PHOTO</span>
            <span style={{ fontSize: 11 }}>camera or gallery</span>
            <input
              type="file"
              accept="image/*"
              style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
              onChange={(e) => {
                addPhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      {msg && <div style={{ color: WAIT, fontWeight: 700, fontSize: 13, marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
