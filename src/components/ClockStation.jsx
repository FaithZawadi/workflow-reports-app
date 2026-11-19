"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { ensureFace, descriptorFromDataUrl, assessFace, faceDistance, MATCH_THRESHOLD } from "@/lib/faceClient";
import { queuePunch, flushQueue, queuedCount } from "@/lib/clockQueue";

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
  const [faceState, setFaceState] = useState("loading"); // loading | ready | off
  const [pending, setPending] = useState(0); // punches queued offline
  const [site, setSite] = useState(""); // the site this device is clocking for
  const [siteList, setSiteList] = useState([]); // best-effort datalist of sites
  const streamRef = useRef(null); // the live camera stream, shared with the confirm view
  const [selected, setSelected] = useState(null); // worker chosen for the access-control confirm

  // Remember the site per device, and offer registered sites as suggestions.
  useEffect(() => {
    try { setSite(localStorage.getItem("qsl:clockSite") || ""); } catch {}
    fetch("/api/sites").then((r) => (r.ok ? r.json() : { sites: [] })).then((d) => {
      setSiteList((d.sites || []).map((s) => s.name).filter(Boolean));
    }).catch(() => {});
  }, []);
  const saveSite = (v) => { setSite(v); try { localStorage.setItem("qsl:clockSite", v); } catch {} };

  // Preload the face models once (best-effort). Clocking still works if they fail.
  useEffect(() => {
    let cancel = false;
    ensureFace().then(() => { if (!cancel) setFaceState("ready"); }).catch(() => { if (!cancel) setFaceState("off"); });
    return () => { cancel = true; };
  }, []);

  // Start the front camera and keep it live so a punch is instant. While the
  // register sheet is open it runs its own camera (front + rear for the ID), so
  // this one is released to avoid two streams fighting over the same camera.
  useEffect(() => {
    if (showReg) return undefined;
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      } catch {
        setCamErr("Camera unavailable — allow camera access, or clocking will record without a photo.");
      }
    })();
    return () => { try { stream && stream.getTracks().forEach((t) => t.stop()); } catch {} streamRef.current = null; };
  }, [showReg]);

  const loadWorkers = useCallback(async () => {
    try {
      const r = await fetch("/api/attendance/workers");
      const d = await r.json();
      if (r.ok) setWorkers(d.workers || []);
    } catch {}
  }, []);
  useEffect(() => { loadWorkers(); }, [loadWorkers]);

  const flash = (text, ok = true) => { setToast({ text, ok }); setTimeout(() => setToast(null), 2600); };

  const refreshPending = useCallback(() => { queuedCount().then(setPending).catch(() => {}); }, []);
  // Sync any punches queued while offline, then refresh. Runs on mount and when
  // the device comes back online.
  const doFlush = useCallback(async () => {
    refreshPending();
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const n = await flushQueue().catch(() => 0);
    if (n > 0) { flash(`${n} offline punch${n > 1 ? "es" : ""} synced.`, true); await loadWorkers(); }
    refreshPending();
  }, [loadWorkers, refreshPending]);
  useEffect(() => {
    doFlush();
    const on = () => doFlush();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [doFlush]);

  // Optimistically flip a worker's state so the card and the next punch toggle
  // correctly even before the server confirms (and while offline).
  const bumpLocal = (id, type, at) => setWorkers((ws) => ws.map((x) => (x.id === id ? { ...x, lastType: type, lastAt: at } : x)));

  // One tap = clocked. The face check runs in the background purely as evidence
  // for the log (matched ✓ / ✗ is recorded), and NEVER refuses the punch or asks
  // for a second tap — the manager is operating the device and taps the right
  // person. Clocking also works with no camera / no face models at all.
  const punch = async (w) => {
    if (busyId) return;
    setBusyId(w.id);

    // Decide IN/OUT and show it immediately, so the tap feels instant.
    const type = w.lastType === "IN" ? "OUT" : "IN";
    const at = new Date().toISOString();
    bumpLocal(w.id, type, at);

    const selfie = grabFrame(videoRef.current);
    let matched = null;
    let matchScore = null;
    if (faceState === "ready" && Array.isArray(w.faceDescriptor) && w.faceDescriptor.length > 0 && selfie) {
      try {
        const desc = await descriptorFromDataUrl(selfie);
        if (desc) { const dist = faceDistance(desc, w.faceDescriptor); matchScore = Math.round(dist * 1000) / 1000; matched = dist <= MATCH_THRESHOLD; }
      } catch {}
    }

    const loc = await getLocation();
    const payload = { workerId: w.id, type, at, selfie: selfie || undefined, matched, matchScore, site: site || undefined, ...loc };
    const tag = matched === false ? " · face unverified" : "";
    const hhmm = new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const queueIt = async () => {
      await queuePunch({ id: `${w.id}-${Date.now()}`, ...payload });
      bumpLocal(w.id, type, at);
      refreshPending();
      flash(`${w.name} clocked ${type} offline — will sync${tag}`, true);
    };

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await queueIt();
      setBusyId(null);
      return;
    }
    try {
      const r = await fetch("/api/attendance/clock", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) {
        // Roll the optimistic toggle back only if the server genuinely rejected it.
        bumpLocal(w.id, w.lastType || null, w.lastAt || null);
        flash(d.error || "Could not record — try again.", false);
      } else {
        bumpLocal(w.id, d.type || type, at);
        flash(`${w.name} clocked ${d.type || type} · ${hhmm}${tag}`, true);
        await loadWorkers();
      }
    } catch {
      // Network dropped mid-punch → queue and sync later.
      await queueIt();
    }
    setBusyId(null);
  };

  const filtered = workers.filter((w) => !q.trim() || w.name.toLowerCase().includes(q.trim().toLowerCase()));

  const inCount = workers.filter((w) => w.lastType === "IN").length;

  return (
    <div style={{ minHeight: "100dvh", background: COAL, color: "#fff", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Top bar: title · site · reports */}
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #2c2720" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Clocking</div>
          <div style={{ fontSize: 11, color: "#9a9284", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{manager?.name} · {inCount} in now</div>
        </div>
        {pending > 0 && (
          <span onClick={doFlush} title="Tap to sync now" style={{ fontSize: 11, fontWeight: 800, color: "#ffb37a", background: "#000a", border: "1px solid #5a4a2a", borderRadius: 999, padding: "4px 9px", cursor: "pointer", whiteSpace: "nowrap" }}>⧖ {pending}</span>
        )}
        <a href="/attendance" style={{ color: GOLD, fontWeight: 700, fontSize: 12.5, textDecoration: "none", whiteSpace: "nowrap" }}>Reports →</a>
      </div>

      {/* Site this device is clocking for */}
      <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, background: "#1b1813", borderBottom: "1px solid #2c2720" }}>
        <span style={{ fontSize: 13, whiteSpace: "nowrap" }}>📍</span>
        <input
          list="qsl-site-list"
          value={site}
          onChange={(e) => saveSite(e.target.value)}
          placeholder="Set the site for this device…"
          style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 8, border: `1px solid ${site ? "#3a342c" : "#8a5a00"}`, background: "#211d18", color: "#fff", fontSize: 14 }}
        />
        <datalist id="qsl-site-list">
          {siteList.map((s) => <option key={s} value={s} />)}
        </datalist>
      </div>

      {/* Compact live camera (face is checked automatically on each tap) */}
      <div style={{ position: "relative", background: "#000", height: "22vh", minHeight: 120, maxHeight: 190, overflow: "hidden", flexShrink: 0 }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "5px 12px", background: "linear-gradient(transparent,#000c)", fontSize: 12, color: "#eee", textAlign: "center" }}>
          {camErr ? camErr : "Face the camera, then tap a name below"}
        </div>
        <div style={{ position: "absolute", top: 6, right: 6, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#000a", color: faceState === "ready" ? "#8fe3a6" : faceState === "off" ? "#ffb37a" : "#c9c1b0" }}>
          {faceState === "ready" ? "Face ✓" : faceState === "off" ? "No face check" : "…"}
        </div>
      </div>

      {/* Search + register */}
      <div style={{ padding: "10px 14px", display: "flex", gap: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…" style={{ flex: 1, minWidth: 0, padding: "11px 12px", borderRadius: 10, border: "1px solid #3a342c", background: "#211d18", color: "#fff", fontSize: 15 }} />
        <button onClick={() => setShowReg(true)} style={{ padding: "11px 14px", borderRadius: 10, border: 0, background: GOLD, color: COAL, fontWeight: 800, fontSize: 14, whiteSpace: "nowrap" }}>+ Worker</button>
      </div>

      {/* Worker list — one big, direct row each */}
      <div style={{ flex: 1, overflowY: "auto", padding: "2px 14px calc(24px + env(safe-area-inset-bottom,0px))", display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "#9a9284", padding: 30, fontSize: 14 }}>
            {workers.length === 0 ? "No workers yet. Tap “+ Worker” to register the first one." : "No match."}
          </div>
        )}
        {filtered.map((w) => {
          const inNow = w.lastType === "IN";
          const busyThis = busyId === w.id;
          return (
            <button key={w.id} onClick={() => setSelected(w)} disabled={!!busyId}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", border: inNow ? `1.5px solid ${PASS}` : "1.5px solid #3a342c", background: "#211d18", borderRadius: 14, padding: "10px 12px", color: "#fff", opacity: busyId && !busyThis ? 0.5 : 1 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", background: "#000", flexShrink: 0, border: "1px solid #3a342c" }}>
                {w.photo ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={w.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b6355", fontWeight: 800, fontSize: 18 }}>{w.name[0]?.toUpperCase()}</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.name}</div>
                <div style={{ fontSize: 12, color: inNow ? "#8fe3a6" : "#9a9284" }}>
                  {inNow ? `● In${w.lastAt ? " · since " + new Date(w.lastAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}` : (w.jobTitle || "Not clocked in")}
                </div>
              </div>
              <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.3, padding: "10px 14px", borderRadius: 10, background: busyThis ? "#3a342c" : inNow ? "rgba(176,58,46,.18)" : GOLD, color: busyThis ? "#c9c1b0" : inNow ? "#ff9b8e" : COAL }}>
                {busyThis ? "…" : inNow ? "Clock out" : "Clock in"}
              </span>
            </button>
          );
        })}
      </div>

      {toast && (
        <div className="app-toast" style={{ position: "fixed", left: 14, right: 14, bottom: 14, padding: "14px 16px", borderRadius: 12, background: toast.ok ? PASS : FAIL, color: "#fff", fontWeight: 700, fontSize: 15, textAlign: "center", boxShadow: "0 8px 24px #0008" }}>
          {toast.text}
        </div>
      )}

      {selected && (
        <ClockConfirm
          worker={selected}
          streamRef={streamRef}
          camErr={camErr}
          busy={busyId === selected.id}
          onApprove={async () => { const w = selected; await punch(w); setSelected(null); }}
          onCancel={() => setSelected(null)}
        />
      )}

      {showReg && (
        <RegisterWorker videoRef={videoRef} onClose={() => setShowReg(false)} onSaved={(msg) => { setShowReg(false); loadWorkers(); flash(msg || "Worker registered.", true); }} grabFrame={grabFrame} />
      )}
    </div>
  );
}

// Access-control style confirm: once a worker is chosen, their registered face
// fills the screen next to the live camera, with one big Clock IN / Clock OUT
// button to approve. No long list, no fuss.
function ClockConfirm({ worker, streamRef, camErr, busy, onApprove, onCancel }) {
  const vref = useRef(null);
  useEffect(() => {
    const s = streamRef && streamRef.current;
    if (s && vref.current) { vref.current.srcObject = s; vref.current.play().catch(() => {}); }
  }, [streamRef]);

  const inNow = worker.lastType === "IN";
  const since = worker.lastAt ? new Date(worker.lastAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const actionBg = inNow ? "#B03A2E" : "#2E7D46";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 65, background: "#0e0c0a", display: "flex", flexDirection: "column", color: "#fff" }}>
      {/* Registered face — big, like an access-control badge */}
      <div style={{ flex: 1, position: "relative", background: "#000", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {worker.photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={worker.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ fontSize: 96, fontWeight: 800, color: "#3a342c" }}>{worker.name[0]?.toUpperCase()}</div>
        )}
        <div style={{ position: "absolute", top: 12, left: 12, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "#c9c1b0", background: "#000a", padding: "3px 8px", borderRadius: 999 }}>Registered worker</div>
        {/* live camera inset for a quick visual match */}
        <div style={{ position: "absolute", bottom: 12, right: 12, width: 108, height: 144, borderRadius: 12, overflow: "hidden", border: "2px solid #F5A800", background: "#000" }}>
          <video ref={vref} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, fontSize: 9, fontWeight: 700, textAlign: "center", color: "#fff", background: "#000a", padding: "1px 0" }}>{camErr ? "no camera" : "live"}</div>
        </div>
      </div>

      {/* Identity + approve */}
      <div style={{ padding: "16px 16px calc(16px + env(safe-area-inset-bottom,0px))", background: "#161310" }}>
        <div style={{ fontWeight: 800, fontSize: 22, lineHeight: 1.1 }}>{worker.name}</div>
        <div style={{ fontSize: 13.5, color: inNow ? "#8fe3a6" : "#9a9284", marginTop: 3, marginBottom: 14 }}>
          {worker.jobTitle ? worker.jobTitle + " · " : ""}{inNow ? `● Currently IN${since ? " since " + since : ""}` : "Not clocked in"}
        </div>
        <button onClick={onApprove} disabled={busy} style={{ width: "100%", padding: 18, borderRadius: 14, border: 0, background: actionBg, color: "#fff", fontWeight: 900, fontSize: 19, letterSpacing: 0.3 }}>
          {busy ? "Saving…" : inNow ? "✓ Clock OUT" : "✓ Clock IN"}
        </button>
        <button onClick={onCancel} disabled={busy} style={{ width: "100%", padding: 13, marginTop: 8, background: "transparent", border: "1px solid #3a342c", color: "#c9c1b0", borderRadius: 12, fontWeight: 700, fontSize: 14 }}>Cancel</button>
      </div>
    </div>
  );
}

// A self-contained in-app camera used for the face selfie and the ID front/back
// photos. Shows a live preview from the chosen camera (rear for the ID, front
// for the face), a big Capture button, then Retake / Use. The face shot is
// quality-checked before it can be used. Returns a JPEG data URL.
function CaptureModal({ facing = "environment", title, hint, faceCheck = false, onDone, onClose }) {
  const vref = useRef(null);
  const streamRef = useRef(null);
  const [shot, setShot] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
        if (!active) { st.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = st;
        if (vref.current) { vref.current.srcObject = st; await vref.current.play().catch(() => {}); setReady(true); }
      } catch { setErr("Camera unavailable — allow camera access in your browser."); }
    })();
    return () => { active = false; try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {} };
  }, [facing]);

  const grab = () => {
    const v = vref.current;
    if (!v || !v.videoWidth) return setErr("Camera not ready yet — hold on a second.");
    const maxW = faceCheck ? 480 : 1280;
    const scale = Math.min(1, maxW / v.videoWidth);
    const w = Math.round(v.videoWidth * scale), h = Math.round(v.videoHeight * scale);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (facing === "user") { ctx.translate(w, 0); ctx.scale(-1, 1); } // store the face un-mirrored
    ctx.drawImage(v, 0, 0, w, h);
    setShot(c.toDataURL("image/jpeg", faceCheck ? 0.78 : 0.72));
    setErr("");
  };

  const retake = () => { setShot(""); setErr(""); };

  const use = async () => {
    if (!shot) return;
    if (faceCheck) {
      setBusy(true);
      const a = await assessFace(shot).catch(() => ({ ok: null }));
      setBusy(false);
      if (a.ok === false) return setErr(a.message || "Face not clear — tap Retake and try again.");
      onDone(shot, a.ok && Array.isArray(a.descriptor) ? a.descriptor : null);
      return;
    }
    onDone(shot, null);
  };

  const btn = (bg, color) => ({ flex: 1, padding: 15, borderRadius: 12, border: 0, background: bg, color, fontWeight: 800, fontSize: 15 });

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ position: "fixed", inset: 0, zIndex: 70, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff" }}>
        <b style={{ fontSize: 15 }}>{title}</b>
        <button onClick={onClose} style={{ background: "none", border: 0, color: "#c9c1b0", fontSize: 26, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#000" }}>
        {!shot ? (
          <video ref={vref} playsInline muted style={{ width: "100%", height: "100%", objectFit: "contain", transform: facing === "user" ? "scaleX(-1)" : "none" }} />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={shot} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        )}
        {!shot && !faceCheck && (
          <div style={{ position: "absolute", inset: "14% 6%", border: "2px dashed rgba(255,255,255,.7)", borderRadius: 14, pointerEvents: "none" }} />
        )}
        {!shot && hint && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "6px 12px 10px", background: "linear-gradient(transparent,#000c)", color: "#fff", fontSize: 12.5, textAlign: "center" }}>{hint}</div>
        )}
        {err && <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, background: FAIL, color: "#fff", padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700, textAlign: "center" }}>{err}</div>}
      </div>
      <div style={{ padding: "12px 14px calc(14px + env(safe-area-inset-bottom,0px))", display: "flex", gap: 10, background: "#111" }}>
        {!shot ? (
          <button onClick={grab} disabled={!ready} style={{ ...btn(GOLD, COAL), opacity: ready ? 1 : 0.6 }}>{ready ? "📷 Capture" : "Starting camera…"}</button>
        ) : (
          <>
            <button onClick={retake} style={btn("#2a2621", "#fff")}>↺ Retake</button>
            <button onClick={use} disabled={busy} style={btn(PASS, "#fff")}>{busy ? "Checking…" : "✓ Use photo"}</button>
          </>
        )}
      </div>
    </div>
  );
}

const DRAFT_KEY = "qsl:workerDraft";
const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") || {}; } catch { return {}; } };

function RegisterWorker({ videoRef, onClose, onSaved, grabFrame }) {
  const [draft0] = useState(loadDraft); // restored once when the sheet opens
  const [name, setName] = useState(draft0.name || "");
  const [idNumber, setIdNumber] = useState(draft0.idNumber || "");
  const [idPhoto, setIdPhoto] = useState(draft0.idPhoto || ""); // ID front
  const [idPhotoBack, setIdPhotoBack] = useState(draft0.idPhotoBack || "");
  const [cap, setCap] = useState(null); // active camera: "face" | "idFront" | "idBack"
  const [phone, setPhone] = useState(draft0.phone || "");
  const [jobTitle, setJobTitle] = useState(draft0.jobTitle || "");
  const [dailyWage, setDailyWage] = useState(draft0.dailyWage || "");
  const [gender, setGender] = useState(draft0.gender || "");
  const [address, setAddress] = useState(draft0.address || "");
  const [nextOfKin, setNextOfKin] = useState(draft0.nextOfKin || "");
  const [nextOfKinPhone, setNextOfKinPhone] = useState(draft0.nextOfKinPhone || "");
  const [photo, setPhoto] = useState(draft0.photo || "");
  const [siteId, setSiteId] = useState(draft0.siteId || "");
  const [sites, setSites] = useState([]);
  const [newSite, setNewSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteCity, setNewSiteCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [capturedDesc, setCapturedDesc] = useState(null);
  const [faceDup, setFaceDup] = useState(false); // a close face match the manager can override
  const [savedDraft, setSavedDraft] = useState(!!draft0.name || !!draft0.idNumber);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/attendance/sites").then((r) => (r.ok ? r.json() : { sites: [] })).then((d) => setSites(d.sites || [])).catch(() => {});
  }, []);

  // Auto-save a draft so a half-filled registration survives closing the sheet
  // or a reload. Images are large, so fall back to a text-only draft on quota.
  useEffect(() => {
    const d = { name, idNumber, idPhoto, idPhotoBack, phone, jobTitle, dailyWage, gender, address, nextOfKin, nextOfKinPhone, photo, siteId };
    const hasAny = Object.values(d).some((v) => v);
    try {
      if (!hasAny) { localStorage.removeItem(DRAFT_KEY); setSavedDraft(false); return; }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, idPhoto: "", idPhotoBack: "", photo: "" })); } catch {}
    }
    setSavedDraft(hasAny);
  }, [name, idNumber, idPhoto, idPhotoBack, phone, jobTitle, dailyWage, gender, address, nextOfKin, nextOfKinPhone, photo, siteId]);

  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} };
  const discardDraft = () => {
    clearDraft();
    setName(""); setIdNumber(""); setIdPhoto(""); setIdPhotoBack(""); setPhone(""); setJobTitle(""); setDailyWage("");
    setGender(""); setAddress(""); setNextOfKin(""); setNextOfKinPhone(""); setPhoto(""); setSiteId("");
    setCapturedDesc(null); setErr(""); setSavedDraft(false);
  };

  // A photo came back from the in-app camera. The face shot arrives already
  // quality-checked (upright, clear) with its descriptor; store it in the right
  // slot and close the camera.
  const onCaptured = (dataUrl, desc) => {
    if (cap === "face") { setPhoto(dataUrl); setCapturedDesc(Array.isArray(desc) ? desc : null); setFaceDup(false); }
    else if (cap === "idFront") setIdPhoto(dataUrl);
    else if (cap === "idBack") setIdPhotoBack(dataUrl);
    setCap(null); setErr("");
  };

  const addSite = async () => {
    const nm = newSiteName.trim();
    if (!nm) return setErr("Enter the new site's name.");
    setErr("");
    try {
      const r = await fetch("/api/attendance/sites", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nm, city: newSiteCity.trim() }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error || "Could not add the site.");
      setSites((arr) => (arr.some((s) => s.id === d.site.id) ? arr : [...arr, d.site].sort((a, b) => a.name.localeCompare(b.name))));
      setSiteId(d.site.id);
      setNewSite(false); setNewSiteName(""); setNewSiteCity("");
    } catch { setErr("Network problem — try again."); }
  };

  const save = async (allowFaceDuplicate = false) => {
    if (!name.trim()) return setErr("Enter the worker's name.");
    if (!idNumber.trim()) return setErr("Enter the worker's ID number.");
    if (!photo) return setErr("Take the worker's face photo — a face is required to register.");
    if (!idPhoto) return setErr("Take a photo of the FRONT of the worker's ID.");
    if (!idPhotoBack) return setErr("Take a photo of the BACK of the worker's ID.");
    setBusy(true); setErr("");
    // A face descriptor is required so the worker can be verified at clock-in AND
    // so the server can reject registering the same person twice. Reuse the one
    // computed when the photo passed the capture check, else derive it now.
    let faceDescriptor = Array.isArray(capturedDesc) ? capturedDesc : [];
    if (faceDescriptor.length === 0) {
      const d = await descriptorFromDataUrl(photo).catch(() => null);
      faceDescriptor = Array.isArray(d) ? d : [];
    }
    if (faceDescriptor.length === 0) {
      setBusy(false);
      return setErr("No face detected in the photo — face the camera in good light and retake. A clear face is required so the same person isn't registered twice.");
    }
    try {
      const r = await fetch("/api/attendance/workers", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, idNumber, idPhoto, idPhotoBack, phone, jobTitle, dailyWage, gender, address, nextOfKin, nextOfKinPhone, photo, faceDescriptor, siteId: siteId || undefined, allowFaceDuplicate }),
      });
      const d2 = await r.json();
      if (!r.ok) {
        setErr(d2.error || "Could not save.");
        // A close face match is a soft warning the manager can override; an ID
        // clash (or anything else) is not.
        setFaceDup(!!d2.faceDuplicate);
        setBusy(false);
        return;
      }
      clearDraft();
      onSaved("");
    } catch { setErr("Network problem — try again."); setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#000b", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(480px, 100%)", background: "#1b1813", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, color: "#fff", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <b style={{ fontSize: 16 }}>Register worker</b>
          <button onClick={onClose} style={{ background: "none", border: 0, color: "#c9c1b0", fontSize: 20 }}>×</button>
        </div>
        {savedDraft && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: 11.5 }}>
            <span style={{ color: "#8fe3a6" }}>● Draft saved — you can close and finish later.</span>
            <button onClick={discardDraft} style={{ background: "none", border: 0, color: "#ffb37a", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>Discard draft</button>
          </div>
        )}

        {/* Photos — all taken here with the camera (no uploads) */}
        <div style={{ fontSize: 11.5, color: "#c9c1b0", fontWeight: 700, marginBottom: 6 }}>Photos — take all three here</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 6 }}>
          <PhotoTile label="Face" img={photo} onTap={() => setCap("face")} />
          <PhotoTile label="ID front" img={idPhoto} onTap={() => setCap("idFront")} />
          <PhotoTile label="ID back" img={idPhotoBack} onTap={() => setCap("idBack")} />
        </div>
        <p style={{ fontSize: 11, color: "#9a9284", margin: "0 0 12px" }}>Tap each tile to take the photo. The face must be upright, centred and clear; hold the physical ID flat inside the frame — front and back.</p>

        <Field label="Full name" value={name} onChange={setName} placeholder="e.g. John Mwangi" />
        <Field label="ID number" value={idNumber} onChange={setIdNumber} placeholder="National ID / passport no." />

        {/* Site assignment */}
        <label style={{ display: "block", marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, color: "#c9c1b0", fontWeight: 700 }}>Assigned site</span>
          {!newSite ? (
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)} style={{ flex: 1, minWidth: 0, padding: "11px 12px", borderRadius: 10, border: "1px solid #3a342c", background: "#211d18", color: "#fff", fontSize: 15 }}>
                <option value="">— No site —</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}{s.city ? ` · ${s.city}` : ""}</option>)}
              </select>
              <button type="button" onClick={() => setNewSite(true)} style={{ padding: "0 12px", borderRadius: 10, border: "1px solid #3a342c", background: "#211d18", color: GOLD, fontWeight: 800, whiteSpace: "nowrap" }}>+ New</button>
            </div>
          ) : (
            <div style={{ marginTop: 4, padding: 10, borderRadius: 10, border: "1px solid #3a342c", background: "#201c17", display: "grid", gap: 6 }}>
              <input value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)} placeholder="New site name" style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #3a342c", background: "#211d18", color: "#fff", fontSize: 14 }} />
              <input value={newSiteCity} onChange={(e) => setNewSiteCity(e.target.value)} placeholder="Town / city (optional)" style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #3a342c", background: "#211d18", color: "#fff", fontSize: 14 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => { setNewSite(false); setNewSiteName(""); setNewSiteCity(""); }} style={{ flex: 1, padding: 9, borderRadius: 8, border: "1px solid #3a342c", background: "transparent", color: "#c9c1b0", fontWeight: 700 }}>Cancel</button>
                <button type="button" onClick={addSite} style={{ flex: 1, padding: 9, borderRadius: 8, border: 0, background: GOLD, color: COAL, fontWeight: 800 }}>Add site</button>
              </div>
            </div>
          )}
        </label>

        <Field label="Job title (optional)" value={jobTitle} onChange={setJobTitle} placeholder="e.g. Casual / Technician" />
        <Field label="Daily wage (optional)" value={dailyWage} onChange={setDailyWage} placeholder="e.g. 800" type="number" inputMode="decimal" />
        <Field label="Phone (optional)" value={phone} onChange={setPhone} placeholder="+254…" />
        <Field label="Gender (optional)" value={gender} onChange={setGender} placeholder="e.g. Male / Female" />
        <Field label="Home address (optional)" value={address} onChange={setAddress} placeholder="Estate / town" />
        <Field label="Next of kin (optional)" value={nextOfKin} onChange={setNextOfKin} placeholder="Name" />
        <Field label="Next of kin phone (optional)" value={nextOfKinPhone} onChange={setNextOfKinPhone} placeholder="+254…" />

        {err && <div style={{ color: faceDup ? "#ffcf8a" : "#ff9b8e", fontSize: 13, fontWeight: 700, margin: "6px 0" }}>{err}</div>}
        {faceDup ? (
          <button onClick={() => save(true)} disabled={busy} style={{ width: "100%", marginTop: 10, padding: 14, borderRadius: 12, border: `1px solid ${GOLD}`, background: "transparent", color: GOLD, fontWeight: 800, fontSize: 15 }}>
            {busy ? "Saving…" : "Register anyway — this is a different person"}
          </button>
        ) : (
          <button onClick={() => save(false)} disabled={busy} style={{ width: "100%", marginTop: 10, padding: 14, borderRadius: 12, border: 0, background: GOLD, color: COAL, fontWeight: 800, fontSize: 15 }}>
            {busy ? "Saving…" : "Save worker"}
          </button>
        )}
        <p style={{ fontSize: 11.5, color: "#9a9284", marginTop: 8 }}>One-time registration — a worker can’t be registered twice. Only their site can be changed later, and every change is recorded in the audit log. Workers are not given a login.</p>
      </div>

      {cap && (
        <CaptureModal
          facing={cap === "face" ? "user" : "environment"}
          faceCheck={cap === "face"}
          title={cap === "face" ? "Face photo" : cap === "idFront" ? "ID — front" : "ID — back"}
          hint={cap === "face" ? "Centre the face, hold the phone level and still." : "Fit the whole ID inside the frame — flat and in focus."}
          onDone={onCaptured}
          onClose={() => setCap(null)}
        />
      )}
    </div>
  );
}

// A square-ish capture tile: tap to open the camera; shows the photo + a ✓ once
// taken, and tapping again retakes it.
function PhotoTile({ label, img, onTap }) {
  return (
    <button type="button" onClick={onTap} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, background: "transparent", border: 0, padding: 0, cursor: "pointer", minWidth: 0 }}>
      <div style={{ width: "100%", aspectRatio: "4 / 3", borderRadius: 10, overflow: "hidden", background: "#000", border: `1.5px solid ${img ? PASS : "#8a5a00"}`, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {img ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <span style={{ position: "absolute", top: 3, right: 3, background: PASS, color: "#fff", fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 999 }}>✓</span>
          </>
        ) : (
          <span style={{ color: "#c79a3d", fontSize: 22, fontWeight: 300 }}>＋</span>
        )}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: img ? "#8fe3a6" : "#c9c1b0" }}>{img ? "Retake" : label}</span>
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", inputMode }) {
  return (
    <label style={{ display: "block", marginBottom: 8 }}>
      <span style={{ fontSize: 11.5, color: "#c9c1b0", fontWeight: 700 }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} inputMode={inputMode} min={type === "number" ? 0 : undefined}
        style={{ width: "100%", marginTop: 3, padding: "11px 12px", borderRadius: 10, border: "1px solid #3a342c", background: "#211d18", color: "#fff", fontSize: 15 }} />
    </label>
  );
}
