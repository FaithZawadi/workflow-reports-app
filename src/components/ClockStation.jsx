"use client";
import { useEffect, useRef, useState, useCallback } from "react";

const GOLD = "#F5A800";
const COAL = "#161310";
const PASS = "#2E7D46";
const FAIL = "#B03A2E";

// Draw the current video frame to a downscaled JPEG data URL (small enough to
// store per punch). Returns "" if the video isn't ready.
function grabFrame(video) {
  if (!video || !video.videoWidth) return "";
  const maxW = 420;
  const scale = Math.min(1, maxW / video.videoWidth);
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.7);
}

// Best-effort location — never blocks a punch for more than ~4s.
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    const done = (v) => resolve(v);
    const t = setTimeout(() => done({}), 4000);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); done({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => { clearTimeout(t); done({}); },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
    );
  });
}

export default function ClockStation({ manager }) {
  const videoRef = useRef(null);
  const [camErr, setCamErr] = useState("");
  const [workers, setWorkers] = useState([]);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null); // { text, ok }
  const [showReg, setShowReg] = useState(false);

  // Start the front camera once; keep it live so a punch is instant.
  useEffect(() => {
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      } catch {
        setCamErr("Camera unavailable — allow camera access, or clocking will record without a photo.");
      }
    })();
    return () => { try { stream && stream.getTracks().forEach((t) => t.stop()); } catch {} };
  }, []);

  const loadWorkers = useCallback(async () => {
    try {
      const r = await fetch("/api/attendance/workers");
      const d = await r.json();
      if (r.ok) setWorkers(d.workers || []);
    } catch {}
  }, []);
  useEffect(() => { loadWorkers(); }, [loadWorkers]);

  const flash = (text, ok = true) => { setToast({ text, ok }); setTimeout(() => setToast(null), 2600); };

  const punch = async (w) => {
    if (busyId) return;
    setBusyId(w.id);
    const selfie = grabFrame(videoRef.current);
    const loc = await getLocation();
    try {
      const r = await fetch("/api/attendance/clock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workerId: w.id, selfie: selfie || undefined, ...loc }),
      });
      const d = await r.json();
      if (!r.ok) { flash(d.error || "Could not record.", false); }
      else {
        flash(`${w.name} clocked ${d.type} · ${new Date(d.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`, true);
        await loadWorkers();
      }
    } catch { flash("Network problem — try again.", false); }
    setBusyId(null);
  };

  const filtered = workers.filter((w) => !q.trim() || w.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div style={{ minHeight: "100vh", background: COAL, color: "#fff", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, borderBottom: "1px solid #2c2720" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Clocking station</div>
          <div style={{ fontSize: 11.5, color: "#c9c1b0" }}>Operated by {manager?.name}</div>
        </div>
        <a href="/attendance" style={{ color: GOLD, fontWeight: 700, fontSize: 12.5, textDecoration: "none" }}>Reports →</a>
      </div>

      {/* Live camera */}
      <div style={{ position: "relative", background: "#000", aspectRatio: "4 / 3", maxHeight: "38vh", overflow: "hidden" }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "6px 12px", background: "linear-gradient(transparent,#000a)", fontSize: 12, color: "#eee", textAlign: "center" }}>
          {camErr ? camErr : "Look at the camera, then tap your name to clock in or out"}
        </div>
      </div>

      {/* Search + register */}
      <div style={{ padding: "10px 12px", display: "flex", gap: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…" style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #3a342c", background: "#211d18", color: "#fff", fontSize: 15 }} />
        <button onClick={() => setShowReg(true)} style={{ padding: "10px 14px", borderRadius: 10, border: 0, background: GOLD, color: COAL, fontWeight: 800, fontSize: 14 }}>+ Worker</button>
      </div>

      {/* Worker grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 12px 90px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, alignContent: "start" }}>
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#9a9284", padding: 30, fontSize: 14 }}>
            {workers.length === 0 ? "No workers yet. Tap “+ Worker” to register the first one." : "No match."}
          </div>
        )}
        {filtered.map((w) => {
          const inNow = w.lastType === "IN";
          return (
            <button key={w.id} onClick={() => punch(w)} disabled={!!busyId}
              style={{ textAlign: "left", border: inNow ? `2px solid ${PASS}` : "2px solid #3a342c", background: "#211d18", borderRadius: 14, padding: 10, color: "#fff", opacity: busyId && busyId !== w.id ? 0.5 : 1 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 46, height: 46, borderRadius: "50%", overflow: "hidden", background: "#000", flexShrink: 0, border: "1px solid #3a342c" }}>
                  {w.photo ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={w.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b6355", fontWeight: 800 }}>{w.name[0]?.toUpperCase()}</div>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.name}</div>
                  {w.jobTitle ? <div style={{ fontSize: 11, color: "#9a9284" }}>{w.jobTitle}</div> : null}
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: inNow ? "#8fe3a6" : "#c9c1b0" }}>
                {busyId === w.id ? "Saving…" : inNow ? `● In · tap to clock OUT` : `Tap to clock IN`}
              </div>
            </button>
          );
        })}
      </div>

      {toast && (
        <div style={{ position: "fixed", left: 16, right: 16, bottom: 16, padding: "14px 16px", borderRadius: 12, background: toast.ok ? PASS : FAIL, color: "#fff", fontWeight: 700, fontSize: 15, textAlign: "center", boxShadow: "0 8px 24px #0008" }}>
          {toast.text}
        </div>
      )}

      {showReg && (
        <RegisterWorker videoRef={videoRef} onClose={() => setShowReg(false)} onSaved={() => { setShowReg(false); loadWorkers(); flash("Worker registered.", true); }} grabFrame={grabFrame} />
      )}
    </div>
  );
}

function RegisterWorker({ videoRef, onClose, onSaved, grabFrame }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [photo, setPhoto] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const capture = () => { const d = grabFrame(videoRef.current); if (d) setPhoto(d); else setErr("Camera not ready — allow camera access."); };
  const save = async () => {
    if (!name.trim()) return setErr("Enter the worker's name.");
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/attendance/workers", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, phone, jobTitle, photo: photo || undefined }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not save."); setBusy(false); return; }
      onSaved();
    } catch { setErr("Network problem — try again."); setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#000b", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(480px, 100%)", background: "#1b1813", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, color: "#fff", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <b style={{ fontSize: 16 }}>Register worker</b>
          <button onClick={onClose} style={{ background: "none", border: 0, color: "#c9c1b0", fontSize: 20 }}>×</button>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", background: "#000", border: "1px solid #3a342c", flexShrink: 0 }}>
            {photo ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />) : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b6355", fontSize: 11 }}>No photo</div>}
          </div>
          <button onClick={capture} style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${GOLD}`, background: "transparent", color: GOLD, fontWeight: 800 }}>
            {photo ? "Retake photo" : "📷 Capture face photo"}
          </button>
        </div>
        <Field label="Name" value={name} onChange={setName} placeholder="e.g. John Mwangi" />
        <Field label="Job title (optional)" value={jobTitle} onChange={setJobTitle} placeholder="e.g. Casual / Technician" />
        <Field label="Phone (optional)" value={phone} onChange={setPhone} placeholder="+254…" />
        {err && <div style={{ color: "#ff9b8e", fontSize: 13, fontWeight: 700, margin: "6px 0" }}>{err}</div>}
        <button onClick={save} disabled={busy} style={{ width: "100%", marginTop: 10, padding: 14, borderRadius: 12, border: 0, background: GOLD, color: COAL, fontWeight: 800, fontSize: 15 }}>
          {busy ? "Saving…" : "Save worker"}
        </button>
        <p style={{ fontSize: 11.5, color: "#9a9284", marginTop: 8 }}>This one-time registration is what tracks the worker's attendance. They are not given a login.</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: "block", marginBottom: 8 }}>
      <span style={{ fontSize: 11.5, color: "#c9c1b0", fontWeight: 700 }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", marginTop: 3, padding: "11px 12px", borderRadius: 10, border: "1px solid #3a342c", background: "#211d18", color: "#fff", fontSize: 15 }} />
    </label>
  );
}
