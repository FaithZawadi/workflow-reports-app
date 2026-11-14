"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { ensureFace, descriptorFromDataUrl, faceDistance, MATCH_THRESHOLD } from "@/lib/faceClient";
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
  const pendingRef = useRef(null); // { id, ts } — mismatch override within a short window

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

  const punch = async (w) => {
    if (busyId) return;
    const selfie = grabFrame(videoRef.current);
    let matched = null;
    let matchScore = null;

    // Automatic face verification (1:1) when the worker has a registered face and
    // the models are loaded. A mismatch asks the manager to tap again to override.
    const canCheck = faceState === "ready" && Array.isArray(w.faceDescriptor) && w.faceDescriptor.length > 0 && !!selfie;
    if (canCheck) {
      setBusyId(w.id);
      const desc = await descriptorFromDataUrl(selfie);
      if (!desc) {
        setBusyId(null);
        flash(`No face detected — look at the camera and tap ${w.name.split(" ")[0]} again.`, false);
        return;
      }
      const dist = faceDistance(desc, w.faceDescriptor);
      matchScore = Math.round(dist * 1000) / 1000;
      matched = dist <= MATCH_THRESHOLD;
      if (!matched) {
        const p = pendingRef.current;
        const recent = p && p.id === w.id && Date.now() - p.ts < 8000;
        if (!recent) {
          pendingRef.current = { id: w.id, ts: Date.now() };
          setBusyId(null);
          flash(`Face didn't match ${w.name.split(" ")[0]}. Tap again within 8s to clock anyway.`, false);
          return;
        }
        // second tap within the window → manager override, record as not matched
      }
      pendingRef.current = null;
    } else {
      setBusyId(w.id);
    }

    const loc = await getLocation();
    // Decide IN/OUT on the device so offline punches keep the right direction.
    const type = w.lastType === "IN" ? "OUT" : "IN";
    const at = new Date().toISOString();
    const payload = { workerId: w.id, type, at, selfie: selfie || undefined, matched, matchScore, site: site || undefined, ...loc };
    const tag = matched === true ? " · face ✓" : matched === false ? " · face ✗ (override)" : "";
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
      if (!r.ok) { flash(d.error || "Could not record.", false); }
      else {
        bumpLocal(w.id, d.type || type, at);
        flash(`${w.name} clocked ${d.type || type} · ${hhmm}${tag}`, matched !== false);
        await loadWorkers();
      }
    } catch {
      // Network dropped mid-punch → queue and sync later.
      await queueIt();
    }
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {pending > 0 && (
            <span onClick={doFlush} title="Tap to sync now" style={{ fontSize: 11, fontWeight: 800, color: "#ffb37a", background: "#000a", border: "1px solid #5a4a2a", borderRadius: 999, padding: "3px 9px", cursor: "pointer" }}>
              ⧖ {pending} to sync
            </span>
          )}
          <a href="/attendance" style={{ color: GOLD, fontWeight: 700, fontSize: 12.5, textDecoration: "none" }}>Reports →</a>
        </div>
      </div>

      {/* Site this device is clocking for */}
      <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, background: "#1b1813", borderBottom: "1px solid #2c2720" }}>
        <span style={{ fontSize: 12, color: GOLD, fontWeight: 800, whiteSpace: "nowrap" }}>📍 Site</span>
        <input
          list="qsl-site-list"
          value={site}
          onChange={(e) => saveSite(e.target.value)}
          placeholder="Set the site for this device…"
          style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${site ? "#3a342c" : "#8a5a00"}`, background: "#211d18", color: "#fff", fontSize: 14 }}
        />
        <datalist id="qsl-site-list">
          {siteList.map((s) => <option key={s} value={s} />)}
        </datalist>
      </div>

      {/* Live camera */}
      <div style={{ position: "relative", background: "#000", aspectRatio: "4 / 3", maxHeight: "38vh", overflow: "hidden" }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "6px 12px", background: "linear-gradient(transparent,#000a)", fontSize: 12, color: "#eee", textAlign: "center" }}>
          {camErr ? camErr : "Look at the camera, then tap your name to clock in or out"}
        </div>
        <div style={{ position: "absolute", top: 8, right: 8, fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: "#000a", color: faceState === "ready" ? "#8fe3a6" : faceState === "off" ? "#ffb37a" : "#c9c1b0" }}>
          {faceState === "ready" ? "● Face check on" : faceState === "off" ? "Face check off" : "Loading face check…"}
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
        <RegisterWorker videoRef={videoRef} onClose={() => setShowReg(false)} onSaved={(msg) => { setShowReg(false); loadWorkers(); flash(msg || "Worker registered.", true); }} grabFrame={grabFrame} />
      )}
    </div>
  );
}

// Read an image file and downscale it to a JPEG data URL (ID documents can be
// large straight off a phone camera).
async function fileToDataUrl(file, max = 1280, quality = 0.72) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    let { width, height } = img;
    if (Math.max(width, height) > max) { const s = max / Math.max(width, height); width = Math.round(width * s); height = Math.round(height * s); }
    const c = document.createElement("canvas"); c.width = width; c.height = height;
    c.getContext("2d").drawImage(img, 0, 0, width, height);
    return c.toDataURL("image/jpeg", quality);
  } finally { URL.revokeObjectURL(url); }
}

function RegisterWorker({ videoRef, onClose, onSaved, grabFrame }) {
  const [name, setName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idPhoto, setIdPhoto] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [nextOfKin, setNextOfKin] = useState("");
  const [nextOfKinPhone, setNextOfKinPhone] = useState("");
  const [photo, setPhoto] = useState("");
  const [siteId, setSiteId] = useState("");
  const [sites, setSites] = useState([]);
  const [newSite, setNewSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteCity, setNewSiteCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/attendance/sites").then((r) => (r.ok ? r.json() : { sites: [] })).then((d) => setSites(d.sites || [])).catch(() => {});
  }, []);

  const capture = () => { const d = grabFrame(videoRef.current); if (d) { setPhoto(d); setErr(""); } else setErr("Camera not ready — allow camera access."); };

  const pickId = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try { setIdPhoto(await fileToDataUrl(f)); setErr(""); } catch { setErr("Couldn't read that image — try another."); }
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

  const save = async () => {
    if (!name.trim()) return setErr("Enter the worker's name.");
    if (!idNumber.trim()) return setErr("Enter the worker's ID number.");
    if (!photo) return setErr("Take the worker's face photo — a face is required to register.");
    if (!idPhoto) return setErr("Attach a photo of the worker's ID.");
    setBusy(true); setErr("");
    // A face descriptor is required so the worker can be verified at clock-in AND
    // so the server can reject registering the same person twice.
    const d = await descriptorFromDataUrl(photo).catch(() => null);
    const faceDescriptor = Array.isArray(d) ? d : [];
    if (faceDescriptor.length === 0) {
      setBusy(false);
      return setErr("No face detected in the photo — face the camera in good light and retake. A clear face is required so the same person isn't registered twice.");
    }
    try {
      const r = await fetch("/api/attendance/workers", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, idNumber, idPhoto, phone, jobTitle, gender, address, nextOfKin, nextOfKinPhone, photo, faceDescriptor, siteId: siteId || undefined }),
      });
      const d2 = await r.json();
      if (!r.ok) { setErr(d2.error || "Could not save."); setBusy(false); return; }
      onSaved("");
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
            {photo ? "Retake face" : "📷 Capture face"}
          </button>
        </div>

        <Field label="Full name" value={name} onChange={setName} placeholder="e.g. John Mwangi" />
        <Field label="ID number" value={idNumber} onChange={setIdNumber} placeholder="National ID / passport no." />

        {/* ID document attachment */}
        <label style={{ display: "block", marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, color: "#c9c1b0", fontWeight: 700 }}>ID document photo</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
            <div style={{ width: 86, height: 56, borderRadius: 8, overflow: "hidden", background: "#000", border: "1px solid #3a342c", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {idPhoto ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={idPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />) : <span style={{ color: "#6b6355", fontSize: 10 }}>No ID</span>}
            </div>
            <label style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${GOLD}`, background: "transparent", color: GOLD, fontWeight: 800, cursor: "pointer", fontSize: 13 }}>
              {idPhoto ? "Replace ID photo" : "📎 Attach ID photo"}
              <input type="file" accept="image/*" capture="environment" onChange={pickId} style={{ display: "none" }} />
            </label>
          </div>
        </label>

        {/* Site assignment */}
        <label style={{ display: "block", marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, color: "#c9c1b0", fontWeight: 700 }}>Assigned site</span>
          {!newSite ? (
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)} style={{ flex: 1, padding: "11px 12px", borderRadius: 10, border: "1px solid #3a342c", background: "#211d18", color: "#fff", fontSize: 15 }}>
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
        <Field label="Phone (optional)" value={phone} onChange={setPhone} placeholder="+254…" />
        <Field label="Gender (optional)" value={gender} onChange={setGender} placeholder="e.g. Male / Female" />
        <Field label="Home address (optional)" value={address} onChange={setAddress} placeholder="Estate / town" />
        <Field label="Next of kin (optional)" value={nextOfKin} onChange={setNextOfKin} placeholder="Name" />
        <Field label="Next of kin phone (optional)" value={nextOfKinPhone} onChange={setNextOfKinPhone} placeholder="+254…" />

        {err && <div style={{ color: "#ff9b8e", fontSize: 13, fontWeight: 700, margin: "6px 0" }}>{err}</div>}
        <button onClick={save} disabled={busy} style={{ width: "100%", marginTop: 10, padding: 14, borderRadius: 12, border: 0, background: GOLD, color: COAL, fontWeight: 800, fontSize: 15 }}>
          {busy ? "Saving…" : "Save worker"}
        </button>
        <p style={{ fontSize: 11.5, color: "#9a9284", marginTop: 8 }}>One-time registration — a worker can’t be registered twice. Only their site can be changed later, and every change is recorded in the audit log. Workers are not given a login.</p>
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
